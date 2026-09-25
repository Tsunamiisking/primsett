import type { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import { db, bookings, payments, paymentEvents } from '@primsett/database';
import { eq, and } from 'drizzle-orm';
import { analytics } from '../../lib/analytics.js';
import type { PaystackWebhookEvent } from '../../lib/paystack.js';

export const paystackWebhookRoutes: FastifyPluginAsync = async (fastify) => {

  fastify.post('/paystack', {
    config: { rawBody: true },
  }, async (request, reply) => {
    // 1. Verify signature — reject anything that fails
    const signature = request.headers['x-paystack-signature'] as string;
    if (!verifyPaystackSignature(request.rawBody as Buffer, signature)) {
      fastify.log.warn('Paystack webhook signature verification failed');
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    // 2. Acknowledge immediately
    reply.status(200).send({ status: 'ok' });

    // 3. Process async
    processPaystackEvent(request.body as PaystackWebhookEvent).catch(
      (err: Error) => fastify.log.error(err, 'Paystack event processing failed'),
    );
  });
};

function verifyPaystackSignature(rawBody: Buffer, signature: string): boolean {
  const secret = process.env['PAYSTACK_WEBHOOK_SECRET'];
  if (!secret || !signature) return false;

  const expected = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

async function processPaystackEvent(event: PaystackWebhookEvent) {
  const { reference, status, amount } = event.data;

  // IDEMPOTENCY: check if we've already processed this reference
  const existing = await db
    .select({ id: payments.id, bookingId: payments.bookingId, status: payments.status })
    .from(payments)
    .where(eq(payments.paystackReference, reference))
    .limit(1);

  if (!existing[0]) return; // Unknown reference — not our payment

  const payment = existing[0];

  // Append to immutable event log first
  await db.insert(paymentEvents).values({
    paymentId: payment.id,
    eventType: event.event,
    payload: event as unknown as Record<string, unknown>,
  });

  // Idempotency: skip if already succeeded
  if (payment.status === 'succeeded') return;

  if (event.event === 'charge.success' && status === 'success') {
    await db.transaction(async (tx) => {
      // Vendor is paid immediately — no escrow held
      await tx
        .update(payments)
        .set({ status: 'succeeded' })
        .where(eq(payments.id, payment.id));

      // Confirm the booking
      await tx
        .update(bookings)
        .set({ status: 'confirmed', updatedAt: new Date() })
        .where(and(
          eq(bookings.id, payment.bookingId),
          eq(bookings.status, 'pending_deposit'),
        ));
    });

    // Fire booking_confirmed event
    analytics.capture({
      distinctId: payment.bookingId,
      event: 'booking_confirmed',
      properties: {
        booking_id: payment.bookingId,
        deposit_kobo: amount,
        payment_reference: reference,
      },
    });

    const { notificationsQueue, remindersQueue, digestQueue } = await import('../lib/queues.js');

    // Immediate: WhatsApp booking confirmation to client
    await notificationsQueue.add('booking_confirmation', {
      bookingId: payment.bookingId,
      type: 'booking_confirmation',
    });

    // Fetch booking details to schedule timed jobs
    const booking = await db
      .select({
        scheduledAt: bookings.scheduledAt,
        durationMinutes: bookings.durationMinutes,
        vendorId: bookings.vendorId,
      })
      .from(bookings)
      .where(eq(bookings.id, payment.bookingId))
      .limit(1);

    if (booking[0]) {
      const { scheduledAt, durationMinutes, vendorId } = booking[0];
      const apptTime = new Date(scheduledAt).getTime();
      const now = Date.now();

      // Client reminders
      const delay24h = apptTime - 24 * 3_600_000 - now;
      const delay2h = apptTime - 2 * 3_600_000 - now;
      if (delay24h > 0) {
        await remindersQueue.add('reminder_24h', { bookingId: payment.bookingId }, { delay: delay24h });
      }
      if (delay2h > 0) {
        await remindersQueue.add('reminder_2h', { bookingId: payment.bookingId }, { delay: delay2h });
      }

      // Vendor: 10-min check (per-booking, non-urgent — subject to mute window)
      const delay10min = apptTime - 10 * 60_000 - now;
      if (delay10min > 0) {
        await notificationsQueue.add(
          'vendor_10min_check',
          { bookingId: payment.bookingId, type: 'vendor_10min_check' },
          { delay: delay10min },
        );
      }

      // Vendor: arrival check (at appointment time)
      const delayArrival = apptTime - now;
      if (delayArrival > 0) {
        await notificationsQueue.add(
          'vendor_arrival_check',
          { bookingId: payment.bookingId, type: 'vendor_arrival_check' },
          { delay: delayArrival },
        );
      }

      // Vendor: done check (at appointment end time)
      const delayDone = apptTime + durationMinutes * 60_000 - now;
      if (delayDone > 0) {
        await notificationsQueue.add(
          'vendor_done_check',
          { bookingId: payment.bookingId, type: 'vendor_done_check' },
          { delay: delayDone },
        );
      }

      // Vendor digests — one per vendor per day, deduplicated by jobId
      // Lagos is UTC+1 (WAT). Night-before = 19:00 UTC. Morning-of = 06:00 UTC.
      const apptDate = new Date(apptTime);
      apptDate.setUTCHours(0, 0, 0, 0); // midnight UTC of appointment day
      const dateStr = apptDate.toISOString().slice(0, 10);

      const nightTime = new Date(apptDate.getTime() - 5 * 3_600_000); // 19:00 UTC day before = 8pm Lagos
      const morningTime = new Date(apptDate.getTime() + 6 * 3_600_000); // 06:00 UTC = 7am Lagos

      const delayNight = nightTime.getTime() - now;
      const delayMorning = morningTime.getTime() - now;

      if (delayNight > 0) {
        await digestQueue.add(
          'vendor_digest_night',
          { vendorId, date: dateStr, type: 'vendor_digest_night' },
          { delay: delayNight, jobId: `digest:night:${vendorId}:${dateStr}` },
        );
      }
      if (delayMorning > 0) {
        await digestQueue.add(
          'vendor_digest_morning',
          { vendorId, date: dateStr, type: 'vendor_digest_morning' },
          { delay: delayMorning, jobId: `digest:morning:${vendorId}:${dateStr}` },
        );
      }
    }
  }

  if (event.event === 'refund.processed') {
    await db
      .update(payments)
      .set({ status: 'refunded' })
      .where(eq(payments.id, payment.id));
  }
}
