# Architecture and Deployment Overview

## High-Level Architecture

The platform is a Next.js application with API routes, server-side business logic, database-backed workflows, provider integrations, and role-based dashboards.

Core areas:

- public landing pages and auth screens
- vendor dashboards and auction participation
- adjuster case creation
- manager approval and auction operations
- finance payment/reconciliation workflows
- admin configuration and white-label setup
- API routes for cases, auctions, KYC, payments, documents, reports, notifications, and business policy

## Main Technical Components

| Component | Purpose |
| --- | --- |
| Next.js / React | Web application, dashboards, public pages, API routes. |
| PostgreSQL / Drizzle ORM | Core operational database and schema access. |
| NextAuth | Authentication/session framework. |
| Redis / Vercel KV | Rate limiting, session/cache helpers, queues/idempotency helpers. |
| Cloudinary | Media/document storage integration. |
| Paystack | Payment processing and webhook events. |
| Dojah | KYC and identity verification provider integration. |
| Resend / Termii | Email and SMS notification integrations. |
| Business Policy Service | White-label policy, branding, payment, document, and auction configuration. |

## Deployment Model

The intended enterprise model is separate configuration per insurer deployment.

Each insurer deployment should have separate:

- environment variables
- database connection
- application URL/domain
- provider credentials
- payment settings
- KYC settings
- email/SMS sender details
- branding/business policy

This model reduces cross-client data leakage risk compared with a shared tenant database model.

## Environment and Secrets

The repository includes `.env.example` and `.env.staging.example` to show required configuration values. Production secrets should live in a managed platform secret store and should not be committed to source control.

Client-specific secrets include:

- database URLs
- auth secrets
- OAuth client secrets
- Paystack secret keys
- Dojah API/webhook secrets
- Cloudinary credentials
- email/SMS provider credentials
- encryption keys
- cron secrets

## Deployment Checklist

Before a new insurer deployment:

1. Create isolated database/project.
2. Configure deployment domain.
3. Set environment variables in secret manager.
4. Configure provider credentials.
5. Apply migrations.
6. Configure business policy and branding.
7. Verify KYC, payment, document, notification, and cron routes.
8. Run smoke tests.
9. Confirm backup/restore coverage.
10. Confirm support escalation path.

## Evidence

- `Dockerfile`
- `vercel.json`
- `.env.example`
- `.env.staging.example`
- `drizzle.config.ts`
- `src/lib/db/drizzle.ts`
- `src/lib/redis/client.ts`
- `src/features/business-policy/*`

