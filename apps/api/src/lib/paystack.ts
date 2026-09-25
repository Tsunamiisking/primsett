const BASE = 'https://api.paystack.co';
const SECRET = () => process.env['PAYSTACK_SECRET_KEY'] ?? '';

async function paystackFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${SECRET()}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const json = await res.json() as { status: boolean; data: T; message: string };
  if (!json.status) throw new Error(`Paystack error: ${json.message}`);
  return json.data;
}

export interface PaystackInitResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export async function initializeTransaction(params: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackInitResult> {
  return paystackFetch<PaystackInitResult>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo, // Paystack uses kobo natively
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });
}

export async function verifyTransaction(reference: string): Promise<{
  status: string;
  amount: number;
  reference: string;
  customer: { email: string };
}> {
  return paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`);
}

export interface PaystackWebhookEvent {
  event: string;
  data: {
    reference: string;
    status: string;
    amount: number;
    metadata?: Record<string, unknown>;
  };
}
