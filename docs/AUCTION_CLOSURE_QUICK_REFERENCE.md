# Auction Closure System - Quick Reference

## Overview

Event-driven auction closure with synchronous document generation and real-time Socket.io broadcasts.

## Key Features

- ✅ **Instant closure** - < 1 second after timer expires
- ✅ **Synchronous documents** - Generated before status changes to 'closed'
- ✅ **Real-time updates** - Socket.io broadcasts every step
- ✅ **Idempotent** - Safe to call multiple times
- ✅ **No cron dependency** - Client-side timer triggers closure

## Architecture

```
Timer Expires → POST /api/auctions/[id]/close → Status: 'closing' 
→ Generate Docs (sync) → Status: 'closed' → Broadcast Events
```

## Socket.io Events

### Server → Client

| Event | Data | When |
|-------|------|------|
| `auction:closing` | `{ auctionId }` | Auction is closing, docs generating |
| `auction:document-generated` | `{ auctionId, documentType, documentId }` | Each document generated |
| `auction:document-generation-complete` | `{ auctionId, totalDocuments }` | All documents ready |
| `auction:closed` | `{ auctionId, winnerId }` | Auction fully closed |

## API Endpoints

### POST /api/auctions/[id]/close

Close an auction immediately (idempotent).

**Request**:
```bash
POST /api/auctions/abc123/close
Authorization: Bearer <jwt_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "auctionId": "abc123",
    "winnerId": "vendor-456",
    "winningBid": 150000,
    "paymentId": "pay-789"
  }
}
```

**Idempotent**: Returns success if already closed.

## Client Usage

### 1. Set Up Timer

```typescript
useEffect(() => {
  if (!auction || auction.status !== 'active') return;
  
  const endTime = new Date(auction.endTime);
  const timeUntilEnd = endTime.getTime() - Date.now();
  
  if (timeUntilEnd <= 0) {
    handleAuctionClose();
  } else {
    const timer = setTimeout(handleAuctionClose, timeUntilEnd);
    return () => clearTimeout(timer);
  }
}, [auction?.endTime, auction?.status]);
```

### 2. Listen for Events

```typescript
const { 
  isClosing,
  documentsGenerating,
  generatedDocuments,
} = useAuctionUpdates(auctionId);
```

### 3. Show Loading UI

```typescript
{isClosing && (
  <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-6">
    <h3>Closing Auction...</h3>
    {documentsGenerating && (
      <p>Generating documents: {generatedDocuments.length}/2</p>
    )}
  </div>
)}
```

## Testing

### Manual Test (2 Windows)

1. Open 2 browser windows to same auction
2. Wait for timer to expire OR click "End Early"
3. Verify both windows show:
   - "Closing auction..." banner
   - Document generation progress (1/2 → 2/2)
   - "Documents ready!" message
   - Documents appear without refresh
   - Status changes to "Closed"

### Automated Test

```bash
# Set environment variables
export TEST_AUCTION_ID="your-auction-id"
export TEST_JWT_TOKEN="your-jwt-token"

# Run test
npx tsx scripts/test-auction-closure-realtime.ts
```

## Timing Expectations

| Step | Expected Time |
|------|---------------|
| Timer expires → API call | < 100ms |
| API call → Status 'closing' | < 200ms |
| Generate Bill of Sale | ~500ms |
| Generate Liability Waiver | ~500ms |
| Status 'closed' | < 100ms |
| **Total** | **~1.5 seconds** |

## Troubleshooting

### Issue: Documents not appearing

**Check**:
1. Server logs for "Document generation complete"
2. Socket.io broadcasts sent (check server logs)
3. Client received events (check browser console)

**Solution**: Documents are generated synchronously now, should appear within 5 seconds.

### Issue: Multiple closures

**Check**: Server logs for "already closed (idempotent check)"

**Solution**: This is expected behavior - idempotency prevents duplicates.

### Issue: Status stuck on 'closing'

**Check**: Server logs for document generation errors

**Solution**: If documents fail, status reverts to 'active'. Check error logs.

## Console Logs

### Server (Expected)

```
🎯 Close auction request: abc123
   - Requested by: user-123 (vendor)
🔄 Auction abc123 status: closing
📢 Broadcasting auction closing to 2 clients
📄 Starting document generation...
✅ Bill of Sale generated
📢 Broadcasting document generated: bill_of_sale
✅ Liability Waiver generated
📢 Broadcasting document generated: liability_waiver
📢 Broadcasting document generation complete: 2 docs
✅ Auction abc123 status: closed
📢 Broadcasting auction closure to 2 clients
```

### Client (Expected)

```
⏰ Timer fired! Closing auction abc123
🎯 Closing auction abc123...
📡 Received auction closing for abc123
   - Documents are being generated...
📡 Received document generated for abc123
   - Document type: bill_of_sale
📡 Received document generated for abc123
   - Document type: liability_waiver
📡 Received document generation complete for abc123
   - Total documents: 2
📡 Received auction closure for abc123
   - Winner ID: vendor-456
```

## Files Modified

1. `src/lib/socket/server.ts` - Added 3 new broadcast functions
2. `src/features/auctions/services/closure.service.ts` - Synchronous document generation
3. `src/app/api/auctions/[id]/close/route.ts` - NEW close endpoint
4. `src/hooks/use-socket.ts` - Added 3 new event listeners
5. `src/app/(dashboard)/vendor/auctions/[id]/page.tsx` - Client-side timer + loading UI

## Migration Notes

- ✅ Backward compatible - existing code still works
- ✅ No database migration required (yet)
- ✅ Cron job still works as backup
- ⏳ TODO: Add 'closing' status to database enum

## Next Steps

1. Test with 2 browser windows
2. Verify timing (< 5 seconds total)
3. Test idempotency (call close multiple times)
4. Add 'closing' status to database schema
5. Update cron job to run once daily (backup only)
