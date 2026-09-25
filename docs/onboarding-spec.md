# Onboarding Specification — Finalised

This document is the single source of truth for the adaptive onboarding flow.
It supersedes any earlier onboarding description in CLAUDE.md or other docs.
Read this in full before implementing any onboarding screen, route, or
vendor configuration logic.

---

## Core principle

Never ask what you already know. Never show a screen, or a question within
a screen, that an earlier answer has already resolved. Every answer should
map to a clear, actionable system configuration — no vague or "not sure"
options that the backend cannot act on. If an option doesn't change what
the system configures, it shouldn't exist as a separate option.

---

## MVP target bracket — who onboarding is designed for

The MVP is built for **solo, fixed-location vendors** — home studio or
rented space/salon, 2–5 clients per day, working alone, in Lagos.

This is NOT mobile artists (Precious's bracket) or studio owners with
staff (Tunde's bracket) as the primary design target. Those personas can
pass through onboarding and the system should configure correctly for
them where the logic naturally extends (see Path C below), but the MVP
feature set, copy, and flow are optimised for the solo fixed-location
case first.

Reference personas for this bracket: Dami (informal solo) and Zara
(student solo) are the primary fit. Hillary (structured solo) is also in
this bracket but with more advanced needs that activate Phase 2 features.

---

## Screen 1 — What kind of work do you do?

**Question:** "What kind of work do you do?"
**Type:** Multi-select
**Options:**
- Nails & lash
- Makeup
- Hair
- Salon / studio (multi-staff, fixed location)

**Conditional sub-question — appears INLINE on Screen 1, only if
"Salon / studio" is selected:**

"How many people work with you?"
- Just me
- 2–5 staff
- 6 or more

**Logic:**
- If "Salon / studio" is selected (alone or combined with other options),
  show the staff count sub-question inline, right under that option card.
  Do NOT show a separate staff-count screen later (this replaces the old
  Screen 4 design).
- If only solo service types are selected (Nails & lash / Makeup / Hair,
  with NO "Salon / studio"), do not show any staff question anywhere in
  onboarding. The vendor is solo by default.
- This answer determines `vendors.service_types` and whether
  `onboarding_persona` leans toward `studio_owner` vs the solo personas.

---

## Screen 2 — How you work and how you price

Screen 2 contains two distinct question blocks, visually separated (a
divider or clear section label between them), not crammed as one
undifferentiated list.

### Block A — Where you work

**Question:** "Where do you work?"
**Type:** Single-select
**Options:**
- My home studio
- A rented space or salon
- I go to my clients
- Both — I have a base but also visit clients

**Critical naming rule:** Do NOT use a bare "Mix of both" option. It is
ambiguous — the user doesn't know which two things are being mixed.
Always spell out explicitly what is being combined, as shown above.

**Logic:**
- "I go to my clients" or "Both — I have a base but also visit clients"
  → sets `vendors.location_type = 'mobile'` or `'both'`
  → activates: on-my-way alert, waiting timer, client address field
  (Phase 2 features — see note below)
- "My home studio" or "A rented space or salon" → `location_type = 'fixed'`
- This question is about TRAVEL BEHAVIOUR, not physical location type.
  The distinction between "home studio" and "rented space" does NOT
  change any feature configuration — it is stored for display purposes
  only (shown on the vendor's public page). The only thing that matters
  functionally is whether they ever travel to clients.

### Block B — Pricing range

**Question:** "What's your price range per service?"
**Type:** Two numeric inputs (Naira)
**Format:** "From ₦____ to ₦____"

**Logic:**
- This replaces the earlier "how is your pricing structured" multiple
  choice question entirely. Do not ask about pricing structure
  (flat / varies by options / varies by location) during onboarding.
- The range is stored on the vendor profile for marketplace display
  ("from ₦X") and to give the profile a non-empty pricing signal on day one.
- Detailed pricing (variants, add-ons, location tiers, day-based
  surcharges) is configured AFTER onboarding, inside the service builder
  in the main app — not during onboarding. Keep onboarding fast; defer
  pricing complexity to first-session setup inside the app.

---

## Screen 3 — Payment and policy

This screen is SEQUENCED, not a flat list. The second question only
appears conditionally based on the answer to the first.

### Question 1 — Deposit collection

**Question:** "Do you collect payment before appointments?"
**Type:** Single-select
**Options:**
- Yes, always
- Sometimes
- No — I want to start

**Critical rule:** Do NOT include a "Not sure yet" option. It does not
map to any actionable configuration. "Sometimes" already covers
ambiguous/inconsistent cases (this is literally Dami's real answer in
research — "most pay before, some make half payment"). Forcing a
near-fit choice between clear options is better than offering a vague
option the backend cannot act on.

**Logic — this determines whether Question 2 is shown:**
- If "Yes, always" or "Sometimes" → proceed to Question 2 (cancellation
  policy) below.
- If "No — I want to start" → SKIP Question 2 entirely. Show a single
  reassurance line instead: *"No problem — we'll set up a simple deposit
  and cancellation policy together once you're in."* Then complete
  onboarding. There is nothing meaningful to ask about cancellation
  policy for a vendor who has never collected a deposit — asking it
  anyway adds friction for exactly the persona (Dami's bracket) who is
  most likely to abandon onboarding if it feels long.

### Question 2 — Cancellation policy (conditional — see above)

**Question:** "Do you have a cancellation policy?"
**Type:** Single-select
**Options:**
- Yes, written and I send it out
- Kind of — it's in my head
- Not really, I handle it case by case

**Logic:**
- "Yes, written and I send it out" → pre-load the policy builder UI on
  first app session, prompt: "Paste your existing policy and we'll set
  it up." Sets `onboarding_persona` toward `structured_solo` (Hillary's
  bracket). Deposit gate ON by default at vendor-specified terms.
- "Kind of — it's in my head" and "Not really, I handle it case by case"
  → these two options map to IDENTICAL backend configuration. Both
  result in: suggest the starter policy template, one-tap adopt, fully
  editable after. The two options exist only for the user's emotional
  accuracy (letting them pick the phrasing that feels true to them) —
  do not build separate logic paths for these two answers.

---

## Full screen flow by path

### Path A — Solo vendor, no deposits yet (e.g. new signups, Dami-type)
Screen 1 → Screen 2 (Block A + B) → Screen 3 (Q1 only, reassurance shown)
→ Done. Shortest path. ~60–70 seconds.

### Path B — Solo vendor, has some payment habit (Dami, Zara typical)
Screen 1 → Screen 2 (Block A + B) → Screen 3 (Q1 + Q2) → Done.
~80–90 seconds.

### Path C — Solo vendor, fully structured (Hillary typical)
Same screens as Path B, but answers trigger pre-loading the policy
builder and stricter default deposit settings. ~80–90 seconds — same
screen count as Path B, different downstream configuration.

### Path D — Salon/studio selected on Screen 1
Screen 1 (with inline staff count) → Screen 2 → Screen 3 → Done.
Slightly longer due to the inline staff question. ~90–100 seconds.

There is no longer a separate "Screen 4." The inline staff question on
Screen 1 fully replaces it. Never show a staff-count question to a
vendor who only selected solo service types.

---

## What gets configured automatically — summary table

| Answer | Configures |
|---|---|
| "Salon / studio" selected | `service_types` includes studio flag, staff count captured inline |
| Only solo service types selected | No staff question shown anywhere |
| "I go to my clients" / "Both" | `location_type = mobile/both`, Phase 2 travel features flagged for later activation |
| "My home studio" / "Rented space" | `location_type = fixed`, no travel features needed |
| Price range entered | Stored for marketplace display; detailed pricing deferred to in-app service builder |
| "No — I want to start" (deposits) | Skip cancellation policy question; show reassurance; deposit gate OFF by default, nudged in week 2 |
| "Yes, always" / "Sometimes" (deposits) | Proceed to cancellation policy question; deposit gate ON by default |
| "Yes, written" (policy) | Pre-load policy builder; prompt to paste existing policy |
| "Kind of" / "Not really" (policy) | Identical config: suggest starter template, one-tap adopt |

---

## Implementation notes for Claude Code

- Onboarding state should be stored incrementally as the user progresses
  through screens, not only on final submit — if they abandon mid-flow,
  we want partial data and an `onboarding_abandoned` analytics event with
  `last_screen_seen`.
- Every screen transition fires a `onboarding_screen_completed` event
  (see CLAUDE.md analytics section) with the screen number and answers
  selected.
- The conditional skip logic (Path A skipping Question 2 on Screen 3,
  inline staff question on Screen 1) must be implemented as actual
  conditional rendering — not a screen that briefly flashes then auto-
  skips. The user should never see a screen they don't need to answer.
- Reference the MVP target bracket section above when writing onboarding
  copy — default tone and pacing should optimise for the solo,
  fixed-location, possibly-first-time-collecting-deposits vendor, since
  that is the primary MVP user.