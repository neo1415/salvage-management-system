# Finance, Pickup, Export & Platform Hardening — Master Spec

**Status:** In progress  
**Last updated:** 2026-06-22

## Batch plan

| Batch | Scope | Status |
|-------|--------|--------|
| B1 | Spec + payment case fields API/UI + salvage manager market value fix + currency helper | in_progress |
| B2 | Finance dashboard filters + payment verification filters | pending |
| B3 | CSV exports comprehensive, remove PDF where requested, IP redaction, filenames, NGN | pending |
| B4 | Pay Now single loader UX + documents download spinners + receipt fixes | pending |
| B5 | Price adjustment propagation (`finalSettledAmount`) app-wide | pending |
| B6 | Pickup vendor flow (no resubmit, under review) + confirm notifications + optional admin notes | pending |
| B7 | Fraud same-IP detection hardening + brand color flash fix | pending |
| B8 | Hide claim ref from vendors + evidence review cleanup + cases export | pending |

---

## 1. Payment details — case information

**Requirement:** Show branch, policy number, broker, asset type, and case name (auction card style).

**Files:**
- `src/app/api/finance/payments/route.ts` — extend case select
- `src/app/(dashboard)/finance/payments/page.tsx` — modal Case Information section
- Use `formatAssetName()` from `src/lib/utils/asset-name.ts`

---

## 2. Finance dashboard filters

**Requirement:** Date range, branch, broker, insurance class filters on dashboard cards/data.

**Files:**
- `src/components/finance/finance-dashboard-content.tsx`
- `src/app/api/dashboard/finance/route.ts`

---

## 3. Payment verification filters

**Requirement:** Add branch, broker, insurance class (date range exists).

**Files:**
- `src/app/(dashboard)/finance/payments/page.tsx`
- `src/app/api/finance/payments/route.ts`

---

## 4. CSV export (payments)

- Remove PDF export button
- CSV includes all modal fields (vendor, case, payment, escrow summary — no audit trail)
- IP redacted unless `system_admin` (not in fraud/audit contexts)

---

## 5. Currency display

- Replace broken ₦ with `NGN` prefix or proper formatting via `formatNgnAmount()`
- Apply across exports and finance UI

---

## 6. All other CSV exports

- Cases export comprehensive (all case fields)
- Understandable filenames via `ExportService.generateFilename`
- Audit each export route

---

## 7. Fraud — same IP multiple accounts

- Extend detection: same IP across different auctions / accounts on same network
- Ensure `fraud.ip_detection_enabled` default on
- Log when IP is `unknown`
- Optional cron IP rescan

**Files:** `ip-analysis.service.ts`, `bidding.service.ts`, `detect-fraud/route.ts`

---

## 8. Pay Now UX

- Single loading state with message "Loading payment details…"
- Remove double modal + skeleton flash

**Files:** `vendor/auctions/[id]/page.tsx`, `payment-options.tsx`

---

## 9. Documents page

- Download button loading spinner
- Receipt downloadable like other docs
- Receipt: branding address from policy, pickup code not claim ref

**Files:** `vendor/documents/page.tsx`, `receipt/[paymentId]/page.tsx`, `pdf-template.service.ts`

---

## 10. Vendor auctions — hide claim reference

- Remove from search placeholder and filter fallbacks where shown to vendors

---

## 11. Evidence review

- Remove "Method: claude_ai" display from admin pickups

---

## 12. Price adjustment → final settled price (CRITICAL)

**Business rule:**
- Outcome `confirmed_no_adjustment` → keep original `payments.amount` / `current_bid`
- Outcome `price_adjustment_recorded` → `adjustment_amount` IS the new absolute final price
- External reimbursement outcomes → keep original price; track metadata only

**Schema:** `auctions.final_settled_amount` (nullable), `auctions.price_adjusted_at`, `auctions.original_winning_bid` (audit)

**Write path:** `pickup-confirmation.service.ts` on admin confirm

**Read path:** `getEffectiveSaleAmount(auction, payment)` used everywhere:
- Financial reports repos
- Dashboard finance route
- Operational reports
- KPI / master report
- Pickup display
- Vendor payment UI
- Intelligence analytics where applicable

**Do NOT mutate `bids.amount`**

---

## 13. Pickup vendor evidence

- After submit: disable resubmit, show "Under review" on card
- API: check existing evidence status

---

## 14. Pickup confirmed notifications

- Email + SMS + push to vendor on admin pickup confirm

---

## 15. Admin notes optional in pickup modal

- Remove min 20 char requirement when evidence needs review

---

## 16. Brand color flash

- Align `globals.css` default with policy default OR use SSR vars only
- Remove hardcoded `#0C0C0B` / `#111827` from splash screens
- Prevent client re-apply flash in `public-business-policy-context.tsx`

---

## 17. Salvage manager AI policy

- When `aiDamageAssessmentRunner === 'salvage_manager'`:
  - API `POST /api/cases` must NOT require marketValue
  - `validateCaseInput` must skip market value check
  - Adjuster can submit without AI assessment

**Files:** `api/cases/route.ts`, `case.service.ts`

---

## Testing checklist

- [ ] Unit: wallet funding, bid OTP, price adjustment helper
- [ ] Unit: case submission manager mode
- [ ] Integration: finance payments API fields
- [ ] `npm run build` after each batch
- [ ] Manual: payment modal fields, Pay Now flow, pickup adjustment → report revenue

---

## IP redaction policy

Redact IP in UI/exports unless:
- User role is `system_admin`
- Page is fraud alerts or audit logs
