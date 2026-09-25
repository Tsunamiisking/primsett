/** Normalise any Nigerian phone number to E.164 (+2348012345678). */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length === 13) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `+234${digits.slice(1)}`;
  if (digits.length === 10) return `+234${digits}`;
  if (digits.startsWith('234')) return `+${digits}`;
  return `+${digits}`;
}

/** Strip E.164 prefix to get Meta webhook format (no +). */
export function toMetaFormat(e164: string): string {
  return e164.startsWith('+') ? e164.slice(1) : e164;
}

export function isValidNigerianNumber(raw: string): boolean {
  const normalised = normalisePhone(raw);
  return /^\+234[789]\d{9}$/.test(normalised);
}
