# Quick Start: Auction Expiry & Migration Fixes

## 🚀 Quick Commands

### Run Migration
```bash
# Option 1: Using drizzle-kit (recommended)
npm run db:migrate

# Option 2: Using custom script
npx tsx scripts/run-migration.ts 0018_add_forfeited_status_and_disabled_documents.sql
```

### Verify Migration
```sql
-- Check auction_status enum
SELECT enum_range(NULL::auction_status);
-- Should include: 'forfeited'

-- Check payment_status enum
SELECT enum_range(NULL::payment_status);
-- Should include: 'forfeited'

-- Check release_forms table
\d release_forms
-- Should have 'disabled' column (boolean, default false)
```

---

## 🔧 How It Works

### Real-Time Auction Closure

#### 1. API Endpoint
```bash
# Check single auction
GET /api/auctions/check-expired?auctionId=abc123

# Check all active auctions
POST /api/auctions/check-expired
Content-Type: application/json
{"checkAll": true}
```

#### 2. Client-Side Hook
```typescript
import { useAuctionExpiryCheck } from '@/hooks/use-auction-expiry-check';

// In your component
useAuctionExpiryCheck({
  auctionId: 'abc123',
  endTime: auction.endTime,
  status: auction.status,
  enabled: auction.status === 'active',
  onAuctionClosed: () => {
    // Refresh data, show notification, etc.
  },
});
```

#### 3. Automatic Behavior
- ✅ Checks on mount
- ✅ Polls every 10 seconds (detail page) or 30 seconds (list page)
- ✅ Stops when auction closes
- ✅ Calls API only when needed
- ✅ Handles race conditions

---

## 📋 Testing Checklist

### Quick Test
1. Create auction with endTime 1 minute in future
2. Navigate to auction page
3. Wait for timer to expire
4. Verify closure within 10 seconds
5. Check documents appear
6. Verify notifications sent

### Database Test
```sql
-- Create test auction with expired endTime
UPDATE auctions 
SET end_time = NOW() - INTERVAL '1 minute',
    status = 'active'
WHERE id = '[auction-id]';

-- Visit auction page or call API
-- Then verify:
SELECT status FROM auctions WHERE id = '[auction-id]';
-- Should be 'closed'

SELECT COUNT(*) FROM payments WHERE auction_id = '[auction-id]';
-- Should be 1

SELECT COUNT(*) FROM release_forms WHERE auction_id = '[auction-id]';
-- Should be 2 (Bill of Sale, Liability Waiver)
```

---

## 🐛 Troubleshooting

### Migration Issues

**Problem:** Migration fails with "type already exists"
```
Solution: This is expected if running drizzle-kit migrate on existing database.
Use the custom script instead:
npx tsx scripts/run-migration.ts 0018_add_forfeited_status_and_disabled_documents.sql
```

**Problem:** Migration file not found
```
Solution: Ensure file is in correct location:
src/lib/db/migrations/0018_add_forfeited_status_and_disabled_documents.sql
```

### Auction Closure Issues

**Problem:** Auction not closing automatically
```
Checklist:
1. Check browser console for errors
2. Verify auction status is 'active'
3. Verify endTime has passed
4. Check Network tab for API calls
5. Verify hook is enabled (status === 'active')
```

**Problem:** Multiple payments created
```
Solution: This shouldn't happen due to idempotency checks.
If it does, check:
1. Database constraints on payments table
2. Service layer duplicate checks
3. Audit logs for multiple closure attempts
```

**Problem:** Documents not generated
```
Checklist:
1. Check server logs for errors
2. Verify document service is working
3. Check if auction has winner
4. Verify vendor ID is valid
```

---

## 📊 Monitoring

### Key Metrics to Track

1. **Closure Detection Time**
   - Time from expiry to closure
   - Target: < 10 seconds

2. **API Call Frequency**
   - Calls per minute
   - Should match polling intervals

3. **Race Conditions**
   - Multiple closure attempts
   - Should be handled gracefully

4. **Failure Rate**
   - Failed closures
   - Should be < 1%

### Logging
```typescript
// Check browser console for:
console.log('🎯 Auction expired and closed! Refreshing data...');
console.log('✅ Closed X expired auctions');

// Check server logs for:
console.log(`Auction ${auctionId} closed successfully`);
console.error(`Failed to close auction ${auctionId}:`, error);
```

---

## 🔐 Security Considerations

### API Endpoint
- ✅ No authentication required (public endpoint)
- ✅ Idempotent - safe to call multiple times
- ✅ Rate limiting recommended (future enhancement)

### Race Conditions
- ✅ Database constraints prevent duplicates
- ✅ Service layer checks prevent duplicate processing
- ✅ Audit logs track all attempts

---

## 🚦 Deployment Checklist

Before deploying to production:

- [ ] Run migration on production database
- [ ] Verify migration applied correctly
- [ ] Test API endpoint with production data
- [ ] Monitor closure detection time
- [ ] Check for errors in logs
- [ ] Verify notifications are sent
- [ ] Test with multiple concurrent users
- [ ] Confirm no duplicate payments/documents

---

## 📞 Support

### Common Questions

**Q: Will this affect existing auctions?**
A: No, all existing auctions work seamlessly with the new system.

**Q: What happens if the browser is closed?**
A: The daily cron job still runs as a backup to close any missed auctions.

**Q: Can I disable the real-time checking?**
A: Yes, set `enabled: false` in the hook configuration.

**Q: How do I test without waiting for timer?**
A: Update the auction's endTime in the database to a past time.

---

## 📚 Related Documentation

- [Full Implementation Guide](./AUCTION_EXPIRY_AND_MIGRATION_FIXES_COMPLETE.md)
- [Manual Test Plan](./tests/manual/test-auction-expiry-and-migration.md)
- [Auction Closure Service](./src/features/auctions/services/closure.service.ts)
- [API Endpoint](./src/app/api/auctions/check-expired/route.ts)
- [React Hook](./src/hooks/use-auction-expiry-check.ts)

---

**Last Updated:** 2024
**Status:** ✅ Production Ready
