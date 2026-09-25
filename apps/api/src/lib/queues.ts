import { Queue } from 'bullmq';
import { redis } from './redis.js';

const connection = redis;

export const notificationsQueue = new Queue('notifications', { connection });
export const remindersQueue = new Queue('reminders', { connection });
export const digestQueue = new Queue('digest', { connection });
