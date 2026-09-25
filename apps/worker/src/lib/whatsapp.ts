const BASE_URL = `https://graph.facebook.com/v19.0`;

function phoneNumberId() {
  return process.env['WHATSAPP_PHONE_NUMBER_ID'] ?? '';
}
function accessToken() {
  return process.env['WHATSAPP_ACCESS_TOKEN'] ?? '';
}

async function post(body: object): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/${phoneNumberId()}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...body }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[whatsapp] send failed:', res.status, err);
    return null;
  }

  const data = (await res.json()) as { messages?: Array<{ id: string }> };
  return data.messages?.[0]?.id ?? null;
}

/**
 * Send a free-form text message. Only valid within the 24-hour service window
 * (i.e. after the recipient has messaged the business number first).
 * Use sendWhatsAppTemplate for all system-initiated outbound messages.
 */
export async function sendWhatsApp(to: string, body: string): Promise<string | null> {
  return post({ to, type: 'text', text: { body } });
}

/**
 * Send an approved Meta template message.
 * templateName must be approved in WhatsApp Manager before use.
 * bodyParams maps to {{1}}, {{2}}, ... in the template body.
 * urlButtonParam is the dynamic suffix for a URL button (if the template has one).
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  bodyParams: string[],
  urlButtonParam?: string,
): Promise<string | null> {
  const components: object[] = [];

  if (bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams.map((text) => ({ type: 'text', text })),
    });
  }

  if (urlButtonParam) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: urlButtonParam }],
    });
  }

  return post({
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'en' },
      components,
    },
  });
}
