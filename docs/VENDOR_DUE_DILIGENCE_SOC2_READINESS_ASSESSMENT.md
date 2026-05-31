# Vendor Due Diligence, Security Readiness, and SOC 2-Style Gap Assessment

Assessment date: 2026-05-30  
Repository: `C:\Users\DELL PRECISION 5540\Desktop\React\salvage`  
Assessment type: codebase and documentation review only  
Scope: white-label insurance salvage recovery platform covering cases, auctions, KYC, wallet/deposits, payments, documents, audit logs, fraud alerts, reports, and admin workflows.

## 2026-05-31 Remediation Update

After the initial assessment, the following remediation work was completed:

- Created a client-safe Salvage Bridge procurement pack under `docs/procurement/salvage-bridge/`.
- Created legal/compliance draft templates under `docs/compliance-drafts/`.
- Added a remediation and evidence tracker under `docs/procurement/salvage-bridge/11-remediation-and-evidence-tracker.md`.
- Removed the high-risk case deletion behavior that deleted case audit logs before deleting a case.
- Replaced legacy `manager` / `admin` checks in `src/app/api/cases/[id]/route.ts` with the actual platform roles `salvage_manager` / `system_admin`.
- Changed the auction document download route to serve PDFs through the application instead of redirecting users to raw Cloudinary URLs.
- Added `DOCUMENT_DOWNLOADED` audit actions to document download routes.
- Added valuation/deduction create, update, and delete audit logging to the admin valuation and deduction routes.
- Added database-level append-only protection and tamper-evident hash-chain columns for `audit_logs` via `src/lib/db/migrations/0039_audit_log_immutability.sql`.
- Added a first-party privacy/data-rights request workflow under Settings with audited requests for export, correction, deactivation, deletion, restriction, and objection review.
- Added an admin privacy request review console and a dry-run retention/blocker check for deletion/deactivation-style requests.
- Hardened high-risk legacy API routes for payment verification, payment proof upload, pickup confirmation, scheduled auction activation/status, auction expiry checks, admin cache refresh, and operational report access.
- Added `docs/procurement/salvage-bridge/12-api-route-authorization-inventory.md`, `tests/unit/security/high-risk-route-authorization.test.ts`, and `tests/unit/security/api-route-inventory.test.ts` as route-authorization evidence.
- Added `tests/unit/security/deposit-freeze-policy.test.ts` to guard top-N deposit freezing and payment-specific unfreeze assumptions.

These changes improve procurement readiness and auditability, but they do not replace formal legal review, penetration testing, NDPA/NDPC review, or SOC 2 audit work.

## Important Limitation

This is not a SOC 2 audit, penetration test, NDPC filing, legal opinion, or certified security assessment. It is an internal readiness review based on source code, repository documents, and public references.

Formal claims such as "SOC 2 compliant", "NDPA compliant", "PCI compliant", "audited", or "certified" should not be made unless backed by an independent auditor, DPCO, CPA firm, provider report, or formal legal/compliance review.

External references used:

- AICPA Trust Services Criteria: https://www.aicpa-cima.com/resources/download/2017-trust-services-criteria-with-revised-points-of-focus-2022
- Nigeria Data Protection Commission: https://www.ndpc.gov.ng/
- Supabase Security: https://supabase.com/security
- Paystack Security: https://paystack.com/security

## A. Executive Summary

### Short Answer

The platform is credible enough for early insurer vendor due diligence conversations, especially as a technical walkthrough or pilot candidate, but it is not yet packaged as a procurement-ready enterprise vendor offering.

It is not ready to claim SOC 2 compliance. It is reasonable to say the platform is "built with enterprise security, auditability, and configurable white-label deployment in mind", provided that statement is paired with the caveat that formal compliance evidence is still being prepared.

### Overall Readiness Scores

| Area | Score | Meaning |
| --- | ---: | --- |
| Early insurer due diligence conversation readiness | 7.5 / 10 | Strong enough to support structured first-round due diligence using the new procurement pack. |
| Production deployment readiness for a new insurer | 6.5 / 10 | Major flows exist, with several audit/document-access/API authorization gaps closed; still needs DR evidence, monitoring, and security testing. |
| Security engineering foundation | 7.5 / 10 | Real auth, RBAC, audit, KYC, webhook, encryption, document access, high-risk route hardening, and rate-limit controls exist. Coverage is still uneven. |
| SOC 2-style readiness | 5.5 / 10 | Better documentation/control mapping, route guardrails, admin privacy review, and code hardening now exist, but formal policies, operating evidence, monitoring, vendor management, and audit evidence remain incomplete. |
| Privacy/NDPA readiness | 6 / 10 | Draft privacy/DPA/retention/NDPA materials, in-app request workflow, admin review, and retention dry-run controls now exist, but they require legal/DPCO review and final fulfilment operations. |

### Biggest Strengths

- Real role-based platform with distinct vendor, adjuster, salvage manager, finance officer, and system admin flows.
- Auth implementation includes credentials, OAuth providers, account lockout, optional MFA, session/device awareness, secure cookies, and production guard against E2E CSRF bypass.
- Sensitive KYC workflows are materially implemented: Dojah webhook validation, provider verification records, encrypted provider payload storage, manager review, approval/rejection/resubmission, and KYC audit action types.
- Payment and wallet logic is not superficial. Paystack webhooks validate signatures, wallet/deposit logic uses row locks, and the system models frozen funds, hybrid/wallet/Paystack paths, payment verification, cron reconciliation, and ledger-style transaction records.
- Business policy and white-label configuration are real, with validation, sanitization, versioning, public/private policy separation, publishing, and audit logs.
- Audit logging is broad and intentionally sanitizes sensitive before/after state.
- Reporting and dashboards exist across executive, operational, financial, user performance, compliance, and fraud areas.

### Biggest Gaps

- No formal SOC 2 control owner list, evidence calendar, operating evidence, or auditor-ready control archive.
- Procurement and compliance draft packs now exist, but they still require review, tailoring, and approval before external use.
- Audit logs now have database-level append-only/tamper-evident controls once migration `0039` is applied; audit failures are still non-blocking and need alerting.
- Access control is partly centralized but still depends heavily on per-route checks. High-risk legacy endpoints have been hardened, but a full object-level authorization audit is still needed.
- Privacy controls are partial: BVN/NIN/provider payload encryption and in-app data-rights requests now exist, but retention fulfilment, deletion/anonymization, subprocessor disclosure, and raw-provider access policy are not complete.
- Backup/restore coverage appears limited to specific market/config data scripts, not a complete platform DR strategy.
- Fraud/risk services exist, but some paths still have TODO-style alerting/escalation gaps and need end-to-end verification.
- Local hygiene issue: local `.env`, `.env_staging`, and `google-cloud-credentials.json` exist in the workspace. They are not shown as tracked in `git status`, but should be handled carefully and never included in commits.

## B. Due Diligence Checklist

| Item / Control | Status | Evidence Found | Risk | Recommended Next Action |
| --- | --- | --- | --- | --- |
| Company profile | Partial | `docs/procurement/salvage-bridge/README.md`, `docs/procurement/salvage-bridge/01-product-overview.md`. | Low | Add legal/company registration and commercial contact details when ready. |
| Product overview | Present | `docs/procurement/salvage-bridge/01-product-overview.md`. | Low | Tailor for each insurer conversation. |
| Architecture overview | Partial | `docs/procurement/salvage-bridge/03-architecture-and-deployment.md`, `docs/reports/ARCHITECTURE.md`, code structure. | Medium | Add visual architecture diagram. |
| Security overview | Present | `docs/procurement/salvage-bridge/02-security-overview.md`, `SECURITY.md`, auth/audit/KYC/payment code. | Medium | Add final client-facing security appendix after hardening sprint. |
| Data flow diagram | Partial | `docs/procurement/salvage-bridge/06-data-flow-summary.md`. | Medium | Convert summary into visual DFD. |
| Access control matrix | Partial | `docs/procurement/salvage-bridge/05-access-control-matrix.md`, `docs/procurement/salvage-bridge/12-api-route-authorization-inventory.md`, `src/lib/auth/rbac.ts`, `tests/unit/security/high-risk-route-authorization.test.ts`, `tests/unit/security/api-route-inventory.test.ts`. | Medium | Continue object-level authorization tests and CI inventory. |
| Privacy policy | Draft | `docs/compliance-drafts/privacy-notice-template.md`, legal pages under `src/app/(legal)`. | High | Legal review for white-label privacy and controller/processor posture. |
| Data processing agreement | Draft | `docs/compliance-drafts/data-processing-addendum-draft.md`. | High | Legal review and insurer-specific schedules. |
| Subprocessor list | Draft | `docs/procurement/salvage-bridge/07-subprocessors.md`. | High | Validate provider list per deployment and attach provider references. |
| Data retention policy | Draft | `docs/compliance-drafts/data-retention-policy-draft.md`, `src/app/api/admin/privacy-requests/[id]/retention-check/route.ts`. | High | Approve retention periods and implement automated enforcement. |
| Backup/recovery policy | Draft | `docs/compliance-drafts/backup-recovery-policy-draft.md`, `backups/backup.sh`, `backups/restore.sh`. | High | Create full restore runbook and restore-test evidence. |
| Incident response policy | Draft | `docs/compliance-drafts/incident-response-policy-draft.md`, `SECURITY.md`. | Medium | Assign owners and test tabletop process. |
| SLA/support policy | Draft | `docs/procurement/salvage-bridge/08-support-sla-and-maintenance.md`. | Medium | Finalize commercial targets per client. |
| Change management policy | Draft | `docs/compliance-drafts/change-management-policy-draft.md`. | Medium | Add release approval/evidence process. |
| Vulnerability management policy | Draft | `docs/compliance-drafts/vulnerability-management-policy-draft.md`, `SECURITY.md`, `PRE_COMMIT_SECURITY_CHECK.md`, `package.json` audit scripts. | Medium | Add cadence, owner, tracking log. |
| Pen test report | Missing | No third-party report found. | High | Commission independent web/API pentest before enterprise procurement claim. |
| Audit/security assessment report | Partial | This report, procurement pack, compliance drafts, evidence tracker, and many internal implementation docs. | Medium | Keep tracker current and collect operating evidence. |
| Vendor security questionnaire | Draft | `docs/procurement/salvage-bridge/09-vendor-security-questionnaire.md`. | Medium | Review answers before each insurer questionnaire; do not auto-send without tailoring. |
| NDPA/NDPC readiness notes | Partial | Legal NDPR page exists; KYC privacy/security code exists; no DPCO reviewed pack. | High | Engage Nigerian DPCO/legal counsel if filing/audit is required. |
| Supabase/Postgres compliance references | Needs external validation | Supabase public security page states SOC 2 Type 2, ISO 27001, encryption, daily backups for paid DBs. | Medium | Obtain client-specific Supabase report/plan details if using Supabase. |
| Paystack compliance references | Needs external validation | Paystack public security page states PCI Service Provider Level 1, ISO 27001, ISO 27701, NDPR/NDPA references. | Medium | Include Paystack as payment subprocessor and attach public/security docs. |
| Dojah subprocessor notes | Needs external validation | Dojah integrated in code; public provider security/legal docs must be collected. | High | Obtain Dojah DPA/security docs and document KYC data categories. |
| Cloudinary/Vercel/Resend/Termii subprocessor notes | Needs external validation | Integrated by code/env; provider compliance docs not stored in repo. | Medium | Collect current security/compliance pages or reports. |

## C. Codebase Control Assessment

### 1. Auth / Session

What exists:

- NextAuth v5 configuration in `src/lib/auth/next-auth.config.ts`.
- Credentials, Google, and Facebook auth providers.
- Password verification with `bcryptjs`.
- Redis-backed account lockout: 5 failed attempts and 30-minute lockout.
- Optional login MFA via `src/lib/auth/mfa.ts`.
- Production guard prevents `E2E_TESTING=true` from disabling CSRF in production.
- Secure session cookie settings: httpOnly, sameSite=lax, secure in production.
- Device-aware JWT max age logic and audit logging for login outcomes.
- Password reset/change routes exist: `src/app/api/auth/forgot-password/route.ts`, `src/app/api/auth/change-password/route.ts`.
- Auth routes are rate-limited in several places.

Partial / concerns:

- Redis lockout fails open if Redis is unavailable. That is availability-friendly but weaker for brute-force defense.
- JWT session includes a socket access token and `sessionId`; `sessionId` appears generated using non-cryptographic randomness.
- MFA is implemented but readiness depends on whether policy enforcement is enabled for staff/vendor roles in each deployment.
- No formal session management policy, password history policy, or reauthentication policy was found.

Files inspected:

- `src/lib/auth/next-auth.config.ts`
- `src/lib/auth/rbac.ts`
- `src/lib/auth/vendor-bvn-access.ts`
- `src/proxy.ts`
- `src/app/api/auth/*`
- `src/lib/utils/rate-limit.ts`

### 2. RBAC / Access Control

What exists:

- Defined roles: vendor, claims adjuster, salvage manager, finance officer, system admin.
- Page-level RBAC and some API-prefix RBAC in `src/lib/auth/rbac.ts` and `src/proxy.ts`.
- Vendor KYC/BVN access gating in `src/lib/auth/vendor-bvn-access.ts`.
- Multiple server-side object checks exist in case, auction, document, KYC, payment, and admin routes.

Partial / concerns:

- API RBAC is not universal; many routes rely on route-local checks.
- The previously identified legacy role-name issue in `src/app/api/cases/[id]/route.ts` has been remediated.
- High-risk route hardening was added for payment verification, payment proof upload, pickup confirmation, scheduled/expired auction side effects, admin cache refresh, and operational report access.
- A static route inventory guardrail now requires API routes to be session-gated, cron-secret protected, webhook-signature protected, or explicitly classified as public/pre-auth.
- Need systematic object-level authorization test coverage for vendor documents, auction payment actions, KYC evidence, finance actions, and reports.

Missing:

- Formal access control matrix for procurement.
- Privileged reauthentication for sensitive admin/payment/KYC actions.

### 3. Audit Logs

What exists:

- Broad audit enum and logging utility in `src/lib/utils/audit-logger.ts`.
- Sensitive field sanitizer in `src/lib/utils/audit-sanitizer.ts`.
- Audit schema in `src/lib/db/schema/audit-logs.ts`.
- Admin audit log API/export in `src/app/api/admin/audit-logs/route.ts`.
- Audit actions cover auth, case, auction, bid, payment, wallet, KYC/Dojah, documents, reports, policy, ratings, and fraud.

Partial / concerns:

- Audit failures are non-blocking. That is reasonable for availability, but not enough for regulated evidence without alerting.
- Migration `0039_audit_log_immutability.sql` adds hash-chain columns and database triggers to prevent update/delete once applied.
- Admin export excludes before/after states, which is good for sensitivity, but the system should define who can view raw state.
- The previously identified case-delete audit log deletion issue has been remediated. Case deletion no longer deletes related audit records.
- The previously identified valuation/deduction admin audit TODOs have been remediated with create, update, and delete audit logging.

Missing:

- External WORM/export-to-log-store evidence beyond the primary database trigger design.
- Formal audit retention policy.
- Control evidence showing regular audit review.

### 4. KYC / Dojah

What exists:

- Dojah webhook route validates secret/signature and fails closed in production if no secret is configured: `src/app/api/webhooks/dojah/route.ts`.
- Duplicate webhook handling and provider event recording.
- Provider verification records and webhook event schemas: `src/lib/db/schema/provider-verifications.ts`.
- Normalized verification result model and encrypted raw payload storage.
- Tier 1 BVN verification and encryption functions in `src/features/vendors/services/bvn-verification.service.ts`.
- Manager KYC review/decision route: `src/app/api/kyc/approvals/[id]/decision/route.ts`.
- KYC documents/evidence/refresh/export routes exist.
- Unit tests exist for Dojah integration behavior under `tests/unit/kyc/`.

Partial / concerns:

- Legacy/manual KYC and provider KYC coexist; the operational policy needs to define which source wins.
- Raw provider payload encryption exists, but access-control and retention policy for provider data needs formalization.
- Dojah test mode messaging has appeared in the UI before; production/client deployments need clear environment validation.
- AML/PEP/watchlist handling appears modeled but needs provider capability evidence and review workflow verification.

Missing:

- DPA/subprocessor documentation for Dojah.
- Data retention/deletion rules for BVN/NIN/selfies/CAC/bank statements/raw provider payloads.
- Formal KYC reviewer SOP.

### 5. Payments / Wallet / Deposits

What exists:

- Paystack unified webhook verifies HMAC SHA512 signature using the raw body: `src/app/api/webhooks/paystack/route.ts`.
- Auction-specific Paystack webhook also exists: `src/app/api/webhooks/paystack-auction/route.ts`.
- Payment service models Paystack, wallet-only, hybrid payment, frozen wallet portions, rollbacks, wallet settlement, non-winner unfreeze, final payment, and finance transfer: `src/features/auction-deposit/services/payment.service.ts`.
- Wallet transactions and deposit events create ledger-like evidence.
- Row-level locks are used with `.for('update')` in wallet-sensitive paths.
- Payment queue/idempotency exists in `src/lib/queue/payment-queue.ts`.
- Cron reconciliation and deadline routes are configured in `vercel.json`.
- A deposit-freeze guardrail test now checks that outbid vendors are not unfrozen immediately, closure only releases bidders below the configured top-N fallback set, and payment settlement releases only auction-specific frozen funds.

Partial / concerns:

- Payment code is complex and still needs DB-backed integration tests around Paystack webhook replay, failed webhook recovery, payment cancellation, duplicate payments, and settlement.
- Some payment paths have legacy and newer behavior; reconcile these before procurement demos.
- Formal financial controls are missing: maker/checker approvals, refund policy, manual adjustment policy, reconciliation sign-off, exception reports.
- PCI scope appears mostly delegated to Paystack, but platform payment references, wallet, deposits, and financial records still require strong controls.

Missing:

- Formal reconciliation runbook.
- Refund/withdrawal policy if supported.
- Finance approval matrix.
- Payment incident playbook.

### 6. Documents / Files

What exists:

- Document generation/signing service in `src/features/documents/services/document.service.ts`.
- Document types include bill of sale, liability waiver, pickup authorization, and salvage certificate.
- Documents use active business policy branding/legal/contact details.
- BVN is masked in generated document data.
- Vendor document download route fetches PDF server-side: `src/app/api/documents/[id]/download/route.ts`.
- Auction document download route now fetches PDFs server-side after permission checks instead of redirecting users to raw storage URLs: `src/app/api/auctions/[id]/documents/[docId]/download/route.ts`.
- Document download tracking table is referenced via `documentDownloads`.

Partial / concerns:

- Access expiration / signed short-lived document URLs were not clearly evidenced.
- Document viewing/downloading audit coverage has improved, but preview/view events and all generated-document paths still need route-by-route verification.

Missing:

- Document retention policy.
- Legal approval process for templates.
- Document access review process.

### 7. Fraud Alerts / Risk Monitoring

What exists:

- Fraud service modules exist under `src/features/fraud/services/`.
- Admin fraud alert routes exist under `src/app/api/admin/fraud-alerts/*`.
- Intelligence fraud alert routes exist under `src/app/api/intelligence/fraud/*`.
- Cron routes include fraud detection and auto-suspend flows.
- Dojah-specific fraud/AML/IP/device action types exist in audit enum.

Partial / concerns:

- `src/features/fraud/services/fraud-logging.service.ts` includes TODO-style alert creation/escalation gaps.
- Some attempted/matched fraud data may be sensitive and needs sanitization/retention review.
- Need end-to-end verification of alert creation, review, dismissal, suspension, and notification.

Missing:

- Formal fraud triage SOP.
- Security monitoring dashboard/runbook.
- Incident escalation matrix.

### 8. Business Policy / White-Label

What exists:

- Business policy service supports runtime default, published policy, draft save, publish, validation, sanitization, snapshots, and public policy.
- Files: `src/features/business-policy/business-policy.service.ts`, `policy-validation.ts`, `policy-sanitization.ts`, `public-policy.ts`, `default-policy.ts`.
- Admin API: `src/app/api/admin/business-policy/route.ts`.
- Public API: `src/app/api/business-policy/public/route.ts`.
- Policy changes are audit logged.
- Branding, homepage templates, auth provider toggles, payment methods, onboarding/KYC, docs, fraud/report settings are modeled.

Partial / concerns:

- Public policy exposure should be reviewed to ensure no private config leaks.
- Per-client deployment isolation is assumed by environment/database separation, but not formally documented.
- Client-specific domain/email/payment/KYC setup checklist needs formalization.

Missing:

- White-label deployment guide and client isolation model.
- Policy decision log/report that can be shown in audits.

### 9. Reports / Exports

What exists:

- Report services and routes cover executive, financial, operational, compliance, escrow, vendor ranking, payment aging, and user performance.
- Permission checks exist in `src/features/reports/services/report.service.ts`.
- Report audit service exists: `src/features/reports/services/report-audit.service.ts`.
- Export routes exist for CSV/Excel/PDF.

Partial / concerns:

- `docs/reports/HONEST_ASSESSMENT.md` states parts of reporting were previously incomplete or placeholder. Current code should be tested end-to-end before demos.
- Report permissions need route-by-route verification.
- Evidence packet generation for procurement/compliance is not yet formalized.

Missing:

- Report catalog with owner, audience, data source, refresh cadence, and access permissions.
- Export controls for sensitive data.

### 10. Monitoring / Backups / Resilience

What exists:

- Database retry wrapper and connection health helpers in `src/lib/db/drizzle.ts`.
- Redis/KV cache helpers in `src/lib/redis/client.ts`.
- Scheduled crons in `vercel.json`.
- Backup/restore scripts under `backups/`.
- Health-like routes exist, including KYC/intelligence health routes.

Partial / concerns:

- Backup scripts appear scoped to market/config tables, not the full operational database.
- No full DR plan, RTO/RPO, restore test evidence, incident response tabletop evidence, or monitoring/alerting policy found.
- Repeated `CONNECTION_CLOSED` logs from prior testing suggest DB pooler/runtime resilience needs attention.
- `Dockerfile` runs seeds by default unless `SKIP_SEEDS=true`; production behavior must be tightly controlled.

Missing:

- Centralized observability stack and alert routing evidence.
- Full backup/restore policy.
- Disaster recovery runbook.
- Dependency outage playbooks for Supabase, Vercel, Paystack, Dojah, Cloudinary, Resend/Termii.

## D. SOC 2 Readiness Assessment

### Security

Current evidence:

- Auth, secure cookies, lockout, optional MFA, RBAC, rate limits, webhook signature validation, audit logs, KYC encryption, and sensitive audit sanitization.
- `SECURITY.md` contains security reporting and operational guidance.

Missing evidence:

- Formal security policy pack, access review evidence, change approvals, vulnerability management evidence, incident response evidence, and third-party penetration test.

Code gaps:

- Inconsistent API/object authorization coverage remains outside the high-risk routes already hardened.
- Audit immutability depends on applying migration `0039` in each environment and retaining external evidence.
- Some legacy route patterns may remain and need continued inventory review.
- Some fail-open security dependencies.

Policy/process gaps:

- Access review cadence, least-privilege onboarding/offboarding, privileged reauth, incident response, vendor security management.

Readiness score: 5.5 / 10.

### Availability

Current evidence:

- Retry wrappers, scheduled crons, provider fallback behavior in some areas, Supabase/Vercel-style deployment assumptions, backup scripts.

Missing evidence:

- RTO/RPO, uptime SLA, monitoring alerts, restore tests, failover strategy, incident postmortems.

Code gaps:

- Connection pooler failures have caused user-visible 500/timeout behavior in testing.
- Backup scripts are not full platform backups.

Policy/process gaps:

- SLA/support escalation, incident communications, DR plan.

Readiness score: 3.5 / 10.

### Processing Integrity

Current evidence:

- Payment webhook signature verification, wallet row locks, idempotency patterns, payment reconciliation crons, business policy validation, KYC normalization, document progress checks.

Missing evidence:

- End-to-end financial reconciliation sign-off, payment exception workflow, QA evidence for top-N frozen deposit logic, hybrid/wallet payment controls, report accuracy validation.

Code gaps:

- Complex payment paths need more tests.
- Some report docs admit prior placeholder/incomplete logic.

Policy/process gaps:

- Finance approval matrix, reconciliation SOP, manual adjustment controls.

Readiness score: 5 / 10.

### Confidentiality

Current evidence:

- BVN/NIN/provider payload encryption paths, audit sanitization, server-side document fetch route, secure env examples, Cloudinary signed uploads.
- Supabase public page states encryption at rest/in transit for hosted customer data; Paystack public page states PCI/ISO controls for payment handling.

Missing evidence:

- Data classification, encryption key management/rotation policy, raw provider access policy, document URL expiration design, secure deletion evidence.

Code gaps:

- Some document routes redirect to provider URLs.
- Local secret files exist in workspace and need strict handling.

Policy/process gaps:

- Key rotation, least-privilege provider dashboard access, secure support handling.

Readiness score: 5 / 10.

### Privacy

Current evidence:

- Legal pages exist, KYC data is modeled carefully, audit sanitizer avoids sensitive values, provider payloads can be encrypted, BVN masking exists.
- Users can submit privacy/data-rights requests from Settings, and admins can review, status, note, and audit those requests.
- Admins can run a dry-run retention/blocker check before fulfilling deletion/deactivation-style requests.

Missing evidence:

- Legal-reviewed privacy notice/DPA/subprocessor list, completed deletion/anonymization SOP, approved retention schedules, lawful basis mapping, cross-border transfer assessment, NDPA/DPCO review.

Code gaps:

- Privacy request intake and admin review now exist, but automated export package generation and final deletion/anonymization execution are not complete.
- Retention is not uniformly enforced across KYC, documents, logs, payments, notifications, provider payloads.

Policy/process gaps:

- DPO/contact process, breach notification workflow, controller/processor terms, Nigerian DPCO filing if applicable.

Readiness score: 4.5 / 10.

## E. External Report Reality Check

What this self-assessment can cover:

- Architecture and code-level control inventory.
- Internal readiness score.
- Evidence map to repository files.
- Gap list and remediation roadmap.
- Draft procurement answers.

What Codex/codebase review can cover:

- Whether controls appear implemented in source code.
- Whether docs exist.
- Whether obvious gaps, TODOs, and risk patterns are present.
- Whether claims are supportable by repository evidence.

What requires an independent third-party pentest:

- Exploitability of auth, RBAC, object access, file access, KYC evidence access, payment flows, webhooks, upload handling, and admin surfaces.
- External network and deployment posture.
- OWASP/API abuse testing.

What requires a formal CPA/SOC 2 auditor:

- SOC 2 Type I/II scoping.
- Control design and operating effectiveness.
- Auditor evidence requests, sampling, management assertions, bridge letters.

What requires Nigerian privacy counsel or licensed DPCO:

- NDPA/NDPC filing/audit obligations.
- DPCMI classification.
- DPA/privacy notice review.
- Lawful basis, data subject rights, breach notification obligations.
- Cross-border transfer position.

## F. Recommended Procurement Pack

### Minimum Pack for First Demo

1. Product overview for insurers.
2. High-level architecture diagram.
3. Role/access matrix.
4. Security overview.
5. Data flow diagram for KYC, payment, document, and auction flows.
6. White-label deployment overview.
7. Subprocessor draft list.
8. Current limitations and roadmap.

### Procurement / Legal Pack

1. DPA template.
2. Privacy notice template.
3. Data retention/deletion policy.
4. Incident response policy.
5. Support/SLA policy.
6. Backup/restore and DR policy.
7. Change management policy.
8. Vulnerability management policy.
9. Access control policy.
10. Vendor security questionnaire.
11. Provider compliance references for Supabase, Vercel, Cloudinary, Paystack, Dojah, Resend, Termii.

### Larger / International Client Pack

1. SOC 2 readiness matrix.
2. Pen test report.
3. Evidence of dependency scanning and remediation.
4. DPIA/PIA.
5. Data transfer assessment.
6. Formal business continuity plan.
7. RTO/RPO and restore test evidence.
8. Secure SDLC policy.
9. Incident tabletop evidence.
10. Access review evidence.

## G. 30-Day Remediation Plan

### 1. Must-Have Before Sales Conversations

- Create product overview, architecture diagram, data-flow diagram, and white-label deployment overview.
- Create access control matrix.
- Create draft subprocessor list.
- Write clear "not SOC 2 certified yet" security readiness language.
- Prepare a concise security overview using evidence from auth, RBAC, audit, KYC, payment, document, policy, and report modules.
- Keep the remediation/evidence tracker current and remove outdated gaps once code evidence is verified.

### 2. Must-Have Before Production Deployment to a New Insurer

- Continue route-by-route authorization audit with object-level negative tests.
- DB-backed payment/wallet/deposit integration tests for hybrid payment, wallet-only, Paystack, webhook replay, duplicate payment, and failed webhook recovery.
- Document access hardening review.
- Backup/restore/DR plan with tested restore.
- Incident response and SLA/support process.
- KYC retention and raw provider payload policy.
- Environment/secrets checklist per client.
- Provider configuration checklist: domain, emails, Paystack, Dojah, Cloudinary, SMS, push, OAuth.

### 3. Nice-to-Have After First Few Sales

- Evidence packet generator for procurement.
- Built-in admin export of policy versions, audit history, and access matrix.
- Automated access reviews.
- Tamper-evident audit export to external log store.
- Expanded monitoring dashboards.
- Security control dashboard for each deployment.

### 4. Formal Compliance / Audit Items for Later

- Independent penetration test.
- SOC 2 Type I readiness assessment, then SOC 2 Type I, then Type II.
- NDPA/DPCO review and any required filings.
- Formal vendor risk management program.
- Annual disaster recovery test.
- Annual incident response tabletop.
- Security awareness and secure SDLC training evidence.

## H. Questions to Be Ready For in Insurer Meetings

### IT / Security

- How is each insurer's data isolated?
- Is this single-tenant or multi-tenant?
- Where is data hosted?
- Who has production database access?
- How are secrets stored and rotated?
- Do you support MFA for admins?
- Are webhooks verified?
- Are documents private?
- Can vendors access another vendor's records?
- Do you have a pentest report?
- What happens if Paystack/Dojah/Supabase is down?

### Compliance / Legal

- Are you a data processor or controller?
- What personal data do you process?
- Do you process BVN, NIN, selfies, IDs, addresses, bank details, AML data?
- What is your retention policy?
- Can a data subject request deletion/export?
- Who are your subprocessors?
- Do you have a DPA?
- Have you filed any NDPA/NDPC audit returns?
- What is your breach notification timeline?

### Procurement

- Can you provide company registration, insurance, references, and support process?
- What is the SLA?
- What onboarding support is included?
- What is the deployment timeline?
- What are the recurring third-party costs?
- What evidence do you provide for security controls?

### Finance

- How are deposits frozen?
- Can deposits be unfrozen incorrectly?
- How do you reconcile Paystack payments?
- How do you handle failed webhooks?
- Are wallet transactions immutable?
- Who can approve refunds or manual adjustments?
- How are settlement reports generated?

### Claims / Salvage Operations

- How does case creation work?
- Can managers approve/reject cases?
- How are reserve prices set?
- Can auctions be extended or stopped early?
- How are documents generated and signed?
- What happens if a winner does not pay?
- How are pickup instructions released?

### Executive Management

- What does white-label mean operationally?
- Can the insurer control branding, policies, emails, templates, payments, and KYC providers?
- How quickly can this launch?
- What are the top risks before production?
- What compliance claims can we safely make today?

## Final Recommendation

The platform should be positioned now as:

"A white-label salvage auction recovery platform with built-in role separation, KYC, wallet/deposit handling, payment workflows, document signing, audit trails, fraud monitoring, configurable business policy, and reporting, currently being packaged for enterprise procurement and SOC 2-style readiness."

Do not position it as SOC 2 compliant yet.

The next practical move is to keep the procurement pack and remediation tracker current, then run a focused security hardening sprint before onboarding another insurer into production.
