# Bidding OTP Rate Limits Fix

## Problem

The bidding flow was using the same OTP rate limits as authentication, which was too restrictive for competitive auction scenarios.

### Symptoms
- Vendors getting locked out after 3 bid attempts in 30 minutes
- "Too many OTP requests" errors during active bidding
- Poor user experience in competitive auctions

### Root Cause
The OTP service already had context-aware rate limiting (`authentication` vs `bidding`), but the bidding flow wasn't passing the correct context parameter. This caused bidding OTPs to use the restrictive authentication limits.

## Solution

Created dedicated bidding OTP endpoints that pass the correct context to the OTP service.

### New Endpoints

#### 1. Send Bidding OTP
```
POST /api/auctions/[id]/otp/send
```

**Purpose**: Request OTP for bid placement with bidding-specific rate limits

**Authentication**: Required (session)

**Response**:
```json
{
  "success": true,
  "message": "OTP sent successfully"
}
```

#### 2. Verify Bidding OTP
```
POST /api/auctions/[id]/otp/verify
```

**Purpose**: Verify OTP before bid placement

**Authentication**: Required (session)

**Request Body**:
```json
{
  "otp": "123456"
}
```

**Response**:
```json
{
  "success": true,
  "message": "OTP verified successfully"
}
```

## Rate Limit Comparison

### Authentication Context (Registration, Login)
- **Max Attempts**: 3 per 30 minutes
- **Use Case**: Account creation, password reset
- **Rationale**: Prevent brute force attacks and SMS spam

### Bidding Context (Auction Bidding)
- **Global Limit**: 15 OTP requests per 30 minutes
- **Per-Auction Limit**: 5 OTP requests per auction per 5 minutes
- **Use Case**: Competitive bidding in auctions
- **Rationale**: Allow multiple bids while preventing abuse

## Implementation Details

### OTP Service Context Parameter

The `otpService.sendOTP()` method accepts a `context` parameter:

```typescript
await otpService.sendOTP(
  phone,
  ipAddress,
  deviceType,
  email,
  fullName,
  'bidding',  // ✅ Context: 'authentication' | 'bidding'
  auctionId   // ✅ Required for per-auction rate limiting
);
```

### Rate Limit Configuration

Located in `src/features/auth/services/otp.service.ts`:

```typescript
const RATE_LIMITS = {
  authentication: {
    maxAttempts: 3,
    windowSeconds: 30 * 60, // 30 minutes
  },
  bidding: {
    maxAttempts: 15, // Allow 15 bids per 30 minutes
    windowSeconds: 30 * 60, // 30 minutes
    perAuctionMax: 5, // Max 5 bids per auction per 5 minutes
    perAuctionWindowSeconds: 5 * 60, // 5 minutes
  },
};
```

## Frontend Integration

### Before (Incorrect)
```typescript
// ❌ Using generic OTP endpoint (authentication context)
await fetch('/api/auth/send-otp', {
  method: 'POST',
  body: JSON.stringify({ phone })
});
```

### After (Correct)
```typescript
// ✅ Using bidding-specific endpoint (bidding context)
await fetch(`/api/auctions/${auctionId}/otp/send`, {
  method: 'POST'
});

// Verify OTP
await fetch(`/api/auctions/${auctionId}/otp/verify`, {
  method: 'POST',
  body: JSON.stringify({ otp })
});

// Place bid (OTP already verified)
await fetch(`/api/auctions/${auctionId}/bids`, {
  method: 'POST',
  body: JSON.stringify({ amount, otp })
});
```

## Security Considerations

### Fraud Detection
Both contexts include fraud monitoring:
- Tracks OTP requests per IP + phone combination
- Logs suspicious activity (>20 requests per hour)
- Creates fraud alerts for admin review
- **Does not block legitimate users** - monitoring only

### Per-Auction Rate Limiting
The bidding context includes per-auction limits to prevent:
- Shill bidding (fake bids to inflate prices)
- Bid spamming on specific auctions
- Coordinated attacks on high-value items

### Rate Limit Keys
```typescript
// Global bidding rate limit
`otp:ratelimit:bidding:${phone}`

// Per-auction rate limit
`otp:auction:${auctionId}:${phone}`
```

## Testing

### Test Scenarios

1. **Normal Bidding Flow**
   - Vendor requests OTP for auction
   - Receives OTP via SMS
   - Verifies OTP
   - Places bid successfully

2. **Multiple Bids (Same Auction)**
   - Vendor places 5 bids in 5 minutes → ✅ Allowed
   - Vendor attempts 6th bid → ❌ Rate limited (per-auction)
   - Wait 5 minutes → ✅ Can bid again

3. **Multiple Bids (Different Auctions)**
   - Vendor places 15 bids across different auctions in 30 minutes → ✅ Allowed
   - Vendor attempts 16th bid → ❌ Rate limited (global)
   - Wait 30 minutes → ✅ Can bid again

4. **Competitive Bidding**
   - Multiple vendors bidding on same auction → ✅ All allowed
   - Each vendor has independent rate limits

## Migration Notes

### Backward Compatibility
- Existing bidding flow continues to work
- No database schema changes required
- Frontend needs to be updated to use new endpoints

### Deployment Steps
1. Deploy backend changes (new API routes)
2. Update frontend to use new endpoints
3. Monitor rate limit metrics
4. Adjust limits if needed based on usage patterns

## Monitoring

### Metrics to Track
- OTP requests per context (authentication vs bidding)
- Rate limit hits per context
- Fraud alerts triggered
- Average OTP requests per auction
- Peak bidding activity times

### Redis Keys to Monitor
```bash
# Global bidding rate limits
redis-cli KEYS "otp:ratelimit:bidding:*"

# Per-auction rate limits
redis-cli KEYS "otp:auction:*"

# Fraud monitoring
redis-cli KEYS "fraud:otp:*"
```

## Future Improvements

### Potential Enhancements
1. **Dynamic Rate Limits**: Adjust limits based on auction value or vendor tier
2. **Burst Allowance**: Allow short bursts of bids during final minutes
3. **Whitelist**: Trusted vendors with higher limits
4. **Admin Override**: Manual rate limit adjustments for specific auctions

### Configuration Options
Consider making rate limits configurable via admin panel:
```typescript
interface BiddingRateLimitConfig {
  globalMaxAttempts: number;
  globalWindowSeconds: number;
  perAuctionMax: number;
  perAuctionWindowSeconds: number;
}
```

## References

- **OTP Service**: `src/features/auth/services/otp.service.ts`
- **Bidding Service**: `src/features/auctions/services/bidding.service.ts`
- **Rate Limiter**: `src/lib/redis/client.ts`
- **Fraud Detection**: `src/features/fraud/services/fraud-logging.service.ts`

## Summary

This fix enables competitive bidding by using appropriate rate limits while maintaining security. Vendors can now place up to 15 bids per 30 minutes (with 5 per auction per 5 minutes), compared to the previous 3 attempts per 30 minutes.

**Key Takeaway**: Always use context-aware rate limiting for different user flows. Authentication and bidding have different security vs usability trade-offs.
