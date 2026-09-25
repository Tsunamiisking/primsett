import {
  pgTable, uuid, text, integer, boolean, timestamp,
  pgEnum, jsonb, numeric, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['vendor', 'client', 'admin']);

export const subscriptionTierEnum = pgEnum('subscription_tier', [
  'free', 'pro', 'studio',
]);

export const locationTypeEnum = pgEnum('location_type', [
  'fixed', 'mobile', 'both',
]);

export const calendarModeEnum = pgEnum('calendar_mode', ['open', 'slots']);

export const vendorPersonaEnum = pgEnum('vendor_persona', [
  'informal_solo', 'structured_solo', 'mobile_artist',
  'studio_owner', 'student',
]);

export const bookingStatusEnum = pgEnum('booking_status', [
  'pending_deposit', 'confirmed', 'in_progress', 'completed',
  'cancelled', 'no_show', 'rescheduled', 'disputed',
]);

export const bookingSourceEnum = pgEnum('booking_source', [
  'booking_page', 'marketplace', 'manual', 'offline',
]);

export const cancelledByEnum = pgEnum('cancelled_by', [
  'vendor', 'client', 'system',
]);

export const lateOutcomeEnum = pgEnum('late_outcome', [
  'fined', 'design_changed', 'rescheduled',
]);

export const paymentTypeEnum = pgEnum('payment_type', [
  'deposit', 'balance', 'refund', 'partial_refund',
  'late_fine', 'platform_fee',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending', 'processing', 'succeeded', 'failed',
  'refunded', 'in_escrow', 'disbursed', 'disputed',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'card', 'bank_transfer', 'ussd', 'mobile_money',
]);

export const depositTypeEnum = pgEnum('deposit_type', [
  'fixed', 'percentage',
]);

export const trustLevelEnum = pgEnum('trust_level', [
  'standard', 'trusted', 'blocked',
]);

export const notificationChannelEnum = pgEnum('notification_channel', [
  'whatsapp', 'in_app', 'email',
]);

export const notificationStatusEnum = pgEnum('notification_status', [
  'queued', 'sent', 'delivered', 'read', 'failed',
]);

export const availabilityTypeEnum = pgEnum('availability_type', [
  'recurring', 'override', 'block',
]);

export const portfolioSourceEnum = pgEnum('portfolio_source', [
  'whatsapp', 'in_app',
]);

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone').notNull().unique(),
  fullName: text('full_name').notNull(),
  role: userRoleEnum('role').notNull().default('client'),
  clerkUserId: text('clerk_user_id').unique(),
  whatsappNumber: text('whatsapp_number'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  phoneIdx: index('users_phone_idx').on(table.phone),
  whatsappIdx: index('users_whatsapp_idx').on(table.whatsappNumber),
  clerkIdx: uniqueIndex('users_clerk_idx').on(table.clerkUserId),
}));

// ─────────────────────────────────────────────────────────────────────────────
// VENDORS
// ─────────────────────────────────────────────────────────────────────────────

export const vendors = pgTable('vendors', {
  // Same as users.id — true 1:1
  id: uuid('id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  businessName: text('business_name').notNull(),
  slug: text('slug').notNull().unique(),
  bio: text('bio'),
  serviceTypes: text('service_types').array().notNull().default([]),
  locationType: locationTypeEnum('location_type').notNull().default('fixed'),
  locationText: text('location_text'),
  locationArea: text('location_area'),
  subscriptionTier: subscriptionTierEnum('subscription_tier')
    .notNull()
    .default('free'),
  subscriptionExpiresAt: timestamp('subscription_expires_at', {
    withTimezone: true,
  }),
  calendarMode: calendarModeEnum('calendar_mode').notNull().default('open'),
  bookingAdvanceDays: integer('booking_advance_days').notNull().default(30),
  maxDailyBookings: integer('max_daily_bookings'),
  bufferMinutes: integer('buffer_minutes').notNull().default(15),
  // Reliability score 0.00–100.00, recalculated nightly
  reliabilityScore: numeric('reliability_score', { precision: 5, scale: 2 })
    .notNull()
    .default('100.00'),
  // Denormalised for speed — updated when review is submitted
  avgRating: numeric('avg_rating', { precision: 3, scale: 2 }),
  totalClientsServed: integer('total_clients_served').notNull().default(0),
  onboardingPersona: vendorPersonaEnum('onboarding_persona'),
  priceMinKobo: integer('price_min_kobo'),
  priceMaxKobo: integer('price_max_kobo'),
  isMarketplaceListed: boolean('is_marketplace_listed')
    .notNull()
    .default(false),
  // Computed hourly by analytics worker
  rankingScore: numeric('ranking_score', { precision: 10, scale: 4 })
    .notNull()
    .default('0.0000'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  slugIdx: uniqueIndex('vendors_slug_idx').on(table.slug),
  locationIdx: index('vendors_location_idx').on(
    table.locationArea,
    table.isMarketplaceListed,
  ),
  rankingIdx: index('vendors_ranking_idx').on(table.rankingScore),
  tierIdx: index('vendors_tier_idx').on(table.subscriptionTier),
}));

// ─────────────────────────────────────────────────────────────────────────────
// SERVICES
// ─────────────────────────────────────────────────────────────────────────────

export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  // All money in kobo
  basePriceKobo: integer('base_price_kobo').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  requiresDeposit: boolean('requires_deposit').notNull().default(true),
  depositType: depositTypeEnum('deposit_type').notNull().default('percentage'),
  // Kobo if fixed. Basis points (3000 = 30%) if percentage.
  depositValue: integer('deposit_value').notNull().default(3000),
  // JSONB flexible structures — see types/src/index.ts for shapes
  intakeForm: jsonb('intake_form').$type<object[]>().default([]),
  variants: jsonb('variants').$type<object[]>().default([]),
  addons: jsonb('addons').$type<object[]>().default([]),
  locationPricing: jsonb('location_pricing').$type<object[]>().default([]),
  dayPricing: jsonb('day_pricing').$type<object[]>().default([]),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  vendorIdx: index('services_vendor_idx').on(table.vendorId),
  activeIdx: index('services_active_idx').on(table.vendorId, table.isActive),
}));

// ─────────────────────────────────────────────────────────────────────────────
// AVAILABILITY
// ─────────────────────────────────────────────────────────────────────────────

export const availability = pgTable('availability', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  type: availabilityTypeEnum('type').notNull(),
  // 0=Sunday ... 6=Saturday. NULL for specific date
  dayOfWeek: integer('day_of_week'),
  specificDate: text('specific_date'), // DATE as text YYYY-MM-DD
  startTime: text('start_time').notNull(), // HH:MM
  endTime: text('end_time').notNull(), // HH:MM
  // For slot-mode vendors (Hillary): ['08:00','10:00','12:00','14:00','16:00']
  slotTimes: text('slot_times').array(),
  isAvailable: boolean('is_available').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  vendorIdx: index('availability_vendor_idx').on(table.vendorId),
  dayIdx: index('availability_day_idx').on(table.vendorId, table.dayOfWeek),
}));

// ─────────────────────────────────────────────────────────────────────────────
// POLICIES (versioned)
// ─────────────────────────────────────────────────────────────────────────────

export const policies = pgTable('policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  version: integer('version').notNull().default(1),
  isCurrent: boolean('is_current').notNull().default(true),
  // Hours before appointment client can cancel for free
  cancellationHours: integer('cancellation_hours').notNull().default(24),
  // Basis points: 9000 = 90% refunded (Hillary: 10% deduction)
  depositRefundPct: integer('deposit_refund_pct').notNull().default(10000),
  // Hillary's ₦2,000 late fine
  lateFineKobo: integer('late_fine_kobo').notNull().default(0),
  lateThresholdMinutes: integer('late_threshold_minutes').notNull().default(15),
  // Precious: how long to wait before eligible to cancel
  waitingLimitMinutes: integer('waiting_limit_minutes').notNull().default(60),
  // Full policy text — shown to client, must be acknowledged
  customText: text('custom_text'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  vendorCurrentIdx: index('policies_vendor_current_idx').on(
    table.vendorId,
    table.isCurrent,
  ),
}));

// ─────────────────────────────────────────────────────────────────────────────
// BOOKINGS — the central entity
// ─────────────────────────────────────────────────────────────────────────────

export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id),
  clientId: uuid('client_id').references(() => users.id),
  serviceId: uuid('service_id')
    .notNull()
    .references(() => services.id),
  staffId: uuid('staff_id').references(() => users.id),
  status: bookingStatusEnum('status').notNull().default('pending_deposit'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  // All money in kobo — locked at booking time, never changes
  totalPriceKobo: integer('total_price_kobo').notNull(),
  depositRequiredKobo: integer('deposit_required_kobo').notNull(),
  depositDeadline: timestamp('deposit_deadline', { withTimezone: true }),
  // Snapshots of selections at booking time — immutable
  selectedVariant: jsonb('selected_variant').$type<object | null>(),
  selectedAddons: jsonb('selected_addons').$type<object[]>().default([]),
  intakeResponses: jsonb('intake_responses').$type<object[]>().default([]),
  // Mobile artist fields
  clientAddress: text('client_address'),
  clientArea: text('client_area'),
  // Policy snapshot
  policyVersionId: uuid('policy_version_id').references(() => policies.id),
  policyAcknowledgedAt: timestamp('policy_acknowledged_at', {
    withTimezone: true,
  }),
  // Offline sync
  isOfflineTentative: boolean('is_offline_tentative').notNull().default(false),
  // Cancellation
  cancellationReason: text('cancellation_reason'),
  cancelledBy: cancelledByEnum('cancelled_by'),
  // Late arrival flow (Hillary's 3-option system)
  lateArrivalMinutes: integer('late_arrival_minutes'),
  lateOutcome: lateOutcomeEnum('late_outcome'),
  // Mobile artist flow (Precious)
  onWaySentAt: timestamp('on_way_sent_at', { withTimezone: true }),
  clientConfirmedReadyAt: timestamp('client_confirmed_ready_at', {
    withTimezone: true,
  }),
  // Completion
  completedAt: timestamp('completed_at', { withTimezone: true }),
  source: bookingSourceEnum('source').notNull().default('booking_page'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  // Most queried indexes
  vendorScheduledIdx: index('bookings_vendor_scheduled_idx').on(
    table.vendorId,
    table.scheduledAt,
  ),
  vendorStatusIdx: index('bookings_vendor_status_idx').on(
    table.vendorId,
    table.status,
  ),
  clientVendorIdx: index('bookings_client_vendor_idx').on(
    table.clientId,
    table.vendorId,
  ),
  // deposit.expire worker queries this every minute
  depositDeadlineIdx: index('bookings_deposit_deadline_idx').on(
    table.depositDeadline,
  ),
}));

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR CLIENTS — relationship + trust + history
// ─────────────────────────────────────────────────────────────────────────────

export const vendorClients = pgTable('vendor_clients', {
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  trustLevel: trustLevelEnum('trust_level').notNull().default('standard'),
  noShowCount: integer('no_show_count').notNull().default(0),
  rescheduleCount: integer('reschedule_count').notNull().default(0),
  // Lifetime spend with this vendor (kobo)
  totalSpentKobo: integer('total_spent_kobo').notNull().default(0),
  // Hillary's carry-forward balance (kobo) — added to next invoice
  outstandingBalanceKobo: integer('outstanding_balance_kobo')
    .notNull()
    .default(0),
  // Private vendor notes — never shown to client
  vendorNotes: text('vendor_notes'),
  firstBookingAt: timestamp('first_booking_at', { withTimezone: true }),
  lastBookingAt: timestamp('last_booking_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  pk: uniqueIndex('vendor_clients_pk').on(table.vendorId, table.clientId),
}));

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENTS — financial record (append-only in spirit; no hard deletes)
// ─────────────────────────────────────────────────────────────────────────────

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id')
    .notNull()
    .references(() => bookings.id),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id),
  clientId: uuid('client_id').references(() => users.id),
  type: paymentTypeEnum('type').notNull(),
  // Always positive — direction determined by type
  amountKobo: integer('amount_kobo').notNull(),
  platformFeeKobo: integer('platform_fee_kobo').notNull().default(0),
  vendorPayoutKobo: integer('vendor_payout_kobo').notNull(),
  status: paymentStatusEnum('status').notNull().default('pending'),
  // Paystack reference for idempotency on webhook replay
  paystackReference: text('paystack_reference').unique(),
  paystackTransferCode: text('paystack_transfer_code'),
  paymentMethod: paymentMethodEnum('payment_method'),
  escrowReleaseAt: timestamp('escrow_release_at', { withTimezone: true }),
  refundReason: text('refund_reason'),
  initiatedBy: text('initiated_by'), // 'vendor' | 'client' | 'system' | 'admin'
  // Immutable — never updated
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  bookingIdx: index('payments_booking_idx').on(table.bookingId),
  vendorIdx: index('payments_vendor_idx').on(table.vendorId),
  // Idempotency check
  paystackRefIdx: uniqueIndex('payments_paystack_ref_idx').on(
    table.paystackReference,
  ),
  escrowIdx: index('payments_escrow_idx').on(table.escrowReleaseAt),
}));

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT EVENTS — immutable audit log. Never update or delete.
// ─────────────────────────────────────────────────────────────────────────────

export const paymentEvents = pgTable('payment_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id')
    .notNull()
    .references(() => payments.id),
  eventType: text('event_type').notNull(),
  // Raw webhook payload or system event data
  payload: jsonb('payload').notNull(),
  // Immutable
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  paymentIdx: index('payment_events_payment_idx').on(table.paymentId),
}));

// ─────────────────────────────────────────────────────────────────────────────
// PORTFOLIO ITEMS
// ─────────────────────────────────────────────────────────────────────────────

export const portfolioItems = pgTable('portfolio_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  serviceTag: text('service_tag'),
  serviceId: uuid('service_id').references(() => services.id),
  uploadSource: portfolioSourceEnum('upload_source').notNull(),
  // Meta message ID — prevents duplicate uploads
  whatsappMessageId: text('whatsapp_message_id').unique(),
  // False until vendor confirms via WhatsApp YES or in-app
  isPublished: boolean('is_published').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  vendorIdx: index('portfolio_vendor_idx').on(table.vendorId),
  publishedIdx: index('portfolio_published_idx').on(
    table.vendorId,
    table.isPublished,
  ),
}));

// ─────────────────────────────────────────────────────────────────────────────
// REVIEWS
// ─────────────────────────────────────────────────────────────────────────────

export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  // ONE review per booking — enforced by unique index
  bookingId: uuid('booking_id')
    .notNull()
    .references(() => bookings.id)
    .unique(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id),
  clientId: uuid('client_id')
    .notNull()
    .references(() => users.id),
  // 1–5 — CHECK constraint in migration
  rating: integer('rating').notNull(),
  body: text('body'),
  isVisible: boolean('is_visible').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  vendorIdx: index('reviews_vendor_idx').on(table.vendorId),
  bookingIdx: uniqueIndex('reviews_booking_idx').on(table.bookingId),
}));

// ─────────────────────────────────────────────────────────────────────────────
// BADGES
// ─────────────────────────────────────────────────────────────────────────────

export const badges = pgTable('badges', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  label: text('label').notNull(),
  description: text('description'),
  // Permanent = never revoked (Founding Member). False = rechecked nightly.
  isPermanent: boolean('is_permanent').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const vendorBadges = pgTable('vendor_badges', {
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  badgeId: uuid('badge_id')
    .notNull()
    .references(() => badges.id),
  earnedAt: timestamp('earned_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  // NULL for permanent badges
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (table) => ({
  pk: uniqueIndex('vendor_badges_pk').on(table.vendorId, table.badgeId),
}));

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS — WhatsApp and in-app message log
// ─────────────────────────────────────────────────────────────────────────────

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id').references(() => bookings.id),
  recipientId: uuid('recipient_id')
    .notNull()
    .references(() => users.id),
  channel: notificationChannelEnum('channel').notNull(),
  type: text('type').notNull(),
  status: notificationStatusEnum('status').notNull().default('queued'),
  // Meta WhatsApp message ID — for delivery tracking and reply matching
  metaMessageId: text('meta_message_id'),
  replyReceived: boolean('reply_received').notNull().default(false),
  replyText: text('reply_text'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  bookingTypeIdx: index('notifications_booking_type_idx').on(
    table.bookingId,
    table.type,
  ),
  recipientIdx: index('notifications_recipient_idx').on(table.recipientId),
  metaMessageIdx: index('notifications_meta_message_idx').on(
    table.metaMessageId,
  ),
}));

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONS (Drizzle relational queries)
// ─────────────────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  vendor: one(vendors, { fields: [users.id], references: [vendors.id] }),
  clientBookings: many(bookings),
  notifications: many(notifications),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  user: one(users, { fields: [vendors.id], references: [users.id] }),
  services: many(services),
  bookings: many(bookings),
  availability: many(availability),
  policies: many(policies),
  vendorClients: many(vendorClients),
  portfolioItems: many(portfolioItems),
  reviews: many(reviews),
  vendorBadges: many(vendorBadges),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  vendor: one(vendors, { fields: [bookings.vendorId], references: [vendors.id] }),
  client: one(users, { fields: [bookings.clientId], references: [users.id] }),
  service: one(services, { fields: [bookings.serviceId], references: [services.id] }),
  policy: one(policies, { fields: [bookings.policyVersionId], references: [policies.id] }),
  payments: many(payments),
  notifications: many(notifications),
  review: one(reviews, { fields: [bookings.id], references: [reviews.bookingId] }),
}));
