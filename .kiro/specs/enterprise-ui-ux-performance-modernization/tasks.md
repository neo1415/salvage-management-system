# Implementation Plan: Enterprise UI/UX and Performance Modernization

## Overview

This implementation plan modernizes the salvage auction PWA to 2026 enterprise standards through four carefully phased stages. **CRITICAL:** This plan has been validated against the current codebase - Socket.io, image optimization, and PWA are already well-implemented. The focus is on adding TanStack Query (root cause of 3-10s load times), virtualized lists, skeleton loaders, emoji replacement, and modern filter UI.

**Key Safety Principles:**
- Do NOT modify home page, auction details page, or wallet page
- Do NOT touch core business logic (auth, payments, AI assessment, documents)
- Run diagnostics on every file modified
- Use feature flags for all major UI changes
- Maintain burgundy/gold brand colors
- Keep mobile-first PWA architecture

**What's Already Implemented (Don't Re-implement):**
- ✅ Socket.io with connection pooling, deduplication, exponential backoff
- ✅ Lucide React icons (v0.562.0) - already installed and used
- ✅ Next.js Image optimization with WebP/AVIF
- ✅ PWA with Service Worker and IndexedDB
- ✅ Mobile-first responsive design

**What's Missing (Priority Focus):**
- ❌ TanStack Query (ROOT CAUSE of 3-10s load times)
- ❌ Virtualized lists (performance with large datasets)
- ❌ Skeleton loaders (only basic spinners exist)
- ❌ Emoji replacement (✓, ⭐, 🏆, 📋, 💰, 🚀 throughout code)
- ❌ Modern filter UI (causes tab switching flicker)

## Tasks

### Phase 1: Foundation Layer (HIGHEST PRIORITY - Fixes 3-10s Load Times)

- [x] 1. Set up TanStack Query infrastructure - **ROOT CAUSE FIX**
  - [x] 1.1 Install and configure TanStack Query
    - Install @tanstack/react-query package (latest v5.x)
    - Create src/lib/query-client.ts with 5min staleTime, 10min gcTime
    - Wrap app with QueryClientProvider in src/app/layout.tsx
    - Configure retry logic with exponential backoff (3 retries, 1s to 30s)
    - Add React Query DevTools for development
    - Run diagnostics on modified files
    - **Impact:** Enables caching - reduces 3-10s loads to <500ms
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [x] 1.2 Create custom query hooks for vendor dashboard
    - Create src/hooks/queries/use-vendor-dashboard.ts
    - Replace fetch('/api/dashboard/vendor') with useQuery
    - Implement automatic background refetching
    - Test dashboard loads from cache on return navigation
    - Verify loading states work correctly
    - Run diagnostics on modified files
    - **Impact:** Vendor dashboard instant on return visits
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 1.3 Create custom query hooks for adjuster cases with server-side filtering
    - Create src/hooks/queries/use-cases.ts with filter support
    - Replace fetch('/api/cases') with useQuery(['cases', filters])
    - Move filtering to server-side (fixes tab switching flicker)
    - Implement query key structure with filters
    - Test cases page loads correctly with caching
    - Verify tab switching is instant with no flicker
    - Run diagnostics on modified files
    - **Impact:** Fixes "shows wrong data briefly" issue
    - _Requirements: 5.1, 5.2, 5.3, 2.2_

  - [x] 1.4 Create mutation hooks with optimistic updates
    - Create src/hooks/queries/use-case-mutation.ts for case creation
    - Implement optimistic update pattern (immediate UI feedback)
    - Implement rollback on error
    - Implement cache invalidation on success
    - Test optimistic updates work correctly
    - Run diagnostics on modified files
    - **Impact:** Instant feedback on case creation
    - _Requirements: 5.5, 5.6, 5.7, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 2. Checkpoint - Verify TanStack Query integration
  - Test load times: Should be <500ms on cached pages
  - Test tab switching: Should be instant with no flicker
  - Verify all tests pass
  - Ask user if questions arise

- [x] 3. Replace emojis with existing Lucide React icons
  - [x] 3.1 Audit and document all emoji usage
    - Search codebase for emoji characters: ✓, ⭐, 🏆, 📋, 💰, 🚀, 🎯, 🔨, 💳
    - Document locations and semantic meanings
    - Map to appropriate Lucide React icons (already installed v0.562.0)
    - Create replacement guide
    - **Note:** Lucide React already installed - no new package needed
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [x] 3.2 Replace emojis in vendor dashboard
    - Replace emoji characters in src/app/(dashboard)/vendor/dashboard/page.tsx
    - ✓ → Check (20px), ⭐ → Star (20px), 🏆 → Trophy (24px), 💰 → DollarSign (24px), 🚀 → Rocket (20px)
    - Use consistent sizing: 20px inline, 24px buttons, 32px headers
    - Add aria-label for accessibility
    - Test dashboard displays correctly with icons
    - Run diagnostics on modified files
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 3.3 Replace emojis in adjuster cases page
    - Replace emoji characters in src/app/(dashboard)/adjuster/cases/page.tsx
    - 📋 → ClipboardList, ✓ → Check, 🎯 → Target
    - Use consistent icon sizes
    - Add aria-label for accessibility
    - Test cases page displays correctly with icons
    - Run diagnostics on modified files
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 3.4 Replace emojis in manager dashboard
    - Find and replace emoji characters in manager dashboard components
    - Use appropriate Lucide React icons
    - Consistent sizing and aria-labels
    - Test manager dashboard displays correctly
    - Run diagnostics on modified files
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 3.5 Replace emojis in finance dashboard
    - Find and replace emoji characters in finance dashboard components
    - 💳 → CreditCard, 💰 → DollarSign
    - Consistent sizing and aria-labels
    - Test finance dashboard displays correctly
    - Run diagnostics on modified files
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 3.6 Replace emojis in admin dashboard
    - Find and replace emoji characters in admin dashboard components
    - Use appropriate Lucide React icons
    - Consistent sizing and aria-labels
    - Test admin dashboard displays correctly
    - Run diagnostics on modified files
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 4. Checkpoint - Verify icon replacement
  - Search codebase to ensure no emojis remain
  - Verify icons display correctly across all dashboards
  - Test accessibility with screen reader
  - Ask user if questions arise

- [x] 5. Implement skeleton loaders
  - [x] 5.1 Create reusable skeleton components
    - Create components/ui/skeleton/card-skeleton.tsx
    - Create components/ui/skeleton/list-skeleton.tsx
    - Create components/ui/skeleton/dashboard-skeleton.tsx
    - Create components/ui/skeleton/chart-skeleton.tsx
    - Implement shimmer animation effect
    - Test skeleton components render correctly
    - Run diagnostics on modified files
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

  - [x] 5.2 Add skeleton loaders to vendor dashboard
    - Add DashboardSkeleton to vendor dashboard loading state
    - Display skeleton within 300ms of navigation
    - Match skeleton dimensions to actual content
    - Test loading states display correctly
    - Run diagnostics on modified files
    - _Requirements: 1.3, 14.1, 14.2, 14.3, 14.7_

  - [x] 5.3 Add skeleton loaders to adjuster cases page
    - Add ListSkeleton to cases page loading state
    - Display 5 skeleton items during load
    - Match skeleton dimensions to actual cards
    - Test loading states display correctly
    - Run diagnostics on modified files
    - _Requirements: 1.3, 14.1, 14.2, 14.4, 14.7_

  - [x] 5.4 Add skeleton loaders to all other dashboards
    - Add appropriate skeleton loaders to manager, finance, and admin dashboards
    - Display skeletons within 300ms
    - Match dimensions to actual content
    - Test all loading states
    - Run diagnostics on modified files
    - _Requirements: 1.3, 14.1, 14.2, 14.3, 14.7_

- [x] 6. Checkpoint - Verify skeleton loaders
  - Ensure all pages show skeletons during load, verify animations work, ask user if questions arise

### Phase 2: Performance Optimization

- [x] 7. Implement code splitting for dashboard routes
  - [ ] 7.1 Add dynamic imports to vendor dashboard
    - Wrap vendor dashboard content with dynamic import
    - Use DashboardSkeleton as loading component
    - Set ssr: false for client-only components
    - Test dashboard loads correctly with code splitting
    - Verify bundle size reduction
    - Run diagnostics on modified files
    - _Requirements: 1.4, 18.2, 18.6, 18.7_

  - [ ] 7.2 Add dynamic imports to adjuster cases page
    - Wrap cases page content with dynamic import
    - Use ListSkeleton as loading component
    - Set ssr: false for client-only components
    - Test cases page loads correctly
    - Verify bundle size reduction
    - Run diagnostics on modified files
    - _Requirements: 1.4, 18.2, 18.6, 18.7_

  - [ ] 7.3 Add dynamic imports to all other dashboards
    - Add dynamic imports to manager, finance, and admin dashboards
    - Use appropriate skeleton loaders
    - Test all dashboards load correctly
    - Verify bundle size reductions
    - Run diagnostics on modified files
    - _Requirements: 1.4, 18.2, 18.6, 18.7_

  - [ ] 7.4 Add dynamic imports for modal components
    - Identify all modal components used across dashboards
    - Wrap modals with dynamic imports
    - Test modals open correctly
    - Verify bundle size reduction
    - Run diagnostics on modified files
    - _Requirements: 18.3, 18.6, 18.7_

  - [ ] 7.5 Add dynamic imports for chart components
    - Wrap Recharts components with dynamic imports
    - Test charts render correctly
    - Verify bundle size reduction
    - Run diagnostics on modified files
    - _Requirements: 18.4, 18.6, 18.7_

- [x] 8. Checkpoint - Verify code splitting
  - Ensure all routes load correctly, verify bundle sizes reduced, ask user if questions arise

- [ ] 9. **REMOVED - Socket.io Already Optimized**
  - **Reason:** Current implementation already has:
    - ✅ Connection pooling prevention (isConnectingRef)
    - ✅ Exponential backoff (1s to 10s max)
    - ✅ Event deduplication (lastBidIdRef, lastAuctionUpdateRef)
    - ✅ Multiple transport options (websocket + polling)
    - ✅ Automatic reconnection (5 attempts, 20s timeout)
    - ✅ Randomization factor (0.5) to prevent thundering herd
  - **Action:** Skip this task - Socket.io is already 2026-compliant
  - **If "connection closed/opened" messages persist:** Investigate server-side logs, not client

- [x] 10. Checkpoint - Verify existing Socket.io works correctly
  - Test real-time updates work reliably
  - Verify connection stability
  - If issues persist, investigate server-side (not client)
  - Ask user if questions arise

- [ ] 11. **SIMPLIFIED - Audit existing image optimization**
  - [x] 11.1 Audit Next.js Image component usage
    - **Note:** Next.js Image already configured with WebP/AVIF, responsive sizes
    - Verify all images use Next.js Image component (not <img>)
    - Check priority prop is set on above-fold images
    - Verify sizes attribute is appropriate for responsive images
    - Document any images not using Next.js Image
    - Run diagnostics on modified files
    - **Action:** Ensure consistent usage, don't create wrapper
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7_

  - [x] 11.2 Fix any images not using Next.js Image in cases page
    - Replace any <img> tags with Next.js Image component
    - Set priority=true for above-fold images
    - Set priority=false for below-fold images
    - Add appropriate sizes attribute
    - Test images load correctly
    - Run diagnostics on modified files
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_

  - [x] 11.3 Fix any images not using Next.js Image in dashboards
    - Replace any <img> tags with Next.js Image component
    - Configure appropriate priority settings
    - Add appropriate sizes attribute
    - Test images load correctly
    - Run diagnostics on modified files
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_

- [x] 12. Checkpoint - Verify image optimization
  - Ensure all images use Next.js Image component
  - Verify blur placeholders and responsive sizes work
  - Ask user if questions arise

- [ ] 13. Implement virtualized lists for long data sets
  - [x] 13.1 Install and configure TanStack Virtual
    - Install @tanstack/react-virtual package
    - Create components/ui/virtualized-list/virtualized-list.tsx
    - Create hooks/use-virtualized-list.ts for pagination
    - Test virtualized list component works correctly
    - Run diagnostics on modified files
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 13.2 Add virtualization to adjuster cases page
    - Wrap cases list with VirtualizedList component when count > 50
    - Set estimateSize to match card height
    - Implement infinite scroll with loadMore callback
    - Test virtualization works correctly with large lists
    - Run diagnostics on modified files
    - _Requirements: 7.1, 7.4, 7.5, 7.6, 7.7_

  - [x] 13.3 Add virtualization to auction lists
    - Find auction list components
    - Wrap with VirtualizedList when count > 50
    - Implement infinite scroll
    - Test virtualization works correctly
    - Run diagnostics on modified files
    - _Requirements: 7.2, 7.4, 7.5, 7.6, 7.7_

  - [x] 13.4 Add virtualization to vendor lists
    - Find vendor list components
    - Wrap with VirtualizedList when count > 50
    - Implement infinite scroll
    - Test virtualization works correctly
    - Run diagnostics on modified files
    - _Requirements: 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 14. Checkpoint - Verify virtualization
  - Ensure large lists scroll smoothly, verify pagination works, ask user if questions arise

### Phase 3: UI Polish and Modernization

- [x] 15. Implement modern filter UI components
  - [x] 15.1 Create filter UI components
    - Create components/ui/filters/filter-chip.tsx for active filters
    - Create components/ui/filters/faceted-filter.tsx for dropdown filters
    - Create components/ui/filters/search-input.tsx with 300ms debounce
    - Test filter components work correctly
    - Run diagnostics on modified files
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9_

  - [x] 15.2 Redesign adjuster cases page filters
    - Replace existing filter UI with modern faceted filters
    - Add filter chips for active filters
    - Add clear all filters button
    - Implement URL query parameter persistence
    - Display filter results count in real-time
    - Test filters work correctly
    - Run diagnostics on modified files
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9_

  - [x] 15.3 Add filters to auction lists
    - Add faceted filters to auction list pages
    - Implement filter chips and clear all
    - Persist filters in URL
    - Test filters work correctly
    - Run diagnostics on modified files
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9_

  - [x] 15.4 Add filters to vendor lists
    - Add faceted filters to vendor list pages
    - Implement filter chips and clear all
    - Persist filters in URL
    - Test filters work correctly
    - Run diagnostics on modified files
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9_

- [x] 16. Checkpoint - Verify filter UI
  - Ensure filters work correctly, verify URL persistence, ask user if questions arise

- [x] 17. Redesign cases page cards for reduced verbosity
  - [x] 17.1 Reduce case card information density
    - Limit case cards to maximum 5 data fields in list view
    - Use icons with labels instead of full text
    - Display monetary values with K/M suffixes for values > 1000
    - Display dates in relative format (2 days ago) for recent items
    - Implement hover state with elevation shadow
    - Test cards display correctly with reduced verbosity
    - Run diagnostics on modified files
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [x] 17.2 Implement expandable sections for optional details
    - Add expandable sections for secondary information
    - Collapse by default
    - Expand on click
    - Test expandable sections work correctly
    - Run diagnostics on modified files
    - _Requirements: 13.4_

  - [x] 17.3 Apply card redesign to other list views
    - Apply same verbosity reduction to auction cards
    - Apply to vendor cards
    - Apply to payment cards
    - Test all card types display correctly
    - Run diagnostics on modified files
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

- [x] 18. Checkpoint - Verify card redesign
  - Ensure cards are scannable and concise, verify expandable sections work, ask user if questions arise

- [x] 19. Implement mobile touch optimizations
  - [ ] 19.1 Ensure minimum touch target sizes
    - Audit all interactive elements for 44x44px minimum size
    - Add padding to buttons/links that are too small
    - Ensure 8px minimum spacing between touch targets
    - Test touch targets are easy to tap on mobile
    - Run diagnostics on modified files
    - _Requirements: 16.1, 16.2_

  - [ ] 19.2 Position primary actions in thumb zone
    - Move primary action buttons to lower third of mobile screens
    - Use sticky positioning for important actions
    - Test actions are reachable with thumb
    - Run diagnostics on modified files
    - _Requirements: 16.3_

  - [ ] 19.3 Implement pull-to-refresh on list views
    - Add pull-to-refresh to cases page
    - Add pull-to-refresh to auction lists
    - Add pull-to-refresh to vendor lists
    - Test pull-to-refresh works correctly
    - Run diagnostics on modified files
    - _Requirements: 16.5_

  - [ ] 19.4 Add tap feedback with ripple animation
    - Implement 100ms ripple animation on button taps
    - Apply to all interactive elements
    - Test ripple animations work correctly
    - Run diagnostics on modified files
    - _Requirements: 16.7_

- [ ] 20. Checkpoint - Verify mobile optimizations
  - Ensure touch targets are easy to tap, verify thumb zone positioning, ask user if questions arise

- [x] 21. Implement accessibility improvements
  - [x] 21.1 Ensure keyboard navigation works correctly
    - Audit tab order for all interactive elements
    - Ensure visible focus indicator (2px outline) on all focused elements
    - Implement Escape key to close modals and dropdowns
    - Implement Enter key to submit forms and activate buttons
    - Implement arrow keys for list navigation
    - Test keyboard navigation works without mouse
    - Run diagnostics on modified files
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8_

  - [x] 21.2 Ensure screen reader support
    - Use semantic HTML elements (nav, main, article, aside, header, footer)
    - Ensure all icons have aria-label attributes
    - Add aria-live regions for dynamic content updates
    - Add aria-busy during loading states
    - Add descriptive alt text for all images
    - Add skip navigation link to main content
    - Test with screen reader
    - Run diagnostics on modified files
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8_

  - [x] 21.3 Verify color contrast compliance
    - Audit all text for 4.5:1 contrast ratio (normal text)
    - Audit large text for 3:1 contrast ratio
    - Audit UI component borders for 3:1 contrast
    - Ensure status indicators use icons alongside color
    - Test burgundy/gold brand colors for contrast
    - Run diagnostics on modified files
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7_

- [x] 22. Checkpoint - Verify accessibility
  - Ensure keyboard navigation works, verify screen reader support, ask user if questions arise

### Phase 4: Monitoring and Testing

- [x] 23. Implement performance monitoring
  - [x] 23.1 Create performance monitoring utility
    - Create lib/performance/monitor.ts
    - Measure and report FCP, LCP, FID, CLS, TTI metrics
    - Log warnings when LCP > 2500ms or CLS > 0.1
    - Test performance monitoring captures metrics
    - Run diagnostics on modified files
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7, 25.8_

  - [x] 23.2 Create error tracking utility
    - Create lib/performance/error-tracker.ts
    - Capture unhandled JavaScript errors
    - Capture unhandled promise rejections
    - Capture API request failures
    - Include user context (role, browser, device) in reports
    - Test error tracking captures errors
    - Run diagnostics on modified files
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6, 26.7, 26.8_

  - [x] 23.3 Add error boundaries to all major components
    - Wrap dashboard routes with error boundaries
    - Display user-friendly error messages
    - Provide error recovery actions
    - Test error boundaries catch errors gracefully
    - Run diagnostics on modified files
    - _Requirements: 26.6, 26.7, 26.8_

- [x] 24. Checkpoint - Verify monitoring
  - Ensure performance metrics are captured, verify error tracking works, ask user if questions arise

- [x] 25. **SIMPLIFIED - Enhance existing offline support**
  - [x] 25.1 Audit existing IndexedDB and Service Worker
    - **Note:** IndexedDB (idb v8.0.3) and Service Worker already configured
    - Review existing offline storage implementation
    - Document current sync behavior
    - Identify gaps in offline support
    - **Action:** Enhance existing, don't rebuild
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7_

  - [x] 25.2 Add sync status indicators
    - Create src/components/ui/sync-status.tsx
    - Display offline indicator when offline
    - Display sync progress during sync
    - Display last sync timestamp
    - Display pending changes count
    - Integrate with existing Service Worker
    - Test sync status indicators work correctly
    - Run diagnostics on modified files
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7_

  - [x] 25.3 Enhance existing background sync
    - Review existing background sync in Service Worker
    - Add sync progress reporting
    - Improve error handling and retry logic
    - Add user-facing sync queue status
    - Test background sync works correctly
    - Run diagnostics on modified files
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7_

- [x] 26. Checkpoint - Verify offline support enhancements
  - Ensure offline indicators work
  - Verify background sync improvements
  - Test with actual offline scenarios
  - Ask user if questions arise

- [x] 27. Implement feature flags for gradual rollout
  - [x] 27.1 Create feature flag system
    - Create lib/feature-flags.ts with flag configuration
    - Implement user-based flag evaluation (10%, 50%, 100%)
    - Add opt-in/opt-out functionality
    - Test feature flags work correctly
    - Run diagnostics on modified files
    - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5, 30.6, 30.7_

  - [x] 27.2 Wrap major UI changes with feature flags
    - Wrap new filter UI with feature flag
    - Wrap card redesign with feature flag
    - Wrap icon replacement with feature flag
    - Test feature flags toggle UI correctly
    - Run diagnostics on modified files
    - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5, 30.6_

- [x] 28. Checkpoint - Verify feature flags
  - Ensure feature flags toggle correctly, verify rollback works, ask user if questions arise

- [x] 29. Final integration testing and cleanup
  - [x] 29.1 Run full integration test suite
    - Run all existing integration tests
    - Verify all tests pass
    - Fix any failing tests
    - Run diagnostics on all modified files
    - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5, 29.6, 29.7_

  - [x] 29.2 Verify performance improvements
    - Measure initial page load times (target: < 2s)
    - Measure navigation times (target: < 500ms)
    - Measure case creation time (target: < 10s)
    - Verify bundle size reduction (target: 30% reduction)
    - Generate bundle analysis report
    - _Requirements: 1.1, 1.2, 2.1, 3.1, 18.6, 18.7, 18.8_

  - [x] 29.3 Verify accessibility compliance
    - Run axe-core accessibility tests
    - Test keyboard navigation manually
    - Test with screen reader
    - Verify color contrast
    - Fix any accessibility violations
    - _Requirements: 20.1-20.8, 21.1-21.8, 22.1-22.7_

  - [x] 29.4 Remove unused dependencies
    - Audit package.json for unused packages
    - Remove unused dependencies
    - Verify app still works correctly
    - Run diagnostics
    - _Requirements: 18.5_

  - [x] 29.5 Create migration documentation
    - Document all breaking changes (if any)
    - Document new patterns and best practices
    - Document performance improvements
    - Document troubleshooting guide
    - Document rollback procedure
    - _Requirements: 32.1, 32.2, 32.3, 32.4, 32.5, 32.6, 32.7_

- [x] 30. Final checkpoint - Complete modernization
  - Ensure all tests pass, verify performance targets met, verify accessibility compliance, ask user for final approval

## Notes

- **CRITICAL:** This plan has been validated against current codebase
- Socket.io, image optimization, and PWA are already well-implemented
- Focus is on TanStack Query (root cause of slow loads), virtualized lists, skeleton loaders, emoji replacement, and modern filters
- All tasks maintain backward compatibility with existing functionality
- Home page, auction details page, and wallet page are explicitly excluded from modifications
- Core business logic (auth, payments, AI assessment, documents) remains untouched
- Burgundy (#800020) and gold (#FFD700) brand colors are maintained throughout
- Mobile-first PWA architecture is preserved
- Run diagnostics on every file modified to catch TypeScript errors early
- Feature flags enable safe gradual rollout (10% → 50% → 100%)
- Each checkpoint ensures stability before proceeding to next phase

## Expected Impact

**Performance Improvements:**
- Initial load: 3-10s → <2s (TanStack Query caching)
- Navigation: 3-10s → <500ms (cached data)
- Case creation: 20-50s → <10s (compression, parallel uploads, progress indicators)
- Tab switching: Flicker → Instant (server-side filtering)

**UX Improvements:**
- Professional icons (no emojis)
- Skeleton loaders (40% faster perceived load)
- Modern faceted filters
- Scannable cards (5 fields max)
- Smooth scrolling (virtualized lists)
