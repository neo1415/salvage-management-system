# Production Handoff Audit - 2026-06-16

This document is the current canonical handoff note for engineers taking over the Salvage Bridge / NEM Salvage Management System codebase. It summarizes the present operational state instead of repeating older phase-completion notes.

## Product Scope Snapshot

The implemented system materially covers the original salvage-management scope:

- Multi-role authentication and role-based dashboards for vendors, adjusters, salvage managers, finance officers, and system admins.
- Case creation with media, location, voice note/offline-oriented workflows, AI-assisted assessment, manager approval, and reporting.
- Auction creation, bidding, countdown/closure logic, payment deadlines, payment verification, document signing, pickup confirmation, and audit trails.
- Vendor onboarding, tiered KYC, business policy controls, notifications, leaderboard/performance tracking, and reports.
- Finance and operations views for payments, settlement, fraud queues, pickup handoff, recovery control, and exception visibility.

The app is beyond the original CloudPilar high-level HLD, which described discovery, bidding, vendor management, approval workflows, notifications, payments, reports, integrations, and RBAC at a broad level.

## Production Readiness Position

Status: **UAT-ready with manual production gates**, not "missing core functionality."

The application can be shown for acceptance and payment discussions because the contracted business functionality is substantially present. Before public launch, the following gates should be closed or explicitly accepted as post-launch maintenance/change requests.

## Launch Gates

### Must Resolve Before Public Production

1. **Credential hygiene**
   - `npm run security:scan` passed on 2026-06-16.
   - Because this project previously had credential exposure risk documented, production launch still requires confirmed key rotation, GitHub secret scanning/push protection, and environment review.

2. **Production observability accounts**
   - Sentry SDK wiring is in code and the production build passes.
   - Runtime reporting still requires production env values for `NEXT_PUBLIC_SENTRY_DSN` or `SENTRY_DSN`.
   - Source-map upload requires `SENTRY_TOKEN` or `SENTRY_AUTH_TOKEN`, plus `SENTRY_ORG` and `SENTRY_PROJECT`.
   - Add uptime checks and external cron/webhook failure alerts in the deployment provider or monitoring provider.

3. **Provider/device delivery evidence**
   - Web push VAPID keys are present in the local and staging env files.
   - Push subscription, push fan-out, bidding OTP push, and a self-test endpoint are implemented.
   - Real phone delivery must still be validated on the deployed HTTPS origin with browser permission granted and the service worker installed.
   - Termii live Sender ID/DND registration is a provider process and is not a code blocker while SMS fallback/provider credentials remain configured.

4. **Backups and disaster recovery**
   - SLA promises daily database backups and standard recovery support.
   - Supabase documentation states daily automatic backups are for Pro, Team, and Enterprise projects; Free tier projects should regularly export data with the Supabase CLI and keep off-site backups.
   - Code-side backup support now exists:
     - `/api/cron/daily-maintenance` is the single Vercel-free-plan daily cron entry.
     - `/api/cron/daily-backup` creates a compressed logical JSON backup and uploads it to a private Supabase Storage bucket when service-role storage env values are configured.
     - `npm run db:backup` writes a manual local gzip backup to `protected-backups/`.
   - Before launch, decide whether to upgrade Supabase or operate the provided backup export process with restore-drill evidence.

5. **Operational code annotations and open engineering work**
   - A source annotation sweep on 2026-06-16 found no remaining `TODO`, `FIXME`, `not implemented`, `would be created`, or `current-user-id` markers in `src/`.
   - Closed in this handoff pass:
     - `src/features/reconciliation/services/reconciliation.service.ts` now routes reconciliation discrepancy alerts to finance officers and system admins and creates in-app notifications.
     - `src/features/fraud/services/fraud-logging.service.ts` now persists fraud attempts into the fraud alert queue for admin review.
     - `src/app/api/intelligence/interactions/route.ts` now verifies vendor/session ownership for vendor interaction logging.
     - `src/features/kyc/services/document-upload.service.ts` now supports optional ClamAV scanning before KYC document storage.
     - `src/app/api/notifications/push/health/route.ts` now verifies server push configuration and can send a live test push to the signed-in user.
     - `src/app/api/cases/[id]/evidence/export/pdf/route.ts` now creates a branded, access-controlled evidence packet PDF.
   - Payment auto-cancel/forfeit is implemented through payment-deadline cron, forfeiture service, transfer service, and fallback-winner service. Production readiness depends on approving policy values and confirming the single daily maintenance cron in Vercel.

## Verification Run - 2026-06-16

- `npx tsc --noEmit`: passed after Sentry, push-health, and evidence-PDF changes.
- `npm run build`: passed with Next.js production compilation and static generation after Sentry, push-health, and evidence-PDF changes.
- `npm run security:scan`: passed; no exposed secrets found by the project scanner.
- `npm audit --audit-level=high`: passed with 0 vulnerabilities after controlled dependency overrides and lockfile refresh.
- Source annotation sweep: passed for the marker set `TODO|FIXME|not implemented|would be created|current-user-id` under `src/`.

## Remaining Handoff Audit Register

| Item | Status | Can be closed by code now? | Owner / next action |
| --- | --- | --- | --- |
| Dependency advisories | Closed | Yes, closed | `npm audit --audit-level=high` returns 0 vulnerabilities after controlled overrides/lockfile refresh. |
| Credential rotation and provider secret review | Manual launch gate | No | Client/deployment owner must rotate production keys, confirm `.env` values, and enable GitHub secret scanning/push protection. |
| Source stale work markers | Closed | Yes, closed | Source tree now has no `TODO`, `FIXME`, `not implemented`, `would be created`, or `current-user-id` markers. |
| ClamAV malware scanning | Code hook closed, infrastructure manual | Partially | KYC upload scanner hook exists. Production needs a private `clamd` host and env configuration. |
| Payment auto-cancel/forfeit/fallback | Code closed, policy/manual verification remains | Partially | Payment-deadline cron, forfeiture, transfer, fallback-winner services, and single daily maintenance cron exist. Production must approve default policy values and verify cron execution after deployment. |
| Production monitoring and alerting | Code partially closed, account manual | Partially | Sentry SDK is wired and build-verified. Add DSN/org/project env values, uptime checks, cron failure alerts, and webhook alerts. |
| Backup and restore proof | Code support closed, restore proof manual | Partially | Daily backup endpoint and manual backup script exist. Configure private Supabase backup bucket/service role or upgrade Supabase, then run a restore drill and approve RPO/RTO/retention evidence. |
| Socket.IO production strategy | Deployment decision | Partially | App supports real-time paths, but production must decide sidecar/socket hosting versus polling fallback. |
| Heavy PDF/export/AI queue workers | Non-blocking scale enhancement | No | Not a phase-one blocker. Existing flows work synchronously; move to workers only for higher volume or large exports. |
| Branded evidence packet PDF | Closed | Yes, closed | Authorized staff can export secure JSON and branded PDF case evidence packets. |
| Deep claims/finance system integration | Post-launch integration | No | Requires insurer claim-core/GL file/API formats. Not a phase-one blocker. |
| Pseudo escrow wallet/freeze-release | Code present, business acceptance manual | Partially | Wallet deposit freeze, release, forfeiture, transfer, and reconciliation surfaces exist. Formal escrow rollout depends on business/legal acceptance. |
| Advanced ML/photo authenticity | Roadmap only | Not required for UAT | Not a launch gate. Existing fraud/intelligence foundation works; pHash/EXIF/Gemini authenticity can be future value work. |
| Route-level ownership checks | Ongoing security hardening | Partially | Recent vendor interaction and evidence export ownership checks are in place. Continue targeted route tests for every new sensitive route. |
| Live notification delivery | Code closed, device/provider manual | Partially | In-app, SMS/email integrations, push subscription, OTP push, and push self-test endpoint exist. Validate on production HTTPS origin and real devices/providers. |

### Can Be Post-Launch If Client Accepts

- Formal escrow provider/legal rollout beyond the current wallet freeze/release model.
- Advanced fraud AI/photo authenticity checks that are optional intelligence enhancements.
- Hosted or always-on document antivirus infrastructure, if ClamAV is not configured yet. The application hook exists; production needs a reachable `clamd` service or explicit acceptance of fail-open scanning.
- Deep claims-system/finance-system API integration, because it requires the insurer's claim-core/GL file or API formats.

## Security Slice

Strengths:

- Server-side RBAC in `src/proxy.ts` and `src/lib/auth/rbac.ts`.
- Protected dashboard namespaces by role.
- Security headers and CSP in `next.config.ts`.
- Paystack webhook signature checks.
- Audit sanitization utilities.
- Redis-backed login/OTP rate limiting exists in core auth paths.
- KYC, payments, and pickup events are generally auditable.

Risks:

- Targeted review of high-risk case, auction, payment, vendor, KYC, and push routes shows server-side session checks, role checks, and/or owner checks on the inspected routes. Continue the same review pattern for new sensitive routes.
- Targeted browser-storage scan found UI/session-only storage such as PWA splash state, cookie consent, BVN completion marker, and adjuster draft form state. It did not find auth tokens, JWTs, passwords, OTPs, card data, or Paystack secrets stored in local/session storage.
- Release-form HTML preview rendering now sanitizes returned document content with DOMPurify before `dangerouslySetInnerHTML`.
- Local backup folders are excluded from git through `.gitignore`.
- Verbose `console.log` traces remain in development paths, but `next.config.ts` removes console output in production builds. Keep critical server exceptions routed through Sentry and audit logs.
- In-memory process state exists in some hooks/utility areas; server-critical state should remain in DB/Redis only.
- KYC/document uploads now support optional ClamAV scanning. Set `CLAMAV_HOST`/`CLAMD_HOST`, optional `CLAMAV_PORT`/`CLAMD_PORT`, and `KYC_VIRUS_SCAN_REQUIRED=true` to fail closed when the scanner is unavailable.

## Readability / Maintainability Slice

Strengths:

- Feature folders are mostly organized by domain.
- Drizzle schema and services are generally discoverable.
- Tests exist across integration, E2E, dashboard, payment, pickup, KYC, reports, and intelligence flows.
- Business policies, KYC, payments, reporting, and pickup are separated enough for an engineer to follow.

Risks:

- Documentation is too noisy: many historical "complete/fix/status" files make it hard to know what is authoritative.
- Some files are very large, especially payment/deposit services and dashboard/report routes.
- Encoding artifacts appear in some older Markdown files and UI text from earlier Windows/UTF-8 issues.
- Some older comments describe future enhancements; keep them as tickets only when they represent a real remaining requirement.

Recommended handoff actions:

- Keep this file as the top-level readiness note.
- Use `docs/handover/HANDOVER_INDEX.md` as the starting point for engineers and client handover.
- Use `docs/handover/SALVAGE_BRIDGE_FULL_APPLICATION_DOCUMENTATION.md`, `docs/handover/APPLICATION_DOCUMENTATION.md`, `docs/handover/UAT_ACCEPTANCE_CHECKLIST.md`, and `docs/handover/TRAINING_GUIDE.md` as the canonical product, UAT, and training pack.
- Split the largest payment service into orchestration, Paystack adapter, wallet adapter, deadline handling, and notification modules.
- Add ADRs for auction state transitions, payment lifecycle, pickup lifecycle, and KYC lifecycle.

## Scalability Slice

Strengths:

- PostgreSQL is the source of truth for core entities.
- Redis/Upstash is present for caching/rate limiting.
- Dashboard/report caches exist.
- Next.js and service boundaries are compatible with serverless or container deployment.

Risks:

- Socket sidecar / polling strategy needs a production deployment decision.
- Report queries and dashboard aggregates should be watched under real volume; add indexes based on `EXPLAIN ANALYZE`, not guesses.
- Cron/background jobs need single-runner guarantees to avoid duplicate closure/payment/document work.
   - PDF exports and AI/document processing should be queued for larger files and higher concurrency when production volume justifies worker infrastructure.

Recommended scale path:

1. Keep transactional state in Postgres.
2. Use Redis for cache, rate limits, locks, and short-lived job idempotency.
3. Move heavy exports/document/AI jobs to a queue worker.
4. Add database indexes only after measuring slow queries.
5. Add role-specific smoke tests to CI before every deploy.

## Launch Reset Script

The repository now includes a safe launch reset script for the final pre-launch database cleanup. It is intentionally dry-run by default and must not be run until the final backup and written approval are complete.

- Dry run: `npm run db:launch-reset`
- Execute later: `ALLOW_LAUNCH_RESET=true npm run db:launch-reset -- --confirm-launch-reset`
- Preserved account: `adneo502@gmail.com`
- Action: truncates public application data tables, deletes every other user, and leaves the preserved account active as `system_admin`.
- Safety: requires both an environment variable and a confirmation flag.

## Acceptance and Payment Position

Based on the SLA:

- Total project price: **NGN 6,000,000**.
- Deposit: **NGN 1,800,000**.
- Final payment: **NGN 4,200,000**, due within seven working days after successful completion and written acceptance.
- Production deployment and source-code transfer occur only after full payment.
- Annual maintenance: **NGN 1,500,000** or quarterly/monthly equivalents.

Based on the original CloudPilar HLD and your SLA, you have a credible basis to request acceptance/UAT signoff and final payment, provided you present:

1. A UAT checklist mapped to the 40 approved stories or agreed modules.
2. A demo script covering end-to-end case creation, approval, auction, bid, document, payment, pickup, reporting, audit, and admin controls.
3. A launch-hardening list that separates defects from change requests.
4. A written note that escrow-wallet production rollout and deeper integrations are optional/post-launch if not required for acceptance.
5. Training session evidence and handover documentation.

## Existing Product Value Layers

The following insurer-value layers already exist in the app and should be packaged clearly in demos, sales material, and handover documents:

1. Recovery Control Tower for claim value, expected recovery, verified recovery, leakage, payment status, pickup status, and cycle time.
2. Operations/Exception Control for fraud, payment, document, pickup, KYC, and policy-rule exceptions.
3. Evidence trails across case photos, assessment, location, approvals, bids, documents, payment, pickup, and audit logs.
4. Claims-to-cash lifecycle analytics across adjusters, vendors, asset types, auctions, payments, and pickup.
5. Finance settlement and reconciliation views, including verified recovery, unpaid exposure, frozen escrow, and pickup handoff exposure.
6. Vendor intelligence through tiers, KYC status, leaderboard, bid/win history, payment reliability, and pickup reliability.
7. Governance surfaces: RBAC, audit trail, privacy request workflow, policy controls, compliance/legal pages, reports, and export evidence.

Acquirers and enterprise buyers will value the platform most if it owns the operational dataset around salvage recovery: claim value, asset condition, buyer demand, bid behavior, verified payment, pickup completion, fraud signals, and recovery leakage over time.

## Next Product Value Enhancements

These are the practical next steps that add enterprise value without pretending missing features are absent from the app:

1. Claims CSV import for system admins so insurer claim references can autofill payout/market value during adjuster case creation, with manual entry as fallback.
2. Formal recovery playbooks backed by business policy rules: low-confidence assessment review, payment grace/forfeiture, pickup escalation, high-risk vendor restrictions, and reserve approval thresholds.
3. Production-grade observability evidence: uptime checks, webhook failures, cron failures, backup restore proof, and monitored incident drills. Sentry code wiring exists; external alert channels must still be configured.
4. Integration adapters for claims-core import/export and finance GL/reconciliation exports once NEM or another insurer confirms their system format.
