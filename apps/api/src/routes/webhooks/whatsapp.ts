import type { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import { normalisePhone } from '@primsett/utils';
import { db, users, vendors, portfolioItems, bookings, notifications } from '@primsett/database';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { analytics } from '../../lib/analytics.js';
import { rset, rget, rdel } from '../../lib/redis.js';
import { downloadMetaMedia, uploadBuffer } from '../../lib/cloudinary.js';

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Webhook Handler
//
// Handles two things:
// 1. Verification GET request from Meta (required for webhook registration)
// 2. POST events — inbound messages, delivery receipts, read receipts
//
// SECURITY: Every request verified via HMAC-SHA256 signature
// RULE: Phone numbers always normalised to E.164 before any DB lookup
// ─────────────────────────────────────────────────────────────────────────────

export const whatsappWebhookRoutes: FastifyPluginAsync = async (fastify) => {

  // ── Webhook verification (Meta calls this on setup) ──────────────────────
  fastify.get('/whatsapp', async (request, reply) => {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } =
      request.query as Record<string, string>;

    const verifyToken = process.env['WHATSAPP_VERIFY_TOKEN'];

    if (mode === 'subscribe' && token === verifyToken) {
      return reply.send(challenge);
    }

    return reply.status(403).send({ error: 'Verification failed' });
  });

  // ── Inbound messages ──────────────────────────────────────────────────────
  fastify.post('/whatsapp', {
    config: { rawBody: true }, // Need raw body for HMAC
  }, async (request, reply) => {

    // 1. Verify HMAC signature — reject anything that fails
    const signature = request.headers['x-hub-signature-256'] as string;
    if (!verifyWhatsAppSignature(request.rawBody as Buffer, signature)) {
      fastify.log.warn('WhatsApp webhook signature verification failed');
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    // 2. Acknowledge immediately — Meta requires < 5s response
    reply.status(200).send({ status: 'ok' });

    // 3. Process asynchronously — don't await
    processWhatsAppEvent(request.body as WhatsAppWebhookPayload).catch(
      (err) => fastify.log.error(err, 'WhatsApp event processing failed')
    );
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// HMAC Signature verification
// ─────────────────────────────────────────────────────────────────────────────

function verifyWhatsAppSignature(rawBody: Buffer, signature: string): boolean {
  const appSecret = process.env['WHATSAPP_APP_SECRET'];
  if (!appSecret || !signature) return false;

  const expected = `sha256=${crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')}`;

  // Constant-time comparison prevents timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Event processing
// ─────────────────────────────────────────────────────────────────────────────

async function processWhatsAppEvent(payload: WhatsAppWebhookPayload) {
  const entry = payload.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value) return;

  // Handle delivery/read status updates
  if (value.statuses) {
    await handleStatusUpdate(value.statuses);
    return;
  }

  const messages = value.messages;
  if (!messages?.length) return;

  for (const message of messages) {
    await handleInboundMessage(message, value.metadata);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Inbound message routing
// ─────────────────────────────────────────────────────────────────────────────

async function handleInboundMessage(
  message: WhatsAppMessage,
  metadata: WhatsAppMetadata
) {
  // RULE: Always normalise phone number to E.164 before DB lookup
  const senderNumber = normalisePhone(message.from);

  // Look up vendor by WhatsApp number
  const vendor = await lookupVendorByWhatsApp(senderNumber);

  if (message.type === 'image') {
    await handleImageUpload(message, vendor, senderNumber);
    return;
  }

  if (message.type === 'text') {
    const text = message.text?.body?.trim().toUpperCase() ?? '';
    await handleTextMessage(text, vendor, senderNumber, message.id);
    return;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vendor lookup — the core identification mechanism
// ─────────────────────────────────────────────────────────────────────────────

async function lookupVendorByWhatsApp(normalisedNumber: string) {
  const result = await db
    .select({
      vendorId: vendors.id,
      businessName: vendors.businessName,
      subscriptionTier: vendors.subscriptionTier,
      userId: users.id,
      fullName: users.fullName,
    })
    .from(users)
    .innerJoin(vendors, eq(vendors.id, users.id))
    .where(
      and(
        eq(users.whatsappNumber, normalisedNumber),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  return result[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Image upload pipeline
// See CLAUDE.md: WhatsApp number handling section for full flow
// ─────────────────────────────────────────────────────────────────────────────

async function handleImageUpload(
  message: WhatsAppMessage,
  vendor: VendorLookupResult | null,
  senderNumber: string
) {
  if (!vendor) {
    // Sender is not a registered vendor
    await sendWhatsAppMessage(senderNumber, {
      type: 'text',
      text: {
        body: "Hi! We couldn't find a Primsett account linked to this number. Visit primsett.app to sign up or update your WhatsApp number in settings.",
      },
    });
    return;
  }

  const imageId = message.image?.id;
  if (!imageId) return;

  // Check for duplicate — whatsapp_message_id unique constraint
  const existing = await db
    .select({ id: portfolioItems.id })
    .from(portfolioItems)
    .where(eq(portfolioItems.whatsappMessageId, message.id))
    .limit(1);

  if (existing.length > 0) return; // Already processed

  // Download image from Meta and upload to R2
  // Download from Meta and upload to Cloudinary
  const buffer = await downloadMetaMedia(imageId);
  const { url: imageUrl, thumbnailUrl } = await uploadBuffer(buffer, {
    folder: `primsett/portfolio/${vendor.vendorId}`,
    publicId: message.id,
  });

  // Insert as unpublished — awaiting vendor confirmation
  const [pending] = await db
    .insert(portfolioItems)
    .values({
      vendorId: vendor.vendorId,
      imageUrl,
      thumbnailUrl,
      uploadSource: 'whatsapp',
      whatsappMessageId: message.id,
      isPublished: false,
    })
    .returning({ id: portfolioItems.id });

  if (!pending) return;

  // Store pending item in Redis keyed by WhatsApp number — TTL 24hrs
  await rset(`pending_portfolio:${senderNumber}`, pending.id, 86400);

  // Ask vendor to confirm
  await sendWhatsAppMessage(senderNumber, {
    type: 'text',
    text: {
      body: `Got it 📸 Post this to your portfolio?\n\nReply with the service name (e.g. "acrylic chrome") or just *YES* to post.\nReply *NO* to discard.`,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Text message handling — YES/NO confirmations + reminder replies
// ─────────────────────────────────────────────────────────────────────────────

async function handleTextMessage(
  text: string,
  vendor: VendorLookupResult | null,
  senderNumber: string,
  _messageId: string
) {
  if (vendor) {
    await handleVendorText(text, vendor, senderNumber);
  } else {
    await handleClientText(text, senderNumber);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vendor text handling
// ─────────────────────────────────────────────────────────────────────────────

async function handleVendorText(
  text: string,
  vendor: NonNullable<VendorLookupResult>,
  senderNumber: string,
) {
  // ── Portfolio upload confirmation (highest priority) ──────────────────────
  const pendingItemId = await rget(`pending_portfolio:${senderNumber}`);

  if (pendingItemId) {
    if (text === 'NO') {
      await db.update(portfolioItems).set({ deletedAt: new Date() }).where(eq(portfolioItems.id, pendingItemId));
      await rdel(`pending_portfolio:${senderNumber}`);
      // Free-form reply: vendor just messaged us (sent the image), so we're in the 24hr window
      await sendWhatsAppMessage(senderNumber, { type: 'text', text: { body: 'Discarded.' } });
      return;
    }
    if (text === 'YES' || text.length > 1) {
      const serviceTag = text === 'YES' ? null : text.toLowerCase();
      await db.update(portfolioItems).set({ isPublished: true, serviceTag }).where(eq(portfolioItems.id, pendingItemId));
      await rdel(`pending_portfolio:${senderNumber}`);
      analytics.capture({
        distinctId: vendor.vendorId,
        event: 'portfolio_image_uploaded',
        properties: { vendor_id: vendor.vendorId, upload_source: 'whatsapp', has_service_tag: !!serviceTag },
      });
      await sendWhatsAppMessage(senderNumber, {
        type: 'text',
        text: { body: `Posted. View it at primsett.app/${vendor.vendorId}` },
      });
      return;
    }
  }

  // ── LATE follow-up: free-text minutes (e.g. "20" or "20 mins") ───────────
  const latePending = await rget(`late_followup:${vendor.vendorId}`);
  if (latePending) {
    const minutes = parseInt(text.replace(/\D/g, ''), 10);
    if (!isNaN(minutes) && minutes > 0) {
      await rdel(`late_followup:${vendor.vendorId}`);
      const { notificationsQueue } = await import('../../lib/queues.js');
      await notificationsQueue.add('running_late', {
        bookingId: latePending,
        type: 'running_late',
        lateMinutes: minutes,
      });
      analytics.capture({
        distinctId: vendor.vendorId,
        event: 'late_arrival_triggered',
        properties: { booking_id: latePending, minutes_late: minutes },
      });
      // Free-form reply within 24hr window
      await sendWhatsAppMessage(senderNumber, {
        type: 'text',
        text: { body: `Got it. Client has been notified you are running about ${minutes} minutes behind.` },
      });
      return;
    }
  }

  // ── Route by last outbound notification context ───────────────────────────
  const lastNotif = await db
    .select({ id: notifications.id, type: notifications.type, bookingId: notifications.bookingId })
    .from(notifications)
    .where(and(eq(notifications.recipientId, vendor.vendorId), eq(notifications.replyReceived, false)))
    .orderBy(desc(notifications.sentAt))
    .limit(1);

  if (!lastNotif[0]) return;
  const { id: notifId, type: notifType, bookingId } = lastNotif[0];

  async function markReplied() {
    await db.update(notifications).set({ replyReceived: true, replyText: text }).where(eq(notifications.id, notifId));
  }

  // READY — acknowledge night-before digest
  if (text === 'READY' && notifType === 'vendor_digest_night') {
    await markReplied();
    await sendWhatsAppMessage(senderNumber, { type: 'text', text: { body: 'All set. See you tomorrow.' } });
    return;
  }

  // YES — 10-min check all good
  if (text === 'YES' && notifType === 'vendor_10min_check') {
    await markReplied();
    await sendWhatsAppMessage(senderNumber, { type: 'text', text: { body: 'Great, all set.' } });
    return;
  }

  // LATE — from 10-min check or arrival check: vendor is running behind for next client
  if (text === 'LATE' && (notifType === 'vendor_10min_check' || notifType === 'vendor_arrival_check') && bookingId) {
    await markReplied();
    // Store booking ID in Redis so we can match the free-text minutes reply
    await rset(`late_followup:${vendor.vendorId}`, bookingId, 3600);
    // Fetch client name for template
    const booking = await db
      .select({ clientName: users.fullName })
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.clientId!))
      .where(eq(bookings.id, bookingId))
      .limit(1);
    const clientName = booking[0]?.clientName ?? 'the client';
    // Template: vendor_late_minutes_request — {{1}} client name
    await sendWhatsAppTemplate(senderNumber, 'vendor_late_minutes_request', [clientName]);
    return;
  }

  // YES — arrival confirmed: mark booking in_progress
  if (text === 'YES' && notifType === 'vendor_arrival_check' && bookingId) {
    await markReplied();
    await db.update(bookings)
      .set({ status: 'in_progress', updatedAt: new Date() })
      .where(and(eq(bookings.id, bookingId), eq(bookings.status, 'confirmed')));
    await sendWhatsAppMessage(senderNumber, { type: 'text', text: { body: 'Perfect. Good luck!' } });
    return;
  }

  // WAITING — vendor is waiting for client who hasn't arrived
  if (text === 'WAITING' && notifType === 'vendor_arrival_check' && bookingId) {
    await markReplied();
    await rset(`waiting:${vendor.vendorId}`, bookingId, 7200);
    await sendWhatsAppMessage(senderNumber, { type: 'text', text: { body: 'Noted. We will check back shortly.' } });
    return;
  }

  // DONE — appointment complete. No payment action. Marks completion + schedules rebook nudge.
  if (text === 'DONE' && notifType === 'vendor_completion_check' && bookingId) {
    await markReplied();
    await db.update(bookings)
      .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(bookings.id, bookingId), eq(bookings.status, 'in_progress')));

    // Increment vendor lifetime completed count
    await db.update(vendors)
      .set({ totalClientsServed: sql`${vendors.totalClientsServed} + 1` })
      .where(eq(vendors.id, vendor.vendorId));

    // Schedule client rebooking nudge 24hrs after completion
    const { notificationsQueue } = await import('../../lib/queues.js');
    await notificationsQueue.add(
      'rebook_nudge',
      { bookingId, type: 'rebook_nudge' },
      { delay: 24 * 3_600_000 },
    );

    analytics.capture({
      distinctId: vendor.vendorId,
      event: 'appointment_completed',
      properties: { booking_id: bookingId, vendor_id: vendor.vendorId },
    });

    await sendWhatsAppMessage(senderNumber, {
      type: 'text',
      text: { body: 'Done! Your records have been updated and the client will receive a follow-up message.' },
    });
    return;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Client text handling
// ─────────────────────────────────────────────────────────────────────────────

async function handleClientText(text: string, senderNumber: string) {
  const client = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.phone, senderNumber), isNull(users.deletedAt)))
    .limit(1);

  if (!client[0]) return;

  const lastNotif = await db
    .select({ id: notifications.id, type: notifications.type, bookingId: notifications.bookingId })
    .from(notifications)
    .where(and(eq(notifications.recipientId, client[0].id), eq(notifications.replyReceived, false)))
    .orderBy(desc(notifications.sentAt))
    .limit(1);

  if (!lastNotif[0]) return;
  const { id: notifId, type: notifType, bookingId } = lastNotif[0];

  if (text === 'YES' && (notifType === 'reminder_24h' || notifType === 'reminder_2h') && bookingId) {
    await db.update(notifications).set({ replyReceived: true, replyText: 'YES' }).where(eq(notifications.id, notifId));
    analytics.capture({
      distinctId: client[0].id,
      event: 'reminder_confirmed',
      properties: { booking_id: bookingId, reminder_type: notifType },
    });
    // Free-form — client just messaged us (replied to our template), within 24hr window
    await sendWhatsAppMessage(senderNumber, {
      type: 'text',
      text: { body: 'Confirmed. We will see you at your appointment.' },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Delivery / read status updates
// ─────────────────────────────────────────────────────────────────────────────

async function handleStatusUpdate(statuses: WhatsAppStatus[]) {
  for (const status of statuses) {
    if (status.status === 'delivered' || status.status === 'read') {
      await db.update(notifications)
        .set({
          deliveredAt: status.status === 'delivered' ? new Date() : undefined,
          readAt: status.status === 'read' ? new Date() : undefined,
        })
        .where(eq(notifications.metaMessageId, status.id));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Send WhatsApp message via Meta Cloud API
// ─────────────────────────────────────────────────────────────────────────────

async function sendWhatsAppTemplate(to: string, templateName: string, bodyParams: string[]): Promise<void> {
  const phoneNumberId = process.env['WHATSAPP_PHONE_NUMBER_ID'];
  const accessToken = process.env['WHATSAPP_ACCESS_TOKEN'];

  await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components: bodyParams.length > 0 ? [{
          type: 'body',
          parameters: bodyParams.map((text) => ({ type: 'text', text })),
        }] : [],
      },
    }),
  });
}

async function sendWhatsAppMessage(to: string, message: object) {
  const phoneNumberId = process.env['WHATSAPP_PHONE_NUMBER_ID'];
  const accessToken = process.env['WHATSAPP_ACCESS_TOKEN'];

  await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        ...message,
      }),
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface WhatsAppWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: WhatsAppValue;
    }>;
  }>;
}

interface WhatsAppValue {
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
  metadata?: WhatsAppMetadata;
}

interface WhatsAppMessage {
  id: string;
  from: string; // Sender's number WITHOUT + prefix — always normalise
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
  text?: { body: string };
  image?: { id: string; mime_type: string };
  timestamp: string;
}

interface WhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
}

interface WhatsAppMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

type VendorLookupResult = {
  vendorId: string;
  businessName: string;
  subscriptionTier: string;
  userId: string;
  fullName: string;
} | undefined;
