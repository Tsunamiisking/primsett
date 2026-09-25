import { Worker } from 'bullmq';
import { redis } from './lib/redis.js';
import { processNotification } from './processors/notifications.js';
import { processDigest } from './processors/digest.js';

const connection = redis;

// ── Notifications worker — per-booking messages (client + vendor) ──────────────
const notificationsWorker = new Worker(
  'notifications',
  async (job) => {
    await processNotification(job);
  },
  { connection, concurrency: 5 },
);

// ── Reminders worker — client timed reminders (24hr, 2hr) ─────────────────────
const remindersWorker = new Worker(
  'reminders',
  async (job) => {
    await processNotification(job);
  },
  { connection, concurrency: 10 },
);

// ── Digest worker — vendor daily digests (night-before, morning-of) ───────────
const digestWorker = new Worker(
  'digest',
  async (job) => {
    await processDigest(job);
  },
  { connection, concurrency: 3 },
);

for (const worker of [notificationsWorker, remindersWorker, digestWorker]) {
  worker.on('failed', (job, err) => {
    console.error(`[worker] Job ${job?.id} (${job?.name}) failed:`, err.message);
  });
  worker.on('completed', (job) => {
    console.log(`[worker] Job ${job.id} (${job.name}) completed`);
  });
}

console.log('[worker] All workers started — notifications, reminders, digest');

process.on('SIGTERM', async () => {
  await notificationsWorker.close();
  await remindersWorker.close();
  await digestWorker.close();
  process.exit(0);
});
