import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─────────────────────────────────────────────────────────────────────────────
// Database connection
// Uses DATABASE_URL from environment.
// In development: Supabase connection string
// In production: Supabase pooler connection string (port 6543)
// ─────────────────────────────────────────────────────────────────────────────

// tsx doesn't auto-load .env.local — do it here so DATABASE_URL is available
// whether the package is consumed by the API, worker, or drizzle-kit
if (!process.env['DATABASE_URL']) {
  try {
    const pkgDir = dirname(fileURLToPath(import.meta.url));
    const lines = readFileSync(resolve(pkgDir, '../../../.env.local'), 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && !(key in process.env)) process.env[key] = val;
    }
  } catch {
    // no .env.local — env vars must be set externally (production)
  }
}

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Use pooled connection in production
const isProduction = process.env['NODE_ENV'] === 'production';

export const sql = postgres(connectionString, {
  max: isProduction ? 10 : 3,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(sql, {
  schema,
  logger: !isProduction,
});

export type Database = typeof db;

// Re-export schema for convenience
export * from './schema.js';
