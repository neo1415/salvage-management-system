# Security Overview

## Security Posture Summary

Salvage Bridge is built with role separation, auditability, payment integrity, provider webhook verification, sensitive-data handling, and configurable white-label policy controls in mind.

This document is a procurement overview, not a certification report.

## Current Security Controls

| Area | Current Control |
| --- | --- |
| Authentication | Email/phone credentials, OAuth support, password hashing, secure cookies, account lockout, optional MFA. |
| Authorization | Role-based access for vendors, adjusters, salvage managers, finance officers, and system admins. |
| KYC | Dojah integration, webhook verification, provider verification records, review workflows, sensitive payload storage. |
| Payments | Paystack webhook signature verification, wallet/deposit records, row-locking for critical wallet operations, reconciliation jobs. |
| Audit | Central audit action model, sensitive audit-state sanitizer, admin audit log access, document download records. |
| Business Policy | Draft/publish workflow, validation, sanitization, active policy versions, public/private config separation. |
| Documents | Server-mediated document download routes, document signing progress, generated PDF records. |
| Rate Limiting | Applied across auth, payment, OTP, upload, bidding, and other high-risk routes. |

## Evidence in the Codebase

- `src/lib/auth/next-auth.config.ts`
- `src/lib/auth/rbac.ts`
- `src/proxy.ts`
- `src/lib/utils/audit-logger.ts`
- `src/lib/utils/audit-sanitizer.ts`
- `src/app/api/webhooks/paystack/route.ts`
- `src/app/api/webhooks/dojah/route.ts`
- `src/features/auction-deposit/services/payment.service.ts`
- `src/features/documents/services/document.service.ts`
- `src/features/business-policy/business-policy.service.ts`
- `src/features/business-policy/policy-validation.ts`
- `src/features/business-policy/policy-sanitization.ts`

## What This Does Not Claim

This overview does not claim:

- SOC 2 compliance
- PCI DSS certification for Salvage Bridge
- NDPA/NDPC certification
- independent penetration test completion
- legal sufficiency of insurer-specific templates

Payment card processing is intended to be handled by payment providers such as Paystack. Salvage Bridge still retains responsibility for securely handling platform payment references, wallet/deposit records, reconciliation, and user authorization.

## Recommended Client Review

Before production rollout, each insurer should review:

- deployment architecture
- data flow
- access control matrix
- support/SLA expectations
- DPA and privacy terms
- provider/subprocessor list
- backup and restore approach
- incident response contact path
- payment/KYC provider setup

