# Salvage Bridge Remediation and Evidence Tracker

Last updated: 2026-05-31

This tracker is for internal use before insurer procurement, security review, legal review, or auditor review. It separates work Salvage Bridge can evidence from work that must be validated by an insurer, legal counsel, DPCO, external penetration tester, cloud provider, or SOC 2 auditor.

Do not send this file as-is to a prospect unless the open items have been reviewed and tailored.

## Status Legend

| Status | Meaning |
| --- | --- |
| Complete | Implemented or drafted enough to reference internally. |
| Draft | Document exists but needs owner/legal/security approval before external use. |
| In progress | Work has started but is not complete. |
| Client-specific | Must be finalized per insurer deployment. |
| External validation | Requires provider report, independent test, legal opinion, DPCO review, or auditor evidence. |

## Completed Remediation

| Area | Status | Evidence | Owner | Notes |
| --- | --- | --- | --- | --- |
| Procurement overview pack | Complete | `docs/procurement/salvage-bridge/README.md`, `01-product-overview.md`, `02-security-overview.md`, `03-architecture-and-deployment.md` | Salvage Bridge | Safe for internal sales enablement after final review. |
| White-label deployment narrative | Complete | `04-white-label-client-isolation.md` | Salvage Bridge | Describes per-client environment/database approach without overpromising multi-tenant isolation. |
| Access-control matrix draft | Complete | `05-access-control-matrix.md` | Salvage Bridge | Must be reconciled with route-level test evidence before being treated as final. |
| Data-flow summary | Complete | `06-data-flow-summary.md` | Salvage Bridge | Should be converted into a diagram for technical procurement packs. |
| Subprocessor list draft | Draft | `07-subprocessors.md` | Salvage Bridge + Legal | Provider list must be confirmed per deployment. |
| Support/SLA draft | Draft | `08-support-sla-and-maintenance.md` | Salvage Bridge + Commercial | SLA commitments should be finalized in the customer agreement. |
| Security questionnaire starter | Draft | `09-vendor-security-questionnaire.md` | Salvage Bridge + Security | Use as a controlled answer bank, not as an automatic answer to every questionnaire. |
| Case-delete audit preservation | Complete | `src/app/api/cases/[id]/route.ts` | Engineering | Case deletion no longer deletes related audit logs. |
| Actual role checks in case update/delete | Complete | `src/app/api/cases/[id]/route.ts` | Engineering | Replaced legacy `manager` / `admin` role checks with `salvage_manager` / `system_admin`. |
| Document download audit events | Complete | `src/app/api/documents/[id]/download/route.ts`, `src/app/api/auctions/[id]/documents/[docId]/download/route.ts` | Engineering | Download actions now emit `DOCUMENT_DOWNLOADED`. |
| Auction document app-mediated download | Complete | `src/app/api/auctions/[id]/documents/[docId]/download/route.ts` | Engineering | Route serves PDF bytes through the app instead of redirecting to raw storage URL. |
| Download filename hardening | Complete | Document download routes | Engineering | Document titles are sanitized before being used in `Content-Disposition`. |
| Valuation/deduction audit logging | Complete | `src/app/api/admin/valuations/*`, `src/app/api/admin/deductions/*` | Engineering | Create, update, and delete actions now write valuation audit logs. |
| Audit log append-only foundation | Complete | `src/lib/db/migrations/0039_audit_log_immutability.sql`, `src/lib/db/schema/audit-logs.ts` | Engineering | Adds hash-chain metadata and database triggers to prevent update/delete once migration is applied. External WORM export remains a later evidence item. |
| Privacy/data-rights request workflow | Complete | `src/app/api/settings/privacy/route.ts`, `src/components/settings/privacy-settings-panel.tsx`, `src/lib/db/migrations/0040_add_data_right_requests.sql` | Engineering | Users can submit audited export/correction/deactivation/deletion/restriction/objection requests for review. |
| Admin privacy request review | Complete | `src/app/api/admin/privacy-requests/route.ts`, `src/app/api/admin/privacy-requests/[id]/route.ts`, `src/components/admin/privacy-requests-content.tsx` | Engineering | System admins and salvage managers can search, filter, review, update status, record notes, and audit privacy request decisions. |
| Privacy retention dry-run control | Complete | `src/app/api/admin/privacy-requests/[id]/retention-check/route.ts`, `src/components/admin/privacy-requests-content.tsx` | Engineering | Admins can check operational blockers and retained evidence before completing deletion/deactivation-style requests. This is a dry-run control; it does not delete records. |
| High-risk API route hardening | Complete | `docs/procurement/salvage-bridge/12-api-route-authorization-inventory.md`, `tests/unit/security/high-risk-route-authorization.test.ts` | Engineering | Payment, pickup, scheduled-auction, admin cache, and report routes were tightened and covered by a static guardrail test. |
| API route inventory guardrail | Complete | `tests/unit/security/api-route-inventory.test.ts` | Engineering | Every API route must be session-gated, cron-secret protected, webhook-signature protected, or explicitly documented as public/pre-auth. |
| Deposit freeze policy guardrail | Complete | `tests/unit/security/deposit-freeze-policy.test.ts` | Engineering | Static regression test checks no outbid unfreeze, top-N fallback freeze behavior, and auction-specific deposit settlement/unfreeze sequence. |

## Draft Policies and Legal/Compliance Materials

| Document | Status | Evidence | External review needed |
| --- | --- | --- | --- |
| Data processing addendum | Draft | `docs/compliance-drafts/data-processing-addendum-draft.md` | Legal counsel; insurer legal team |
| Privacy notice template | Draft | `docs/compliance-drafts/privacy-notice-template.md` | Legal counsel; insurer-specific controller/processor review |
| Data retention policy | Draft | `docs/compliance-drafts/data-retention-policy-draft.md` | Legal/compliance; implementation owner |
| Incident response policy | Draft | `docs/compliance-drafts/incident-response-policy-draft.md` | Security owner; executive owner |
| Backup/recovery policy | Draft | `docs/compliance-drafts/backup-recovery-policy-draft.md` | Infrastructure owner; restore-test evidence |
| Change management policy | Draft | `docs/compliance-drafts/change-management-policy-draft.md` | Engineering lead; release owner |
| Vulnerability management policy | Draft | `docs/compliance-drafts/vulnerability-management-policy-draft.md` | Security owner; tracker setup |
| NDPA/NDPC readiness notes | Draft | `docs/compliance-drafts/ndpa-ndpc-readiness-notes.md` | Nigerian privacy counsel or licensed DPCO where required |
| SOC 2 readiness control map | Draft | `docs/compliance-drafts/soc2-readiness-control-map.md` | CPA/SOC 2 readiness advisor or auditor |

## Must-Have Before New Insurer Production Deployment

| Control | Status | Next Action | Owner |
| --- | --- | --- | --- |
| Route-level authorization test matrix | In progress | High-risk and route-inventory guardrails exist; add vendor isolation, KYC evidence access, document route, report route, and admin settings negative tests. | Engineering |
| Payment integration test pack | In progress | Deposit freeze policy guardrail exists; add DB-backed Paystack webhook replay, stuck-payment verify, hybrid payment, wallet-only payment, duplicate reference, and settlement release tests. | Engineering |
| Backup restore test evidence | External validation | Run restore test against a non-production environment and retain timestamped evidence. | Infrastructure |
| Monitoring and alerting runbook | Draft | Define who receives alerts for payment failures, webhook failures, DB connection failures, KYC webhook failures, and fraud escalation failures. | Engineering + Operations |
| Provider compliance references | External validation | Collect current compliance/security references from Supabase/Postgres, Vercel/hosting, Cloudinary/storage, Paystack, Dojah, Resend, Termii, Google, and any SMS/email provider used. | Operations + Legal |
| Data retention implementation | In progress | Privacy request workflow and admin retention dry-run exist; convert approved retention periods into scheduled jobs or documented manual retention controls. | Engineering + Compliance |
| Incident response contact tree | Client-specific | Define Salvage Bridge contacts and insurer contacts for each deployment. | Operations |
| Environment and secrets checklist | Client-specific | Confirm per-client domain, app URL, callback URLs, Paystack, Dojah, Cloudinary/storage, email/SMS, push keys, OAuth, and database configuration. | Engineering |

## External Evidence Still Required

| Evidence | Why It Matters | Who Provides It |
| --- | --- | --- |
| Independent penetration test report | Required for strong enterprise security assurance. | Third-party security firm |
| Formal SOC 2 readiness assessment or SOC 2 audit | Required before any SOC 2 compliance claim. | CPA firm/SOC 2 auditor |
| Nigerian data protection review or DPCO support | Required where NDPA/NDPC filing, audit, or compliance representation is needed. | Licensed DPCO or privacy counsel |
| Provider compliance reports | Needed to support subprocessor and infrastructure claims. | Cloud/payment/KYC/storage/email/SMS providers |
| Legal review of DPA, privacy, retention, and SLA | Required before sending binding commitments to insurers. | Legal counsel |
| Production restore test evidence | Required to prove backup/DR claims. | Infrastructure owner |

## Client-Specific Configuration Checklist

Use this for every insurer deployment.

| Item | Must Be Client-Specific? | Notes |
| --- | --- | --- |
| App name, logo, colors, public copy | Yes | Managed through enterprise setup/business policy. |
| Legal entity name and footer/legal copy | Yes | Must match insurer/customer-owned portal posture unless contract says otherwise. |
| Support email/phone | Yes | Can be Salvage Bridge, insurer, or shared support depending on agreement. |
| Public domain and callback URLs | Yes | Never ship localhost/ngrok callbacks in production. |
| Database/environment | Yes | One deployment/database per insurer is the safest current model. |
| Payment provider credentials | Yes | Paystack subaccount/settlement model must match commercial agreement. |
| KYC provider credentials | Yes | Dojah mode, webhook secret, and production capability must be validated. |
| Email/SMS/push sender details | Yes | Sender names and templates must match active brand and legal posture. |
| Retention schedule | Usually | Depends on insurer policy, legal requirements, and contract. |
| SLA/support contacts | Yes | Should be in order form or support schedule. |

## Procurement Language Guardrails

Use precise, defensible language:

- Say: "Designed for isolated white-label deployments."
- Do not say: "Guaranteed tenant isolation" unless architecture and contract prove it.
- Say: "Supports audit logging across key workflows."
- Say: "Audit logs include append-only database triggers and tamper-evident hash-chain metadata once migrations are applied."
- Do not say: "Tamper-proof audit logs" or "WORM-compliant audit storage" unless external immutable storage/export evidence is implemented and reviewed.
- Say: "Paystack handles card checkout; Salvage Bridge stores transaction references and wallet/deposit records."
- Do not say: "PCI compliant" unless Salvage Bridge has its own applicable assessment.
- Say: "SOC 2-style controls are being mapped."
- Do not say: "SOC 2 compliant" without a CPA audit report.
- Say: "NDPA/NDPC readiness materials are drafted for legal/DPCO review."
- Do not say: "NDPA certified" unless formal evidence exists.
