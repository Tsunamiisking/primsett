# WhatsApp Message Templates — Submission Spec

All templates below are submitted as Category: UTILITY in WhatsApp
Manager (or via the Message Templates API). They are transactional and
expected by the recipient — never submit these as Marketing.

**Payment note:** this spec assumes the no-escrow payment model defined
in /docs/trust-reputation-spec.md. No template references "escrow,"
"holding," or "releasing" funds — vendors are paid immediately at
booking time. The `vendor_completion_check` template (DONE trigger)
only marks the appointment complete; it has no payment meaning.

How to read each entry:
- TEMPLATE NAME — internal name used in API calls (lowercase, underscores)
- VARIABLES — listed in order, {{1}}, {{2}} etc, filled at send time
- BODY — the approved message text with variable placeholders
- BUTTONS — quick reply buttons (tap, no typing) or URL buttons
- TRIGGERED BY — which notifications-spec.md trigger sends this

Submit all of these to Meta before building the corresponding worker
jobs — approval can take minutes to 24 hours, and jobs should not be
built against a template name that doesn't exist yet.

---

## IMPORTANT — submission learnings from actual WhatsApp Manager use

Two real constraints were discovered submitting these templates that
were not anticipated when this spec was first drafted. Both are
reflected in the templates below — read this section before submitting
anything.

### 1. A variable cannot be the first or last character in the body

Meta requires static text immediately before and after every variable.
A template body like `{{1}}'s appointment has arrived` will be REJECTED
because `{{1}}` leads the message with no preceding static text.

**Fix pattern:** always add a short static lead-in word before a
variable that would otherwise be first (e.g. "For {{1}}'s appointment"
instead of "{{1}}'s appointment"). Every template below already has
this fix applied where needed — if you add a NEW template later, check
this constraint before submitting.

### 2. Meta auto-flags re-engagement/return-purchase language as Marketing

A template encouraging a past client to book again — even when framed
as a simple utility follow-up — can trigger Meta's automatic
reclassification from Utility to Marketing if the language reads as a
call-to-action to purchase again (e.g. "Ready to book your next
appointment?" + a "Book again" button was flagged).

This matters because Marketing-category messages cost more per message
and require a different, broader opt-in than transactional Utility
messages — a client who only consented to booking-related messages may
not have consented to marketing messages.

**Fix pattern:** reframe as a passive, informational follow-up rather
than an active prompt to purchase. Remove "ready to," "book again,"
and similar direct calls-to-action. State a fact and provide a neutral
reference link instead of a sales-style nudge. The `rebooking_nudge`
template below reflects this corrected framing. If Meta still flags a
softened version, that specific message type may need to be accepted
as Marketing category and budgeted accordingly — do not force a
Marketing-flagged template through as Utility.

---

## CLIENT-SIDE TEMPLATES

### 1. booking_confirmation

**Variables:** {{1}} client name, {{2}} vendor business name, {{3}} service
name, {{4}} date, {{5}} time, {{6}} total price, {{7}} deposit amount

**Body:**
```
Hi {{1}}! Your booking with {{2}} is confirmed ✅

Service: {{3}}
Date: {{4}}
Time: {{5}}
Total: {{6}}
Deposit paid: {{7}}

We'll remind you closer to the date. See you then!
```

**Buttons:** None required — informational.

**Triggered by:** Booking confirmed after deposit payment succeeds.

**Sample values for submission:** Hillary, Primsett, Acrylic full set,
15th July, 2:00 PM, ₦15,000, ₦5,000

---

### 2. reminder_24h

**Variables:** {{1}} client name, {{2}} vendor business name, {{3}} time,
{{4}} date

**Body:**
```
Hi {{1}}, just a reminder — your appointment with {{2}}
is tomorrow ({{4}}) at {{3}}.

Reply YES to confirm you'll be there.
```

**Buttons:** Quick reply — "YES, I'll be there"

**Triggered by:** 24hrs before `bookings.scheduled_at`.

**Sample values for submission:** Hillary, Primsett, 2:00 PM, 15th July

---

### 3. reminder_2h

**Variables:** {{1}} vendor business name, {{2}} time

**Body:**
```
Your appointment with {{1}} is in 2 hours, at {{2}}.
Still good for you? Reply YES to confirm.
```

**Buttons:** Quick reply — "YES, confirmed"

**Triggered by:** 2hrs before `bookings.scheduled_at`.

**Sample values for submission:** Primsett, 2:00 PM

---

### 4. on_way_alert (Phase 2 — mobile artists only, do not submit for MVP)

**Variables:** {{1}} client name, {{2}} vendor name, {{3}} estimated
arrival time

**Body:**
```
Hi {{1}}, {{2}} is on the way to you now and should
arrive around {{3}}. Please be ready!
```

**Buttons:** Quick reply — "I'm ready"

**Triggered by:** Vendor replies GO to the 1hr-before travel check.

---

### 5. running_late

**Variables:** {{1}} client name, {{2}} vendor name, {{3}} new estimated
time, {{4}} minutes late

**Body:**
```
Hi {{1}}, {{2}} is running about {{4}} minutes behind
schedule. New estimated time: {{3}}.
Thanks for your patience!
```

**Buttons:** None required — informational.

**Triggered by:** Vendor replies LATE + provides minute estimate.

**Sample values for submission:** Chioma, Hillary, 2:20 PM, 20

---

### 6. rebooking_nudge — REVISED after Marketing flag

**Original framing rejected by Meta's classifier:** "Ready to book your
next appointment?" + "Book again" URL button → auto-flagged as
Marketing.

**Revised framing — passive, informational, not a purchase prompt:**

**Variables:** {{1}} client name, {{2}} service name, {{3}} vendor name

**Body:**
```
Hi {{1}}! Thanks for visiting {{3}} for your {{2}} 💅

Your booking link is saved below whenever you need it.
```

**Buttons:** Call to Action — Visit Website — text: "View booking page"
— URL: `https://primsett.com/book/{{1}}` (dynamic, vendor slug)

**Note:** when filling in Meta's "Add sample URL" field during
submission, enter the FULL valid URL (e.g.
`https://primsett.com/book/hillary-blessing-nails`), not just the slug
portion. Meta validates the sample as a complete URL string — entering
only the slug will fail validation with "please enter a valid website
URL."

**If this revised version is STILL flagged as Marketing on submission:**
do not force it through. Accept Marketing classification for this
specific template, budget for the higher per-message cost, and ensure
only clients who've opted into marketing-category messages receive it
(may require a separate marketing opt-in step at onboarding or first
booking — flag this to the product owner if it occurs, since it is a
scope addition not currently planned for MVP).

**Triggered by:** 24hrs after `bookings.completedAt` is set (i.e. after
vendor replies DONE).

**Sample values for submission:** Chioma, Acrylic full set, Hillary

---

### 7. dispute_notification

**Variables:** {{1}} client name, {{2}} vendor name, {{3}} booking date

**Body:**
```
Hi {{1}}, we received a dispute regarding your {{3}}
appointment with {{2}}. Our team is reviewing it and
will respond within 48 hours.
```

**Buttons:** None required — informational.

**Triggered by:** Dispute raised by either party on a completed booking.

**Sample values for submission:** Chioma, Hillary, 15th July

---

## VENDOR-SIDE TEMPLATES

### 8. vendor_daily_digest_tomorrow

**Variables:** {{1}} vendor name, {{2}} formatted list of tomorrow's
bookings

**Body:**
```
Hi {{1}}, here's tomorrow's schedule:

{{2}}

Reply READY if you're all set, or let us know if
anything's changed.
```

**Open question — verify before submitting:** confirm in WhatsApp
Manager whether a single variable can contain line breaks for a
multi-booking list. If not supported, fall back to fixed numbered slots
(e.g. separate {{2}} time, {{3}} client, {{4}} time, {{5}} client pairs
for up to a fixed number of bookings, with overflow handled by a
follow-up message). Check this directly in the template editor — type
a multi-line sample into the variable field and see if it's accepted
before finalising the variable structure.

**Buttons:** Quick reply — "READY"

**Triggered by:** Once per vendor per day, evening before, only if they
have at least one booking the next day.

---

### 9. vendor_daily_digest_today

**Variables:** {{1}} vendor name, {{2}} formatted list of today's bookings

**Body:**
```
Good morning {{1}}! Today's schedule:

{{2}}

Have a great day 💅
```

**Buttons:** None required — informational.

**Triggered by:** Once per vendor per day, ~7-8am, only if they have at
least one booking that day.

**Same open question as template 8 applies here.**

---

### 10. vendor_travel_check (Phase 2 — mobile artists only, do not submit for MVP)

**Variables:** {{1}} client name, {{2}} appointment time

**Body:**
```
For {{1}}'s appointment at {{2}} — heading out now?
Reply GO and we'll let them know you're on the way.
```

**Buttons:** Quick reply — "GO"

**Triggered by:** 1hr before a mobile-artist booking's `scheduled_at`.

---

### 11. vendor_arrival_check — REVISED for variable-position rule

**Original body rejected:** `{{1}}'s appointment time has arrived...`
— variable led the message with no static text before it.

**Corrected body:**

**Variables:** {{1}} client name

**Body:**
```
For {{1}}'s appointment — the time has arrived.
Are they there and ready to start?
```

**Buttons:** Quick reply — "YES" / Quick reply — "WAITING"

**Triggered by:** At `bookings.scheduled_at`, if not yet marked started.

**Sample values for submission:** Chioma

---

### 12. vendor_waiting_checkin

**Variables:** {{1}} client name, {{2}} minutes waited

**Body:**
```
You've been waiting {{2}} minutes for {{1}}.
Cancel and keep the deposit, or keep waiting?
```

**Buttons:** Quick reply — "CANCEL" / Quick reply — "KEEP WAITING"

**Triggered by:** 30 minutes after vendor replies WAITING, repeating per
`policies.waiting_limit_minutes` until resolved.

**Sample values for submission:** Chioma, 30

---

### 13. vendor_late_minutes_request

**Variables:** {{1}} client name

**Body:**
```
Got it. How many minutes behind are you running for
{{1}}'s appointment?
```

**Buttons:** None — this expects a free-text numeric reply, not a fixed
vocabulary word. Parse the reply as minutes.

**Triggered by:** Vendor replies LATE to a client-facing flow trigger.

**Sample values for submission:** Chioma

---

### 14. vendor_completion_check — payment meaning removed

**Note:** this template's trigger no longer has any payment/escrow
meaning. DONE only marks the booking complete and updates stats. See
notifications-spec.md and trust-reputation-spec.md for the full,
current behaviour.

**Variables:** {{1}} client name

**Body:**
```
How did {{1}}'s appointment go? Reply DONE when
you've finished so we can update your records.
```

**Note on wording:** the original draft of this body said "...reply
DONE so we can process payment" — that phrasing is now incorrect since
payment is already settled at booking time, not triggered by
completion. Updated to "update your records" to reflect the actual
no-escrow behaviour.

**Buttons:** Quick reply — "DONE"

**Triggered by:** At `bookings.scheduled_at` + `duration_minutes`
(estimated end time).

**Sample values for submission:** Chioma

---

### 15. vendor_portfolio_upload_confirm

**Variables:** None — generic confirmation text, sent in response to an
inbound image (this is a SERVICE message within the 24-hour window
triggered by their own message, not a template requiring pre-approval,
since the vendor messaged first by sending the image).

**Body (free-form, not a template):**
```
Got it 📸 Post this to your portfolio?
Reply with the service name (e.g. "acrylic chrome")
or just YES to post. Reply NO to discard.
```

**Note:** This is NOT submitted as a template. Because the vendor
initiated contact by sending an image, this falls inside the 24-hour
service window and can be sent as a free-form message. Listed here for
completeness since it's part of the same notification system, but it
does not require Meta approval.

---

## SUBMISSION CHECKLIST

Before building any worker job that depends on a template:

1. Submit all MVP-scope templates above through WhatsApp Manager (or
   the Message Templates API) under your verified WABA. Skip templates
   4 and 10 (on_way_alert, vendor_travel_check) — these are Phase 2,
   mobile-artist-only, not needed for MVP.
2. Mark every template category as UTILITY at submission. If Meta
   auto-flags a specific template as Marketing despite a neutral
   framing (see rebooking_nudge above), do not force it through as
   Utility — accept the reclassification and budget accordingly, or
   revise the wording further and resubmit.
3. Add a sample value for every variable when submitting — Meta uses
   this to evaluate content and approves faster with samples included.
   Use the sample values listed under each template above.
4. For any URL button, enter the FULL valid URL in the "Add sample URL"
   field, not just the dynamic variable portion — see the note under
   rebooking_nudge for the exact issue this caused during submission.
5. Before submitting any new template body, manually check it does not
   start or end with a variable — add static lead-in/lead-out text if
   it does. See the "Important — submission learnings" section above.
6. Wait for APPROVED status before referencing the template name in any
   BullMQ job or API call. Sending against a non-approved template name
   will fail.
7. Confirm the multi-line/list-variable question on templates #8 and #9
   directly in the WhatsApp Manager template editor before finalising
   — type a multi-line sample into the variable field and observe
   whether it's accepted. Use the fixed-slot fallback noted under each
   template if not supported.
8. Template names, once approved, cannot be edited beyond minor typo
   fixes. If wording needs to materially change later, create a new
   template version with a new name rather than trying to edit
   in place.

## CROSS-REFERENCE

This spec implements the message content for every trigger defined in
notifications-spec.md. Read that document first for the full timing
logic, batching rules, and one-word reply vocabulary — this document
only covers the exact approved wording and variable structure for each
message.

For the payment model these templates assume (no escrow, immediate
vendor payout, vendor-initiated refunds), see trust-reputation-spec.md.