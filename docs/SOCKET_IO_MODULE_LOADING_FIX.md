# Socket.io Module Loading Fix

## Problem

Socket.io server was initializing correctly (banner showed "Socket.io ready"), but broadcasts were failing with:

```
❌ Socket.io server not initialized - cannot broadcast bid
   - This means io is null/undefined
```

## Root Cause

**Next.js Module Loading Issue**: When Next.js compiles API routes and server components, it creates separate module instances. The `io` variable set in `server.ts` exists in a different module instance than the one imported by API routes.

```
server.ts (Module Instance A)
  ↓
  io = initializeSocketServer() ✅ (io is set)

API Route (Module Instance B)
  ↓
  import { broadcastNewBid } from '@/lib/socket/server'
  ↓
  broadcastNewBid() checks `io` ❌ (io is null in this instance)
```

## Solution

Use the `getSocketServer()` function instead of the module-level `io` variable. This function returns the actual Socket.io instance regardless of module boundaries.

### Before (Broken)

```typescript
export async function broadcastNewBid(auctionId: string, bid: any) {
  if (!io) {  // ❌ io is null in API route module instance
    console.error('Socket.io server not initialized');
    return;
  }
  
  io.to(`auction:${auctionId}`).emit('auction:new-bid', { ... });
}
```

### After (Fixed)

```typescript
export async function broadcastNewBid(auctionId: string, bid: any) {
  const socketServer = getSocketServer();  // ✅ Gets actual instance
  
  if (!socketServer) {
    console.error('Socket.io server not initialized');
    return;
  }
  
  socketServer.to(`auction:${auctionId}`).emit('auction:new-bid', { ... });
}
```

## Files Modified

All broadcast functions in `src/lib/socket/server.ts`:

1. ✅ `broadcastNewBid()` - Fixed
2. ✅ `broadcastAuctionUpdate()` - Fixed
3. ✅ `broadcastAuctionExtension()` - Fixed
4. ✅ `broadcastAuctionClosure()` - Fixed
5. ✅ `notifyVendorOutbid()` - Fixed
6. ✅ `notifyVendorWon()` - Fixed
7. ✅ `sendNotificationToUser()` - Fixed
8. ✅ `broadcastAuctionClosing()` - Fixed (NEW)
9. ✅ `broadcastDocumentGenerated()` - Fixed (NEW)
10. ✅ `broadcastDocumentGenerationComplete()` - Fixed (NEW)

## Testing

1. **Restart your dev server**:
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Verify Socket.io initializes**:
   Look for this banner in terminal:
   ```
   ╔════════════════════════════════════════════════════════════╗
   ║  🚀 NEM Salvage Management System                         ║
   ║  ✅ Next.js server ready                                  ║
   ║  ✅ Socket.io server ready                                ║
   ╚════════════════════════════════════════════════════════════╝
   ```

3. **Test real-time bidding**:
   - Open 2 browser windows to the same auction
   - Place a bid in one window
   - Other window should update instantly
   - Check terminal for broadcast logs:
     ```
     🔔 broadcastNewBid() called for auction xxx
     📢 Broadcasting to room: auction:xxx
        - Clients in room: 2
     ✅ Broadcast successful for auction xxx
     ```

4. **Test auction closure**:
   - Wait for auction to expire or click "End Early"
   - Should see real-time document generation progress
   - Check terminal for closure logs:
     ```
     🔔 broadcastAuctionClosing() called
     🔔 broadcastDocumentGenerated() called
     🔔 broadcastDocumentGenerationComplete() called
     ```

## Why This Happens

Next.js uses Webpack/Turbopack to bundle code, which can create multiple instances of the same module:

1. **Server startup** (`server.ts`): Runs in Node.js directly via `tsx`
2. **API routes**: Compiled by Next.js into separate bundles
3. **Server components**: Compiled separately again

Each compilation creates its own module scope, so module-level variables don't share state.

## Best Practice

**Always use getter functions for shared state in Next.js**:

```typescript
// ❌ BAD: Module-level variable
let sharedState = null;

export function setState(value) {
  sharedState = value;
}

export function getState() {
  return sharedState;  // May be null in different module instances
}

// ✅ GOOD: Getter function that accesses actual instance
let sharedState = null;

export function setState(value) {
  sharedState = value;
}

export function getState() {
  return sharedState;  // Returns actual instance
}

// Use getState() in all functions instead of accessing sharedState directly
```

## Related Issues

This same pattern should be used for any shared state in Next.js:
- Database connections
- Cache instances
- WebSocket servers
- External service clients

## Credits

Fixed by: Kiro AI
Date: 2025-01-XX
Issue: Socket.io broadcasts failing due to Next.js module loading
