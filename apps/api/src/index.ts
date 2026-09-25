// env-loader MUST be first — it sets process.env before any module that reads
// env vars at load time (e.g. @clerk/fastify/constants, posthog-node) is evaluated.
import './env-loader.js';

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { analytics } from './lib/analytics.js';
import { vendorRoutes } from './routes/vendors.js';
import { bookingRoutes } from './routes/bookings.js';
import { whatsappWebhookRoutes } from './routes/webhooks/whatsapp.js';
import { paystackWebhookRoutes } from './routes/webhooks/paystack.js';
import { clerkAuthPlugin } from './middleware/auth.js';

const server = Fastify({
  logger: {
    level: process.env['NODE_ENV'] === 'production' ? 'warn' : 'info',
    redact: [
      'req.headers.authorization',
      'req.body.phone',
      'req.body.whatsapp_number',
      'req.body.card_number',
    ],
  },
  trustProxy: true,
});

await server.register(helmet);

await server.register(cors, {
  origin: [process.env['WEB_URL'] ?? 'http://localhost:3000'],
  credentials: true,
});

await server.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  allowList: ['/webhooks/paystack', '/webhooks/whatsapp'],
});

server.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: process.env['npm_package_version'] ?? '0.1.0',
}));

await server.register(clerkAuthPlugin);
await server.register(vendorRoutes, { prefix: '/api/v1' });
await server.register(bookingRoutes, { prefix: '/api/v1' });
await server.register(whatsappWebhookRoutes, { prefix: '/webhooks' });
await server.register(paystackWebhookRoutes, { prefix: '/webhooks' });

const start = async () => {
  try {
    const port = parseInt(process.env['PORT'] ?? '4000', 10);
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`API running on port ${port}`);
  } catch (err) {
    server.log.error(err);
    await analytics.shutdown();
    process.exit(1);
  }
};

start();

export { server };
