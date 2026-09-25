# Slotly

Nigerian beauty booking platform — booking management, client communication,
and marketplace for nail techs, lash techs, makeup artists, and stylists.

## Before you touch anything

Read `CLAUDE.md`. Every architectural decision is documented there with the
reasoning behind it. Every feature traces back to a real user interview.

## Structure

```
slotly/
  apps/
    web/        Next.js 14 — Tech App (PWA) + Booking Pages + Marketplace
    api/        Fastify — REST API + Webhook handlers
    worker/     BullMQ — Background jobs
  packages/
    database/   Drizzle ORM schema + migrations
    types/      Shared TypeScript types
    utils/      Shared utilities
  docs/
    personas.md
    features.md
    edge-cases.md
    architecture.md
```

## Quick start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Fill in your values in .env.local

# Generate and run database migrations
npm run db:generate
npm run db:migrate

# Start all apps in development
npm run dev
```

## Key rules (see CLAUDE.md for full list)

- All money in **kobo** (integer). Never floats.
- All timestamps **TIMESTAMPTZ** (UTC). Display in Africa/Lagos at UI layer.
- All IDs are **UUID v4**.
- **Never hard delete** business data — soft deletes everywhere.
- **Every API response fires a PostHog event** before returning.
- **Deposits held in escrow** until booking.completed_at is set.
- **WhatsApp numbers in E.164 format** (+2348012345678) everywhere.

## Stack

Next.js 14 · TypeScript · Fastify · Drizzle ORM · PostgreSQL (Supabase) ·
Redis (Upstash) · BullMQ · Clerk · Paystack · Meta Cloud API ·
Cloudflare R2 · PostHog · Resend · Railway
