// ─────────────────────────────────────────────────────────────────────────────
// Primsett — Shared Types
// All money values are in KOBO (integer). Never use floats for money.
// All timestamps are UTC. Display in Africa/Lagos (UTC+1) at the UI layer.
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = 'vendor' | 'client' | 'admin';

export type SubscriptionTier = 'free' | 'pro' | 'studio';

export type LocationType = 'fixed' | 'mobile' | 'both';

export type CalendarMode = 'open' | 'slots';

export type VendorPersona =
  | 'informal_solo'
  | 'structured_solo'
  | 'mobile_artist'
  | 'studio_owner'
  | 'student';

export type BookingStatus =
  | 'pending_deposit'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'rescheduled'
  | 'disputed';

export type BookingSource =
  | 'booking_page'
  | 'marketplace'
  | 'manual'
  | 'offline';

export type CancelledBy = 'vendor' | 'client' | 'system';

export type LateOutcome = 'fined' | 'design_changed' | 'rescheduled';

export type PaymentType =
  | 'deposit'
  | 'balance'
  | 'refund'
  | 'partial_refund'
  | 'late_fine'
  | 'platform_fee';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'in_escrow'
  | 'disbursed'
  | 'disputed';

export type PaymentMethod =
  | 'card'
  | 'bank_transfer'
  | 'ussd'
  | 'mobile_money';

export type DepositType = 'fixed' | 'percentage';

export type TrustLevel = 'standard' | 'trusted' | 'blocked';

export type NotificationChannel = 'whatsapp' | 'in_app' | 'email';

export type NotificationStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export type NotificationType =
  | 'booking_confirmation'
  | 'reminder_24h'
  | 'reminder_2h'
  | 'deposit_request'
  | 'deposit_expiring'
  | 'on_way_alert'
  | 'running_late'
  | 'rebook_nudge'
  | 'dispute_notification'
  | 'review_request';

export type AvailabilityType = 'recurring' | 'override' | 'block';

export type PortfolioUploadSource = 'whatsapp' | 'in_app';

export type BadgeSlug =
  | 'founding_member'
  | 'verified'
  | 'top_rated'
  | 'always_on_time'
  | 'rising_talent'
  | 'client_favourite'
  | 'fast_responder'
  | 'hundred_clients';

// ── Money helpers ─────────────────────────────────────────────────────────────

/** All money is stored in kobo. This type alias makes intent clear. */
export type Kobo = number;

/** Convert naira to kobo for storage */
export const toKobo = (naira: number): Kobo => Math.round(naira * 100);

/** Convert kobo to naira for display only */
export const toNaira = (kobo: Kobo): number => kobo / 100;

/** Format kobo as ₦ string for display */
export const formatNaira = (kobo: Kobo): string =>
  `₦${toNaira(kobo).toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

// ── Phone helpers ─────────────────────────────────────────────────────────────

/**
 * Normalise any Nigerian phone number to E.164 format (+2348012345678)
 * Called on write to DB and before every WhatsApp lookup.
 * Lives here in types but also re-exported from packages/utils/phone.ts
 */
export const normalisePhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  // Already has country code
  if (digits.startsWith('234') && digits.length === 13) return `+${digits}`;
  // Local format 08012345678
  if (digits.startsWith('0') && digits.length === 11)
    return `+234${digits.slice(1)}`;
  // Bare number without leading zero
  if (digits.length === 10) return `+234${digits}`;
  // Already E.164 without +
  if (digits.startsWith('234')) return `+${digits}`;
  return `+${digits}`;
};

// ── Service pricing structures (stored as JSONB) ──────────────────────────────

export interface ServiceVariant {
  id: string;
  name: string; // "Short", "Medium", "Long", "XL"
  price_delta_kobo: Kobo; // Added to base_price_kobo
  duration_delta_minutes: number; // Added to base duration
}

export interface ServiceAddon {
  id: string;
  name: string; // "Nail art", "Soak off", "Gele"
  price_kobo: Kobo;
  duration_minutes: number;
}

export interface LocationPricingTier {
  area: string; // "Island", "Mainland", "Studio"
  price_kobo: Kobo; // Overrides base price entirely for this area
}

export interface DayPricingRule {
  day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
  surcharge_kobo: Kobo; // Added on top of calculated price
}

// ── Intake form structure (stored as JSONB) ───────────────────────────────────

export type IntakeQuestionType =
  | 'text'
  | 'select'
  | 'multi_select'
  | 'image_upload'
  | 'boolean';

export interface IntakeQuestion {
  id: string;
  label: string;
  type: IntakeQuestionType;
  required: boolean;
  options?: string[]; // For select / multi_select
  placeholder?: string;
}

export interface IntakeResponse {
  question_id: string;
  answer: string | string[] | boolean;
}

// ── Booking price calculation result ─────────────────────────────────────────

export interface BookingPriceBreakdown {
  base_price_kobo: Kobo;
  variant_delta_kobo: Kobo;
  addons_kobo: Kobo;
  location_surcharge_kobo: Kobo;
  day_surcharge_kobo: Kobo;
  outstanding_balance_kobo: Kobo;
  total_kobo: Kobo;
  deposit_kobo: Kobo;
  balance_due_kobo: Kobo;
}

// ── Analytics event payload shapes ───────────────────────────────────────────

export interface AnalyticsBaseProperties {
  user_id: string;
  persona_type?: VendorPersona;
  subscription_tier?: SubscriptionTier;
  platform: 'web' | 'pwa';
  timestamp: string; // ISO 8601
}

export interface BookingConfirmedProperties extends AnalyticsBaseProperties {
  vendor_id: string;
  service_id: string;
  total_value_kobo: Kobo;
  deposit_kobo: Kobo;
  days_until_appointment: number;
  booking_source: BookingSource;
  has_variant: boolean;
  has_addons: boolean;
}

export interface OnboardingCompletedProperties extends AnalyticsBaseProperties {
  persona_type: VendorPersona;
  onboarding_path: 'A' | 'B' | 'C';
  total_duration_seconds: number;
  has_written_policy: boolean;
  collects_deposits: boolean;
  calendar_mode: CalendarMode;
  location_type: LocationType;
}

// ── API response shapes ───────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    per_page?: number;
    total?: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    field?: string; // For validation errors
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  per_page?: number;
  cursor?: string;
}
