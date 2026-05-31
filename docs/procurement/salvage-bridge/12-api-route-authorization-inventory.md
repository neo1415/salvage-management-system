# API Route Authorization Inventory

Last reviewed: 2026-05-31

This is an engineering evidence note, not a formal penetration test. It records the current route-level authorization sweep and the high-risk remediations completed after the vendor due diligence assessment.

## Summary

Static inventory scan:

| Category | Count | Meaning |
| --- | ---: | --- |
| Total `src/app/api/**/route.ts` files scanned | 257 | API route handlers present in the app directory. |
| Auth + role checks detected | 137 | Route contains session authentication and explicit role/permission logic. |
| Auth checks detected | 65 | Route requires a signed-in session but may rely on object ownership or shared authenticated access rather than role gates. |
| Public or integration route | 42 | Route is intentionally public or externally called, such as auth bootstrap, public config, callbacks/webhooks, lookup/autocomplete, contact, or public leaderboard. |
| Needs manual review after classifier | 9 | Mostly public/intentionally-auth-flow routes plus shared profile delegation. These should remain in the manual route review queue. |

The classifier is intentionally conservative. A route appearing outside `auth+role` is not automatically insecure; it means the reason for access should be documented or tested.

## High-Risk Routes Hardened

| Route | Remediation |
| --- | --- |
| `src/app/api/payments/[id]/verify/route.ts` | Requires authenticated session and uses `session.user.id` as the finance officer instead of trusting a browser-supplied `financeOfficerId`. |
| `src/app/api/payments/[id]/upload-proof/route.ts` | Requires authenticated session and verifies the payment vendor belongs to the signed-in user before accepting proof uploads. |
| `src/app/api/auctions/[id]/confirm-pickup/route.ts` | Requires authenticated session and verifies the signed-in user owns the winning vendor record before confirming pickup. |
| `src/app/api/auctions/check-expired/route.ts` | Requires authenticated session before triggering expiry checks or closure side effects. |
| `src/app/api/auctions/check-and-activate-scheduled/route.ts` | Requires authenticated session before activating scheduled auctions. |
| `src/app/api/auctions/scheduled-status/route.ts` | Restricted to `system_admin` and `salvage_manager`. |
| `src/app/api/admin/cache/refresh/route.ts` | Restricted to `system_admin`. |
| `src/app/api/reports/operational/auction-performance/route.ts` | Restricted to `system_admin`, `salvage_manager`, and `finance_officer`. |
| `src/app/api/settings/privacy/route.ts` | Requires authenticated session and only returns/creates requests for the signed-in user. |

Guardrail tests:

- `tests/unit/security/high-risk-route-authorization.test.ts`
- `tests/unit/security/api-route-inventory.test.ts`

The inventory test classifies each route as one of:

- signed-in session protected
- cron-secret protected
- webhook-signature protected
- explicitly documented as public/pre-auth

If a new route is added without one of those gates or a deliberate public classification, the test fails.

## Manual Review Queue

These routes should be reviewed individually and either documented as intentionally public/integration routes or moved behind session/role gates:

| Route | Current disposition |
| --- | --- |
| `src/app/api/auctions/[id]/watching-count/route.ts` | Public-ish read endpoint for watching count; mutates Redis only to clean expired viewers. Keep under review for abuse/rate limiting. |
| `src/app/api/auth/mfa/start/route.ts` | Login pre-auth route. Rate limited and password checked before MFA code sending. |
| `src/app/api/config/system/route.ts` | Public read-only config subset. Confirm no client-specific sensitive values are exposed before production. |
| `src/app/api/otp/resend/route.ts` | Authentication bootstrap route. Should remain rate limited. |
| `src/app/api/otp/verify/route.ts` | Authentication bootstrap route. Should remain rate limited. |
| `src/app/api/vendor/settings/profile/route.ts` | Deprecated delegation route to `/api/settings/profile`; shared route handles authentication. |
| `src/app/api/vendors/leaderboard/route.ts` | Public leaderboard. Confirm it exposes only safe aggregate/vendor-display fields. |

## Next Evidence To Collect

- Object-level authorization tests for document access, KYC evidence access, vendor payment ownership, wallet operations, and admin-only settings.
- Full API route inventory generated in CI with expected disposition per route.
- Negative tests showing vendors cannot access other vendors' documents, payments, KYC records, or wallet records.
- Report route permission tests for finance, salvage manager, claims adjuster, vendor, and anonymous users.
