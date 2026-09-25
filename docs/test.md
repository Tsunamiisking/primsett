# Test: Newline support — run NOW against reminder_24h (already approved)

This test answers the same core question as the original
whatsapp-newline-test.md, but uses reminder_24h instead of
vendor_daily_digest_tomorrow, since reminder_24h should already be
approved and we don't need to wait for the digest template's review to
finish.

**Target format confirmed:** line breaks between bookings in the
schedule string, not commas or pipes. This test exists to confirm
whether the WhatsApp API actually preserves \n characters at send
time — if it does, the digest templates get built exactly as designed.
If not, we fall back to a different separator and update this doc.

---

## reminder_24h's actual variable structure (for reference)

From whatsapp-templates-spec.md, the approved body is:

```
Hi {{1}}, just a reminder — your appointment with {{2}}
is tomorrow ({{4}}) at {{3}}.

Reply YES to confirm you'll be there.
```

Four variables: {{1}} client name, {{2}} vendor name, {{3}} time,
{{4}} date.

For this test, we are NOT trying to send a sensible real message — we
are deliberately injecting a newline into one variable just to observe
whether the API accepts and preserves it. Using {{2}} (vendor name)
for this since it's a plain text slot in the middle of the sentence.

---

## The test request

Replace PHONE_NUMBER_ID, ACCESS_TOKEN, and YOUR_TEST_NUMBER with your
real values from the Meta developer dashboard.

```bash
curl -X POST \
  "https://graph.facebook.com/v19.0/PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "YOUR_TEST_NUMBER",
    "type": "template",
    "template": {
      "name": "reminder_24h",
      "language": { "code": "en_US" },
      "components": [
        {
          "type": "body",
          "parameters": [
            { "type": "text", "text": "Chioma" },
            { "type": "text", "text": "Primsett\nTest Line Two\nTest Line Three" },
            { "type": "text", "text": "2:00 PM" },
            { "type": "text", "text": "15th July" }
          ]
        }
      ]
    }
  }'
```

Note: the message that arrives will read strangely — "your appointment
with Primsett / Test Line Two / Test Line Three is tomorrow..." — that
is expected and fine. We are not testing for a sensible message here,
only testing whether the three lines stack visually or collapse into
one line/space when the message is delivered.

---

## What each outcome means

**HTTP 200 response AND the delivered message shows "Primsett",
"Test Line Two", "Test Line Three" on three visually separate lines:**

Confirmed — newlines survive at runtime through the Cloud API, even
though the WhatsApp Manager submission UI doesn't allow typing them
into a sample field. Build vendor_daily_digest_tomorrow and
vendor_daily_digest_today exactly as originally designed: single {{2}}
variable, backend joins each booking with a real \n character, scales
to any number of bookings, line-break format as decided.

**HTTP 200 response BUT the three lines collapse into one line or get
joined with a space:**

Newlines are stripped somewhere in delivery despite the API accepting
the request. Switch the backend string-building function to use a
different separator instead — since line breaks were the preferred
visual format, the next best option, in order of preference:
  1. Try `\n\n` (double newline) in case single newlines specifically
     get collapsed but paragraph breaks survive — worth a quick second
     test if the first attempt fails, before falling back further
  2. If that also fails, fall back to " | " as the separator
     (pipe-separated, single visual line)

**The API call itself returns an error (not HTTP 200):**

Note the exact error code and message. If it specifically references
the \n character or "invalid parameter," that's a hard confirmation
newlines aren't accepted at all via this endpoint — skip straight to
the pipe-separator fallback, no need to retry with \n\n.

---

## Once tested

**RESULT: HARD REJECTION — newlines are not allowed in parameter values.**

Tested 2026-06-30 using the `new_message` template (the only approved
template with a body variable on this WABA). The API returned HTTP 400
error code 132018 before delivery:

> "Param text cannot have new-line/tab characters or more than 4
> consecutive spaces"

This is a validation error, not a delivery-side strip. `\n` and `\n\n`
are both blocked at the API layer. Skip both fallbacks and go straight
to the pipe separator.

**Confirmed approach for vendor_daily_digest_tomorrow and
vendor_daily_digest_today:** join bookings with ` | ` in the backend
string-building function. Example output:

```
10:00 AM — Gel Manicure | 1:00 PM — Lash Refill | 4:00 PM — Nail Art
```

Update notifications-spec.md Mechanism 1 with this confirmed approach,
and write the booking-list-to-string formatting function accordingly
in the worker job (apps/worker) once building begins.