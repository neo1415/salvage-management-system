# Platform Cleanup & Polish — Master Spec

**Created:** 2026-06-23  
**Status:** Active — work in batches; mark tasks complete in this file as shipped.

This document captures every item from the stakeholder review. Do not delete requirements; check off when done.

---

## Architecture decision: multi-user / head roles

**Question:** Can one system admin, multiple salvage managers, multiple claims adjusters, and multiple finance officers coexist without "head" roles?

**Current state (code review):**
- Roles: `system_admin`, `salvage_manager`, `claims_adjuster`, `finance_officer`, `vendor` (`src/lib/auth/rbac.ts`).
- No `head_salvage`, `head_finance`, or `head_adjuster` roles exist.
- Data scoping is mostly **org-wide** (not per-user hierarchy): managers see all cases, all branches, all brokers in portfolio/reports.
- `createdBy` on cases ties adjuster to submission; `approvedBy` ties manager to approval.

**Recommendation (Phase 1 — no head roles):**
- Platform already supports multiple staff per role at the data layer.
- Gaps are **UX/filtering** (branch, broker, assignee) not missing head roles.
- Defer head roles unless business requires approval chains or branch-scoped managers.

**If head roles are required later (Phase 2):**
- Add roles + `reportsTo` / branch assignment on users.
- Extend: PDFs, master report, all report filters, approval queues, audit trail, notifications.
- Separate spec: `head-roles-phase2.md` (not started).

---

## Batch A — Copy, labels, quick fixes ✅ (in progress)

| ID | Requirement | Files / area | Status |
|----|-------------|--------------|--------|
| A1 | Adjuster dashboard: remove role-specific copy | `adjuster/dashboard/page.tsx` | ✅ |
| A2 | Manager My Cases: **Submitted by** (adjuster) | `adjuster/my-cases/page.tsx` | ✅ |
| A3 | Fix ₦ mojibake in branch report tables | case-processing, revenue-analysis, kpi-dashboard | ✅ |

---

## Batch B — Manager dashboard filters & Control Tower

| ID | Requirement | Files / area | Status |
|----|-------------|--------------|--------|
| B1 | Asset type filter: policy-enabled types | manager dashboard | ✅ |
| B2 | **branch** filter | manager dashboard UI + API | ✅ |
| B3 | **broker** search/filter | manager dashboard UI + API | ✅ |
| B4 | Date range: presets + custom from/to + **All time** | manager dashboard | ✅ |
| B5 | Pickup count aligned with pickups page | manager + admin routes | ✅ |
| B6 | Remove document signing deadline tile | Control Tower | ✅ |
| B7 | Control tower metrics respect date filters | manager API | ✅ |

---

## Batch C — Settings (all roles)

| ID | Requirement | Files / area | Status |
|----|-------------|--------------|--------|
| C1 | Notification channels respect user toggles for email/SMS | channel guard + email/sms services | ✅ |
| C2 | Login verification method saves; MFA channel used on login | security panel + API (enforcement env-flagged) | ✅ |
| C3 | Change password validation aligned (lowercase + API errors) | change-password form + API | ✅ |
| C4 | Unit tests for settings-related guards | `notification-channel-guard.test.ts` | ✅ |

---

## Batch D — Approvals & auction scheduling

| ID | Requirement | Files / area | Status |
|----|-------------|--------------|--------|
| D1 | Auction duration units: **minutes**, hours, days, weeks | `auction-schedule-selector.tsx`, `auction-duration-selector.tsx`, approve API | ✅ |
| D2 | Duration number input: allow clearing field (empty → placeholder/default without fighting input) | Schedule selector + scheduling tab | ✅ |
| D3 | When scheduled auction goes **active**, email manager reminder (draft notification) | Auction activation job/handler + email template | ✅ |

---

## Batch E — Shared image gallery (case, approval, bid history, auction detail)

| ID | Requirement | Files / area | Status |
|----|-------------|--------------|--------|
| E1 | Shared `CasePhotoGallery` component: consistent sizing, responsive, no crop/overflow ugliness | New component | ✅ |
| E2 | Main image carousel arrows + counter; thumbnail strip below | Component | ✅ |
| E3 | Fast image switching: `next/image` sizes, priority, preload adjacent, no layout thrash | Component + pages | ✅ |
| E4 | Adopt on: adjuster case detail, manager approvals, bid history list/detail, auction detail | Multiple pages | ✅ |

---

## Batch F — Case evidence PDF

| ID | Requirement | Files / area | Status |
|----|-------------|--------------|--------|
| F1 | Vendor display: `businessName` → fallback `vendor full name` (Tier 2 incomplete) | `evidence/export/pdf/route.ts`, shared vendor display helper | ✅ |
| F2 | Remove **image metadata** section from PDF | PDF route | ✅ |
| F3 | Remove **integrity note** from audit trail section | PDF route | ✅ |
| F4 | Audit trail: human narrative (bid → outbid → won → signed → paid → pickup confirmed) | PDF route + optional JSON export | ✅ |
| F5 | Master report + all reports: same vendor name fallback | Report generators | ✅ |

---

## Batch G — Bid history

| ID | Requirement | Files / area | Status |
|----|-------------|--------------|--------|
| G1 | Completed auctions: sort **latest first** (by `updatedAt` / activity; includes `awaiting_payment`) | `bid-history/page.tsx`, API sort | ✅ |

---

## Batch H — KYC / Tier 2

| ID | Requirement | Files / area | Status |
|----|-------------|--------------|--------|
| H1 | Tier 2 export evidence: PDF instead of CSV (brand logo/colors from policy) | KYC approvals UI + export route | ✅ |
| H2 | Remove hardcoded NEM / Dojah language; generic or policy-branded; don't expose provider name | KYC flow components, notifications, env copy | ✅ |

---

## Batch I — Pickups UI

| ID | Requirement | Files / area | Status |
|----|-------------|--------------|--------|
| I1 | Action row: avoid slim wall of text — second wide column under main row | `admin/pickups/page.tsx` | ✅ |
| I2 | Mobile responsive layout pass | Pickups page | ✅ |

---

## Batch J — Reports expansion

| ID | Requirement | Files / area | Status |
|----|-------------|--------------|--------|
| J1 | Fix all currency encoding issues (audit entire reports tree) | Reports components + exports | ✅ |
| J2 | **Branch summary** + **branch breakdown** (like case processing categories) | Reports APIs + UI | ✅ |
| J3 | **Broker summary** + **broker breakdown** | Reports APIs + UI | ✅ |
| J4 | Detail rows: policy number, branch, agency OR broker columns (conditional) | Breakdown tables | ✅ |
| J5 | Master report: branch + broker sections; vendor name fallback | `master-report-content.tsx`, PDF generators | ✅ |
| J6 | All reports: filters for branch, time range, asset type (and broker where relevant) | Report pages + APIs | ✅ |

---

## Batch K — Code quality gates (every batch)

| ID | Requirement | Status |
|----|-------------|--------|
| K1 | No `any` types in touched files; fix existing `any` in scope | ⬜ |
| K2 | `npm run build` after each batch | ⬜ |
| K3 | Unit tests where behavior changes | ⬜ |

---

## Implementation order (recommended)

1. **Batch A** — copy, submitted-by, currency fix (low risk)
2. **Batch B** — dashboard filters + pickup ghost fix + date range
3. **Batch C** — settings verification
4. **Batch D** — approval scheduling UX + manager email
5. **Batch E** — shared gallery
6. **Batch F** — evidence PDF
7. **Batch G** — bid history sort
8. **Batch H** — KYC branding
9. **Batch I** — pickups UI
10. **Batch J** — reports expansion (largest)

---

## Notes from investigation

### Pickup count mismatch (B5)
- Control Tower counts: verified payment + `pickup_confirmed_admin = false` (no pickup auth doc).
- Pickups page: also requires `release_forms.document_type = pickup_authorization`.
- Fix: align Control Tower exception + "Awaiting pickup" card with pickups API lifecycle.

### Document signing deadline (B6)
- Counts pending release forms past `validity_deadline`.
- No dedicated manager workflow page; stakeholder questions value → prefer remove from Control Tower or link to actionable queue.

### Notification MFA (C2)
- `docs/SETTINGS_AND_MFA_PHASE1.md`: preferences saved; login MFA enforcement feature-flagged — verify flags for staging/production.
