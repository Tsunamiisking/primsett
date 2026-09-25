CREATE TYPE "public"."availability_type" AS ENUM('recurring', 'override', 'block');--> statement-breakpoint
CREATE TYPE "public"."booking_source" AS ENUM('booking_page', 'marketplace', 'manual', 'offline');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending_deposit', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."calendar_mode" AS ENUM('open', 'slots');--> statement-breakpoint
CREATE TYPE "public"."cancelled_by" AS ENUM('vendor', 'client', 'system');--> statement-breakpoint
CREATE TYPE "public"."deposit_type" AS ENUM('fixed', 'percentage');--> statement-breakpoint
CREATE TYPE "public"."late_outcome" AS ENUM('fined', 'design_changed', 'rescheduled');--> statement-breakpoint
CREATE TYPE "public"."location_type" AS ENUM('fixed', 'mobile', 'both');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('whatsapp', 'in_app', 'email');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('queued', 'sent', 'delivered', 'read', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('card', 'bank_transfer', 'ussd', 'mobile_money');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'refunded', 'in_escrow', 'disbursed', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('deposit', 'balance', 'refund', 'partial_refund', 'late_fine', 'platform_fee');--> statement-breakpoint
CREATE TYPE "public"."portfolio_source" AS ENUM('whatsapp', 'in_app');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('free', 'pro', 'studio');--> statement-breakpoint
CREATE TYPE "public"."trust_level" AS ENUM('standard', 'trusted', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('vendor', 'client', 'admin');--> statement-breakpoint
CREATE TYPE "public"."vendor_persona" AS ENUM('informal_solo', 'structured_solo', 'mobile_artist', 'studio_owner', 'student');--> statement-breakpoint
CREATE TABLE "availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"type" "availability_type" NOT NULL,
	"day_of_week" integer,
	"specific_date" text,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"slot_times" text[],
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"is_permanent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "badges_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"client_id" uuid,
	"service_id" uuid NOT NULL,
	"staff_id" uuid,
	"status" "booking_status" DEFAULT 'pending_deposit' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"total_price_kobo" integer NOT NULL,
	"deposit_required_kobo" integer NOT NULL,
	"deposit_deadline" timestamp with time zone,
	"selected_variant" jsonb,
	"selected_addons" jsonb DEFAULT '[]'::jsonb,
	"intake_responses" jsonb DEFAULT '[]'::jsonb,
	"client_address" text,
	"client_area" text,
	"policy_version_id" uuid,
	"policy_acknowledged_at" timestamp with time zone,
	"is_offline_tentative" boolean DEFAULT false NOT NULL,
	"cancellation_reason" text,
	"cancelled_by" "cancelled_by",
	"late_arrival_minutes" integer,
	"late_outcome" "late_outcome",
	"on_way_sent_at" timestamp with time zone,
	"client_confirmed_ready_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"source" "booking_source" DEFAULT 'booking_page' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"recipient_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"type" text NOT NULL,
	"status" "notification_status" DEFAULT 'queued' NOT NULL,
	"meta_message_id" text,
	"reply_received" boolean DEFAULT false NOT NULL,
	"reply_text" text,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"client_id" uuid,
	"type" "payment_type" NOT NULL,
	"amount_kobo" integer NOT NULL,
	"platform_fee_kobo" integer DEFAULT 0 NOT NULL,
	"vendor_payout_kobo" integer NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"paystack_reference" text,
	"paystack_transfer_code" text,
	"payment_method" "payment_method",
	"escrow_release_at" timestamp with time zone,
	"refund_reason" text,
	"initiated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_paystack_reference_unique" UNIQUE("paystack_reference")
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"cancellation_hours" integer DEFAULT 24 NOT NULL,
	"deposit_refund_pct" integer DEFAULT 10000 NOT NULL,
	"late_fine_kobo" integer DEFAULT 0 NOT NULL,
	"late_threshold_minutes" integer DEFAULT 15 NOT NULL,
	"waiting_limit_minutes" integer DEFAULT 60 NOT NULL,
	"custom_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"thumbnail_url" text,
	"service_tag" text,
	"service_id" uuid,
	"upload_source" "portfolio_source" NOT NULL,
	"whatsapp_message_id" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "portfolio_items_whatsapp_message_id_unique" UNIQUE("whatsapp_message_id")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"body" text,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"base_price_kobo" integer NOT NULL,
	"duration_minutes" integer NOT NULL,
	"requires_deposit" boolean DEFAULT true NOT NULL,
	"deposit_type" "deposit_type" DEFAULT 'percentage' NOT NULL,
	"deposit_value" integer DEFAULT 3000 NOT NULL,
	"intake_form" jsonb DEFAULT '[]'::jsonb,
	"variants" jsonb DEFAULT '[]'::jsonb,
	"addons" jsonb DEFAULT '[]'::jsonb,
	"location_pricing" jsonb DEFAULT '[]'::jsonb,
	"day_pricing" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"full_name" text NOT NULL,
	"role" "user_role" DEFAULT 'client' NOT NULL,
	"clerk_user_id" text,
	"whatsapp_number" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "vendor_badges" (
	"vendor_id" uuid NOT NULL,
	"badge_id" uuid NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vendor_clients" (
	"vendor_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"trust_level" "trust_level" DEFAULT 'standard' NOT NULL,
	"no_show_count" integer DEFAULT 0 NOT NULL,
	"reschedule_count" integer DEFAULT 0 NOT NULL,
	"total_spent_kobo" integer DEFAULT 0 NOT NULL,
	"outstanding_balance_kobo" integer DEFAULT 0 NOT NULL,
	"vendor_notes" text,
	"first_booking_at" timestamp with time zone,
	"last_booking_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_name" text NOT NULL,
	"slug" text NOT NULL,
	"bio" text,
	"service_types" text[] DEFAULT '{}' NOT NULL,
	"location_type" "location_type" DEFAULT 'fixed' NOT NULL,
	"location_text" text,
	"location_area" text,
	"subscription_tier" "subscription_tier" DEFAULT 'free' NOT NULL,
	"subscription_expires_at" timestamp with time zone,
	"calendar_mode" "calendar_mode" DEFAULT 'open' NOT NULL,
	"booking_advance_days" integer DEFAULT 30 NOT NULL,
	"max_daily_bookings" integer,
	"buffer_minutes" integer DEFAULT 15 NOT NULL,
	"reliability_score" numeric(5, 2) DEFAULT '100.00' NOT NULL,
	"avg_rating" numeric(3, 2),
	"total_clients_served" integer DEFAULT 0 NOT NULL,
	"onboarding_persona" "vendor_persona",
	"is_marketplace_listed" boolean DEFAULT false NOT NULL,
	"ranking_score" numeric(10, 4) DEFAULT '0.0000' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "availability" ADD CONSTRAINT "availability_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_policy_version_id_policies_id_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_badges" ADD CONSTRAINT "vendor_badges_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_badges" ADD CONSTRAINT "vendor_badges_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_clients" ADD CONSTRAINT "vendor_clients_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_clients" ADD CONSTRAINT "vendor_clients_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_vendor_idx" ON "availability" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "availability_day_idx" ON "availability" USING btree ("vendor_id","day_of_week");--> statement-breakpoint
CREATE INDEX "bookings_vendor_scheduled_idx" ON "bookings" USING btree ("vendor_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "bookings_vendor_status_idx" ON "bookings" USING btree ("vendor_id","status");--> statement-breakpoint
CREATE INDEX "bookings_client_vendor_idx" ON "bookings" USING btree ("client_id","vendor_id");--> statement-breakpoint
CREATE INDEX "bookings_deposit_deadline_idx" ON "bookings" USING btree ("deposit_deadline");--> statement-breakpoint
CREATE INDEX "notifications_booking_type_idx" ON "notifications" USING btree ("booking_id","type");--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "notifications_meta_message_idx" ON "notifications" USING btree ("meta_message_id");--> statement-breakpoint
CREATE INDEX "payment_events_payment_idx" ON "payment_events" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "payments_vendor_idx" ON "payments" USING btree ("vendor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_paystack_ref_idx" ON "payments" USING btree ("paystack_reference");--> statement-breakpoint
CREATE INDEX "payments_escrow_idx" ON "payments" USING btree ("escrow_release_at");--> statement-breakpoint
CREATE INDEX "policies_vendor_current_idx" ON "policies" USING btree ("vendor_id","is_current");--> statement-breakpoint
CREATE INDEX "portfolio_vendor_idx" ON "portfolio_items" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "portfolio_published_idx" ON "portfolio_items" USING btree ("vendor_id","is_published");--> statement-breakpoint
CREATE INDEX "reviews_vendor_idx" ON "reviews" USING btree ("vendor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_booking_idx" ON "reviews" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "services_vendor_idx" ON "services" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "services_active_idx" ON "services" USING btree ("vendor_id","is_active");--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "users_whatsapp_idx" ON "users" USING btree ("whatsapp_number");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_idx" ON "users" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_badges_pk" ON "vendor_badges" USING btree ("vendor_id","badge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_clients_pk" ON "vendor_clients" USING btree ("vendor_id","client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vendors_slug_idx" ON "vendors" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "vendors_location_idx" ON "vendors" USING btree ("location_area","is_marketplace_listed");--> statement-breakpoint
CREATE INDEX "vendors_ranking_idx" ON "vendors" USING btree ("ranking_score");--> statement-breakpoint
CREATE INDEX "vendors_tier_idx" ON "vendors" USING btree ("subscription_tier");