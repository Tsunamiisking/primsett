import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db, users, vendors, bookings, services, policies, payments, vendorClients } from '@primsett/database';
import { eq, and, isNull, ne, sql as drizzleSql } from 'drizzle-orm';
import { requireAuth, getClerkUserId } from '../middleware/auth.js';
import { calculateDeposit, platformFee } from '@primsett/utils';
import { initializeTransaction } from '../lib/paystack.js';
import { analytics } from '../lib/analytics.js';
import crypto from 'crypto';

// ─── Input schemas ─────────────────────────────────────────────────────────────

const createBookingSchema = z.object({
  vendorSlug: z.string(),
  serviceId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  clientName: z.string().min(1).max(100),
  clientPhone: z.string().min(10),
  intakeResponses: z.array(z.object({
    question_id: z.string(),
    answer: z.union([z.string(), z.array(z.string()), z.boolean()]),
  })).default([]),
  selectedVariant: z.object({
    id: z.string(),
    name: z.string(),
    price_delta_kobo: z.number().int(),
    duration_delta_minutes: z.number().int(),
  }).optional(),
  selectedAddons: z.array(z.object({
    id: z.string(),
    name: z.string(),
    price_kobo: z.number().int(),
    duration_minutes: z.number().int(),
  })).default([]),
  clientAddress: z.string().optional(),
  clientArea: z.string().optional(),
  callbackUrl: z.string().url().optional(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

export const bookingRoutes: FastifyPluginAsync = async (fastify) => {

  // ── Create booking (public — client may not be logged in) ──────────────────
  fastify.post('/bookings', async (request, reply) => {
    const body = createBookingSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: body.error.issues[0]?.message },
      });
    }
    const data = body.data;

    // 1. Look up vendor
    const vendor = await db
      .select({ id: vendors.id, businessName: vendors.businessName, bufferMinutes: vendors.bufferMinutes })
      .from(vendors)
      .innerJoin(users, eq(users.id, vendors.id))
      .where(and(eq(vendors.slug, data.vendorSlug), isNull(users.deletedAt)))
      .limit(1);

    if (!vendor[0]) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Vendor not found' },
      });
    }

    // 2. Fetch service
    const service = await db
      .select()
      .from(services)
      .where(and(
        eq(services.id, data.serviceId),
        eq(services.vendorId, vendor[0].id),
        eq(services.isActive, true),
        isNull(services.deletedAt),
      ))
      .limit(1);

    if (!service[0]) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Service not found' },
      });
    }

    const svc = service[0];

    // 3. Calculate price
    const variantDelta = data.selectedVariant?.price_delta_kobo ?? 0;
    const addonTotal = data.selectedAddons.reduce((sum, a) => sum + a.price_kobo, 0);
    const totalPriceKobo = svc.basePriceKobo + variantDelta + addonTotal;

    const variantDurationDelta = data.selectedVariant?.duration_delta_minutes ?? 0;
    const addonDuration = data.selectedAddons.reduce((sum, a) => sum + a.duration_minutes, 0);
    const durationMinutes = svc.durationMinutes + variantDurationDelta + addonDuration;

    const scheduledAt = new Date(data.scheduledAt);
    const endsAt = new Date(scheduledAt.getTime() + durationMinutes * 60_000);

    // 4. Conflict check — inside a transaction with FOR UPDATE
    const booking = await db.transaction(async (tx) => {
      const conflict = await tx.execute(
        drizzleSql`SELECT id FROM bookings
         WHERE vendor_id = ${vendor[0]!.id}
           AND status NOT IN ('cancelled','no_show','rescheduled')
           AND deleted_at IS NULL
           AND scheduled_at < ${endsAt}
           AND ends_at > ${scheduledAt}
         LIMIT 1
         FOR UPDATE`,
      );

      if ((conflict as unknown[]).length > 0) {
        throw new Error('SLOT_TAKEN');
      }

      // 5. Find or create user record for the client
      const { normalisePhone } = await import('@primsett/utils');
      const normalisedPhone = normalisePhone(data.clientPhone);

      let clientUserId: string | undefined;
      const existingUser = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.phone, normalisedPhone))
        .limit(1);

      if (existingUser[0]) {
        clientUserId = existingUser[0].id;
      } else {
        const [newUser] = await tx
          .insert(users)
          .values({ phone: normalisedPhone, fullName: data.clientName, role: 'client' })
          .returning({ id: users.id });
        clientUserId = newUser?.id;
      }

      // 6. Fetch current policy
      const policy = await tx
        .select({ id: policies.id })
        .from(policies)
        .where(and(eq(policies.vendorId, vendor[0]!.id), eq(policies.isCurrent, true)))
        .limit(1);

      const depositRequiredKobo = svc.requiresDeposit
        ? calculateDeposit(totalPriceKobo, svc.depositType, svc.depositValue)
        : 0;

      // 7. Create booking
      const [newBooking] = await tx
        .insert(bookings)
        .values({
          vendorId: vendor[0]!.id,
          clientId: clientUserId,
          serviceId: svc.id,
          status: svc.requiresDeposit ? 'pending_deposit' : 'confirmed',
          scheduledAt,
          durationMinutes,
          endsAt,
          totalPriceKobo,
          depositRequiredKobo,
          depositDeadline: svc.requiresDeposit
            ? new Date(Date.now() + 30 * 60_000) // 30 minutes to pay
            : null,
          selectedVariant: data.selectedVariant ?? null,
          selectedAddons: data.selectedAddons,
          intakeResponses: data.intakeResponses,
          clientAddress: data.clientAddress,
          clientArea: data.clientArea,
          policyVersionId: policy[0]?.id ?? null,
        })
        .returning();

      if (!newBooking) throw new Error('Failed to create booking');

      // 8. Upsert vendor_clients relationship
      if (clientUserId) {
        await tx
          .insert(vendorClients)
          .values({
            vendorId: vendor[0]!.id,
            clientId: clientUserId,
            firstBookingAt: new Date(),
            lastBookingAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [vendorClients.vendorId, vendorClients.clientId],
            set: { lastBookingAt: new Date() },
          });
      }

      return newBooking;
    }).catch((err: Error) => {
      if (err.message === 'SLOT_TAKEN') return null;
      throw err;
    });

    if (!booking) {
      return reply.status(409).send({
        success: false,
        error: { code: 'SLOT_TAKEN', message: 'This time slot is no longer available' },
      });
    }

    // 9. If deposit required, initiate Paystack payment
    let paymentUrl: string | undefined;
    if (booking.depositRequiredKobo > 0) {
      const reference = `primsett_dep_${booking.id}_${crypto.randomBytes(4).toString('hex')}`;
      const paystack = await initializeTransaction({
        email: `${data.clientPhone.replace(/\D/g, '')}@primsett.app`, // phone-based email
        amountKobo: booking.depositRequiredKobo,
        reference,
        callbackUrl: data.callbackUrl ?? `${process.env['WEB_URL']}/book/confirm?ref=${reference}`,
        metadata: {
          booking_id: booking.id,
          vendor_id: booking.vendorId,
          client_name: data.clientName,
        },
      });

      // Record pending payment
      const fee = platformFee(booking.depositRequiredKobo);
      await db.insert(payments).values({
        bookingId: booking.id,
        vendorId: booking.vendorId,
        clientId: booking.clientId ?? undefined,
        type: 'deposit',
        amountKobo: booking.depositRequiredKobo,
        platformFeeKobo: fee,
        vendorPayoutKobo: booking.depositRequiredKobo - fee,
        status: 'pending',
        paystackReference: reference,
      });

      paymentUrl = paystack.authorization_url;
    }

    analytics.capture({
      distinctId: booking.vendorId,
      event: 'booking_deposit_initiated',
      properties: {
        booking_id: booking.id,
        vendor_id: booking.vendorId,
        service_id: booking.serviceId,
        total_value_kobo: booking.totalPriceKobo,
        deposit_kobo: booking.depositRequiredKobo,
      },
    });

    return reply.status(201).send({
      success: true,
      data: {
        bookingId: booking.id,
        status: booking.status,
        scheduledAt: booking.scheduledAt,
        totalPriceKobo: booking.totalPriceKobo,
        depositRequiredKobo: booking.depositRequiredKobo,
        paymentUrl,
      },
    });
  });

  // ── Get booking by ID ──────────────────────────────────────────────────────
  fastify.get('/bookings/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, id), isNull(bookings.deletedAt)))
      .limit(1);

    if (!result[0]) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found' },
      });
    }

    return { success: true, data: result[0] };
  });

  // ── Vendor confirms booking (manual, no-deposit flow) ─────────────────────
  fastify.patch('/bookings/:id/confirm', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const clerkId = getClerkUserId(request);
    const { id } = request.params as { id: string };

    const user = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.clerkUserId, clerkId), isNull(users.deletedAt)))
      .limit(1);

    if (!user[0]) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } });
    }

    await db
      .update(bookings)
      .set({ status: 'confirmed', updatedAt: new Date() })
      .where(and(
        eq(bookings.id, id),
        eq(bookings.vendorId, user[0].id),
        ne(bookings.status, 'cancelled'),
      ));

    return { success: true, data: null };
  });

  // ── Cancel booking ─────────────────────────────────────────────────────────
  fastify.patch('/bookings/:id/cancel', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const clerkId = getClerkUserId(request);
    const { id } = request.params as { id: string };
    const { reason } = (request.body as { reason?: string }) ?? {};

    const user = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.clerkUserId, clerkId), isNull(users.deletedAt)))
      .limit(1);

    if (!user[0]) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } });
    }

    const booking = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, id), isNull(bookings.deletedAt)))
      .limit(1);

    if (!booking[0]) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } });
    }

    const isVendor = booking[0].vendorId === user[0].id;
    const isClient = booking[0].clientId === user[0].id;
    if (!isVendor && !isClient) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } });
    }

    await db
      .update(bookings)
      .set({
        status: 'cancelled',
        cancelledBy: isVendor ? 'vendor' : 'client',
        cancellationReason: reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, id));

    analytics.capture({
      distinctId: booking[0].vendorId,
      event: 'appointment_rescheduled',
      properties: { booking_id: id, cancelled_by: isVendor ? 'vendor' : 'client' },
    });

    return { success: true, data: null };
  });

  // ── Mark booking complete ──────────────────────────────────────────────────
  fastify.patch('/bookings/:id/complete', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const clerkId = getClerkUserId(request);
    const { id } = request.params as { id: string };

    const user = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.clerkUserId, clerkId), isNull(users.deletedAt)))
      .limit(1);

    if (!user[0]) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } });
    }

    const completedAt = new Date();

    await db
      .update(bookings)
      .set({ status: 'completed', completedAt, updatedAt: new Date() })
      .where(and(eq(bookings.id, id), eq(bookings.vendorId, user[0].id)));

    // Queue escrow release job — 24hrs after completion
    const { notificationsQueue } = await import('../lib/queues.js');
    await notificationsQueue.add('escrow_release', { bookingId: id }, {
      delay: 24 * 60 * 60 * 1000,
    });

    analytics.capture({
      distinctId: user[0].id,
      event: 'appointment_completed',
      properties: { booking_id: id },
    });

    return { success: true, data: null };
  });
};
