# Redis Client (Vercel KV)

This module provides a comprehensive Redis caching layer using Vercel KV for the Salvage Management System.

## Configuration

The Redis client is configured using environment variables:

```env
KV_REST_API_URL=https://your-redis-instance.upstash.io
KV_REST_API_TOKEN=your-token
KV_REST_API_READ_ONLY_TOKEN=your-read-only-token
```

## Cache TTL Configuration

The following TTL (Time To Live) values are configured:

| Cache Type | TTL | Description |
|------------|-----|-------------|
| `SESSION_MOBILE` | 2 hours | Mobile device sessions |
| `SESSION_DESKTOP` | 24 hours | Desktop device sessions |
| `AUCTION_DATA` | 5 minutes | Auction data cache |
| `OTP` | 5 minutes | One-Time Password cache |
| `RATE_LIMIT` | 30 minutes | Rate limiting window |
| `USER_PROFILE` | 15 minutes | User profile data |
| `VENDOR_DATA` | 10 minutes | Vendor information |
| `CASE_DATA` | 10 minutes | Salvage case data |

## Usage Examples

### Basic Cache Operations

```typescript
import { cache } from '@/lib/redis/client';

// Set a value with custom TTL
await cache.set('my-key', { data: 'value' }, 300); // 5 minutes

// Get a value
const value = await cache.get('my-key');

// Delete a value
await cache.del('my-key');

// Check if key exists
const exists = await cache.exists('my-key');

// Get or compute and cache
const data = await cache.getOrSet(
  'expensive-query',
  async () => {
    // Expensive operation
    return await fetchDataFromDatabase();
  },
  600 // Cache for 10 minutes
);
```

### Session Management

```typescript
import { sessionCache } from '@/lib/redis/client';

// Store session (mobile device)
await sessionCache.set('user-123', {
  userId: '123',
  token: 'abc...',
  role: 'vendor'
}, 'mobile');

// Store session (desktop device)
await sessionCache.set('user-123', sessionData, 'desktop');

// Get session
const session = await sessionCache.get('user-123');

// Refresh session TTL
await sessionCache.refresh('user-123', 'mobile');

// Delete session (logout)
await sessionCache.del('user-123');
```

### OTP Management

```typescript
import { otpCache } from '@/lib/redis/client';

// Store OTP (5-minute expiry)
await otpCache.set('+2348012345678', '123456');

// Get OTP data
const otpData = await otpCache.get('+2348012345678');
// Returns: { otp: '123456', attempts: 0 }

// Increment verification attempts
const attempts = await otpCache.incrementAttempts('+2348012345678');

// Delete OTP after successful verification
await otpCache.del('+2348012345678');
```

### Rate Limiting

```typescript
import { rateLimiter } from '@/lib/redis/client';

// Check if rate limit exceeded
const isLimited = await rateLimiter.isLimited(
  'login:user-123',
  5, // Max 5 attempts
  1800 // Within 30 minutes
);

if (isLimited) {
  throw new Error('Too many attempts. Please try again later.');
}

// Reset rate limit
await rateLimiter.reset('login:user-123');
```

### Auction Caching

```typescript
import { auctionCache } from '@/lib/redis/client';

// Cache auction data (5-minute TTL)
await auctionCache.set('auction-123', {
  id: 'auction-123',
  currentBid: 50000,
  endTime: new Date(),
  status: 'active'
});

// Get cached auction
const auction = await auctionCache.get('auction-123');

// Cache active auctions list
await auctionCache.setActiveList([
  { id: 'auction-1', currentBid: 50000 },
  { id: 'auction-2', currentBid: 75000 }
]);

// Get active auctions list
const activeAuctions = await auctionCache.getActiveList();

// Invalidate auction cache
await auctionCache.del('auction-123');
```

### User Profile Caching

```typescript
import { userCache } from '@/lib/redis/client';

// Cache user profile (15-minute TTL)
await userCache.set('user-123', {
  id: 'user-123',
  name: 'John Doe',
  email: 'john@example.com',
  role: 'vendor'
});

// Get cached user profile
const user = await userCache.get('user-123');

// Invalidate user cache (e.g., after profile update)
await userCache.del('user-123');
```

### Vendor Caching

```typescript
import { vendorCache } from '@/lib/redis/client';

// Cache vendor data (10-minute TTL)
await vendorCache.set('vendor-123', {
  id: 'vendor-123',
  businessName: 'ABC Motors',
  tier: 'tier2_full',
  status: 'approved'
});

// Get cached vendor
const vendor = await vendorCache.get('vendor-123');

// Cache vendor tier separately
await vendorCache.setTier('vendor-123', 'tier2_full');

// Get vendor tier
const tier = await vendorCache.getTier('vendor-123');

// Invalidate vendor cache
await vendorCache.del('vendor-123');
```

### Case Caching

```typescript
import { caseCache } from '@/lib/redis/client';

// Cache case data (10-minute TTL)
await caseCache.set('case-123', {
  id: 'case-123',
  claimReference: 'CLM-2024-001',
  status: 'active_auction',
  estimatedValue: 150000
});

// Get cached case
const caseData = await caseCache.get('case-123');

// Invalidate case cache
await caseCache.del('case-123');
```

## Best Practices

### 1. Cache Invalidation

Always invalidate cache when data is updated:

```typescript
// After updating user profile
await db.update(users).set({ name: 'New Name' }).where(eq(users.id, userId));
await userCache.del(userId); // Invalidate cache
```

### 2. Cache-Aside Pattern

Use the `getOrSet` utility for cache-aside pattern:

```typescript
const userData = await cache.getOrSet(
  `user:${userId}`,
  async () => {
    // Fetch from database if not in cache
    return await db.query.users.findFirst({
      where: eq(users.id, userId)
    });
  },
  CACHE_TTL.USER_PROFILE
);
```

### 3. Namespace Keys

Use consistent key naming conventions:

- Sessions: `session:{userId}`
- OTP: `otp:{phone}`
- Rate limiting: `ratelimit:{action}:{identifier}`
- Auctions: `auction:{auctionId}`
- Users: `user:{userId}`
- Vendors: `vendor:{vendorId}`
- Cases: `case:{caseId}`

### 4. Error Handling

Always handle Redis errors gracefully:

```typescript
try {
  const cached = await cache.get('my-key');
  if (cached) {
    return cached;
  }
} catch (error) {
  console.error('Redis error:', error);
  // Fallback to database
}

// Fetch from database
return await fetchFromDatabase();
```

### 5. Monitoring

Monitor cache hit rates and performance:

```typescript
const cacheHit = await cache.get('my-key');
if (cacheHit) {
  console.log('Cache hit for my-key');
} else {
  console.log('Cache miss for my-key');
}
```

## Performance Considerations

1. **TTL Selection**: Choose appropriate TTL values based on data volatility
   - Frequently changing data: 1-5 minutes
   - Moderately changing data: 10-15 minutes
   - Rarely changing data: 30-60 minutes

2. **Cache Size**: Monitor cache memory usage and eviction rates

3. **Network Latency**: Vercel KV is optimized for edge locations, but consider:
   - Batch operations when possible
   - Use read-only tokens for read-heavy operations

4. **Serialization**: All values are JSON serialized, so avoid caching:
   - Very large objects (>1MB)
   - Binary data (use Cloudinary for files)

## Security

1. **Sensitive Data**: Never cache unencrypted sensitive data
   - BVN numbers should be encrypted before caching
   - Payment details should not be cached

2. **Access Control**: Use appropriate tokens
   - `KV_REST_API_TOKEN` for read/write operations
   - `KV_REST_API_READ_ONLY_TOKEN` for read-only operations

3. **Key Isolation**: Use user-specific keys to prevent data leakage
   - Always include user/vendor ID in cache keys
   - Never use predictable keys for sensitive data

## Troubleshooting

### Connection Issues

If you encounter connection errors:

1. Verify environment variables are set correctly
2. Check Vercel KV dashboard for service status
3. Ensure your IP is not rate-limited

### Cache Misses

If experiencing high cache miss rates:

1. Verify TTL values are appropriate
2. Check if cache is being invalidated too frequently
3. Monitor memory usage and eviction rates

### Performance Issues

If Redis operations are slow:

1. Check network latency to Upstash region
2. Consider using read replicas for read-heavy workloads
3. Batch operations when possible

## References

- [Vercel KV Documentation](https://vercel.com/docs/storage/vercel-kv)
- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
