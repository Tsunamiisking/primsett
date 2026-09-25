# Primsett — Claude Code Project Memory

## What this project is
Primsett is a Nigerian beauty booking platform — a personal booking assistant
and marketplace for nail techs, lash techs, makeup artists, and stylists.
It solves ghost bookings, no-shows, manual admin overhead, and zero
discoverability for informal beauty businesses.

**This is not a generic booking tool. Every decision traces back to
real user research. Read /docs/personas.md before touching any feature.**

---

## Required reading — locked specs

These documents are the finalised, authoritative source for their
respective systems. Read the relevant one in full before implementing
anything in that area. Where any other document, comment, or prior
session context conflicts with these, THESE WIN — they represent
explicit reconsideration and supersede earlier drafts.

- `/docs/onboarding-spec.md` — the full adaptive onboarding flow,
  screen logic, and conditional question paths. Supersedes any earlier
  4-screen onboarding description.
- `/docs/notifications-spec.md` — the full WhatsApp notification system,
  daily digest batching, one-word reply vocabulary, and timing logic.
- `/docs/whatsapp-templates-spec.md` — every approved Meta template,
  variable structure, and button configuration.
- `/docs/trust-reputation-spec.md` — payment flow (no escrow, immediate
  payout), and the public/private rule for vendor reputation data.
  **This document removes escrow entirely — see below.**

## The planning conversation
All product decisions were made in a Claude.ai conversation. If you need
context on WHY something was built a certain way, use the past chats tool
to search that conversation. Key search terms:
- "Hillary booking policy" — policy builder decisions
- "Precious on my way" — mobile artist features
- "no escrow" or "anonymity of failed transactions" — payment architecture
  decisions (the platform does NOT hold funds — see trust-reputation-spec.md)
- "onboarding path" — adaptive onboarding logic
- "offline conflict" — double booking resolution
- "WhatsApp portfolio" — image upload pipeline
- "public private reputation" — what vendor stats are client-visible

---

## MVP target bracket — who we are building for first

The MVP is built for **solo, fixed-location vendors** — home studio or
rented space/salon, 2–5 clients per day, working alone, in Lagos.

This is the primary design target — Dami and Zara's bracket most
directly, Hillary's bracket with Phase 2 extensions. Precious (mobile)
and Tunde (multi-staff) are real personas with real designed features,
but those features are Phase 2/3 — do not build mobile-artist-specific
or multi-staff-specific logic as part of MVP scope unless explicitly
asked. See `/docs/onboarding-spec.md` for the full bracket rationale.

---

## Monorepo structure
```
primsett/
  apps/
    web/        Next.js 14 — Tech App (PWA) + Booking Pages + Marketplace
    api/        Fastify — REST API + Webhook handlers
    worker/     BullMQ — Background jobs (reminders, nudges, badges)
  packages/
    database/   Drizzle ORM schema + migrations (PostgreSQL)
    types/      Shared TypeScript types across all apps
    utils/      Shared utilities (phone normalisation, money formatting)
  docs/
    personas.md              The 5 vendor personas
    features.md               MVP feature list with phase breakdown
    edge-cases.md              All booking edge cases and policy logic
    architecture.md            Tech stack decisions and why
    schema.md                  Database entity map
    analytics.md                Event schema and friction metrics
    onboarding-spec.md          LOCKED — full onboarding flow
    notifications-spec.md        LOCKED — full notification system
    whatsapp-templates-spec.md   LOCKED — approved Meta templates
    trust-reputation-spec.md     LOCKED — payments + reputation rules
```

---

## Tech stack
| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) | SSR for SEO on vendor pages, PWA for tech app |
| Language | TypeScript | Non-negotiable at this complexity |
| Styling | Tailwind CSS + shadcn/ui | Fast iteration, consistent tokens |
| PWA/Offline | Workbox | Offline calendar, background sync for tentative bookings |
| State | Zustand + React Query | Local UI state + server state with optimistic updates |
| API | Fastify | 2× faster than Express, schema validation built in |
| ORM | Drizzle | Type-safe, migration-first, PostgreSQL native |
| Database | PostgreSQL via Supabase | Relational, RLS, realtime, hosted |
| Cache/Queue | Redis via Upstash | Sessions, BullMQ jobs, rate limiting |
| Auth | Clerk | Phone OTP, Nigerian numbers, JWT middleware |
| Payments | Paystack (primary) | Nigerian rails, immediate payout to vendor (no escrow) |
| WhatsApp | Meta Cloud API | Official, cheapest, direct access to features |
| File storage | Cloudflare R2 | Zero egress fees, CDN, S3-compatible |
| Analytics | PostHog (self-hosted) | Product events, session replay, feature flags |
| Email | Resend | Transactional, React Email templates |
| Monitoring | Sentry + Grafana | Errors + infrastructure dashboards |
| Hosting | Railway | Zero-config deploy, auto-scale, cheap at early stage |
| Jobs | BullMQ | Persisted, retried, scheduled job queues |

---

## Absolute rules — never break these

### Money
- ALL money stored as INTEGER in kobo (₦1 = 100 kobo)
- ₦3,500 is stored as 350000
- NEVER use floats for money
- Division to naira only happens at the display layer

### Timestamps
- ALL timestamps are TIMESTAMPTZ (UTC with timezone)
- Display in Africa/Lagos (UTC+1) at the app layer
- Never store local time in the database

### IDs
- ALL primary keys are UUID v4
- Use gen_random_uuid() as PostgreSQL default
- Never use auto-increment integers as PKs

### Deletes
- NEVER hard delete business data
- Every table has deleted_at TIMESTAMPTZ (NULL = active)
- Soft deletes everywhere — disputes and audits depend on history

### Payments — UPDATED, no longer escrow-based
- Vendors are paid IMMEDIATELY on successful deposit/payment — same as
  their existing direct bank transfer behaviour today, just digitised
- The platform does NOT hold funds between payment and appointment
  completion — there is no escrow state in this system
- Refunds are entirely vendor-initiated, at her discretion, for
  whatever reason she judges warrants one — the platform makes this a
  one-tap action, it does not gate or approve her decision
- payment_events table remains APPEND ONLY — no updates, no deletes, ever
- Every Paystack webhook must be idempotent (check paystack_reference first)
- Full reasoning and the payment-status state simplification this
  requires: see /docs/trust-reputation-spec.md

### Reputation data — public vs private
- Run every reputation-related stat through this test before exposing
  it anywhere client-facing: does a low/default value make the vendor
  look bad to a stranger? If yes -> PRIVATE (vendor dashboard only).
  If a low value is simply neutral/invisible -> can be PUBLIC.
- PRIVATE always: reliability_score, completion rate, no-show rate,
  cancellation rate, dispute count/history, raw response time
- PUBLIC always: star rating + written reviews, badges, profile view
  count, total bookings completed (lifetime), tenure on platform,
  portfolio post count
- Disputes are NEVER visible publicly, not even as an aggregate count
- Full rule and rationale: see /docs/trust-reputation-spec.md

### Analytics
- Every API response fires a PostHog event BEFORE returning
- Dual-fire: client SDK (PostHog JS) + server SDK (PostHog Node)
- Never skip analytics on an endpoint — it breaks the friction dashboard

### Security
- Row-level security (RLS) enabled on ALL Supabase tables
- A vendor can only read their own data
- Webhook signatures (HMAC) verified before processing any Meta or Paystack webhook
- Never log phone numbers, payment details, or WhatsApp content to console

### Mobile-first
- Nigerian mid-range Android (Tecno, Infinix) on variable 4G
- Booking page must load under 100KB JS on first load
- 44px minimum tap targets everywhere
- Test on throttled 3G in Chrome devtools before every PR

---

## The 5 vendor personas

### Dami — Type A: Informal Solo
- Nail tech, Surulere, 2–3 clients/day
- No written policy, inconsistent deposits
- Economic anxiety: "I'm always available because of this country"
- Needs: gentle structure, deposit nudge, booking link
- Risk: will turn off deposits if a client complains
- **Primary MVP target persona**

### Hillary — Type B: Structured Solo
- Nail tech, Lekki, 3–5 clients/day, up to 5 in December
- Written policy, strict deposits, slot-based calendar (10am/1pm/4pm)
- Has Sunday surcharge, ₦2,000 late fine, 10% deposit deduction on cancellation
- Needs: policy builder, auto pricing calculator, slot calendar, running late alert
- Risk: policy builder not flexible enough for her exact rules
- **MVP target persona, full needs met in Phase 2**

### Precious — Type C: Mobile Artist
- Makeup artist, travels to clients across Lagos
- Location-based pricing: Studio / Mainland / Island tiers
- Uses notes app + phone reminders as her whole system
- Needs: "on my way" alert, waiting timer, location pricing
- Risk: still takes same-day bookings via WhatsApp if flow is too slow
- **Phase 2 persona — not MVP build target**

### Tunde — Type D: Studio Owner
- Salon owner, Victoria Island, 4 staff, 10–20 clients/day
- No visibility across staff — bookings come through 4 different phones
- Needs: multi-staff calendar, unified dashboard, salon-wide deposit policy
- Risk: staff feel surveilled — frame as "your own booking page" not "boss monitoring"
- **Phase 3 persona — not MVP build target**

### Zara — Type E: Student Tech
- Student nail tech, Yaba, weekends only, 1–2 clients/day
- Never asked for a deposit — too scared
- Needs: booking link for credibility, Rising Talent badge, free tier that works
- Risk: ₦3,500/mo feels steep — needs student pricing or genuinely useful free tier
- **Primary MVP target persona — same bracket as Dami**

---

## Feature phases

### Phase 1 — MVP (build first)
Booking link, WhatsApp confirmation, reminders (24hr + 2hr), deposit gate
(immediate payout, no escrow), service intake form, client profile +
history, no-show flag, block client, reschedule flow, partial refund
(vendor-initiated), trusted client bypass, starter policy template,
open availability calendar, post-visit nudge.

### Phase 2 — Power user layer
Slot-based calendar, policy builder + acknowledgement gate, auto invoice,
late arrival flow, running late cascade alert, "on my way" alert,
waiting timer, location-based pricing, day-based pricing, balance carry-forward.

### Phase 3 — Studio and marketplace
Multi-staff calendar, staff earnings, waitlist/queue, earnings dashboard,
marketplace discovery, WhatsApp → portfolio pipeline, badge system,
group bookings, supply partner integrations.

---

## WhatsApp number handling
- ALL numbers stored in E.164 format: +2348012345678
- Normalise on write: strip non-digits, add country code, add +
- The normalisation utility lives in packages/utils/phone.ts
- Meta webhook delivers sender as "from": "2348012345678" (no +)
- Always normalise before lookup: SELECT * FROM users WHERE whatsapp_number = normalise(from)
- users.phone = Clerk auth number
- users.whatsapp_number = messaging number (may differ — user can set separately)
- Portfolio upload flow: receive image → lookup vendor by whatsapp_number →
  store pending (is_published=false) → reply asking confirmation →
  store pending_item_id in Redis keyed by whatsapp_number (TTL 24hrs) →
  on YES reply: publish, fire event, confirm → on no reply: auto-cleanup

---

## Conflict detection
Run this query INSIDE A TRANSACTION before confirming any booking:
```sql
SELECT id FROM bookings
WHERE vendor_id = $vendor_id
  AND status NOT IN ('cancelled', 'no_show', 'rescheduled')
  AND deleted_at IS NULL
  AND scheduled_at < $new_ends_at
  AND ends_at > $new_scheduled_at
LIMIT 1;
```
If this returns a row, the slot is taken. Use SELECT FOR UPDATE to prevent
race conditions when two clients book simultaneously.

---

## Key analytics events (fire these — don't skip them)
onboarding_started, onboarding_screen_completed, onboarding_completed,
onboarding_abandoned, booking_link_first_shared, booking_page_viewed,
booking_service_selected, booking_slot_selected, booking_deposit_initiated,
booking_confirmed, booking_abandoned, reminder_sent, reminder_confirmed,
appointment_completed, appointment_no_show, appointment_rescheduled,
late_arrival_triggered, portfolio_image_uploaded, marketplace_tech_viewed,
whatsapp_cta_clicked, review_submitted.

---

## Friction alert thresholds (Slack alert when breached)
| Metric | Target | Alert |
|---|---|---|
| Onboarding completion | >85% | <70% |
| Booking page → confirmed | >40% | <25% |
| Deposit abandonment | <20% | >35% |
| Free → Pro conversion (30d) | >25% | <15% |
| Monthly churn (Pro) | <5% | >8% |
| WhatsApp delivery rate | >98% | <95% |
| Job queue failure rate | <0.5% | >2% |