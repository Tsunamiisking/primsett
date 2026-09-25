import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db, users, vendors, services, availability, policies, bookings } from '@primsett/database';
import { eq, and, isNull, sql as drizzleSql, asc } from 'drizzle-orm';
import { requireAuth, getClerkUserId } from '../middleware/auth.js';
import { uniqueSlug } from '@primsett/utils';
import { analytics } from '../lib/analytics.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveVendorId(clerkId: string): Promise<string | null> {
  const row = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.clerkUserId, clerkId), isNull(users.deletedAt)))
    .limit(1);
  return row[0]?.id ?? null;
}

// ─── Input schemas ─────────────────────────────────────────────────────────────

const onboardingSchema = z.object({
  fullName: z.string().min(2).max(100),
  businessName: z.string().min(2).max(100),
  bio: z.string().max(500).optional(),
  locationArea: z.string().max(100).optional(),
  serviceTypes: z.array(z.string()).min(1),
  staffCount: z.enum(['just_me', '2_5', '6_plus']).nullable().optional(),
  locationType: z.enum(['fixed', 'mobile', 'both']),
  locationText: z.string().max(200).optional(),
  priceMinKobo: z.number().int().nonnegative().default(0),
  priceMaxKobo: z.number().int().nonnegative().default(0),
  depositHabit: z.enum(['always', 'sometimes', 'not_yet']),
  cancellationPolicyType: z.enum(['written', 'informal', 'none']).nullable().optional(),
});

function derivePersona(
  serviceTypes: string[],
  locationType: string,
  depositHabit: string,
  cancellationPolicyType: string | null | undefined,
): 'informal_solo' | 'structured_solo' | 'mobile_artist' | 'studio_owner' | 'student' {
  if (serviceTypes.includes('Salon / studio')) return 'studio_owner';
  if (locationType === 'mobile' || locationType === 'both') return 'mobile_artist';
  if (depositHabit !== 'not_yet' && cancellationPolicyType === 'written') return 'structured_solo';
  return 'informal_solo';
}

const updateVendorSchema = z.object({
  businessName: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional(),
  serviceTypes: z.array(z.string()).optional(),
  locationType: z.enum(['fixed', 'mobile', 'both']).optional(),
  locationText: z.string().max(200).optional(),
  locationArea: z.string().max(100).optional(),
  calendarMode: z.enum(['open', 'slots']).optional(),
  bookingAdvanceDays: z.number().int().min(1).max(365).optional(),
  bufferMinutes: z.number().int().min(0).max(120).optional(),
  maxDailyBookings: z.number().int().min(1).optional().nullable(),
  isMarketplaceListed: z.boolean().optional(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

export const vendorRoutes: FastifyPluginAsync = async (fastify) => {

  // ── Onboarding: create vendor profile in one shot ──────────────────────────
  fastify.post('/vendors/onboard', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const clerkId = getClerkUserId(request);
    const body = onboardingSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: body.error.issues[0]?.message },
      });
    }
    const data = body.data;

    // Check if vendor already exists for this Clerk user
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.clerkUserId, clerkId), isNull(users.deletedAt)))
      .limit(1);

    if (existing.length > 0) {
      return reply.status(409).send({
        success: false,
        error: { code: 'ALREADY_ONBOARDED', message: 'Vendor profile already exists' },
      });
    }

    const slug = uniqueSlug(data.businessName);
    const persona = derivePersona(data.serviceTypes, data.locationType, data.depositHabit, data.cancellationPolicyType);

    await db.transaction(async (tx) => {
      // 1. Create user record
      const [user] = await tx
        .insert(users)
        .values({
          phone: `clerk:${clerkId}`,
          fullName: data.fullName,
          role: 'vendor',
          clerkUserId: clerkId,
        })
        .returning({ id: users.id });

      if (!user) throw new Error('Failed to create user');

      // 2. Create vendor profile
      await tx.insert(vendors).values({
        id: user.id,
        businessName: data.businessName,
        slug,
        bio: data.bio,
        serviceTypes: data.serviceTypes,
        locationType: data.locationType,
        locationText: data.locationText,
        locationArea: data.locationArea,
        priceMinKobo: data.priceMinKobo,
        priceMaxKobo: data.priceMaxKobo,
        onboardingPersona: persona,
      });

      // 3. Create default policy
      await tx.insert(policies).values({
        vendorId: user.id,
        cancellationHours: 24,
        lateFineKobo: 0,
      });
    });

    analytics.capture({
      distinctId: clerkId,
      event: 'onboarding_completed',
      properties: {
        persona,
        location_type: data.locationType,
        deposit_habit: data.depositHabit,
        cancellation_policy_type: data.cancellationPolicyType ?? 'none',
        service_types: data.serviceTypes,
      },
    });

    return reply.status(201).send({ success: true, data: { slug } });
  });

  // ── Get own vendor profile (authenticated) ─────────────────────────────────
  fastify.get('/vendors/me', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const clerkId = getClerkUserId(request);

    const result = await db
      .select()
      .from(users)
      .innerJoin(vendors, eq(vendors.id, users.id))
      .where(and(eq(users.clerkUserId, clerkId), isNull(users.deletedAt)))
      .limit(1);

    if (!result[0]) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Vendor profile not found' },
      });
    }

    return { success: true, data: result[0] };
  });

  // ── Update vendor profile ─────────────────────────────────────────────────
  fastify.patch('/vendors/me', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const clerkId = getClerkUserId(request);
    const body = updateVendorSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: body.error.issues[0]?.message },
      });
    }

    const user = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.clerkUserId, clerkId), isNull(users.deletedAt)))
      .limit(1);

    if (!user[0]) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Vendor not found' },
      });
    }

    await db
      .update(vendors)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(vendors.id, user[0].id));

    return { success: true, data: null };
  });

  // ── Public vendor page ─────────────────────────────────────────────────────
  fastify.get('/vendors/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const result = await db
      .select({
        vendor: vendors,
        user: { fullName: users.fullName, avatarUrl: users.avatarUrl },
      })
      .from(vendors)
      .innerJoin(users, eq(users.id, vendors.id))
      .where(and(eq(vendors.slug, slug), isNull(users.deletedAt)))
      .limit(1);

    if (!result[0]) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Vendor not found' },
      });
    }

    // Fetch active services
    const vendorServices = await db
      .select()
      .from(services)
      .where(
        and(
          eq(services.vendorId, result[0].vendor.id),
          eq(services.isActive, true),
          isNull(services.deletedAt),
        ),
      )
      .orderBy(services.sortOrder);

    analytics.capture({
      distinctId: result[0].vendor.id,
      event: 'booking_page_viewed',
      properties: { vendor_id: result[0].vendor.id, slug },
    });

    return {
      success: true,
      data: {
        ...result[0].vendor,
        ownerName: result[0].user.fullName,
        avatarUrl: result[0].user.avatarUrl,
        services: vendorServices,
      },
    };
  });

  // ── Service CRUD ──────────────────────────────────────────────────────────

  const serviceSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    basePriceKobo: z.number().int().positive(),
    durationMinutes: z.number().int().min(15).max(480),
    requiresDeposit: z.boolean().default(true),
    depositType: z.enum(['fixed', 'percentage']).default('percentage'),
    depositValue: z.number().int().min(0),
    isActive: z.boolean().default(true),
  });

  fastify.get('/vendors/me/services', { preHandler: requireAuth }, async (request, reply) => {
    const vendorId = await resolveVendorId(getClerkUserId(request));
    if (!vendorId) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Vendor not found' } });

    const rows = await db
      .select()
      .from(services)
      .where(and(eq(services.vendorId, vendorId), isNull(services.deletedAt)))
      .orderBy(asc(services.sortOrder));

    return { success: true, data: rows };
  });

  fastify.post('/vendors/me/services', { preHandler: requireAuth }, async (request, reply) => {
    const vendorId = await resolveVendorId(getClerkUserId(request));
    if (!vendorId) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Vendor not found' } });

    const body = serviceSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.issues[0]?.message } });

    const maxSort = await db
      .select({ max: drizzleSql<number>`COALESCE(MAX(${services.sortOrder}), -1)` })
      .from(services)
      .where(and(eq(services.vendorId, vendorId), isNull(services.deletedAt)));

    const [row] = await db
      .insert(services)
      .values({ ...body.data, vendorId, sortOrder: (maxSort[0]?.max ?? -1) + 1 })
      .returning();

    analytics.capture({ distinctId: vendorId, event: 'service_created', properties: { service_name: body.data.name } });
    return reply.status(201).send({ success: true, data: row });
  });

  fastify.patch('/vendors/me/services/:serviceId', { preHandler: requireAuth }, async (request, reply) => {
    const vendorId = await resolveVendorId(getClerkUserId(request));
    if (!vendorId) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Vendor not found' } });

    const { serviceId } = request.params as { serviceId: string };
    const body = serviceSchema.partial().safeParse(request.body);
    if (!body.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.issues[0]?.message } });

    const [row] = await db
      .update(services)
      .set({ ...body.data, updatedAt: new Date() })
      .where(and(eq(services.id, serviceId), eq(services.vendorId, vendorId), isNull(services.deletedAt)))
      .returning();

    if (!row) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Service not found' } });

    return { success: true, data: row };
  });

  fastify.delete('/vendors/me/services/:serviceId', { preHandler: requireAuth }, async (request, reply) => {
    const vendorId = await resolveVendorId(getClerkUserId(request));
    if (!vendorId) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Vendor not found' } });

    const { serviceId } = request.params as { serviceId: string };

    await db
      .update(services)
      .set({ deletedAt: new Date() })
      .where(and(eq(services.id, serviceId), eq(services.vendorId, vendorId), isNull(services.deletedAt)));

    return { success: true, data: null };
  });

  // ── Availability management ────────────────────────────────────────────────

  fastify.get('/vendors/me/availability', { preHandler: requireAuth }, async (request, reply) => {
    const vendorId = await resolveVendorId(getClerkUserId(request));
    if (!vendorId) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Vendor not found' } });

    const rows = await db
      .select()
      .from(availability)
      .where(and(eq(availability.vendorId, vendorId), eq(availability.type, 'recurring')))
      .orderBy(asc(availability.dayOfWeek));

    return { success: true, data: rows };
  });

  const availabilitySchema = z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    isAvailable: z.boolean().default(true),
  }));

  fastify.put('/vendors/me/availability', { preHandler: requireAuth }, async (request, reply) => {
    const vendorId = await resolveVendorId(getClerkUserId(request));
    if (!vendorId) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Vendor not found' } });

    const body = availabilitySchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.issues[0]?.message } });

    await db.transaction(async (tx) => {
      await tx.delete(availability).where(and(eq(availability.vendorId, vendorId), eq(availability.type, 'recurring')));
      if (body.data.length > 0) {
        await tx.insert(availability).values(
          body.data.map((a) => ({ ...a, vendorId, type: 'recurring' as const })),
        );
      }
    });

    analytics.capture({ distinctId: vendorId, event: 'availability_updated' });
    return { success: true, data: null };
  });

  // ── Vendor's own bookings list ─────────────────────────────────────────────
  fastify.get('/vendors/me/bookings', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const clerkId = getClerkUserId(request);
    const { status, page = '1' } = request.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * 20;

    const user = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.clerkUserId, clerkId), isNull(users.deletedAt)))
      .limit(1);

    if (!user[0]) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Vendor not found' },
      });
    }

    const conditions = [
      eq(bookings.vendorId, user[0].id),
      isNull(bookings.deletedAt),
    ];

    if (status) {
      conditions.push(drizzleSql`${bookings.status} = ${status}`);
    }

    const results = await db
      .select()
      .from(bookings)
      .where(and(...conditions))
      .orderBy(bookings.scheduledAt)
      .limit(20)
      .offset(offset);

    return { success: true, data: results };
  });
};
