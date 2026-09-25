import { PostHog } from 'posthog-node';

// No-op stub with the same shape as PostHog — used when POSTHOG_API_KEY is absent
const noop = new Proxy({} as PostHog, {
  get: () => () => {},
});

export const analytics: PostHog =
  process.env['POSTHOG_API_KEY']
    ? new PostHog(process.env['POSTHOG_API_KEY'], {
        host: process.env['POSTHOG_HOST'] ?? 'https://app.posthog.com',
        flushAt: 20,
        flushInterval: 10000,
      })
    : noop;
