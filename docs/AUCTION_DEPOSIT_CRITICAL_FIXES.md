# Auction Deposit System - Critical Fixes

## Issues Found

### 1. FULL AMOUNT FREEZING (₦220,000 instead of ₦22,000)
**Location:** `src/features/auctions/services/bidding.service.ts:268-276`

**Problem:**
```typescript
await escrowService.freezeFunds(
  data.vendorId,
  data.amount,  // ❌ FULL BID AMOUNT (₦220,000)
  data.auctionId,
  user.id
);
```

**Should Be:**
```typescript
// Calculate deposit: max(bid × 10%, ₦100,000)
const depositAmount = depositCalculatorService.calculateDeposit(
  data.amount,
  config.deposit_rate,
  config.minimum_deposit_floor
);

await escrowService.freezeFunds(
  data.vendorId,
  depositAmount,  // ✅ DEPOSIT ONLY (₦22,000)
  data.auctionId,
  user.id
);
```

### 2. TWO CONFLICTING CLOSURE SERVICES

**Problem:** Two services with different logic, never integrated:
- `closure.service.ts` - Generates documents, sends notifications (USED by cron)
- `auction-closure.service.ts` - Handles top N bidders, deposit retention (NEVER CALLED)

**Solution:** Merge them - `closure.service.ts` should call `auction-closure.service.ts`

### 3. TOP N BIDDERS' DEPOSITS NOT RETAINED

**Problem:** When auction closes, ALL deposits are unfrozen immediately

**Solution:** Call `auctionClosureService.closeAuction()` BEFORE updating status to 'closed'

### 4. DOCUMENTS GENERATED WITHOUT DEADLINE

**Problem:** Documents generated but no deadline set (Requirement 6.3)

**Solution:** Use `document-integration.service.generateDocumentsWithDeadline()`

### 5. NOTIFICATIONS NOT DEPOSIT-AWARE

**Problem:** Generic notifications sent, don't mention deposit amounts

**Solution:** Use `deposit-notification.service` for deposit-aware notifications

## Fix Strategy

### Phase 1: Fix Bid Placement (CRITICAL - Blocks all bidding)
1. Import `depositCalculatorService` and `configService`
2. Calculate deposit amount before freezing
3. Freeze only deposit, not full amount
4. Update unfreeze logic for previous bidder

### Phase 2: Fix Auction Closure (CRITICAL - Breaks requirements)
1. Import `auctionClosureService` into `closure.service.ts`
2. Call `auctionClosureService.closeAuction()` before status update
3. Replace document generation with `documentIntegrationService`
4. Replace notifications with `depositNotificationService`

### Phase 3: Integration Testing
1. Test bid placement with deposit calculation
2. Test auction closure with top N retention
3. Test document generation with deadlines
4. Test notifications with deposit amounts

## Files to Modify

1. `src/features/auctions/services/bidding.service.ts` - Fix bid placement
2. `src/features/auctions/services/closure.service.ts` - Integrate auction-closure logic
3. `src/app/api/auctions/[id]/close/route.ts` - Use correct closure service

## Expected Behavior After Fix

### Bid Placement:
- Vendor bids ₦220,000
- System calculates deposit: max(220,000 × 0.10, 100,000) = ₦22,000
- System freezes ₦22,000 (not ₦220,000)
- Vendor has ₦198,000 available for other auctions

### Auction Closure:
- Auction ends with 5 bidders
- System identifies top 3 bidders
- Top 3 deposits stay frozen
- Bottom 2 deposits unfrozen immediately
- Documents generated with 48-hour deadline
- Winner notified with deposit amount and deadline

### Top Winner Payment:
- Winner pays full amount
- Deposit unfrozen after payment confirmed
- Documents signed within deadline
- If deadline missed, fallback chain activated

## Implementation Order

1. ✅ Generate missing documents (DONE - script ran successfully)
2. ⏳ Fix bid placement deposit calculation (NEXT)
3. ⏳ Integrate closure services
4. ⏳ Add integration tests
