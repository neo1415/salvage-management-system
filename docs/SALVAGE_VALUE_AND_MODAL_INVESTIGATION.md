# Salvage Value Display & Modal Positioning Investigation

## Issue 1: Salvage Values Showing ₦0.00

### Problem
When a case is created, "Estimated Salvage Value" and "Reserve Price" display as ₦0.00 even though AI assessment calculated proper values.

### Root Cause Analysis

#### Data Flow Trace:
1. **Frontend (Case Creation)**: AI assessment runs and calculates values
   - `estimatedSalvageValue`: e.g., 5,300,000
   - `reservePrice`: e.g., 3,710,000

2. **API Endpoint** (`src/app/api/cases/route.ts`):
   - Receives `aiAssessmentResult` from frontend
   - Passes to `createCase()` service
   - ✅ Values are correctly received

3. **Case Service** (`src/features/cases/services/case.service.ts`):
   - Lines 451-452: Converts numbers to strings for database
   ```typescript
   estimatedSalvageValue: aiAssessment ? aiAssessment.estimatedSalvageValue.toString() : null,
   reservePrice: aiAssessment ? aiAssessment.reservePrice.toString() : null,
   ```
   - ✅ Values are correctly converted and stored

4. **Database Schema** (`src/lib/db/schema/cases.ts`):
   - Lines 34-35: Fields are defined as nullable numeric
   ```typescript
   estimatedSalvageValue: numeric('estimated_salvage_value', { precision: 12, scale: 2 }),
   reservePrice: numeric('reserve_price', { precision: 12, scale: 2 }),
   ```
   - ⚠️ Fields are NULLABLE - this is intentional for draft cases

5. **API Response** (`src/app/api/cases/route.ts`):
   - Line 264-265: Returns values with aliases
   ```typescript
   estimatedSalvageValue: salvageCases.estimatedSalvageValue,
   estimatedValue: salvageCases.estimatedSalvageValue,
   ```
   - ❌ **PROBLEM**: When values are NULL, they return as null

6. **Display** (`src/app/(dashboard)/manager/approvals/page.tsx`):
   - Line 675: Parses and displays
   ```typescript
   ₦{parseFloat(selectedCase.estimatedSalvageValue).toLocaleString()}
   ```
   - ❌ **PROBLEM**: `parseFloat(null)` returns `NaN`, which displays as ₦0.00

### The Real Issue
The problem is NOT in saving - values ARE being saved correctly. The issue is:
1. **NULL values for draft cases** - Draft cases intentionally have null salvage values
2. **parseFloat(null) = NaN** - When displaying, NaN is coerced to 0
3. **No null check before display** - Code doesn't check if value is null before parsing

### Affected Components
- `src/app/(dashboard)/manager/approvals/page.tsx` (lines 675, 679)
- `src/app/(dashboard)/vendor/auctions/[id]/page.tsx` (line 932)
- `src/app/(dashboard)/bid-history/[auctionId]/page.tsx` (line 695)
- `src/components/adjuster/adjuster-cases-content.tsx` (line 310)

---

## Issue 2: Modal Positioning Problems

### Problem
Modals (especially case approval confirmation modal) are not properly centered and fixed:
- Don't appear centered on screen
- Have scrollable overlay and modal (should be fixed)
- Overlay doesn't cover sidebar
- Both overlay and modal scroll with page

### Root Cause Analysis

#### Current Implementation (`src/components/ui/confirmation-modal.tsx`):

```typescript
{/* Backdrop */}
<div className="fixed inset-0 bg-black bg-opacity-50 z-[9998]" />

{/* Modal Container */}
<div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
  <div className="relative w-full max-w-md bg-white rounded-xl max-h-[90vh] overflow-y-auto pointer-events-auto">
    {/* Modal content */}
  </div>
</div>
```

#### Problems Identified:

1. **pointer-events-none on container** (Line 93):
   - Container has `pointer-events-none`
   - Modal div has `pointer-events-auto`
   - This creates interaction issues and prevents proper click handling

2. **Scrollable modal content** (Line 95):
   - `max-h-[90vh] overflow-y-auto` allows internal scrolling
   - Should be fixed to viewport, not scrollable

3. **Z-index conflicts**:
   - Backdrop: z-[9998]
   - Modal: z-[9999]
   - Sidebar may have higher z-index, causing overlay to not cover it

4. **No body scroll lock**:
   - While `modal-scroll-lock.ts` exists, it may not be properly applied
   - Body can still scroll behind modal

5. **Overlay not truly fixed**:
   - Uses `fixed inset-0` but doesn't prevent page scrolling
   - Sidebar remains visible and interactive

### Affected Components
- `src/components/ui/confirmation-modal.tsx` (lines 88-110)
- `src/components/ui/result-modal.tsx` (lines 60-82)
- All other modals using similar structure

---

## Solutions

### Solution 1: Fix Salvage Value Display

**Approach**: Add null checks before parsing and display "Pending Analysis" for null values

```typescript
// Instead of:
₦{parseFloat(selectedCase.estimatedSalvageValue).toLocaleString()}

// Use:
{selectedCase.estimatedSalvageValue 
  ? `₦${parseFloat(selectedCase.estimatedSalvageValue).toLocaleString()}`
  : 'Pending Analysis'}
```

**Files to Update**:
1. `src/app/(dashboard)/manager/approvals/page.tsx`
2. `src/app/(dashboard)/vendor/auctions/[id]/page.tsx`
3. `src/app/(dashboard)/bid-history/[auctionId]/page.tsx`
4. `src/components/adjuster/adjuster-cases-content.tsx`

### Solution 2: Fix Modal Positioning

**Approach**: Create a proper fixed modal with:
- Full viewport overlay covering everything including sidebar
- Centered modal that doesn't scroll
- Proper z-index hierarchy
- Body scroll lock

```typescript
{/* Backdrop - covers EVERYTHING */}
<div className="fixed inset-0 bg-black/50 z-[99998]" />

{/* Modal Container - properly centered */}
<div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 overflow-y-auto">
  <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl my-8">
    {/* Modal content - no internal scrolling */}
  </div>
</div>
```

**Key Changes**:
1. Remove `pointer-events-none` from container
2. Remove `overflow-y-auto` from modal div
3. Add `overflow-y-auto` to container for proper scrolling behavior
4. Increase z-index to ensure it's above sidebar
5. Use `my-8` for vertical spacing instead of max-height

**Files to Update**:
1. `src/components/ui/confirmation-modal.tsx`
2. `src/components/ui/result-modal.tsx`

---

## Implementation Priority

1. **High Priority**: Fix salvage value display (affects user trust in AI assessment)
2. **High Priority**: Fix modal positioning (affects UX across entire app)

## Testing Checklist

### Salvage Value Display:
- [ ] Create new case with AI assessment
- [ ] Verify values display correctly in manager approvals
- [ ] Verify values display correctly in auction details
- [ ] Verify draft cases show "Pending Analysis"
- [ ] Verify approved cases show actual values

### Modal Positioning:
- [ ] Open case approval modal
- [ ] Verify modal is centered on screen
- [ ] Verify overlay covers entire viewport including sidebar
- [ ] Verify clicking overlay closes modal
- [ ] Verify body doesn't scroll when modal is open
- [ ] Verify modal content scrolls if too tall
- [ ] Test on mobile and desktop
