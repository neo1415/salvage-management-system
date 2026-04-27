# Bidding OTP Quick Reference

## TL;DR

Use **bidding-specific OTP endpoints** for auction bidding to get higher rate limits.

## Endpoints

### Send OTP for Bidding
```
POST /api/auctions/[auctionId]/otp/send
```

### Verify OTP for Bidding
```
POST /api/auctions/[auctionId]/otp/verify
Body: { "otp": "123456" }
```

## Rate Limits

| Context | Global Limit | Per-Auction Limit | Window |
|---------|-------------|-------------------|--------|
| **Authentication** | 3 attempts | N/A | 30 min |
| **Bidding** | 15 attempts | 5 attempts | 30 min / 5 min |

## Frontend Example

```typescript
// 1. Request OTP
const sendResponse = await fetch(`/api/auctions/${auctionId}/otp/send`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});

// 2. User enters OTP from SMS

// 3. Verify OTP
const verifyResponse = await fetch(`/api/auctions/${auctionId}/otp/verify`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ otp: userEnteredOTP })
});

// 4. Place bid (OTP already verified)
const bidResponse = await fetch(`/api/auctions/${auctionId}/bids`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    amount: bidAmount,
    otp: userEnteredOTP // Still required for bid placement
  })
});
```

## Error Messages

### Rate Limit Exceeded (Global)
```
"Too many OTP requests. Please try again in 30 minutes."
```

### Rate Limit Exceeded (Per-Auction)
```
"Too many bid attempts for this auction. Please wait 5 minutes."
```

### OTP Expired
```
"OTP expired or not found. Please request a new OTP."
```

### Invalid OTP
```
"Invalid OTP. 2 attempts remaining."
```

## When to Use Which Endpoint

| Use Case | Endpoint | Context |
|----------|----------|---------|
| User Registration | `/api/auth/send-otp` | authentication |
| Password Reset | `/api/auth/send-otp` | authentication |
| **Auction Bidding** | `/api/auctions/[id]/otp/send` | **bidding** |
| Phone Verification | `/api/auth/send-otp` | authentication |

## Key Differences

### Authentication OTP
- ✅ Strict rate limits (3 per 30 min)
- ✅ Prevents brute force attacks
- ✅ Prevents SMS spam
- ❌ Too restrictive for bidding

### Bidding OTP
- ✅ Higher rate limits (15 per 30 min)
- ✅ Per-auction limits (5 per 5 min)
- ✅ Enables competitive bidding
- ✅ Still prevents abuse

## Security Features

Both contexts include:
- ✅ OTP expiry (5 minutes)
- ✅ Max verification attempts (3)
- ✅ Fraud monitoring (>20 requests/hour)
- ✅ IP + phone tracking
- ✅ Audit logging

## Common Issues

### Issue: "Too many OTP requests" during bidding
**Solution**: Use `/api/auctions/[id]/otp/send` instead of `/api/auth/send-otp`

### Issue: Vendor locked out after 3 bids
**Solution**: Frontend is using wrong endpoint (authentication instead of bidding)

### Issue: Rate limit hit on specific auction
**Solution**: Per-auction limit (5 per 5 min) - wait 5 minutes or bid on different auction

## Testing

```bash
# Test bidding OTP send
curl -X POST http://localhost:3000/api/auctions/auction-123/otp/send \
  -H "Cookie: next-auth.session-token=..." \
  -H "Content-Type: application/json"

# Test bidding OTP verify
curl -X POST http://localhost:3000/api/auctions/auction-123/otp/verify \
  -H "Cookie: next-auth.session-token=..." \
  -H "Content-Type: application/json" \
  -d '{"otp":"123456"}'
```

## Monitoring

```bash
# Check bidding rate limits
redis-cli KEYS "otp:ratelimit:bidding:*"

# Check per-auction limits
redis-cli KEYS "otp:auction:*"

# Check fraud alerts
redis-cli KEYS "fraud:otp:*"
```

## Need Help?

- **Full Documentation**: `docs/BIDDING_OTP_RATE_LIMITS_FIX.md`
- **OTP Service**: `src/features/auth/services/otp.service.ts`
- **API Routes**: `src/app/api/auctions/[id]/otp/`
