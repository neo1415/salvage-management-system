# Offline-First Implementation - Comprehensive Fixes

## ⚠️ CRITICAL BUGS DISCOVERED IN TESTING

During testing, the following critical bugs were discovered that block offline functionality:

1. **Wallet Balance Fetch Errors** - useCachedWallet not loading cached data
2. **Auction Filtering Broken** - All tabs show same data offline
3. **Documents Not Showing** - Cached documents not appearing offline
4. **Navigation Broken** - Can't navigate from documents page
5. **Dashboard Empty** - No cached data shown, console errors
6. **Notifications Errors** - Console spam from fetch failures
7. **Infinite Loop** - Maximum update depth exceeded in useEffect

See "NEW CRITICAL BUGS DISCOVERED IN TESTING" section below for detailed requirements.

## Overview
Fix all identified gaps in the offline-first implementation to provide a robust, production-ready offline experience across the entire application.

## Current State Analysis

### Existing Implementation
- ✅ Basic offline detection (`useOffline` hook)
- ✅ IndexedDB setup for case storage
- ✅ Offline sync service for cases
- ✅ Auto-sync on connection restore
- ✅ Offline indicator banner
- ⚠️ Limited to case creation only
- ⚠️ No offline caching for auctions, documents, wallet
- ⚠️ No draft auto-save
- ⚠️ No offline session management
- ⚠️ UI blocking issues with offline banner

## Critical Issues to Fix

### 1. Offline UI Blocking (Priority: CRITICAL)
**Problem**: Offline indicator blocks hamburger menu on mobile
- Fixed z-index at top (z-50) blocks navigation
- Not dismissible
- Always visible when offline

**Requirements**:
- Make offline banner dismissible with close button
- Adjust z-index to not block navigation (hamburger menu)
- Add slide-down animation
- Store dismissal state in sessionStorage
- Show compact version after dismissal (small badge)
- Ensure mobile hamburger menu has higher z-index

### 2. No Offline Data Caching (Priority: HIGH)
**Problem**: Auctions, documents, wallet data not available offline

**Requirements**:
- Cache auction listings in IndexedDB
  - Store last 50 auctions viewed
  - Include auction details, images, bids
  - Show "Last updated" timestamp
  - Auto-refresh when online
  
- Cache documents list
  - Store document metadata
  - Cache PDF URLs for offline viewing
  - Show cached documents with offline badge
  
- Cache wallet data
  - Store balance and last 20 transactions
  - Show "Last synced" timestamp
  - Disable transaction actions when offline

### 3. Draft Auto-Save (Priority: HIGH)
**Problem**: No draft saving in case creation

**Requirements**:
- Auto-save every 30 seconds
- Save to IndexedDB with status='draft'
- Show "Saving..." indicator
- Show "Last saved" timestamp
- Allow resuming drafts from list
- Require AI analysis before final submission
- Block submission if marketValue not filled
- Clear draft after successful submission

### 4. Offline Login (Priority: HIGH)
**Problem**: Can't login when offline

**Requirements**:
- Cache session tokens securely in IndexedDB
- Encrypt sensitive session data
- Allow offline access with cached credentials
- Show "Offline Mode" indicator in header
- Validate cached session on reconnect
- Force re-authentication after 7 days offline
- Clear cache on explicit logout

### 5. Approve Button State (Priority: MEDIUM)
**Problem**: Approve/reject buttons not disabled when offline

**Requirements**:
- Disable approve/reject buttons when offline
- Show tooltip: "This action requires internet connection"
- Add visual indicator (grayed out)
- Queue approval for when online (optional)
- Show pending approval count

### 6. AI Analysis Requirement (Priority: HIGH)
**Problem**: Drafts can be submitted without AI analysis

**Requirements**:
- Make AI analysis mandatory before submission
- Block submission if marketValue not filled
- Show clear error: "AI analysis required before submission"
- Disable submit button until AI completes
- Show AI analysis status badge
- Allow saving as draft without AI

### 7. Sync Status Visibility (Priority: MEDIUM)
**Problem**: Users don't see sync status

**Requirements**:
- Show last sync timestamp in header
- Display pending changes count badge
- Add manual "Sync Now" button
- Show sync errors with retry option
- Display sync progress bar
- Show per-item sync status in lists

### 8. Background Sync Progress (Priority: MEDIUM)
**Problem**: No user feedback during sync

**Requirements**:
- Show toast notifications on sync complete
- Display progress during sync (X of Y synced)
- Notify on sync errors with details
- Show which items failed to sync
- Provide retry button for failed items
- Background sync indicator in header

### 9. Conflict Resolution UI (Priority: MEDIUM)
**Problem**: No user interface for conflicts

**Requirements**:
- Create modal for conflict resolution
- Show both versions side-by-side:
  - Local version (your changes)
  - Remote version (server changes)
- Highlight differences
- Let user choose:
  - Keep local
  - Keep remote
  - Merge (manual)
- Show conflict timestamp
- Explain why conflict occurred

### 10. Offline Session Management (Priority: HIGH)
**Problem**: No offline auth support

**Requirements**:
- Cache session securely in IndexedDB
- Encrypt with Web Crypto API
- Allow limited offline access
- Re-authenticate when online
- Show session expiry warning
- Force login after 7 days offline
- Clear sensitive data on logout

## Technical Requirements

### IndexedDB Schema Extensions
```typescript
// Add new stores
interface SalvageDBSchema extends DBSchema {
  // Existing
  offlineCases: { ... };
  syncQueue: { ... };
  
  // New stores
  cachedAuctions: {
    key: string;
    value: CachedAuction;
    indexes: {
      'by-updated-at': Date;
      'by-status': string;
    };
  };
  
  cachedDocuments: {
    key: string;
    value: CachedDocument;
    indexes: {
      'by-auction-id': string;
      'by-updated-at': Date;
    };
  };
  
  cachedWallet: {
    key: string;
    value: CachedWalletData;
    indexes: {
      'by-user-id': string;
      'by-updated-at': Date;
    };
  };
  
  offlineSession: {
    key: string;
    value: EncryptedSession;
    indexes: {
      'by-user-id': string;
      'by-expires-at': Date;
    };
  };
  
  drafts: {
    key: string;
    value: DraftCase;
    indexes: {
      'by-created-at': Date;
      'by-updated-at': Date;
    };
  };
}
```

### Security Requirements
- Encrypt session tokens using Web Crypto API
- Use AES-GCM encryption
- Store encryption key in memory only
- Clear encryption key on logout
- Implement secure key derivation
- No sensitive data in localStorage

### Performance Requirements
- Cache size limit: 50MB per store
- Auto-cleanup old cached data (>7 days)
- Lazy load cached data
- Index for fast queries
- Batch sync operations
- Debounce auto-save (30s)

### Accessibility Requirements
- Screen reader announcements for offline status
- Keyboard navigation for conflict resolution
- Focus management in modals
- ARIA labels for all interactive elements
- High contrast mode support

## Success Criteria

### Functional
- ✅ Users can navigate app offline
- ✅ Cached data available offline
- ✅ Drafts auto-save every 30s
- ✅ Offline login works with cached session
- ✅ Buttons disabled appropriately when offline
- ✅ AI analysis required before submission
- ✅ Sync status visible to users
- ✅ Sync progress shown with notifications
- ✅ Conflicts resolved through UI
- ✅ Session managed securely offline
- ✅ Wallet balance shows cached data offline (no fetch errors)
- ✅ Auction filtering works correctly offline (all tabs)
- ✅ Documents appear offline after viewing online
- ✅ Navigation works from all pages including documents
- ✅ Dashboard shows cached data offline
- ✅ Notifications cached and shown offline
- ✅ No infinite loops or maximum update depth errors

### UX
- ✅ Offline banner doesn't block navigation
- ✅ Clear "Last updated" timestamps
- ✅ Sync errors shown with retry option
- ✅ Smooth transitions between online/offline
- ✅ No data loss during offline usage
- ✅ Clear feedback for all actions

### Performance
- ✅ Cache operations < 100ms
- ✅ Sync completes within 30s for 10 items
- ✅ No UI blocking during sync
- ✅ Memory usage < 100MB
- ✅ Storage usage < 50MB per store

### Security
- ✅ Session tokens encrypted
- ✅ No sensitive data in localStorage
- ✅ Encryption keys in memory only
- ✅ Secure key derivation
- ✅ Auto-logout after 7 days offline

## NEW CRITICAL BUGS DISCOVERED IN TESTING

### 11. Wallet Balance Fetch Errors Offline (Priority: CRITICAL)
**Problem**: "Failed to fetch wallet balance" error when offline

**Root Cause**:
- useCachedWallet hook not working properly
- Cached wallet data not loading from IndexedDB
- Error handling not graceful for offline state

**Requirements**:
- Fix useCachedWallet hook to properly load cached data
- Ensure wallet data is cached when viewed online
- Show cached balance with "Last synced" timestamp
- Gracefully handle fetch errors when offline
- Show clear offline indicator in wallet page
- Prevent error spam in console

**Related Task**: Task 7 (Implement Wallet Caching) - needs bug fixes

### 12. Auction Filtering Broken Offline (Priority: CRITICAL)
**Problem**: All auction tabs show the same data offline

**Root Cause**:
- Filtering logic not working with cached data
- Active, Completed, Won, My Biddings tabs all show identical results
- Cache query not respecting filter parameters

**Requirements**:
- Fix auction filtering to work with cached data
- Implement proper IndexedDB queries for each tab:
  - Active: status='active' AND endDate > now
  - Completed: status='completed' OR endDate < now
  - Won: status='completed' AND winner=currentUser
  - My Biddings: bids contains currentUser
- Add indexes for efficient filtering
- Test each tab independently
- Show appropriate empty states per tab

**Related Task**: Task 5 (Implement Auction Caching) - needs filtering fixes

### 13. Documents Not Showing Offline (Priority: CRITICAL)
**Problem**: Documents viewed online don't appear when offline

**Root Cause**:
- useCachedDocuments hook may not be caching properly
- Documents not being saved to IndexedDB
- Cache retrieval logic may be broken

**Requirements**:
- Verify documents are cached when viewed online
- Fix cache storage logic if broken
- Fix cache retrieval logic in useCachedDocuments
- Add logging to debug caching flow
- Show cached documents with offline badge
- Test with multiple document types
- Ensure PDF URLs are cached

**Related Task**: Task 6 (Implement Document Caching) - needs caching verification

### 14. Navigation Broken in Documents Page (Priority: HIGH)
**Problem**: Can't click to navigate to other pages when in documents

**Root Cause**:
- Possible z-index issue blocking navigation
- Event handler may be preventing clicks
- Overlay or modal may be blocking interaction

**Requirements**:
- Investigate z-index conflicts in documents page
- Check for event handlers preventing navigation
- Verify no overlays blocking clicks
- Test navigation to all pages from documents
- Ensure hamburger menu works
- Test on mobile and desktop

**Related Task**: New task needed for navigation debugging

### 15. Dashboard Empty Offline (Priority: HIGH)
**Problem**: Dashboard shows nothing when offline with console errors

**Root Cause**:
- Dashboard data not cached
- Multiple fetch errors appearing
- No offline fallback for dashboard widgets

**Requirements**:
- Implement dashboard data caching
- Cache key metrics (cases, auctions, wallet summary)
- Show cached data with "Last updated" timestamp
- Gracefully handle fetch errors
- Show offline indicator on dashboard
- Prevent console error spam
- Add empty state for no cached data

**Related Task**: New task needed for dashboard caching

### 16. Notifications Fetch Errors (Priority: MEDIUM)
**Problem**: "Failed to fetch notifications" causing console spam

**Root Cause**:
- Notifications not cached
- No offline handling for notifications
- Fetch errors not caught gracefully

**Requirements**:
- Implement notifications caching
- Cache last 20 notifications
- Show cached notifications offline
- Gracefully handle fetch errors
- Stop console error spam
- Show "Offline - showing cached" message
- Add refresh button when online

**Related Task**: New task needed for notifications caching

### 17. Maximum Update Depth Exceeded (Priority: CRITICAL)
**Problem**: Infinite loop in useEffect causing app crash

**Root Cause**:
- Likely in checkForPaymentUnlockedNotification or similar
- useEffect dependencies causing infinite re-renders
- State updates triggering effect recursively

**Requirements**:
- Identify the problematic useEffect
- Fix dependency array to prevent infinite loop
- Add proper memoization if needed
- Use useCallback for functions in dependencies
- Add ESLint exhaustive-deps check
- Test thoroughly to prevent recurrence

**Related Task**: New task needed for useEffect debugging

## Out of Scope
- Service Worker implementation (future enhancement)
- Background sync API (future enhancement)
- Push notifications for sync (future enhancement)
- Offline file uploads (future enhancement)
- P2P sync between devices (future enhancement)

## Dependencies
- idb (IndexedDB wrapper) - already installed
- Web Crypto API (built-in)
- React hooks (existing)
- Tailwind CSS (existing)

## Risks & Mitigations

### Risk: Data Loss During Sync
**Mitigation**: Implement robust conflict resolution with user choice

### Risk: Storage Quota Exceeded
**Mitigation**: Implement auto-cleanup and storage monitoring

### Risk: Security Vulnerabilities
**Mitigation**: Use Web Crypto API, encrypt sensitive data, regular security audits

### Risk: Performance Degradation
**Mitigation**: Lazy loading, indexing, batch operations, debouncing

### Risk: Browser Compatibility
**Mitigation**: Feature detection, graceful degradation, polyfills

## Implementation Phases

### Phase 0: CRITICAL BUG FIXES (IMMEDIATE - Week 0)
**Priority**: CRITICAL - Must be fixed before continuing
1. Fix wallet balance fetch errors (useCachedWallet)
2. Fix auction filtering for offline cached data
3. Fix documents not showing offline
4. Fix navigation blocking in documents page
5. Fix dashboard empty state offline
6. Fix notifications fetch error spam
7. Fix infinite loop (maximum update depth exceeded)

### Phase 1: Critical Fixes (Week 1)
1. Fix offline UI blocking
2. Implement draft auto-save
3. Add AI analysis requirement enforcement
4. Disable buttons when offline

### Phase 2: Data Caching (Week 2)
5. Implement auction caching
6. Implement document caching
7. Implement wallet caching
8. Add "Last updated" timestamps

### Phase 3: Sync & Session (Week 3)
9. Add sync status visibility
10. Implement background sync progress
11. Create conflict resolution UI
12. Implement offline session management

### Phase 4: Polish & Testing (Week 4)
13. Comprehensive testing
14. Performance optimization
15. Security audit
16. Documentation
