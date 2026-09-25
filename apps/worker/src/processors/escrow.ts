import type { Job } from 'bullmq';
import { db, bookings, payments } from '@primsett/database';
import { eq, and } from 'drizzle-orm';

/** Release escrow 24hrs after booking completion. */
export async function processEscrowRelease(job: Job) {
  const { bookingId } = job.data as { bookingId: string };

  const booking = await db
    .select({ status: bookings.status, completedAt: bookings.completedAt })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!booking[0] || booking[0].status !== 'completed') {
    console.warn(`[escrow] Booking ${bookingId} not completed — skipping release`);
    return;
  }

  // Mark deposit payment as disbursed
  await db
    .update(payments)
    .set({ status: 'disbursed', escrowReleaseAt: new Date() })
    .where(and(
      eq(payments.bookingId, bookingId),
      eq(payments.status, 'in_escrow'),
    ));

  console.log(`[escrow] Released escrow for booking ${bookingId}`);
  // TODO Phase 2: trigger Paystack transfer to vendor's bank account
}
