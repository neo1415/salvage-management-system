# Salvage Bridge Application Documentation

Version: 1.0  
Date: 2026-06-16  
Prepared for: NEM Insurance PLC / Salvage Bridge handover  
System: Salvage Management, Auction, Recovery, Payment, Pickup, Reporting, and Governance Platform

## Disclaimer

This document describes the implemented Salvage Bridge / NEM Salvage Management System as of the date above. It is intended for executive, operational, training, security, and engineering handover. It does not replace the commercial SLA, production environment credential inventory, cloud-provider terms, insurer-specific legal requirements, or future change-control documents.

Some production operations require external provider configuration outside the codebase, including payment gateway credentials, SMS sender ID approval, push notification permission on real devices, Sentry project setup, Supabase backup policy, DNS/HTTPS configuration, and any insurer claims-core or finance-system integration format.

## Table Of Contents

1. Introduction
2. Application Overview
3. User Roles And Access Model
4. Core Business Lifecycle
5. Case Creation And Assessment
6. Auction Management And Bidding
7. Documents, Payments, Wallet Freezing, And Pickup
8. Vendor Onboarding, KYC, And Tier Controls
9. Fraud, Exceptions, Audit, And Governance
10. Dashboards, Reports, And Control Towers
11. Evidence Packet PDF
12. Notifications And Communication
13. Data Storage, Security, And Privacy
14. Cron Jobs, Backup, And Maintenance
15. Administration And Configuration
16. Training And UAT Guidance
17. Engineering Architecture
18. Deployment Readiness
19. Support And Handover Notes

## Chapter One: Introduction

### Purpose

Salvage Bridge is a role-based salvage recovery platform for insurers. It supports the operational journey from claim asset intake to AI-assisted assessment, manager approval, auction, bidding, document execution, payment verification, pickup confirmation, reporting, and audit evidence.

### Target Audience

- Executives who need recovery value, leakage, SLA, and governance visibility.
- Salvage managers who approve cases, manage auctions, review KYC, and handle operational exceptions.
- Claims adjusters who create and document salvage cases.
- Finance officers who verify payments, reconcile recovery, and review frozen wallet/deposit exposure.
- Vendors and buyers who register, verify identity/business status, bid, sign documents, pay, and pick up assets.
- System administrators who configure users, policies, reports, notifications, and audit functions.
- Engineers inheriting the codebase.

### Objectives

- Digitize salvage intake and auction operations.
- Create a verifiable claim-to-recovery trail.
- Improve payment, document, pickup, and fraud control.
- Provide insurer-ready reporting for recovery, finance, operations, and governance.
- Preserve auditability across sensitive business actions.

## Chapter Two: Application Overview

### High-Level Description

The system is a Next.js application backed by PostgreSQL, Redis-compatible services, third-party payment/notification/KYC providers, and structured reports. It is designed as an operational application, not a public marketing site. The role dashboards present work queues, metrics, actions, reports, and exception handling.

### Key Capabilities

- Multi-role authentication and protected navigation.
- Case creation with asset details, photos, GPS/location, voice notes, and AI-assisted valuation.
- Manager approval and auction creation.
- Controlled auction bidding with vendor tier limits and business policy enforcement.
- Winner selection, document signing, payment deadline tracking, forfeiture/fallback handling, and pickup release.
- Finance settlement views, payment verification, reconciliation, and recovery analytics.
- Vendor KYC, BVN/NIN/CAC checks, AML/watchlist evidence, document capture, and approval workflow.
- Fraud alerts, audit logs, privacy rights workflow, and governance reporting.
- Push, in-app, email, and SMS notification pathways.
- Evidence packet exports for case/auction/legal/audit review.

### Technology Stack

- Frontend: Next.js App Router, React, Tailwind CSS, componentized role dashboards.
- Backend: Next.js API routes, custom server, domain services, Drizzle ORM.
- Database: PostgreSQL through Supabase-compatible connection strings.
- Storage: Supabase Storage and provider-backed file storage for protected KYC/document workflows.
- Caching/rate limiting: Redis-compatible services where configured.
- Payments: Paystack plus wallet/freeze/release logic.
- KYC and AML: Provider-backed checks and manual review fallback.
- OCR/AI: Google Document AI / Vision and AI assessment services where configured.
- Observability: Sentry SDK wiring and production monitoring hooks.
- Background work: Vercel cron-compatible daily maintenance orchestrator plus manual scripts.

## Chapter Three: User Roles And Access Model

### Vendor / Buyer

Vendors register, complete verification, browse auctions, bid, sign required documents, pay, and complete pickup. Their dashboard includes buyer operations, bid/win history, payment obligations, pickup readiness, reliability signals, notifications, documents, wallet, and leaderboard access.

### Claims Adjuster

Adjusters create cases, upload evidence, capture location/voice notes, request AI assessment, submit for manager approval, and monitor case processing. Ownership checks protect adjuster-scoped case actions.

### Salvage Manager

Managers review cases, approve auctions, monitor recovery, review KYC applications, handle fraud and operational exceptions, and oversee pickup handoff. The manager dashboard includes a Recovery Control Tower and Operations Control queue.

### Finance Officer

Finance officers verify payments, review Paystack/wallet transactions, reconcile recovery, monitor frozen escrow-like wallet deposits, and manage settlement handoff. The finance dashboard includes Settlement Control.

### System Administrator

System admins manage users, policies, platform settings, fraud queues, pickup confirmations, privacy requests, system health, and operational controls.

## Chapter Four: Core Business Lifecycle

1. A claim asset is identified and entered by an adjuster.
2. Asset evidence is uploaded and assessment/valuation is generated or manually reviewed.
3. A manager approves the case for auction.
4. Auction details, timing, reserve, and eligibility are set.
5. Verified vendors bid within tier and policy limits.
6. Auction closes and winner/fallback candidates are determined.
7. Winner signs required documents.
8. Winner pays through Paystack or wallet flow.
9. Finance verifies the payment and reconciliation state.
10. Pickup is released and staff/admin confirmation records handoff.
11. Reports and evidence packets preserve the recovery trail.

## Chapter Five: Case Creation And Assessment

### Executive Summary

The case workflow captures the factual foundation of salvage recovery: claim reference, asset type, condition, market value, salvage estimate, media evidence, location, and adjuster notes.

### User Flow

- Adjuster opens case creation.
- Adjuster enters claim and asset information.
- Adjuster uploads photos and optional supporting evidence.
- Location is captured through map/GPS/manual fallback.
- Voice notes and offline draft flows support field operation.
- AI assessment may classify damage, valuation signals, and confidence.
- The case is submitted for manager approval.

### Technical Notes

- Case records are stored in PostgreSQL.
- Media is handled through configured upload/storage services.
- Assessment services are separated from case persistence so manual fallback remains available.
- Dashboard and reports query case status, timestamps, adjuster ownership, approval status, market value, and recovery values.

### Security Notes

- Case APIs require authenticated staff roles.
- Adjuster-owned operations use ownership checks where applicable.
- File uploads use type validation and optional malware scanning hooks.
- Evidence export redacts raw private storage access and requires staff access.

## Chapter Six: Auction Management And Bidding

### Executive Summary

Auction management converts approved salvage cases into controlled buyer competition. It manages auction timing, reserve logic, vendor eligibility, bid placement, closure, winner selection, and fallback handling.

### User Flow

- Manager creates or approves auction from a case.
- Vendor views eligible auctions.
- Vendor places a bid subject to tier, deposit, and policy controls.
- Auction closes through scheduled/cron/manual closure logic.
- Winner is selected and document/payment obligations begin.
- If the winner fails to pay after signed documents and grace/buffer rules, deposit forfeiture and fallback winner logic can be triggered by cron.

### Technical Notes

- Auctions, bids, winners, payments, and release forms are separate persisted entities.
- Time-based jobs manage scheduled start, closure, payment deadlines, fallback, and vendor notifications.
- Business policy services resolve default and insurer-configured rules.

### Security Notes

- Bidding requires authenticated vendors and eligibility checks.
- Payment/deadline cron endpoints require `CRON_SECRET`.
- Sensitive transitions are audited.

## Chapter Seven: Documents, Payments, Wallet Freezing, And Pickup

### Executive Summary

After auction close, the platform enforces a recovery handoff: document signing, payment verification, deposit/wallet controls, pickup readiness, and pickup confirmation.

### User Flow

- Winner receives document signing requirements.
- Signed documents unlock payment expectations.
- Payment is initiated through Paystack or wallet flow.
- Finance verifies or auto-verification records payment state.
- Wallet deposits may be frozen, released, or forfeited depending on outcome.
- Pickup confirmation records that the asset has left operational custody.

### Technical Notes

- Payment records include status, amount, source, reference, deadlines, and verification timestamps.
- Wallet-like freeze/release/forfeiture flows are implemented as a pseudo-escrow operational model.
- Pickup status is reflected in admin, manager, finance, vendor, and reports surfaces.
- Daily maintenance now includes payment-deadline, overdue-payment, missing-document, wallet reconciliation, Paystack reconciliation, and pickup reminder jobs.

### Security Notes

- Paystack webhook verification prevents forged payment callbacks.
- Payment evidence and finance actions are access-controlled.
- Sensitive payment and pickup transitions create audit records.

## Chapter Eight: Vendor Onboarding, KYC, And Tier Controls

### Executive Summary

Vendor onboarding verifies identity, business eligibility, risk evidence, and bidding tier. It supports BVN/NIN/CAC checks, document upload, AML/watchlist evidence, manual review, approval, rejection, and resubmission.

### User Flow

- Vendor registers and completes base verification.
- Vendor pays registration fee where policy requires it.
- Vendor submits Tier 2 manual/hybrid KYC.
- Identity/business checks run against configured providers.
- Documents are uploaded and OCR may attempt matching.
- Manager reviews evidence, risk flags, documents, AML/watchlist state, and device/submission context.
- Manager approves or rejects.
- Vendor dashboard reflects the latest review state.

### Technical Notes

- Provider evidence is stored in provider verification records.
- Manual review uses normalized snapshots so manager pages can display consistent evidence.
- Document upload service supports private Supabase storage and optional ClamAV scanning.

### Security Notes

- KYC documents are protected and served through manager-access routes.
- Provider snapshots mask sensitive fields.
- Optional malware scanning can fail closed with `KYC_VIRUS_SCAN_REQUIRED=true`.

## Chapter Nine: Fraud, Exceptions, Audit, And Governance

### Executive Summary

The platform includes fraud and exception queues that make operational risk visible. These queues cover suspicious bidding/payment behavior, KYC risk, document delays, payment delays, pickup delays, and system audit events.

### User Flow

- System detects or records a fraud/exception event.
- Admin or manager reviews the queue.
- Decisions are logged.
- Reports and dashboards show pending queue counts and operational exposure.

### Technical Notes

- Fraud alert records feed admin/system dashboards.
- Reconciliation discrepancy alerts route to finance/system roles.
- Audit logs persist key entity actions.
- Privacy requests are represented in settings/admin surfaces where migrations are applied.

### Security Notes

- Audit logs should be retained and protected in production.
- Fraud review actions require privileged roles.
- Production logs should flow to Sentry/monitoring rather than noisy console output.

## Chapter Ten: Dashboards, Reports, And Control Towers

### Executive Summary

Dashboards are designed as role-specific command surfaces. Reports are designed for management, finance, regulatory, operational, and vendor-performance review.

### Implemented Control Surfaces

- Manager Recovery Control Tower: claims value, verified recovery, reserve gap, pickup exposure, cycle times, and exceptions.
- Operations Control: fraud queue, pickup queue, document exceptions, and payment exceptions.
- Finance Settlement Control: verified recovery, finance queue, paid awaiting pickup, overdue unpaid, frozen escrow, and payment cycle.
- Vendor Buyer Operations: won unpaid, signed unpaid, pickup readiness, payment cycle, pickup cycle, and reliability signals.
- System Admin Health and Operations: users, active vendors, fraud alerts, logs, pickup confirmations, and operational queues.

### Report Families

- Master reports.
- KPI dashboard reports.
- Auction performance.
- Case processing.
- Profitability and revenue analysis.
- Vendor spending/performance.
- Payment analytics.
- Audit/regulatory reports.

### Technical Notes

- Reports consume PostgreSQL data across cases, auctions, bids, payments, vendors, pickup, fraud, and audit logs.
- Role dashboards use aggregate queries and caches where configured.
- Large export/report work can later move to queue workers if volume grows.

## Chapter Eleven: Evidence Packet PDF

### Executive Summary

The evidence packet PDF is a secure, branded, staff-only export that packages the defensible history of a salvage case. It is designed for board packs, legal review, audit, client handover, and recovery dispute resolution.

### User Flow

1. Authorized staff opens a case details or evidence export surface.
2. Staff selects the branded evidence PDF export.
3. The API verifies the signed-in user and role.
4. For adjusters, ownership is checked before export.
5. The system gathers case, auction, bid, payment, document, and audit data.
6. A branded PDF is generated and downloaded.

### What The PDF Contains

- Cover and case summary.
- Claim reference and asset information.
- Market value, reserve/estimated salvage value, and assessment metadata.
- Case location and evidence summary.
- Auction history connected to the case.
- Bid history and winner context.
- Payment status, references, amounts, and verification timestamps.
- Document evidence summary, including generated/signed states where present.
- Pickup/handoff status where present.
- Audit trail extract.
- Security note explaining that protected files are not embedded and must be opened through authorized routes.

### What The PDF Does Not Contain

- Raw private file URLs.
- Provider secrets.
- Full sensitive identity numbers.
- Unrestricted storage links.

### Security Notes

- Staff-only route.
- Adjuster ownership check.
- Private storage remains private.
- Intended as an evidence summary, not a replacement for protected source files.

## Chapter Twelve: Notifications And Communication

### Channels

- In-app notifications.
- Web push notifications through VAPID and service worker subscription.
- Email notifications where configured.
- SMS notifications through Termii where provider approval and credentials permit.

### Operational Notes

- Push notifications require HTTPS, user permission, service worker registration, and a saved subscription for the exact origin.
- Bidding OTP push is implemented for notification bar delivery, but real-device delivery must be tested on production/staging HTTPS.
- Termii sender ID/DND approval is a provider-side launch dependency, not a code blocker when fallback channels exist.

## Chapter Thirteen: Data Storage, Security, And Privacy

### Authentication And Authorization

- Sessions are server-side validated.
- Role-based routing protects dashboard namespaces.
- Sensitive API routes enforce role and/or ownership checks.
- Cron routes require `CRON_SECRET`.

### Upload Storage

- KYC files use protected storage patterns.
- File type and size checks exist on upload surfaces.
- Optional ClamAV scanning can be enabled for KYC/document uploads.
- Evidence exports do not leak private raw file URLs.

### Payment Security

- Card details are not stored by the app.
- Paystack handles payment processing.
- Webhooks use signature verification.
- Wallet/freezing state is stored as application transaction data.

### Privacy

- Privacy settings and data-rights request surfaces exist.
- Data-right request table migrations must be applied in each environment.
- Audit logs should remain available for legitimate compliance review.

### Residual Production Risks

- Rotate all keys before launch.
- Use HTTPS only.
- Configure Sentry DSN and alert routing.
- Validate push on real devices.
- Configure backups and prove restore.
- Review every newly added sensitive route with the same ownership/RBAC pattern.

## Chapter Fourteen: Cron Jobs, Backup, And Maintenance

### Daily Maintenance

Vercel free plan supports one daily cron. The app now uses `/api/cron/daily-maintenance` as the single daily entry point. That endpoint runs the important maintenance jobs sequentially behind `CRON_SECRET`.

Included jobs:

- Daily database backup upload.
- Auction closure.
- Scheduled auction activation.
- Payment deadline forfeiture/fallback.
- Overdue payment checks.
- Document deadline checks.
- Missing document regeneration.
- Pickup reminders.
- KYC expiry.
- Fraud detection/auto-suspend.
- Wallet reconciliation.
- Paystack reconciliation.
- Ledger summary refresh.
- Leaderboard/vendor rating updates.
- Scheduled report execution.

### Backup Strategy

- Deployed cron backup uses a logical JSON gzip backup and uploads to a private Supabase Storage bucket.
- Manual backup script can write a local gzip file to `protected-backups/`.
- Production should still use Supabase paid automatic backups or an external database dump process for stronger recovery guarantees.
- Restore drills must be performed before launch signoff.

### Scripts

- `npm run db:backup` writes a local gzip logical backup.
- `npm run db:backup -- --upload` uploads backup to private Supabase Storage.
- `npm run db:launch-reset` performs a dry run of the launch reset.
- `ALLOW_LAUNCH_RESET=true npm run db:launch-reset -- --confirm-launch-reset` executes the reset when the owner is ready.

## Chapter Fifteen: Administration And Configuration

System administrators manage:

- Users and roles.
- Business policies.
- Fraud queues.
- Pickup queues.
- KYC approvals.
- Privacy requests.
- Logs and system activity.
- Platform health.
- Operational reports.

Business policies can control verification requirements, payment grace/fallback behavior, pickup escalation, reserve approval thresholds, and related operational rules as the insurer's process matures.

## Chapter Sixteen: Training And UAT Guidance

### UAT Coverage

The UAT pack should demonstrate:

- Login and role routing.
- Adjuster case creation.
- Manager case approval.
- Auction creation and bidding.
- Document signing.
- Payment verification.
- Payment deadline/fallback path.
- Pickup confirmation.
- KYC submission, review, approval, rejection, and resubmission.
- Fraud alert review.
- Reports and evidence export.
- Admin user/policy/log/privacy surfaces.

### Training Tracks

- Adjuster training: case intake, evidence, GPS, AI assessment, submission.
- Manager training: approvals, auctions, KYC, fraud, reports, pickup oversight.
- Finance training: payments, reconciliation, settlement, wallet/frozen funds, reports.
- Vendor training: onboarding, KYC, bidding, signing, payment, pickup.
- Admin training: users, roles, policies, logs, health, privacy, monitoring.

## Chapter Seventeen: Engineering Architecture

### Code Organization

- `src/app`: App Router pages and API routes.
- `src/components`: Reusable UI and role dashboard components.
- `src/features`: Domain services and logic.
- `src/lib/db`: Drizzle schema and database client.
- `src/lib/cron`: Scheduled job helpers.
- `src/lib/maintenance`: Backup and maintenance helpers.
- `scripts`: Operational scripts for migrations, backup, reset, diagnostics, and data tasks.
- `docs/handover`: Canonical handover documents.

### Engineering Principles

- Database remains the source of truth.
- Auth checks must be server-side for sensitive operations.
- UI state can be local, but secrets/payment/auth data must not be stored in browser storage.
- Long-running exports and AI work can later move to queue workers.
- Provider integrations should fail visibly and preserve fallback/manual paths.

## Chapter Eighteen: Deployment Readiness

### Code-Side Closed Items

- Dependency audit passes at high severity.
- Build passes.
- Typecheck passes.
- Secret scanner passes.
- Sentry SDK wiring exists.
- Evidence PDF exists.
- Push health/self-test route exists.
- One Vercel-compatible daily cron exists.
- Backup service and manual backup script exist.
- Launch reset dry-run/execute script exists.

### Manual Launch Items

- Rotate production credentials.
- Set production env values.
- Configure Sentry DSN/org/project/token.
- Confirm Supabase backup plan or upgrade.
- Run a restore drill.
- Manually call `/api/cron/daily-maintenance` once after deployment with `Authorization: Bearer <CRON_SECRET>` and confirm all required jobs pass.
- Confirm the private Supabase backup bucket receives a new gzip backup object.
- Validate push on real phone over HTTPS.
- Confirm Termii sender ID approval or accept fallback.
- Apply database migrations in production.
- Configure domain, HTTPS, and webhook callback URLs.
- Run UAT with signed acceptance.

## Chapter Nineteen: Support And Handover Notes

The client should receive:

- This full application documentation.
- Production handoff audit.
- Handover index.
- UAT checklist.
- Training guide.
- Incident runbook.
- Environment variable checklist with secrets redacted.
- Demo script.
- Final deployment and acceptance checklist.

The developer should retain:

- Source-code repository access until final payment terms are satisfied.
- Deployment notes.
- Provider setup notes.
- Migration history.
- Evidence of successful build/test/audit runs.
