# Notifications System Specification — Finalised

This document is the single source of truth for how Primsett handles
vendor and client notifications via WhatsApp. Read this in full before
implementing any reminder, alert, or notification-triggering logic.

**Payment note:** this spec assumes the no-escrow payment model defined
in /docs/trust-reputation-spec.md. Vendors are paid immediately at
booking time — the DONE trigger below marks completion and updates
stats/triggers the rebooking nudge, it does NOT release any held funds.

---

## Core principle

The vendor should never need to open the app to manage day-to-day
communication. Every interaction the system needs from her should be a
single WhatsApp reply — one word where possible. The platform watches
the clock and the booking state; the vendor just responds to what shows
up in her existing WhatsApp inbox. If a vendor with 5 bookings in a day
would receive more than 2-3 distinct WhatsApp messages from us before
midday, the design is wrong and needs to batch.

This applies primarily to vendors in the MVP target bracket — solo,
fixed-location, 2-5 clients/day (see onboarding-spec.md for full bracket
definition). Mobile-artist-specific triggers (on-my-way, travel
detection) are listed here for completeness but are Phase 2 — do not
build until the core fixed-location flow is solid.

---

## The two failure modes this design avoids

**Failure mode 1 — per-booking notification spam.** If every booking
independently triggers its own night-before nudge, 24hr reminder check,
2hr check, and 10-minute check, a vendor with 5 bookings in a day
receives 15-20+ separate messages. This recreates the chaos the product
is meant to remove.

**Failure mode 2 — requiring explicit app intervention.** If "send the
on-my-way message" requires the vendor to open the app and tap a button,
she will not do it — she will just type it directly in the client's
WhatsApp DM like she always has. Any trigger that depends on the vendor
opening the app instead of replying to a WhatsApp message we already
sent her is a broken design.

---

## Design solution — two mechanisms working together

### Mechanism 1 — Daily digest, not per-booking pings

For any vendor-facing notification that is informational/forward-looking
(not requiring an immediate time-sensitive reply), batch by VENDOR PER
DAY, not by individual booking.

**Night-before digest** — sent once per vendor per day, covering ALL of
tomorrow's bookings in one message:

```
Tomorrow's schedule:
10am — Chioma (Acrylic full set)
1pm — Ngozi (Gel + nail art)
4pm — Blessing (Soak off + acrylic)
Reply READY if you're all set, or tell us if anything's changed.
```

**Morning-of digest** — sent once per vendor per day, around 7-8am:

```
Good morning! Today: Chioma at 10, Ngozi at 1, Blessing at 4.
All confirmed and ready to go 💅
```

Do NOT send a separate "tomorrow" message or separate "today" message
per individual booking. One vendor, one digest, regardless of how many
bookings they have that day.

### Mechanism 2 — Per-appointment real-time triggers, naturally spaced

Time-sensitive triggers that need an immediate one-word reply (running
late check, arrival confirmation, on-my-way) ARE sent per-booking, but
this does not cause pile-up because they are tied to actual appointment
times, which are themselves spaced apart by the vendor's own schedule
(typically 2-3+ hour service durations in this bracket).

**Collision rule:** if two notification triggers for the SAME VENDOR
would fire within a 30-minute window of each other (e.g. unusually
short back-to-back bookings), merge them into a single combined message
rather than sending two separate ones. This is the only case requiring
explicit overlap-checking logic — normal schedules with 2-3hr service
gaps never trigger this rule.

### Mechanism 3 — Active appointment mute window

If a vendor is currently in an active appointment (defined as: she
replied YES/GO to start it, and it has not yet been marked DONE), hold
any non-urgent notifications for OTHER bookings until the current one is
marked complete, then deliver held notifications as a single batch.

**Exception — urgent messages still interrupt immediately:** a client
saying they are running late, or a deposit-expiry warning, are not
held — these need timely handling regardless of what the vendor is
doing. Only routine forward-looking checks ("10 minutes till next
client") are subject to the mute window.

---

## Full notification timeline — client-side (per booking)

Client-side reminders do NOT have a batching problem — each client only
ever sees messages about their own single appointment, so no client is
ever bombarded regardless of how busy the vendor's day is.

| Trigger time | Message | Expected reply |
|---|---|---|
| 24hrs before | "Hi [name], your appointment with [vendor] is tomorrow at [time]. Reply YES to confirm." | YES (or no reply → vendor sees at-risk flag) |
| 2hrs before | "Your appointment is in 2 hours — [vendor] will see you at [time]. Still good? Reply YES." | YES (or no reply → vendor sees at-risk flag) |
| On vendor GO (mobile only, Phase 2) | "[Vendor] is on her way to you now. She'll arrive around [time]. Please be ready." | none required, informational |
| 30 min before (mobile only, Phase 2) | "[Vendor] arrives in about 30 minutes. Is everything ready?" | none required, informational |
| Post-appointment (+24hrs) | Rebooking nudge — "Hope you loved your [service]! Ready to book your next one?" | booking link tap |

---

## Full notification timeline — vendor-side (batched by day)

| Trigger time | Message type | Reply expected | Notes |
|---|---|---|---|
| Night before (once/day) | Digest of all tomorrow's bookings | READY (optional) | Mechanism 1 |
| Morning of (once/day) | Digest confirmation of today's bookings | none required | Mechanism 1 |
| 1hr before each booking (mobile only, Phase 2) | "[Client]'s appointment is at [time]. Heading out? Reply GO and we'll notify them." | GO | Triggers client on-my-way message |
| 10 min before each booking | "[Client]'s appointment is in 10 minutes. Everything okay?" | YES or LATE | If LATE, ask "how long?" → triggers client running-late message |
| At appointment time, no arrival confirmed | "It's [time] — have you arrived/are they there? Reply YES or WAITING." | YES or WAITING | Starts waiting timer if WAITING |
| +30 min of WAITING state | "You've been waiting 30 minutes. Cancel and keep deposit, or keep waiting? Reply CANCEL or WAIT." | CANCEL or WAIT | Maps to policy waiting_limit_minutes |
| On appointment end time reached | "How did [client]'s appointment go? Reply DONE when finished." | DONE | Marks booking complete, increments vendor lifetime stats, triggers client rebooking nudge job. **No payment/escrow action — payment already settled at booking time.** |

---

## One-word reply vocabulary — keep this exact and consistent

The system should recognise these replies case-insensitively, and these
words should NEVER be reused for a different meaning in a different
context — vendors will learn this vocabulary and it must stay stable:

- **READY** — acknowledging the night-before digest (optional, informational only)
- **YES** — confirming an appointment/arrival/client presence
- **GO** — vendor is leaving to travel to client (Phase 2, mobile only) → triggers client on-my-way message
- **LATE** — vendor flags the current client is running late → system asks "how many minutes?" as follow-up
- **WAITING** — vendor is waiting for a client who hasn't arrived → starts waiting timer
- **CANCEL** — vendor wants to cancel the current waiting appointment and retain deposit per policy
- **WAIT** — vendor wants to continue waiting past the prompted check-in
- **DONE** — appointment is complete → marks `bookings.completedAt`, increments `vendors.totalBookingsCompleted`, fires `appointment_completed` analytics event, schedules the rebooking nudge for 24hrs later. **Does not touch payment state.**

Free-text replies (e.g. "20 mins" after a LATE flag) should be parsed
for the specific follow-up question asked, not matched against the
fixed vocabulary above.

---

## Implementation architecture

- All vendor-side triggers are scheduled as BullMQ jobs at booking
  confirmation time, keyed by booking ID, but the DIGEST jobs (night-
  before, morning-of) are scheduled per VENDOR per DAY, not per booking
  — implement as a separate recurring job that queries all of a vendor's
  bookings for the relevant day and composes one message.
- Real-time per-booking jobs (10-min check, at-appointment-time check)
  remain per-booking, scheduled relative to `bookings.scheduled_at`.
- Before firing any vendor-side job, check Mechanism 3 (active
  appointment mute window) — query whether vendor has any booking
  currently in an unconfirmed-DONE active state, and if so and the
  pending notification is non-urgent, defer it to a held queue that
  flushes when the active booking is marked DONE.
- Before firing any vendor-side job, check Mechanism 2 collision rule —
  if another job for the same vendor is scheduled within 30 minutes,
  merge into a single outbound message rather than sending both.
- All reply parsing happens in the WhatsApp webhook handler (see
  apps/api/src/routes/webhooks/whatsapp.ts) — inbound text messages are
  matched against the expected reply for the most recent outbound
  notification sent to that vendor/client, tracked via the
  `notifications` table (see packages/database/src/schema.ts).
- Every notification sent and every reply received fires the
  corresponding analytics event from CLAUDE.md's event list
  (reminder_sent, reminder_confirmed, late_arrival_triggered, etc).
- On DONE reply specifically: do NOT implement any escrow-release or
  payment-state-change logic. See /docs/trust-reputation-spec.md for
  the full, current payment model. This spec previously referenced
  escrow release here — that has been removed.

---

## What is explicitly Phase 2 — do not build in MVP

- On-my-way alert and travel detection (GO trigger, 1hr-before mobile
  check) — mobile artist bracket, not MVP target bracket.
- Waiting timer escalation beyond the basic check-in — full waiting_limit
  policy enforcement is Phase 2.
- Location-aware ETA messaging.

## What IS in MVP scope

- Client-side 24hr and 2hr reminders with YES confirmation.
- Vendor-side night-before and morning-of digests (Mechanism 1).
- Vendor-side DONE trigger at appointment end time, marking the booking
  complete and triggering the rebooking nudge (no payment action).
- Basic LATE flag handling for fixed-location vendors (client running
  late, not vendor running late to a client's location — that's Phase 2
  mobile-only).
- Mechanism 3 mute window for active appointments — this is simple
  enough to include in MVP and meaningfully improves vendor experience
  immediately.