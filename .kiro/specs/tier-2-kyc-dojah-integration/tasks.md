# Implementation Plan: Tier 2 KYC Dojah Integration

## Overview

Implement Dojah-powered Tier 2 KYC verification for the NEM Salvage platform. The widget-first approach uses Dojah's JS widget for biometric capture, with server-side result processing, AES-256 encryption, AML screening, manager approval flow, and tier enforcement.

## Tasks

- [x] 1. Database schema extensions and Drizzle migration
  - Add 25 new columns to the `vendors` table in `src/lib/db/schema/vendors.ts` (ninEncrypted, ninVerificationData, ninVerifiedAt, photoIdUrl, photoIdType, photoIdVerifiedAt, selfieUrl, livenessScore, biometricMatchScore, biometricVerifiedAt, addressProofUrl, addressVerifiedAt, amlScreeningData, amlRiskLevel, amlScreenedAt, businessType, cacForm7Url, directorIds, tier2SubmittedAt, tier2ApprovedAt, tier2ApprovedBy, tier2RejectionReason, tier2ExpiresAt, tier2DojahReferenceId, fraudRiskScore, fraudFlags)
  - Create `src/lib/db/schema/verification-costs.ts` with the `verification_costs` table
  - Add composite index on `(tier, status)`, index on `nin_verified_at`, index on `aml_risk_level`
  - Generate and run Drizzle migration
  - _Requirements: 15.1–15.25, 13.7–13.8_

- [x] 2. EncryptionService and property tests
  - [x] 2.1 Implement `src/features/kyc/services/encryption.service.ts`
    - AES-256-CBC `encrypt(plaintext)` returning `{hex_iv}:{hex_ciphertext}`
    - `decrypt(ciphertext)` parsing the IV prefix
    - `mask(value)` returning `*******XXXX` (last 4 visible)
    - Throw on missing `ENCRYPTION_KEY` env var or key length ≠ 64 chars
    - _Requirements: 11.1–11.8, 31.4, 31.8_

  - [ ]* 2.2 Write property test: NIN encryption round-trip (Property 1)
    - File: `src/features/kyc/services/__tests__/encryption.service.pbt.test.ts`
    - **Property 1: decrypt(encrypt(nin)) === nin for all valid 11-digit NINs**
    - **Validates: Requirements 1.7, 11.1, 11.9**

  - [ ]* 2.3 Write property test: IV uniqueness (Property 11)
    - **Property 11: Two encryptions of the same plaintext produce different IVs**
    - **Validates: Requirements 11.3**

  - [ ]* 2.4 Write property test: NIN/BVN masking (Property 12)
    - **Property 12: mask(value) returns same-length string with first (N-4) chars as asterisks**
    - **Validates: Requirements 11.8**

- [x] 3. Zod schemas for Dojah API responses
  - Implement `src/features/kyc/schemas/dojah.schemas.ts` with:
    - `DojahNINEntitySchema`, `DojahVerificationResultSchema`, `DojahAMLResultSchema`, `DojahCACResultSchema`
    - Normalize date fields to ISO 8601 and phone numbers to E.164 inside transforms
    - Handle null/undefined fields with `.optional()` and `.nullable()`
  - _Requirements: 25.1–25.12, 16.17_

  - [ ]* 3.1 Write property test: Dojah response parsing round-trip (Property 5)
    - File: `src/features/kyc/services/__tests__/dojah.service.pbt.test.ts`
    - **Property 5: parse(format(dojahResponse)) equals original for all valid response shapes**
    - **Validates: Requirements 1.4, 4.6, 25.3, 25.6**

- [x] 4. KYC types and validation utilities
  - Create `src/features/kyc/types/kyc.types.ts` with `KYCVerificationStatus`, `KYCStatus`, `KYCVerificationData`, `ManagerDecision`, `VerificationCost`, `PendingApproval` interfaces
  - Create `src/features/kyc/utils/validation.ts` with:
    - `isValidNIN(value: string): boolean` — exactly 11 decimal digits
    - `isDocumentExpired(expiryDate: string): boolean`
    - `isUtilityBillRecent(billDate: string): boolean` — within 3 calendar months
    - `isFileSizeValid(bytes: number, limitMB: number): boolean`
    - `getCloudinaryFolderPath(vendorId: string, documentType: string): string`
    - `fuzzyNameMatch(a: string, b: string, threshold: number): boolean`
  - _Requirements: 1.1, 1.2, 1.5, 4.2, 4.7, 5.1, 5.6, 3.3, 4.4, 5.3, 6.3_

  - [ ]* 4.1 Write property test: NIN format validation (Property 3)
    - File: `src/features/kyc/utils/__tests__/validation.pbt.test.ts`
    - **Property 3: isValidNIN returns true iff string is exactly 11 decimal digits**
    - **Validates: Requirements 1.1, 1.2**

  - [ ]* 4.2 Write property test: file size validation (Property 15)
    - **Property 15: isFileSizeValid returns false iff bytes > limitMB * 1024 * 1024**
    - **Validates: Requirements 4.2, 5.1, 6.2**

  - [ ]* 4.3 Write property test: Cloudinary folder path (Property 16)
    - **Property 16: getCloudinaryFolderPath always returns `kyc-documents/{vendorId}/{documentType}` with no trailing slash**
    - **Validates: Requirements 3.3, 4.4, 5.3, 6.3**

  - [ ]* 4.4 Write property test: name fuzzy match threshold (Property 4)
    - **Property 4: fuzzyNameMatch is deterministic and returns true iff similarity ≥ threshold**
    - **Validates: Requirements 1.5, 1.6**

  - [ ]* 4.5 Write property test: document expiry and bill recency (Properties 7, 8)
    - **Property 7: isDocumentExpired returns true iff expiryDate < today**
    - **Property 8: isUtilityBillRecent returns true iff billDate is within last 3 months**
    - **Validates: Requirements 4.7, 5.6**

- [x] 5. DojahService
  - Implement `src/features/kyc/services/dojah.service.ts`:
    - Constructor validates `DOJAH_API_KEY`, `DOJAH_APP_ID`, `DOJAH_PUBLIC_KEY` env vars; throws on missing
    - `getVerificationResult(referenceId)` — GET `/api/v1/kyc/verification?reference_id=`
    - `verifyNINAdvanced(nin)` — POST to advanced NIN endpoint
    - `screenAML(fullName, dateOfBirth)` — POST to AML Screening v2
    - `verifyCAC(rcNumber)` — GET CAC Lookup
    - Private `fetchWithRetry(url, options, retries=3)` — exponential backoff (1s, 2s, 4s), 30s timeout, 60s wait on 429
    - Log all requests/responses excluding NIN/BVN values
  - _Requirements: 16.1–16.17, 13.11, 22.11_

  - [ ]* 5.1 Write property test: NIN caching idempotence (Property 2)
    - File: `src/features/kyc/services/__tests__/dojah.service.pbt.test.ts`
    - **Property 2: verifyNIN called twice within 24h returns same result without a second API call**
    - **Validates: Requirements 1.10, 13.1, 13.2**

  - [ ]* 5.2 Write property test: liveness and biometric score thresholds (Property 6)
    - **Property 6: liveness passes iff score ≥ 50; biometric passes iff score ≥ 80; both scores ∈ [0,100]**
    - **Validates: Requirements 3.5, 3.6, 3.9**

  - [ ]* 5.3 Write unit tests for DojahService
    - File: `src/features/kyc/services/__tests__/dojah.service.test.ts`
    - Test fixtures: valid NIN response, expired document, low liveness, sanctions match, network timeout, 429 rate limit, malformed JSON
    - _Requirements: 23.1, 23.5, 23.6_

- [x] 6. FraudService and AML risk classification
  - Implement `src/features/kyc/services/fraud.service.ts`:
    - `classifyAMLRisk(amlResult)` — returns `Low | Medium | High` per Property 9 rules
    - `calculateFraudScore(signals)` — composite score 0–100 from liveness, biometric, AML, IP, timing signals
    - `detectFraudFlags(verificationData)` — returns array of flag objects for duplicate NIN, tampered doc, fast completion, multi-account IP
  - _Requirements: 7.4–7.8, 28.1–28.9_

  - [ ]* 6.1 Write property test: AML risk classification consistency (Property 9)
    - File: `src/features/kyc/services/__tests__/fraud.service.pbt.test.ts`
    - **Property 9: sanctions.length > 0 → High; pep.length > 0 → High; adverse_media terrorism/financial → High; organized/violent only → Medium; all empty → Low**
    - **Validates: Requirements 7.4, 7.5, 7.8**

  - [ ]* 6.2 Write property test: fraud risk score bounds (Property 14)
    - **Property 14: calculateFraudScore always returns a value in [0, 100]**
    - **Validates: Requirements 28.7**

- [x] 7. KYCRepository
  - Implement `src/features/kyc/repositories/kyc.repository.ts` using Drizzle ORM:
    - `upsertVerificationData(vendorId, data)` — wraps in DB transaction
    - `getVerificationStatus(vendorId)` — returns `KYCStatus`
    - `getPendingApprovals()` — returns `PendingApproval[]` ordered by submission date
    - `recordDecision(vendorId, decision)` — updates tier, sets approval/rejection fields
    - `recordVerificationCost(vendorId, cost)` — inserts into `verification_costs`
    - `getExpiredTier2Vendors()` — for cron job use
  - _Requirements: 15.1–15.25, 13.7–13.8_

  - [ ]* 7.1 Write unit tests for KYCRepository
    - File: `src/features/kyc/repositories/__tests__/kyc.repository.test.ts`
    - Test upsert idempotence, decision recording, cost tracking
    - _Requirements: 23.2_

- [x] 8. AuditLogger
  - Implement `src/features/kyc/services/audit.service.ts`:
    - `logAction(params: { vendorId, action, actorId, ipAddress, metadata })` — inserts into `audit_logs` table
    - Never updates or deletes audit records
    - Log entries for: widget launch, verification result received, manager decision, tier change, document upload, API call
  - Ensure `audit_logs` table schema exists in `src/lib/db/schema/audit-logs.ts` (create if not present)
  - _Requirements: 12.1–12.12_

- [x] 9. NotificationService integration
  - Implement `src/features/kyc/services/notification.service.ts`:
    - `sendKYCSubmissionConfirmation(vendor)` — SMS + email within 30s/2min
    - `sendKYCApprovalNotification(vendor)` — SMS + email with Tier 2 benefits
    - `sendKYCRejectionNotification(vendor, reason)` — SMS + email with rejection reason
    - `sendManagerAlert(managers, vendor, riskLevel)` — internal alert for high-risk AML
    - `sendExpiryReminder(vendor, daysUntilExpiry)` — 30-day and 7-day reminders
    - Retry once on SMS failure after 5 min, email after 10 min; log all failures
  - _Requirements: 14.1–14.12, 9.2–9.3, 9.10–9.11_

- [x] 10. KYC API routes
  - [x] 10.1 `GET /api/kyc/widget-config` (`src/app/api/kyc/widget-config/route.ts`)
    - Return `{ appId, publicKey, widgetId }` from env vars; require authenticated session
    - _Requirements: 16.2, 31.1–31.3_

  - [x] 10.2 `POST /api/kyc/complete` (`src/app/api/kyc/complete/route.ts`)
    - Accept `{ reference_id }`, acquire Redis lock `kyc:lock:{vendorId}` (5-min TTL), return 409 if locked
    - Call `DojahService.getVerificationResult`, validate with Zod
    - Encrypt NIN via `EncryptionService`, run `FraudService.classifyAMLRisk` and `calculateFraudScore`
    - Call `KYCRepository.upsertVerificationData` in transaction
    - Run `DojahService.screenAML`, record cost via `KYCRepository.recordVerificationCost`
    - Auto-approve if Low risk + all scores pass; else create pending approval record
    - Dispatch notifications and write audit log
    - Release Redis lock
    - _Requirements: 1.3–1.9, 3.4–3.12, 7.1–7.13, 8.12–8.15, 22.6–22.9_

  - [x] 10.3 `GET /api/kyc/status` (`src/app/api/kyc/status/route.ts`)
    - Return `KYCStatus` for authenticated vendor
    - _Requirements: 26.2–26.10_

  - [x] 10.4 `GET /api/kyc/approvals` (`src/app/api/kyc/approvals/route.ts`)
    - Require `salvage_manager` role; return `PendingApproval[]`
    - _Requirements: 9.4–9.7_

  - [x] 10.5 `POST /api/kyc/approvals/[id]/decision` (`src/app/api/kyc/approvals/[id]/decision/route.ts`)
    - Require `salvage_manager` role; accept `{ decision: 'approve' | 'reject', reason? }`
    - Call `KYCRepository.recordDecision`, dispatch notifications, write audit log
    - On approve: upgrade vendor tier; on reject: require reason, set 24h resubmit cooldown
    - _Requirements: 9.8–9.13_

  - [ ]* 10.6 Write unit tests for KYC API routes
    - Files: `src/app/api/kyc/__tests__/complete.test.ts`, `src/app/api/kyc/__tests__/approvals.test.ts`
    - Test happy path, Redis lock 409, Zod validation failure, sanctions auto-reject, manager approve/reject
    - _Requirements: 23.1, 23.2_

- [ ] 11. Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Tier 2 KYC page with Dojah widget
  - Replace `src/app/(dashboard)/vendor/kyc/tier2/page.tsx` with widget-powered implementation:
    - Fetch widget config from `/api/kyc/widget-config` on mount
    - Load Dojah widget script via Next.js `<Script>` tag with `strategy="lazyOnload"`
    - Initialize widget with config + callbacks: `onSuccess(response)` POSTs `reference_id` to `/api/kyc/complete`, then polls `/api/kyc/status`
    - Display status states: idle, in-progress, pending-review, approved, rejected, expired
    - Show estimated cost (₦510–630) before widget launch
    - Mobile-optimized layout with vertical stepper, 44×44px touch targets, ARIA labels on loading states
  - _Requirements: 8.1–8.15, 21.1–21.12, 26.1–26.10, 27.1–27.12_

- [x] 13. Vendor dashboard Tier 2 status card
  - Add/update the "Upgrade to Tier 2" card in the vendor dashboard (`src/app/(dashboard)/vendor/dashboard/page.tsx` or equivalent):
    - Show current tier, verification status, max bid limit, progress percentage
    - Show step completion status (NIN, liveness, biometric, document, AML)
    - Show "Under Review" with 24–48h estimate, "Tier 2 Verified" badge with date, rejection reason + Resubmit button
    - Show expiry date; display renewal banner when ≤ 30 days remaining
  - _Requirements: 26.1–26.10, 19.1–19.5_

- [x] 14. Manager KYC approvals UI
  - [x] 14.1 Create `src/app/(dashboard)/manager/kyc-approvals/page.tsx`
    - List pending applications with vendor name, submission date, verification status, flagged reasons
    - Filter/sort controls; require `salvage_manager` role
    - _Requirements: 9.4–9.7_

  - [x] 14.2 Create `src/app/(dashboard)/manager/kyc-approvals/[id]/page.tsx`
    - Document previews (selfie, photo ID, utility bill, CAC)
    - NIN verification results, biometric match score, AML risk level, fraud flags
    - Approve button and reject form (reason required)
    - POST to `/api/kyc/approvals/[id]/decision`
    - _Requirements: 9.6–9.13_

- [x] 15. Tier enforcement — bid blocking and payment gating
  - Update bid submission logic to check vendor tier before accepting bids:
    - Block Tier 1 bids above ₦500,000 with upgrade prompt (HTTP 403 + UI message)
    - Block payment processing for Tier 1 wins above ₦500,000; set 48h grace period
    - On grace period expiry without upgrade: cancel auction win, refund deposit
    - Log all tier-based blocks to audit log
  - Update auction creation to mark auctions with reserve > ₦500,000 as "Tier 2 Only"
  - Disable bid button for Tier 1 vendors on Tier 2 Only auctions
  - _Requirements: 10.1–10.8, 18.1–18.7_

  - [ ]* 15.1 Write property test: tier-based bid limit enforcement (Property 10)
    - File: `src/hooks/__tests__/use-tier-upgrade.pbt.test.ts`
    - **Property 10: tier1_bvn vendor bid is blocked iff amount > 500000; tier2_full always allowed**
    - **Validates: Requirements 10.1, 10.2**

- [x] 16. Cron job for Tier 2 expiry
  - Implement `src/app/api/cron/kyc-expiry/route.ts`:
    - Query vendors where `tier2_expires_at <= now()` and tier is `tier2_full`
    - Downgrade tier to `tier1_bvn`, write audit log, send expiry notifications
    - Query vendors where `tier2_expires_at` is 30 or 7 days away; send reminder notifications
    - Secure with `CRON_SECRET` header check
  - _Requirements: 20.4–20.9_

  - [ ]* 16.1 Write property test: Tier 2 expiry downgrade (Property 13)
    - File: `src/app/api/cron/__tests__/kyc-expiry.pbt.test.ts`
    - **Property 13: cron downgrades tier iff tier2_expires_at ≤ now; leaves future/null expiry unchanged**
    - **Validates: Requirements 20.4_

- [x] 17. Health check endpoint
  - Implement `src/app/api/health/kyc/route.ts`:
    - Verify Dojah API connectivity with a lightweight ping
    - Return `{ status: 'ok' | 'degraded', dojah: boolean, db: boolean, redis: boolean }`
  - _Requirements: 22.11_

- [ ] 18. Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 19. Wire everything together and integration tests
  - [ ] 19.1 Verify end-to-end flow: widget → `/api/kyc/complete` → DB → notifications → audit log
    - Confirm Redis lock prevents concurrent submissions
    - Confirm auto-approve path (Low AML risk, all scores pass) upgrades tier immediately
    - Confirm flagged path creates pending approval and notifies managers
    - _Requirements: 8.12–8.15, 22.9_

  - [ ]* 19.2 Write integration tests for full Tier 2 upgrade workflow
    - File: `src/features/kyc/__tests__/tier2-upgrade.integration.test.ts`
    - Mock Dojah responses; test happy path, flagged path, rejection path
    - Verify DB state after each transition
    - _Requirements: 23.2_

  - [ ]* 19.3 Write integration tests for manager approval flow
    - Verify DB state changes on approve/reject, notification dispatch, audit log entries
    - _Requirements: 23.2_

- [x] 20. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with minimum 100 iterations per property
- All sensitive data (NIN, BVN) must never appear in logs — use `EncryptionService.mask()` for display
- Redis lock key pattern: `kyc:lock:{vendorId}` with 5-minute TTL
- Cloudinary folder pattern: `kyc-documents/{vendorId}/{documentType}`
- All DB writes for multi-step flows must be wrapped in Drizzle transactions
