import Redis from 'ioredis';

const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

export const redis = new Redis(url, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  lazyConnect: true,
});

redis.on('error', (err) => {
  // Suppress ECONNREFUSED noise during startup
  if ((err as NodeJS.ErrnoException).code !== 'ECONNREFUSED') {
    console.error('[redis]', err.message);
  }
});

/** Store a value with optional TTL in seconds. */
export async function rset(key: string, value: string, ttlSeconds?: number) {
  if (ttlSeconds) {
    await redis.set(key, value, 'EX', ttlSeconds);
  } else {
    await redis.set(key, value);
  }
}

export async function rget(key: string): Promise<string | null> {
  return redis.get(key);
}

export async function rdel(key: string): Promise<void> {
  await redis.del(key);
}
