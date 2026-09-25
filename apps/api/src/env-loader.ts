import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env.local from repo root before any other module needs env vars.
// Must be the first static import in api/src/index.ts.
const dir = dirname(fileURLToPath(import.meta.url));
try {
  const raw = readFileSync(resolve(dir, '../../../.env.local'), 'utf-8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && !(key in process.env)) process.env[key] = val;
  }
} catch {
  // no .env.local — env vars must be set externally (production / CI)
}

// @clerk/fastify/dist/index.js calls apiUrlFromPublishableKey(CLERK_PUBLISHABLE_KEY)
// at MODULE LOAD TIME. If the key is a placeholder (not valid base64), atob() throws.
// Setting CLERK_API_URL makes Clerk skip that call and use the URL directly.
const clerkKey = process.env['CLERK_PUBLISHABLE_KEY'];
if (clerkKey && !process.env['CLERK_API_URL']) {
  const encoded = clerkKey.split('_')[2] ?? '';
  try {
    atob(encoded);
  } catch {
    process.env['CLERK_API_URL'] = 'https://api.clerk.com';
  }
}
