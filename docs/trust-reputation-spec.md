# Trust & Reputation System Specification — Finalised

This document is the single source of truth for how Primsett handles
payments, disputes, and public/private vendor reputation data. It
SUPERSEDES the escrow-based payment design and the "non-negotiable
platform policy" framing described in earlier planning conversations
and any prior policy-engine documentation. Read this in full before
implementing payments, the vendor public page, reviews, badges, or any
reliability/scoring logic.

---

## The core decision — no escrow

**Vendors are paid immediately on successful deposit/payment, the same
way they already get paid today via direct bank transfer.** The
platform does not hold funds between payment and appointment
completion.

### Why this changed from the original design

The original design held all payments in escrow until
`bookings.completed_at`, releasing to the vendor 24hrs later, framed as
protection for the client. This was rejected for three reasons:

1. **It breaks the "frictionless shift" principle.** Every vendor
   interviewed (Dami, Hillary, Precious) already collects payment
   directly into her own account today. Asking her to let a third party
   temporarily hold her income is a materially bigger trust ask than
   any other part of onboarding — it doesn't match existing behaviour,
   it replaces it.

2. **It takes away a decision vendors already see as theirs.** In every
   interview, refund and dispute decisions were made unilaterally by
   the vendor, based on her own judgement of fault (see Hillary's
   deduction system, Precious's case-by-case refund calls). Escrow
   quietly transfers that authority to the platform.

3. **It removes "anonymity of failed transactions."** One of the real
   reasons informal vendors avoid formal platforms is that failures —
   a bad client, a dispute, a refund — currently stay private between
   her and that one client. A system that holds her money and visibly
   tracks/resolves disputes turns private friction into platform-
   visible, potentially permanent record. This cuts directly against
   vendor trust, which is the platform's stated priority over client-
   side institutional guarantees.

### What replaces escrow as the protection mechanism

Client protection moves from a **financial backstop** to a
**reputational signal**, matching how trust already works in this
market (Instagram, word of mouth) rather than manufacturing
institutional guarantees the market has never had and has already
adapted around. See "Public vs private reputation data" below.

Standard Paystack dispute/chargeback mechanisms remain available as the
underlying safety net for genuine bad-actor cases, same as any business
accepting card payments — this is infrastructure-level protection, not
a product-level hold on every transaction.

---

## Public vs private reputation data — the core rule

**Rule: any metric with a visible "bad" end of the scale stays private
to the vendor. Any metric that is purely additive — high is good, there
is no damaging low reading — can be public.**

This single rule should govern every future decision about what to
surface on the vendor page or anywhere client-facing. Run any new stat
or signal through this test before exposing it publicly: *does a low
or default value for this metric make the vendor look bad to a
stranger?* If yes, it stays private. If a low value is simply neutral
or invisible (not shown at all), it can be public.

### PRIVATE — visible to the vendor only, never shown to clients or on the public profile

- `reliability_score` — coaching tool for the vendor herself. Shown in
  her own dashboard as a trend ("you've had 2 reschedules this month")
  never as a number a client could see.
- Completion rate / no-show rate / cancellation rate (as raw
  percentages or ratios)
- Dispute count or dispute history — disputes are never visible to
  anyone except the vendor, the specific client involved, and platform
  support/moderation. No aggregate dispute count is ever shown
  publicly, not even as "X disputes resolved."
- Response time as a raw number (e.g. "responds in 4 hours") — see
  Fast Responder badge below for the public-safe version of this
  signal.
- Reschedule count, late arrival count (raw numbers)

### PUBLIC — shown on the vendor's public page and/or marketplace listing

- **Star rating and written reviews** — aggregate rating absorbs
  individual bad experiences gracefully (a 4.8 from 50 reviews isn't
  damaged by one bad one the way a hard percentage stat would be).
  This is the primary client-facing trust signal, replacing the role
  escrow was meant to play.
- **Badges** — Founding Member, Verified, Top Rated, Rising Talent,
  Client Favourite, Fast Responder, 100 Clients (see badge definitions
  in earlier marketplace spec — unchanged). Badges are asymmetric by
  design: they only ever add to how a vendor looks, never subtract.
  A vendor who hasn't earned a badge simply doesn't show it — there is
  no visible "failed to earn" state.
- **Profile views** — pure vanity metric, zero downside risk, explicitly
  designed to be screenshot-and-share-worthy (e.g. "247 people viewed
  your profile this week"). New addition per this spec.
- **Total bookings completed (lifetime count)** — "150 appointments
  booked through Primsett." Only grows, never reflects a bad period.
- **Tenure on platform** — "Active since March 2026," ties to Founding
  Member badge. Pure tenure signal, not a quality judgement.
- **Portfolio post count** — "32 looks posted." Signals an active
  vendor. A lower count carries no negative reading — it simply isn't
  emphasised as prominently for less-active profiles.

### Explicitly NOT shown publicly, even though it might seem appealing

- Repeat client percentage as a raw number — this is intentionally kept
  inside the **Client Favourite** badge instead of also being shown as
  a percentage. The badge format protects against a vendor with, say,
  a 35% repeat rate looking bad next to one with 60% — she either has
  the badge or she doesn't, no humiliating in-between number.
- Response time as a raw number — same logic, kept inside the **Fast
  Responder** badge only.
- Any completion/cancellation/dispute rate, in any public-facing
  location, under any framing.

---

## Database schema changes required

In `packages/database/src/schema.ts`:

- `payments.status` (paymentStatusEnum) — simplify. Remove `in_escrow`
  and `disbursed` as meaningful states for the payment lifecycle.
  Vendors are paid immediately on `succeeded`. Retain `pending`,
  `processing`, `succeeded`, `failed`, `refunded`, `disputed` for
  actual payment-gateway states. The escrow-specific states should be
  removed or left unused — do not build worker logic that depends on
  them.
- `payments.escrowReleaseAt` — this field is no longer functionally
  needed since there is no escrow release event. Can remain in the
  schema as deprecated/unused, or be removed in a future migration —
  do not write any worker job that reads or sets this field going
  forward.
- `vendors.reliabilityScore` — add an explicit code comment in the
  schema marking this as PRIVATE — never queried for any public-facing
  vendor page or marketplace endpoint. Only the vendor's own
  authenticated dashboard queries should read this field.
- `vendors.avgRating` — explicit code comment marking this as PUBLIC —
  safe to include in any public vendor page or marketplace query.
- New field needed: `vendors.profileViewCount` (integer, default 0) —
  increments on every public vendor page load (consider basic bot/
  duplicate-view filtering at the application layer, not a strict
  requirement for MVP). This is a PUBLIC field.
- New field needed: `vendors.totalBookingsCompleted` (integer, default
  0) — denormalised lifetime count, increments when a booking is
  marked DONE. PUBLIC field, distinct from `totalClientsServed` which
  counts unique clients rather than total bookings.

---

## What this changes in the notification/booking flow

`vendor_completion_check` template (DONE reply) no longer triggers any
escrow release logic. On receiving DONE:

1. Set `bookings.completedAt`
2. Increment `vendors.totalBookingsCompleted`
3. Fire `appointment_completed` analytics event
4. Schedule the `rebooking_nudge` job for the client, 24hrs later
5. (No payment state change — payment already settled at booking time)

Refunds remain entirely vendor-initiated, at her discretion, for
whatever reason she judges warrants one — exactly matching how Dami,
Hillary, and Precious already operate today. The platform's job is to
make issuing a refund a one-tap action in the app rather than a manual
bank transfer, not to gate or approve her decision.

---

## Implementation note for Claude Code

If any earlier document, comment, or prior session context references
escrow, "deposit held until appointment complete," or treats completion
rate / dispute count / cancellation rate as public-facing data, that
content is superseded by this specification. This document represents
the final, confirmed decision after explicit reconsideration — it is
not a draft alongside the earlier escrow design, it replaces it.