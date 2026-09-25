import type { Job } from 'bullmq';
import { db, bookings, users, vendors, services, payments, notifications } from '@primsett/database';
import { eq, and, isNull } from 'drizzle-orm';
import { formatLagosDate, formatLagosTime, formatNaira, toMetaFormat, addMinutes } from '@primsett/utils';
import { sendWhatsAppTemplate } from '../lib/whatsapp.js';

export async function processNotification(job: Job) {
  const { bookingId, type, lateMinutes } = job.data as {
    bookingId: string;
    type: string;
    lateMinutes?: number;
  };

  // Fetch everything needed for any template in one query
  const result = await db
    .select({
      booking: bookings,
      clientPhone: users.phone,
      clientWhatsapp: users.whatsappNumber,
      clientName: users.fullName,
      vendorName: vendors.businessName,
      vendorSlug: vendors.slug,
      vendorId: vendors.id,
      serviceName: services.name,
    })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.clientId!))
    .innerJoin(vendors, eq(vendors.id, bookings.vendorId))
    .leftJoin(services, eq(services.id, bookings.serviceId!))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!result[0]) {
    console.warn(`[notifications] Booking ${bookingId} not found`);
    return;
  }

  const { booking, clientPhone, clientWhatsapp, clientName, vendorName, vendorSlug, vendorId, serviceName } = result[0];
  const scheduledAt = new Date(booking.scheduledAt);
  const dateStr = formatLagosDate(scheduledAt);
  const timeStr = formatLagosTime(scheduledAt);

  // Clients: prefer whatsappNumber if set, fall back to phone
  const clientTo = clientWhatsapp ? toMetaFormat(clientWhatsapp) : toMetaFormat(clientPhone);

  let metaId: string | null = null;
  let recipientId = booking.clientId!;

  switch (type) {

    // ── Client: booking confirmed ────────────────────────────────────────────
    case 'booking_confirmation': {
      // Fetch deposit amount from payments table
      const payment = await db
        .select({ amount: payments.amount })
        .from(payments)
        .where(eq(payments.bookingId, bookingId))
        .limit(1);

      const depositKobo = payment[0]?.amount ?? booking.depositRequiredKobo;

      metaId = await sendWhatsAppTemplate(clientTo, 'booking_confirmation', [
        clientName,
        vendorName,
        serviceName ?? 'Service',
        dateStr,
        timeStr,
        formatNaira(booking.totalPriceKobo),
        formatNaira(depositKobo),
      ]);
      break;
    }

    // ── Client: 24hr reminder ────────────────────────────────────────────────
    case 'reminder_24h':
      metaId = await sendWhatsAppTemplate(clientTo, 'reminder_24h', [
        clientName,
        vendorName,
        timeStr,
        dateStr,
      ]);
      break;

    // ── Client: 2hr reminder ─────────────────────────────────────────────────
    case 'reminder_2h':
      metaId = await sendWhatsAppTemplate(clientTo, 'reminder_2h', [
        vendorName,
        timeStr,
      ]);
      break;

    // ── Client: vendor running late warning ──────────────────────────────────
    case 'running_late': {
      const mins = lateMinutes ?? 15;
      const newTime = formatLagosTime(addMinutes(scheduledAt, mins));
      metaId = await sendWhatsAppTemplate(clientTo, 'running_late', [
        clientName,
        vendorName,
        newTime,
        String(mins),
      ]);
      break;
    }

    // ── Client: rebooking nudge (24hrs after appointment complete) ───────────
    case 'rebook_nudge':
      metaId = await sendWhatsAppTemplate(
        clientTo,
        'rebooking_nudge',
        [clientName, serviceName ?? 'your appointment', vendorName],
        vendorSlug, // URL button dynamic param: primsett.com/book/{vendorSlug}
      );
      break;

    // ── Vendor: 10-min check ─────────────────────────────────────────────────
    // Template name: vendor_10min_check — needs to be submitted to Meta.
    // Variables: {{1}} client name. Buttons: YES / LATE.
    case 'vendor_10min_check': {
      const vendorTo = await getVendorWhatsApp(vendorId);
      if (!vendorTo) break;

      if (await vendorInActiveAppointment(vendorId)) {
        console.log(`[notifications] Mute window active for vendor ${vendorId} — skipping vendor_10min_check`);
        break;
      }

      metaId = await sendWhatsAppTemplate(vendorTo, 'vendor_10min_check', [clientName]);
      recipientId = vendorId;
      break;
    }

    // ── Vendor: arrival check ────────────────────────────────────────────────
    // Template: vendor_arrival_check. Variables: {{1}} client name. Buttons: YES / WAITING.
    case 'vendor_arrival_check': {
      const vendorTo = await getVendorWhatsApp(vendorId);
      if (!vendorTo) break;

      if (await vendorInActiveAppointment(vendorId)) {
        console.log(`[notifications] Mute window active for vendor ${vendorId} — skipping vendor_arrival_check`);
        break;
      }

      metaId = await sendWhatsAppTemplate(vendorTo, 'vendor_arrival_check', [clientName]);
      recipientId = vendorId;
      break;
    }

    // ── Vendor: completion check ─────────────────────────────────────────────
    // Template: vendor_completion_check. Variables: {{1}} client name. Button: DONE.
    // DONE only marks completion — no payment action (no-escrow model).
    case 'vendor_done_check': {
      const vendorTo = await getVendorWhatsApp(vendorId);
      if (!vendorTo) break;

      metaId = await sendWhatsAppTemplate(vendorTo, 'vendor_completion_check', [clientName]);
      recipientId = vendorId;
      break;
    }

    default:
      console.warn(`[notifications] Unknown notification type: ${type}`);
      return;
  }

  if (metaId !== undefined) {
    await db.insert(notifications).values({
      bookingId,
      recipientId,
      channel: 'whatsapp',
      type,
      status: 'sent',
      metaMessageId: metaId ?? undefined,
      sentAt: new Date(),
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getVendorWhatsApp(vendorId: string): Promise<string | null> {
  const row = await db
    .select({ whatsappNumber: users.whatsappNumber })
    .from(users)
    .where(and(eq(users.id, vendorId), isNull(users.deletedAt)))
    .limit(1);

  if (!row[0]?.whatsappNumber) {
    console.warn(`[notifications] Vendor ${vendorId} has no WhatsApp number`);
    return null;
  }
  return toMetaFormat(row[0].whatsappNumber);
}

// Mechanism 3: mute window — returns true if vendor is mid-appointment
async function vendorInActiveAppointment(vendorId: string): Promise<boolean> {
  const active = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.vendorId, vendorId), eq(bookings.status, 'in_progress')))
    .limit(1);
  return active.length > 0;
}
