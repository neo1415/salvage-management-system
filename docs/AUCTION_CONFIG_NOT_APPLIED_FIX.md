# Auction Config Not Being Applied - Root Cause and Fix

## Problem Summary

User reports that auction config changes (minimum bid increment, tier limits, etc.) are not being applied. For example:
- Admin sets minimum bid increment to ₦50,000
- But actual bidding still uses ₦20,000
- Config changes have NO EFFECT on actual bidding behavior

## Root Cause

The bidding service has **HARDCODED VALUES** instead of using the config from the database.

### Hardcoded Locations Found:

#### 1. `src/features/auctions/services/bidding.service.ts` - Line 619
```typescript
// ❌ WRONG - Hardcoded 20000
const minimumBid = currentBid ? currentBid + 20000 : minimumIncrement;
```

Should be:
```typescript
// ✅ CORRECT - Use config value
const minimumBid = currentBid ? currentBid + config.minimumBidIncrement : minimumIncrement;
```

#### 2. `src/features/auctions/services/bidding.service.ts` - Line 239
```typescript
// ❌ WRONG - Hardcoded 20000
const minimumBid = currentBidAmount ? currentBidAmount + 20000 : Number(lockedAuction.minimumIncrement);
```

Should be:
```typescript
// ✅ CORRECT - Use config value
const minimumBid = currentBidAmount ? currentBidAmount + config.minimumBidIncrement : Number(lockedAuction.minimumIncrement);
```

#### 3. Tier 1 Limit Check - Line 625
```typescript
// ❌ WRONG - Hardcoded 500000
if (bidAmount > 500000 && vendorTier === 'tier1_bvn') {
  errors.push('Bid exceeds your Tier 1 limit of ₦500,000...');
}
```

Should be:
```typescript
// ✅ CORRECT - Use config value
if (bidAmount > config.tier1Limit && vendorTier === 'tier1_bvn') {
  errors.push(`Bid exceeds your Tier 1 limit of ₦${config.tier1Limit.toLocaleString()}...`);
}
```

## Impact

**ALL** of these config values are being ignored:
- ✅ Registration Fee (works - used correctly)
- ❌ Minimum Bid Increment (hardcoded to ₦20,000)
- ❌ Tier 1 Bid Limit (hardcoded to ₦500,000)
- ❌ Tier 2 Bid Limit (not checked at all)
- ⚠️  Payment Deadline Hours (need to verify)
- ⚠️  Document Deadline Hours (need to verify)

## Fix Required

### Step 1: Load Config Early in `placeBid()`

The config needs to be loaded at the START of the `placeBid()` method, not just for deposit calculation:

```typescript
async placeBid(data: PlaceBidData): Promise<PlaceBidResult> {
  const startTime = Date.now();

  try {
    // ... input validation ...

    // ✅ LOAD CONFIG EARLY (before validation)
    const config = await configService.getConfig();

    // ... fetch auction and vendor ...

    // ✅ PASS CONFIG to validateBid
    const validation = await this.validateBid(
      data.amount,
      auction.currentBid ? Number(auction.currentBid) : null,
      Number(auction.minimumIncrement),
      auction.status,
      vendor.tier,
      data.otp,
      user.phone,
      data.vendorId,
      data.auctionId,
      config  // ← ADD THIS
    );
```

### Step 2: Update `validateBid()` Signature

```typescript
async validateBid(
  bidAmount: number,
  currentBid: number | null,
  minimumIncrement: number,
  auctionStatus: string,
  vendorTier: string,
  otp: string,
  phone: string,
  vendorId: string,
  auctionId: string,
  config: SystemConfiguration  // ← ADD THIS
): Promise<ValidationResult> {
```

### Step 3: Use Config Values in Validation

```typescript
// ✅ Use config.minimumBidIncrement
const minimumBid = currentBid ? currentBid + config.minimumBidIncrement : minimumIncrement;

// ✅ Use config.tier1Limit
if (bidAmount > config.tier1Limit && vendorTier === 'tier1_bvn') {
  errors.push(`Bid exceeds your Tier 1 limit of ₦${config.tier1Limit.toLocaleString()}...`);
}
```

### Step 4: Use Config in Transaction

In the transaction block (line 239), also use config:

```typescript
await db.transaction(async (tx) => {
  // ... lock auction ...

  // ✅ Use config.minimumBidIncrement
  const minimumBid = currentBidAmount 
    ? currentBidAmount + config.minimumBidIncrement 
    : Number(lockedAuction.minimumIncrement);
  
  if (data.amount < minimumBid) {
    throw new Error(`Bid too low. Minimum bid: ₦${minimumBid.toLocaleString()}`);
  }
```

## Testing After Fix

1. **Change config** via admin panel:
   - Set minimum bid increment to ₦50,000
   - Set tier 1 limit to ₦1,000,000

2. **Test bidding**:
   - Try to bid with only ₦20,000 increment → Should FAIL
   - Try to bid with ₦50,000 increment → Should SUCCEED
   - Tier 1 vendor tries to bid ₦600,000 → Should SUCCEED (new limit)

3. **Verify error messages**:
   - Error messages should show the NEW config values
   - Not the old hardcoded values

## Files to Modify

1. `src/features/auctions/services/bidding.service.ts`
   - Load config early in `placeBid()`
   - Pass config to `validateBid()`
   - Update `validateBid()` signature
   - Replace all hardcoded values with config values
   - Use config in transaction validation

## Additional Configs to Verify

After fixing the above, also verify these are being used correctly:
- Payment deadline hours
- Document deadline hours
- Grace extension duration
- Forfeiture percentage
- Top bidders to keep frozen

## Priority

**HIGH** - This is a critical bug that makes the entire config system useless. Admin changes have no effect on actual system behavior.
