# Salvage Bridge / NEM Salvage Management System Documentation

## 1. Executive Overview

Salvage Bridge is a role-based salvage recovery platform for insurers. It manages the operational chain from a paid claim or salvage case through field assessment, manager approval, auction, vendor bidding, document signing, payment verification, pickup release, fraud review, audit, and reporting.

The product should be presented as a claims-to-recovery operating system, not only as an auction portal. Its core value is that it creates a structured record of every recoverable asset, every vendor action, every approval, every payment state, and every pickup handoff.

The system helps an insurer answer:

- What assets are recoverable after claims settlement?
- What is the expected recovery value versus verified recovery?
- Which cases, payments, documents, vendors, or pickups are blocking recovery?
- Which vendor won, paid, signed documents, and picked up the asset?
- Which staff member approved or changed each operational state?
- Which fraud, KYC, privacy, or audit events require attention?

## 2. Role Model

### Vendor / Buyer

Vendors register, complete verification, review auctions, bid, sign required documents, pay for winning auctions, and complete pickup.

Primary areas:

- Vendor dashboard
- Auctions and bid history
- Wallet/payment pages
- Document signing
- Tier 1 and Tier 2 KYC
- Leaderboard and performance
- Notifications and push subscription

### Claims Adjuster

Claims adjusters create salvage cases and supply the first operational evidence: claim reference, asset details, photos, condition, location, market value, voice notes, and assessment information.

Primary areas:

- Adjuster dashboard
- Case creation
- Case list/detail views
- Offline-oriented case draft support
- Case processing reports

### Salvage Manager

Salvage managers control the operational recovery process. They review cases, manage auctions, review KYC, manage vendors, monitor exceptions, and coordinate pickup handoff.

Primary areas:

- Manager dashboard and Recovery Control Tower
- Case approvals
- Auction approvals and price overrides
- Vendor and KYC approval pages
- Pickup desk
- Operational reports

### Finance Officer

Finance officers verify and monitor payments, settlement exposure, reconciliation, overdue payment states, and paid-but-not-picked-up handoffs.

Primary areas:

- Finance dashboard and Settlement Control
- Payments list/detail views
- Reconciliation center
- Escrow/payment reports
- Revenue and payment analytics

### System Admin

System admins manage platform-wide users, policy, privacy requests, fraud alerts, logs, system settings, and cross-functional exception queues.

Primary areas:

- Admin dashboard and Operations Control
- User management
- Fraud alerts
- Privacy requests
- Business policy/configuration
- Audit logs and system settings

## 3. End-to-End Lifecycle

### Case Intake

1. A claims adjuster creates a salvage case.
2. The case captures claim reference, asset type, asset details, market value, condition, location, photos, and notes.
3. AI/valuation services may assist the assessment where configured.
4. The case enters manager review.

### Manager Review and Auction Preparation

1. Salvage manager reviews the case evidence.
2. Manager approves, rejects, or adjusts pricing where policy allows.
3. Approved cases can become auction lots.
4. Auction rules, reserve values, document requirements, and payment deadlines are applied.

### Auction and Bidding

1. Eligible vendors see available auctions based on role, verification tier, and business policy.
2. Vendors place bids subject to tier, OTP, deposit/payment, and limit controls.
3. Real-time auction updates and notifications support active bidding.
4. Auction close selects a winner and transitions the winner into document/payment flow.

### Document Signing and Payment

1. Winning vendor signs required documents.
2. Payment becomes due according to configured rules.
3. Paystack/manual payment verification updates settlement state.
4. Finance can review verified, overdue, rejected, frozen, and registration-fee payments.

### Pickup Handoff

1. Verified payment creates a pickup handoff obligation.
2. Vendor/staff pickup confirmation records completion evidence.
3. Staff confirmation finalizes operational release.
4. Pickup timing feeds vendor reliability, dashboards, and reports.

### Reporting and Closure

1. Control towers surface claims value, verified recovery, reserve gaps, exceptions, fraud queues, pickup exposure, and payment exposure.
2. Reports provide financial, operational, vendor, auction, KPI, and compliance views.
3. Audit logs preserve sensitive operational actions.

## 4. Core Modules

### Authentication and Authorization

- NextAuth handles authentication.
- Role-based routing and API protection are enforced through middleware/proxy and server-side checks.
- Users are grouped into vendor, claims adjuster, salvage manager, finance officer, and system admin roles.
- Sensitive APIs should always validate both role and ownership, especially vendor-specific and case-specific routes.

### Case Management

- Cases live in PostgreSQL through Drizzle schema.
- Case records include claim reference, asset type, asset details, market value, salvage/reserve values, photos, location, status, creator, approval state, and AI assessment data.
- Case status drives downstream auction and reporting behavior.

### Auction Management

- Auctions attach to approved cases.
- Bids, countdowns, winners, document requirements, payment deadlines, and pickup states form the auction lifecycle.
- Status transitions should remain consistent: approved case -> active auction -> payment/document states -> pickup completion -> sold/closed recovery state.

### Vendor Verification and KYC

- Tier 1 BVN and Tier 2 business/identity verification are policy-controlled.
- Manager KYC review shows identity, business, document, AML/watchlist, device/IP, and provider evidence where available.
- KYC document uploads validate type/size and can optionally run ClamAV scanning before storage.
- Tier 2 approval/rejection drives vendor access and dashboard messaging.

### Payments and Reconciliation

- Paystack is the primary production payment integration.
- Finance can view payment source, status, amount, vendor, deadlines, references, and verification state.
- Reconciliation services detect discrepancies and now notify finance/system admin users through in-app notifications.
- Escrow wallet logic exists in parts of the codebase, but phase-one acceptance can proceed with Paystack/manual payment verification if the client agrees.

### Pickup Confirmation

- Pickup confirmation is a first-class operational handoff.
- Dashboards distinguish paid assets awaiting pickup from completed pickups.
- Pickup timing feeds reliability metrics and vendor performance views.
- Pickup confirmation should be part of UAT because it affects recovery closure and vendor scoring.

### Fraud and Intelligence

- Fraud alert queues exist for admin review.
- Fraud logging now persists fraud attempts into the fraud alert table.
- Cron fraud analysis can create fraud alerts instead of only logging possible issues.
- Intelligence interaction logging verifies vendor/session ownership for vendor-originated events.
- Interaction exports now use the real interaction tracking table for training-data handoff.

### Reports and Control Towers

The app contains executive, financial, operational, user-performance, compliance, and vendor reports. Role dashboards include control-tower summaries:

- Recovery Control Tower for salvage manager/system oversight.
- Settlement Control for finance.
- Operations Control for admin.
- Buyer Operations for vendors.

Long report tables are expected to use 20-row pagination for readable exports and acceptance review.

### Notifications

- In-app notifications exist across operational workflows.
- SMS/email providers are configured for transactional messages.
- Push notification subscription APIs exist; live phone notification delivery must be validated with production VAPID/provider settings and a real device.
- A push health/test endpoint exists so a signed-in user can confirm server configuration, active subscription count, and live push fan-out to their device.

### Privacy and Compliance

- Public privacy and terms pages exist.
- User privacy settings/data-right request surfaces exist.
- Admin privacy request management exists.
- Retention, backup, incident, change-management, and vulnerability-management drafts are included in the compliance pack.

## 5. Evidence and Export Surfaces

Current evidence surfaces include:

- Case photos and assessment evidence.
- Manager approvals and price override trail.
- Bid history.
- Signed document metadata and protected document access.
- Payment references and verification state.
- Pickup confirmation state.
- Audit logs.
- Fraud alerts.
- KYC evidence export surfaces.
- Case evidence packet JSON export endpoint for authorized staff.
- Branded case evidence packet PDF export endpoint for authorized staff.

Current limitation:

- Formal recovery leakage by branch requires branch or imported claims metadata. Current leakage can be analyzed by available case, adjuster, asset, auction, vendor, and payment data.

## 6. Architecture Summary

### Frontend

- Next.js App Router.
- Role-based dashboard layouts.
- React components organized by feature and UI domain.
- PWA/offline-oriented flows exist for field usage.

### Backend

- Next.js route handlers provide API endpoints.
- Drizzle ORM manages PostgreSQL access.
- Service modules handle business domains such as payments, KYC, fraud, reconciliation, reports, and intelligence.
- Background jobs/cron endpoints handle scheduled operational tasks.

### Data Stores

- PostgreSQL is the source of truth.
- Redis/Upstash/Vercel KV is used for caching, rate limiting, short-lived states, and queues where configured.
- Media/document storage uses configured object/media providers.

### External Integrations

- Paystack for payments.
- Termii/SMS provider for SMS.
- Email provider for email delivery.
- Google services for OCR/vision/document extraction where configured.
- Dojah/provider identity services where configured by business policy.
- Cloudinary/Supabase or equivalent for file storage.
- Web push/VAPID for browser push notifications.
- Sentry SDK wiring for production error tracking when DSN and source-map upload environment values are configured.

## 7. Security Controls

Implemented controls:

- Role-based access control.
- Server-side session validation.
- API ownership checks on sensitive paths where recently hardened.
- Security headers and CSP configuration.
- Paystack webhook signature verification.
- Audit logging and audit sanitization.
- Privacy/data-right request workflows.
- File type and size validation for KYC uploads.
- Optional ClamAV scan hook for KYC uploads.

Launch gates:

- Remediate or explicitly risk-accept `npm audit --audit-level=high` findings.
- Rotate and verify production secrets.
- Configure monitoring/error tracking.
- Confirm backup and restore drill.
- Confirm malware scanning infrastructure if fail-closed scanning is required.

## 8. Operational Runbook Pointers

Use these current handover files:

- `docs/handover/HANDOVER_INDEX.md`
- `docs/handover/UAT_ACCEPTANCE_CHECKLIST.md`
- `docs/handover/TRAINING_GUIDE.md`
- `docs/handover/PRODUCTION_MONITORING_AND_INCIDENT_RUNBOOK.md`
- `docs/handover/CLIENT_MANUAL_ACTIONS.md`
- `docs/PRODUCTION_HANDOFF_AUDIT_2026-06-16.md`

## 9. UAT Focus Areas

UAT should cover:

- Login and role routing.
- Case creation with media/location.
- Manager approval and auction setup.
- Vendor bidding and OTP flow.
- Auction close and winner selection.
- Document signing.
- Payment verification and finance view.
- Pickup confirmation.
- Vendor performance/dashboard updates.
- Fraud alert review.
- KYC submission/approval/rejection/resubmission.
- Reports and exports.
- Privacy request flow.
- Push/email/SMS provider delivery on real devices/accounts.

## 10. Product Value for Insurers

The strongest buyer value is the operational dataset created by the app:

- Claim value and salvage asset details.
- Adjuster assessment and media evidence.
- Manager approval and override trail.
- Bidder interest and auction outcome.
- Verified payment and recovery amount.
- Pickup completion and cycle time.
- Vendor reliability, KYC, fraud, and performance signals.
- Compliance, audit, privacy, and exception history.

This data can support better recovery governance, better vendor liquidity decisions, better fraud controls, and better executive reporting over time.
