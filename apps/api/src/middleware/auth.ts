import type { FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

// _getAuth is set when clerkAuthPlugin is registered, before any request arrives.
// Using `any` avoids a `typeof import('@clerk/fastify')` that tsx might emit as
// a runtime require() and crash on an invalid CLERK_PUBLISHABLE_KEY placeholder.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _getAuth: any = null;

// fp() unwraps Fastify's plugin scope so clerkPlugin's decorators are visible
// to all sibling plugins (vendorRoutes, bookingRoutes, etc.), not just children.
export const clerkAuthPlugin = fp(async (fastify) => {
  const { clerkPlugin, getAuth } = await import('@clerk/fastify');
  _getAuth = getAuth;
  await fastify.register(clerkPlugin);
});

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const auth = _getAuth(request);
  if (!auth.userId) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
  }
}

export function getClerkUserId(request: FastifyRequest): string {
  const auth = _getAuth(request);
  if (!auth.userId) throw new Error('getClerkUserId called without auth guard');
  return auth.userId;
}
