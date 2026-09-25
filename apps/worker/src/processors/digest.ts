import type { Job } from 'bullmq';
import { db, bookings, users, services, notifications } from '@primsett/database';
import { eq, and, gte, lt, ne, isNull } from 'drizzle-orm';
import { toMetaFormat, formatLagosTime } from '@primsett/utils';
import { sendWhatsAppTemplate } from '../lib/whatsapp.js';

export async function processDigest(job: Job) {
  const { vendorId, date, type } = job.data as {
    vendorId: string;
    date: string; // "YYYY-MM-DD"
    type: 'vendor_digest_night' | 'vendor_digest_morning';
  };

  const vendorUser = await db
    .select({ whatsappNumber: users.whatsappNumber, fullName: users.fullName })
    .from(users)
    .where(and(eq(users.id, vendorId), isNull(users.deletedAt)))
    .limit(1);

  if (!vendorUser[0]?.whatsappNumber) {
    console.warn(`[digest] Vendor ${vendorId} has no WhatsApp number — skipping ${type}`);
    return;
  }

  // Bounds in Lagos time (WAT = UTC+1)
  const dayStart = new Date(`${date}T00:00:00+01:00`);
  const dayEnd = new Date(`${date}T23:59:59+01:00`);

  const dayBookings = await db
    .select({
      scheduledAt: bookings.scheduledAt,
      clientName: users.fullName,
      serviceName: services.name,
    })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.clientId!))
    .leftJoin(services, eq(services.id, bookings.serviceId!))
    .where(
      and(
        eq(bookings.vendorId, vendorId),
        gte(bookings.scheduledAt, dayStart),
        lt(bookings.scheduledAt, dayEnd),
        ne(bookings.status, 'cancelled'),
        ne(bookings.status, 'no_show'),
        isNull(bookings.deletedAt),
      ),
    )
    .orderBy(bookings.scheduledAt);

  if (dayBookings.length === 0) {
    console.log(`[digest] No bookings for vendor ${vendorId} on ${date} — skipping`);
    return;
  }

  const vendorTo = toMetaFormat(vendorUser[0].whatsappNumber);
  const vendorName = vendorUser[0].fullName;

  // Format booking list: "10:00 AM — Chioma (Acrylic full set)"
  const bookingList = dayBookings
    .map(({ scheduledAt, clientName, serviceName }) => {
      const time = formatLagosTime(new Date(scheduledAt));
      return `${time} — ${clientName}${serviceName ? ` (${serviceName})` : ''}`;
    })
    .join('\n');

  // Template names match whatsapp-templates-spec.md
  const templateName =
    type === 'vendor_digest_night' ? 'vendor_daily_digest_tomorrow' : 'vendor_daily_digest_today';

  const metaId = await sendWhatsAppTemplate(vendorTo, templateName, [vendorName, bookingList]);

  await db.insert(notifications).values({
    recipientId: vendorId,
    channel: 'whatsapp',
    type,
    status: 'sent',
    metaMessageId: metaId ?? undefined,
    sentAt: new Date(),
  });

  console.log(`[digest] Sent ${type} to vendor ${vendorId} — ${dayBookings.length} booking(s) on ${date}`);
}
