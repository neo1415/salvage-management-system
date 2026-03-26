# Offline-First Implementation - Tasks

## Phase 1: Critical UI & UX Fixes (Priority: CRITICAL)

### Task 1: Fix Offline Indicator UI Blocking
**Priority**: CRITICAL
**Estimated Time**: 2 hours

#### Subtasks:
- [x] 1.1 Update z-index strategy
  - Set offline indicator to z-40
  - Set hamburger menu to z-45
  - Set modals to z-50
  - Test on mobile devices

- [x] 1.2 Make offline banner dismissible
  - Add close button with X icon
  - Store dismissal state in sessionStorage
  - Add slide-down animation
  - Show compact badge after dismissal

- [x] 1.3 Create compact offline badge
  - Small badge in top-right corner
  - Shows offline icon only
  - Expandable on click
  - Persistent until online

- [x] 1.4 Test mobile navigation
  - Verify hamburger menu accessible
  - Test on iOS Safari
  - Test on Android Chrome
  - Test on various screen sizes

**Files to Modify**:
- `src/components/pwa/offline-indicator.tsx`
- `src/app/globals.css` (z-index utilities)

**Acceptance Criteria**:
- ✅ Offline banner doesn't block hamburger menu
- ✅ Banner is dismissible with close button
- ✅ Compact badge shows after dismissal
- ✅ Smooth animations
- ✅ Works on all mobile devices

---

### Task 2: Implement Draft Auto-Save System
**Priority**: HIGH
**Estimated Time**: 6 hours

#### Subtasks:
- [x] 2.1 Create draft service
  - Implement `DraftService` class
  - Add auto-save with 30s debounce
  - Add manual save method
  - Add load/list/delete methods

- [x] 2.2 Extend IndexedDB schema
  - Add `drafts` store
  - Add indexes for queries
  - Implement migration
  - Test data persistence

- [x] 2.3 Create `useDraftAutoSave` hook
  - Auto-save on form changes
  - Show "Saving..." indicator
  - Show "Last saved" timestamp
  - Handle errors gracefully

- [x] 2.4 Update case creation form
  - Integrate auto-save hook
  - Add draft list UI
  - Add "Resume Draft" functionality
  - Add "Delete Draft" button

- [x] 2.5 Add draft indicators
  - "Saving..." spinner
  - "Last saved X minutes ago"
  - "Draft saved" success message
  - Error messages for failures

**Files to Create**:
- `src/features/cases/services/draft.service.ts`
- `src/hooks/use-draft-auto-save.ts`
- `src/components/cases/draft-list.tsx`

**Files to Modify**:
- `src/lib/db/indexeddb.ts` (add drafts store)
- `src/app/(dashboard)/adjuster/cases/new/page.tsx`

**Acceptance Criteria**:
- ✅ Form auto-saves every 30 seconds
- ✅ Drafts persist in IndexedDB
- ✅ Users can resume drafts
- ✅ Users can delete drafts
- ✅ Clear visual feedback

---

### Task 3: Enforce AI Analysis Requirement
**Priority**: HIGH
**Estimated Time**: 3 hours

#### Subtasks:
- [x] 3.1 Create AI analysis validator
  - Implement validation logic
  - Check for AI analysis completion
  - Check for market value
  - Return detailed errors

- [x] 3.2 Update case submission logic
  - Block submission without AI analysis
  - Show clear error message
  - Disable submit button
  - Allow saving as draft

- [x] 3.3 Add AI analysis status badge
  - Show "AI Analysis Required"
  - Show "AI Analysis Complete"
  - Show market value when available
  - Visual indicators (colors)

- [x] 3.4 Update form validation
  - Add AI analysis to validation schema
  - Show validation errors
  - Prevent form submission
  - Guide user to run AI analysis

**Files to Create**:
- `src/features/cases/services/ai-analysis-validator.ts`
- `src/components/cases/ai-analysis-status-badge.tsx`

**Files to Modify**:
- `src/app/(dashboard)/adjuster/cases/new/page.tsx`

**Acceptance Criteria**:
- ✅ Cannot submit without AI analysis
- ✅ Clear error message shown
- ✅ Submit button disabled appropriately
- ✅ Can save as draft without AI
- ✅ Status badge shows current state

---

### Task 4: Disable Buttons When Offline
**Priority**: MEDIUM
**Estimated Time**: 3 hours

#### Subtasks:
- [x] 4.1 Create `OfflineAwareButton` component
  - Extend base Button component
  - Auto-disable when offline
  - Show tooltip on hover
  - Visual indicator (grayed out)

- [x] 4.2 Update approval buttons
  - Replace with OfflineAwareButton
  - Add offline tooltip
  - Test in manager approvals page
  - Test in finance approvals page

- [x] 4.3 Update payment buttons
  - Disable payment actions offline
  - Show "Requires internet" tooltip
  - Test in wallet page
  - Test in payment pages

- [~] 4.4 Update document actions
  - Disable download when offline
  - Disable signing when offline
  - Show appropriate messages
  - Test in documents page

**Files to Create**:
- `src/components/ui/offline-aware-button.tsx`

**Files to Modify**:
- `src/app/(dashboard)/manager/approvals/page.tsx`
- `src/app/(dashboard)/finance/payments/page.tsx`
- `src/app/(dashboard)/vendor/wallet/page.tsx`
- `src/app/(dashboard)/vendor/documents/page.tsx`

**Acceptance Criteria**:
- ✅ Buttons disabled when offline
- ✅ Tooltips explain why disabled
- ✅ Visual feedback (grayed out)
- ✅ Works across all pages
- ✅ Re-enables when online

---

## Phase 2: Offline Data Caching (Priority: HIGH)

### Task 5: Implement Auction Caching
**Priority**: HIGH
**Estimated Time**: 6 hours

#### Subtasks:
- [x] 5.1 Create cache service
  - Implement `CacheService` class
  - Add auction caching methods
  - Add cache expiry logic
  - Add auto-cleanup

- [x] 5.2 Extend IndexedDB schema
  - Add `cachedAuctions` store
  - Add indexes for queries
  - Implement migration
  - Test data persistence

- [x] 5.3 Create `useCachedAuctions` hook
  - Fetch from API when online
  - Cache responses
  - Load from cache when offline
  - Show "Last updated" timestamp

- [x] 5.4 Update auction list pages
  - Integrate caching hook
  - Show offline indicator
  - Show "Last updated" timestamp
  - Handle cache misses

- [x] 5.5 Add cache management UI
  - Show cache size
  - Add "Clear Cache" button
  - Show cached items count
  - Add refresh button

**Files to Create**:
- `src/features/cache/services/cache.service.ts`
- `src/hooks/use-cached-auctions.ts`
- `src/components/cache/cache-status.tsx`

**Files to Modify**:
- `src/lib/db/indexeddb.ts` (add cachedAuctions store)
- `src/app/(dashboard)/vendor/auctions/page.tsx`
- `src/app/(dashboard)/admin/auctions/page.tsx`

**Acceptance Criteria**:
- ✅ Auctions cached when viewed online
- ✅ Cached auctions available offline
- ✅ "Last updated" timestamp shown
- ✅ Cache expires after 24 hours
- ✅ Auto-cleanup of old cache

---

### Task 6: Implement Document Caching
**Priority**: HIGH
**Estimated Time**: 5 hours

#### Subtasks:
- [x] 6.1 Add document caching to cache service
  - Add document caching methods
  - Cache document metadata
  - Cache PDF URLs
  - Handle large files

- [x] 6.2 Extend IndexedDB schema
  - Add `cachedDocuments` store
  - Add indexes for queries
  - Implement migration
  - Test data persistence

- [x] 6.3 Create `useCachedDocuments` hook
  - Fetch from API when online
  - Cache responses
  - Load from cache when offline
  - Show offline badge

- [x] 6.4 Update documents page
  - Integrate caching hook
  - Show offline indicator
  - Disable download when offline
  - Show cached documents

**Files to Create**:
- `src/hooks/use-cached-documents.ts`

**Files to Modify**:
- `src/features/cache/services/cache.service.ts`
- `src/lib/db/indexeddb.ts` (add cachedDocuments store)
- `src/app/(dashboard)/vendor/documents/page.tsx`

**Acceptance Criteria**:
- ✅ Documents cached when viewed online
- ✅ Cached documents available offline
- ✅ Offline badge shown
- ✅ Download disabled when offline
- ✅ Cache expires after 7 days

---

### Task 7: Implement Wallet Caching
**Priority**: HIGH
**Estimated Time**: 5 hours

#### Subtasks:
- [x] 7.1 Add wallet caching to cache service
  - Add wallet caching methods
  - Cache balance
  - Cache last 20 transactions
  - Handle sensitive data

- [x] 7.2 Extend IndexedDB schema
  - Add `cachedWallet` store
  - Add indexes for queries
  - Implement migration
  - Test data persistence

- [x] 7.3 Create `useCachedWallet` hook
  - Fetch from API when online
  - Cache responses
  - Load from cache when offline
  - Show "Last synced" timestamp

- [x] 7.4 Update wallet page
  - Integrate caching hook
  - Show offline warning
  - Disable transactions when offline
  - Show "Last synced" timestamp

**Files to Create**:
- `src/hooks/use-cached-wallet.ts`

**Files to Modify**:
- `src/features/cache/services/cache.service.ts`
- `src/lib/db/indexeddb.ts` (add cachedWallet store)
- `src/app/(dashboard)/vendor/wallet/page.tsx`

**Acceptance Criteria**:
- ✅ Wallet data cached when viewed online
- ✅ Cached wallet available offline
- ✅ "Last synced" timestamp shown
- ✅ Transactions disabled when offline
- ✅ Cache expires after 1 hour

---

## Phase 3: Sync & Session Management (Priority: HIGH)

### Task 8: Add Sync Status Visibility
**Priority**: MEDIUM
**Estimated Time**: 4 hours

#### Subtasks:
- [~] 8.1 Create sync status header component
  - Show last sync timestamp
  - Show pending count badge
  - Add manual "Sync Now" button
  - Show sync progress

- [~] 8.2 Update existing sync status component
  - Enhance with more details
  - Add error display
  - Add retry button
  - Improve styling

- [~] 8.3 Add sync status to dashboard
  - Show in header
  - Show in sidebar
  - Update on sync events
  - Persist in sessionStorage

- [~] 8.4 Add per-item sync status
  - Show sync icon in lists
  - Show "Pending sync" badge
  - Show "Synced" checkmark
  - Show "Sync failed" error

**Files to Create**:
- `src/components/ui/sync-status-header.tsx`
- `src/components/ui/sync-status-badge.tsx`

**Files to Modify**:
- `src/components/ui/sync-status.tsx`
- `src/components/layout/dashboard-sidebar.tsx`

**Acceptance Criteria**:
- ✅ Last sync timestamp visible
- ✅ Pending count badge shown
- ✅ Manual sync button works
- ✅ Sync errors displayed
- ✅ Per-item status shown

---

### Task 9: Implement Background Sync Progress
**Priority**: MEDIUM
**Estimated Time**: 4 hours

#### Subtasks:
- [~] 9.1 Create sync progress toast
  - Show during sync
  - Display progress bar
  - Show current item
  - Auto-dismiss on complete

- [~] 9.2 Add sync notifications
  - Success notification
  - Error notification
  - Conflict notification
  - Retry option

- [~] 9.3 Update sync service
  - Emit progress events
  - Track current item
  - Calculate percentage
  - Handle errors

- [~] 9.4 Add sync indicator in header
  - Show spinning icon during sync
  - Show progress percentage
  - Clickable to show details
  - Hide when idle

**Files to Create**:
- `src/components/ui/sync-progress-toast.tsx`
- `src/components/ui/sync-notification.tsx`

**Files to Modify**:
- `src/features/cases/services/offline-sync.service.ts`
- `src/components/layout/dashboard-sidebar.tsx`

**Acceptance Criteria**:
- ✅ Toast shown during sync
- ✅ Progress bar updates
- ✅ Success notification shown
- ✅ Error notification with retry
- ✅ Header indicator visible

---

### Task 10: Create Conflict Resolution UI
**Priority**: MEDIUM
**Estimated Time**: 6 hours

#### Subtasks:
- [~] 10.1 Create conflict resolution modal
  - Side-by-side comparison
  - Highlight differences
  - Resolution buttons
  - Responsive design

- [~] 10.2 Implement diff highlighting
  - Compare local vs remote
  - Highlight changed fields
  - Show timestamps
  - Show user who made changes

- [~] 10.3 Add resolution handlers
  - Keep local version
  - Keep remote version
  - Manual merge (future)
  - Cancel action

- [~] 10.4 Integrate with sync service
  - Detect conflicts during sync
  - Show modal automatically
  - Apply resolution
  - Continue sync after resolution

**Files to Create**:
- `src/components/modals/conflict-resolution-modal.tsx`
- `src/components/ui/diff-viewer.tsx`
- `src/utils/diff-calculator.ts`

**Files to Modify**:
- `src/features/cases/services/offline-sync.service.ts`
- `src/hooks/use-offline-sync.ts`

**Acceptance Criteria**:
- ✅ Modal shows on conflict
- ✅ Both versions displayed
- ✅ Differences highlighted
- ✅ User can choose resolution
- ✅ Sync continues after resolution

---

### Task 11: Implement Offline Session Management
**Priority**: HIGH
**Estimated Time**: 8 hours

#### Subtasks:
- [~] 11.1 Create offline session service
  - Implement encryption/decryption
  - Use Web Crypto API
  - Derive keys securely
  - Handle key management

- [~] 11.2 Extend IndexedDB schema
  - Add `offlineSession` store
  - Add indexes for queries
  - Implement migration
  - Test data persistence

- [~] 11.3 Implement session caching
  - Cache on successful login
  - Encrypt session token
  - Store with expiry
  - Clear on logout

- [~] 11.4 Implement offline authentication
  - Retrieve cached session
  - Decrypt token
  - Validate expiry
  - Allow offline access

- [~] 11.5 Add session validation
  - Validate on reconnect
  - Force re-auth if invalid
  - Handle expired sessions
  - Clear invalid cache

- [~] 11.6 Add offline mode indicator
  - Show in header
  - Show "Offline Mode" badge
  - Show session expiry warning
  - Show re-auth prompt

**Files to Create**:
- `src/features/auth/services/offline-session.service.ts`
- `src/hooks/use-offline-session.ts`
- `src/components/auth/offline-mode-indicator.tsx`
- `src/utils/crypto-helpers.ts`

**Files to Modify**:
- `src/lib/db/indexeddb.ts` (add offlineSession store)
- `src/lib/auth/next-auth.config.ts`
- `src/middleware.ts`

**Acceptance Criteria**:
- ✅ Session cached securely
- ✅ Offline login works
- ✅ Session encrypted with AES-GCM
- ✅ Validates on reconnect
- ✅ Forces re-auth after 7 days
- ✅ Clears cache on logout

---

## Phase 4: Testing & Polish (Priority: MEDIUM)

### Task 12: Comprehensive Testing
**Priority**: MEDIUM
**Estimated Time**: 8 hours

#### Subtasks:
- [~] 12.1 Write unit tests
  - Cache service tests
  - Draft service tests
  - Encryption tests
  - Sync service tests

- [~] 12.2 Write integration tests
  - Online/offline transitions
  - Sync flow tests
  - Conflict resolution tests
  - Session management tests

- [~] 12.3 Write E2E tests
  - Complete offline workflow
  - Draft creation and resumption
  - Sync after reconnection
  - UI interaction tests

- [~] 12.4 Performance testing
  - Cache operation speed
  - Sync performance
  - Memory usage
  - Storage quota handling

**Files to Create**:
- `tests/unit/services/cache.service.test.ts`
- `tests/unit/services/draft.service.test.ts`
- `tests/unit/services/offline-session.service.test.ts`
- `tests/integration/offline/complete-workflow.test.ts`
- `tests/e2e/offline-first.spec.ts`

**Acceptance Criteria**:
- ✅ 80%+ code coverage
- ✅ All critical paths tested
- ✅ Performance benchmarks met
- ✅ No memory leaks
- ✅ All tests passing

---

### Task 13: Performance Optimization
**Priority**: MEDIUM
**Estimated Time**: 4 hours

#### Subtasks:
- [~] 13.1 Optimize cache operations
  - Add lazy loading
  - Implement pagination
  - Add request batching
  - Optimize queries

- [~] 13.2 Optimize sync operations
  - Batch sync requests
  - Implement delta sync
  - Add compression
  - Optimize payload size

- [~] 13.3 Memory optimization
  - Clear unused cache
  - Limit cache size
  - Monitor memory usage
  - Implement cleanup

- [~] 13.4 Network optimization
  - Compress requests
  - Use delta updates
  - Implement request queuing
  - Add retry logic

**Acceptance Criteria**:
- ✅ Cache operations < 100ms
- ✅ Sync completes < 30s for 10 items
- ✅ Memory usage < 100MB
- ✅ Storage usage < 50MB per store
- ✅ No UI blocking

---

### Task 14: Security Audit
**Priority**: HIGH
**Estimated Time**: 4 hours

#### Subtasks:
- [~] 14.1 Review encryption implementation
  - Verify AES-GCM usage
  - Check key derivation
  - Verify IV uniqueness
  - Test encryption strength

- [~] 14.2 Review session management
  - Check token storage
  - Verify expiry handling
  - Test re-authentication
  - Check logout cleanup

- [~] 14.3 Review data protection
  - Check for sensitive data leaks
  - Verify localStorage usage
  - Check console logging
  - Test data cleanup

- [~] 14.4 Penetration testing
  - Test XSS vulnerabilities
  - Test CSRF protection
  - Test session hijacking
  - Test data extraction

**Acceptance Criteria**:
- ✅ No sensitive data in localStorage
- ✅ All session data encrypted
- ✅ Keys stored in memory only
- ✅ No security vulnerabilities
- ✅ Passes security audit

---

### Task 15: Documentation
**Priority**: MEDIUM
**Estimated Time**: 4 hours

#### Subtasks:
- [~] 15.1 Write user documentation
  - Offline features guide
  - Draft auto-save guide
  - Sync troubleshooting
  - FAQ section

- [~] 15.2 Write developer documentation
  - Architecture overview
  - API documentation
  - Integration guide
  - Testing guide

- [~] 15.3 Write deployment guide
  - Migration steps
  - Configuration options
  - Monitoring setup
  - Rollback procedures

- [~] 15.4 Create video tutorials
  - Offline workflow demo
  - Draft auto-save demo
  - Conflict resolution demo
  - Admin features demo

**Files to Create**:
- `docs/offline-first/USER_GUIDE.md`
- `docs/offline-first/DEVELOPER_GUIDE.md`
- `docs/offline-first/DEPLOYMENT_GUIDE.md`
- `docs/offline-first/TROUBLESHOOTING.md`

**Acceptance Criteria**:
- ✅ Complete user guide
- ✅ Complete developer guide
- ✅ Deployment guide ready
- ✅ Video tutorials created
- ✅ FAQ section complete

---

## Summary

### Total Estimated Time: 72 hours (9 days)

### Priority Breakdown:
- **CRITICAL**: 2 hours (Task 1)
- **HIGH**: 38 hours (Tasks 2, 3, 5, 6, 7, 11, 14)
- **MEDIUM**: 32 hours (Tasks 4, 8, 9, 10, 12, 13, 15)

### Phase Timeline:
- **Phase 1**: 14 hours (2 days)
- **Phase 2**: 16 hours (2 days)
- **Phase 3**: 22 hours (3 days)
- **Phase 4**: 20 hours (2 days)

### Dependencies:
- Task 2 depends on Task 1 (UI fixes first)
- Tasks 5, 6, 7 can run in parallel
- Task 8, 9, 10 depend on existing sync service
- Task 11 is independent
- Task 12, 13, 14, 15 run after all features complete

### Risk Mitigation:
- Start with critical UI fixes (Task 1)
- Implement draft auto-save early (Task 2)
- Test encryption thoroughly (Task 11)
- Continuous testing throughout (Task 12)
- Security audit before deployment (Task 14)
