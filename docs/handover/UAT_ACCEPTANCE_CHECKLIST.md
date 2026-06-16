# UAT Acceptance Checklist

Use this checklist during client acceptance. Status values:

- **Pass**: implemented and ready for client test.
- **Manual Evidence**: implemented, but final proof requires client/cloud/provider access or a live-device test.
- **Post-Launch**: acceptable as a maintenance/change request if the client agrees.

## 1. User Management and Access

| Item | Status | Evidence / Notes |
| --- | --- | --- |
| Users can log in with the correct role. | Pass | Auth and role dashboards exist. |
| Vendors can access only vendor pages and APIs. | Pass | Server proxy/RBAC and vendor namespaces exist. |
| Claims adjusters can access only adjuster workflows and allowed reports. | Pass | Adjuster dashboard, cases, and report scope exist. |
| Salvage managers can access approval, auction, KYC, pickup, vendor, and report workflows. | Pass | Manager surfaces exist. |
| Finance officers can access payment, reconciliation, settlement, and finance report workflows. | Pass | Finance dashboard/payment/reconciliation surfaces exist. |
| System admins can manage users, settings, fraud, privacy requests, and operational queues. | Pass | Admin dashboard, users, fraud, privacy, audit, pickup queues exist. |
| Unauthorized direct URL access redirects or returns forbidden. | Pass | Server-side proxy/RBAC protects namespaces. |
| Password reset/change workflows function. | Pass | Auth settings/reset routes exist. |
| Audit logs capture sensitive administrative and operational events. | Pass | Audit log services and admin audit page exist. |

## 2. Vendor Registration and KYC

| Item | Status | Evidence / Notes |
| --- | --- | --- |
| Vendor can register and log in. | Pass | Vendor registration/auth flows exist. |
| Tier 1 BVN verification works according to business policy. | Pass | Tier policy and BVN verification flows exist. |
| Tier 2 manual KYC submission works with identity, business, address, and document uploads. | Pass | Manual KYC submit/review flow exists. |
| KYC uploads enforce file type and size limits. | Pass | `DocumentUploadService` enforces MIME and 5MB limit. |
| KYC uploads can be virus-scanned when ClamAV is configured. | Pass | ClamAV hook exists; production needs private `clamd`. |
| KYC review page shows identity, business, address, AML/watchlist, document, IP/device, and provider evidence where available. | Pass | Manager review page includes these evidence sections. |
| Salvage manager can approve Tier 2 application. | Pass | KYC approval decision route exists. |
| Salvage manager can reject Tier 2 application with a reason. | Pass | Rejection/resubmission flow exists. |
| Vendor dashboard status updates correctly after pending, rejected, resubmitted, and approved states. | Pass | KYC status route/dashboard logic was corrected and tested by user. |
| Vendor tier and access limits update correctly after approval. | Pass | Vendor approval/tier update route exists. |

## 3. Case Management

| Item | Status | Evidence / Notes |
| --- | --- | --- |
| Claims adjuster can create a salvage case. | Pass | Case creation page/API exist. |
| Case creation supports asset details, market value, reserve/salvage estimate, photos, location, and notes. | Pass | Case creation form and API support these fields. |
| AI-assisted assessment runs or falls back safely when AI providers fail. | Pass | Assessment services and fallback paths exist. |
| Case can be saved/submitted from mobile viewport. | Manual Evidence | Requires final client-device UAT. |
| Manager can review and approve/reject cases. | Pass | Manager approval workflow exists. |
| Approved cases are eligible for auction creation. | Pass | Case/auction lifecycle exists. |
| Case lifecycle is visible in dashboard/reporting. | Pass | Dashboards and reports include case lifecycle data. |

## 4. Auction and Bidding

| Item | Status | Evidence / Notes |
| --- | --- | --- |
| Manager can create or approve auction from eligible case. | Pass | Auction routes/workflows exist. |
| Auction appears to eligible vendors based on policy/tier. | Pass | Business policy and tier controls exist. |
| Vendor can place a valid bid. | Pass | Bid APIs and vendor auction pages exist. |
| Invalid bid values are rejected. | Pass | Bid validation exists. |
| OTP verification works for bidding where policy requires it. | Pass | Auction OTP send/verify routes exist. |
| Countdown and status changes behave correctly. | Pass | Countdown, closure, scheduled/expired cron routes exist. |
| Auction closure selects winner and records winner data. | Pass | Auction closure logic exists. |
| Losing vendors are not shown sensitive winner data. | Pass | Role-specific auction views exist. |
| Auction restart/extension/end-early paths work for authorized roles. | Pass | Authorized routes exist. |

## 5. Documents and Signing

| Item | Status | Evidence / Notes |
| --- | --- | --- |
| Winning vendor receives document/signature requirement. | Pass | Document generation/progress/signing routes exist. |
| Generated documents are visible in the vendor workflow. | Pass | Vendor document surfaces exist. |
| Vendor can sign required documents. | Pass | Document signing route exists. |
| Signing status updates the auction/payment lifecycle. | Pass | Payment unlock and document progress integrations exist. |
| Expired document windows appear in exception/reporting queues. | Pass | Document deadline cron and exception queues exist. |
| Document evidence is available for audit/review. | Pass | Document download, progress, and audit surfaces exist. |

## 6. Payment and Finance

| Item | Status | Evidence / Notes |
| --- | --- | --- |
| Vendor can initiate payment after winning/signing. | Pass | Payment initiation routes exist. |
| Paystack payment flow verifies successfully. | Pass | Paystack auction/payment webhook and verification routes exist. |
| Manual payment/proof flow works if enabled. | Pass | Upload proof/finance review routes exist. |
| Finance officer can review/verify payment where required. | Pass | Finance payment pages/routes exist. |
| Webhook signature verification is active. | Pass | Paystack webhook setup and signature logic exist. |
| Duplicate webhook/payment processing is idempotent. | Pass | Payment services include idempotent references/status handling. |
| Registration fee payments are separated from auction payments in reporting. | Pass | Registration fee flows and report filtering exist. |
| Payment status is reflected in vendor, finance, manager, and admin dashboards. | Pass | Role dashboards include payment exposure. |
| Overdue unpaid items appear in operational exception views. | Pass | Dashboard operations controls and deadline crons exist. |

## 7. Pickup Confirmation

| Item | Status | Evidence / Notes |
| --- | --- | --- |
| Paid/winner assets enter pickup-ready or pickup-confirmation queue. | Pass | Admin/manager pickup queues exist. |
| Vendor pickup confirmation works. | Pass | Vendor pickup confirmation route exists. |
| Staff/admin pickup confirmation works. | Pass | Admin pickup confirmation route exists. |
| Pickup completion updates dashboard exposure and vendor performance. | Pass | Dashboard and vendor metrics include pickup exposure/cycle. |
| Pickup date/time is visible in reports where relevant. | Pass | Pickup-aware dashboard/report data exists. |
| Pickup SLA/on-time metrics are calculated from verified payment to staff confirmation. | Pass | Vendor/finance/manager cycle metrics exist. |

## 8. Notifications

| Item | Status | Evidence / Notes |
| --- | --- | --- |
| In-app notifications are created for key events. | Pass | Notification service/routes exist. |
| Email notifications send for configured critical events. | Manual Evidence | Requires live provider/domain credentials. |
| SMS notifications send or skip according to business policy. | Manual Evidence | Requires live Termii/provider confirmation. |
| Push notifications subscribe and deliver where browser/device support exists. | Manual Evidence | Requires mobile/PWA device test and VAPID config. |
| Notification preferences are respected. | Pass | Notification preferences routes exist. |
| Role fanout notifications do not overwhelm the server. | Pass | Notification services use role-targeted fanout; monitor in production. |

## 9. Dashboards and Reports

| Item | Status | Evidence / Notes |
| --- | --- | --- |
| Vendor dashboard shows win rate, on-time pickup, rating, buyer operations, and KYC/access status. | Pass | Vendor dashboard includes these sections. |
| Claims adjuster dashboard shows assessment/control metrics. | Pass | Adjuster dashboard control metrics exist. |
| Salvage manager dashboard shows recovery control, operations control, case/auction/vendor metrics. | Pass | Manager dashboard includes these controls. |
| Finance dashboard shows settlement control, finance queue, verified recovery, pickup handoff, escrow/frozen exposure. | Pass | Finance dashboard includes settlement control. |
| Admin dashboard shows user, fraud, pickup, system health, and operations queues. | Pass | Admin dashboard includes operations control and system health. |
| Reports load without 500 errors. | Pass | Build passed; prior report query errors have been fixed in current branch. |
| Long report tables paginate at 20 rows per page. | Pass | Paginated report table component exists and report pages use 20-row paging. |
| PDF export works for key reports. | Manual Evidence | Requires browser/PDF UAT for final layout. |
| CSV/evidence export works where provided. | Pass | Report CSV and KYC evidence export routes exist. |

## 10. Compliance, Privacy, and Audit

| Item | Status | Evidence / Notes |
| --- | --- | --- |
| Public privacy policy page is available. | Pass | `src/app/(legal)/privacy/page.tsx`. |
| Public terms page is available. | Pass | `src/app/(legal)/terms/page.tsx`. |
| User privacy settings page loads. | Pass | Privacy request page/API exist; required migration must be applied. |
| User can create data-right/privacy requests. | Pass | Settings privacy API exists. |
| Admin can review privacy requests. | Pass | Admin privacy requests page/API exists. |
| Data retention and backup policies are documented for handover. | Pass | Compliance draft docs exist. |
| Incident response policy/runbook is documented. | Pass | Compliance draft and handover runbook exist. |
| Security headers are active. | Pass | Next config includes security headers/CSP. |
| Secret scan passes. | Pass | `npm run security:scan` passed on 2026-06-16. |
| Dependency audit findings are reviewed and remediated or accepted with mitigation. | Post-Launch / Launch Gate | Non-force remediation reduced the audit to 12 high advisories in `esbuild`/`ws` dependency families; requires controlled remediation or written risk acceptance. |

## 11. Training and Handover

| Item | Status | Evidence / Notes |
| --- | --- | --- |
| Initial training session is completed for up to five client staff. | Manual Evidence | Requires actual client session attendance/signoff. |
| User training guide has been delivered. | Pass | `docs/handover/TRAINING_GUIDE.md`. |
| Technical handover guide has been delivered. | Pass | `docs/handover/HANDOVER_INDEX.md` and documentation pack. |
| Environment/deployment configuration has been documented. | Pass | Production/deployment docs exist under `docs/`. |
| Source-code access/transfer terms are confirmed after final payment. | Manual Evidence | Business/legal action, not code. |

## Acceptance Signoff

Client representative:

Date:

Notes / accepted post-launch change requests:
