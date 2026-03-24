# Implementation Plan: System Cleanup and Polish

## Overview

This implementation plan addresses 22 identified issues across the salvage management system through surgical fixes targeting data integrity, UI/UX improvements, export functionality, pagination, and PDF standardization. The approach creates reusable services (ExportService, PaginationService, SearchFilterService) and applies them consistently across all affected components.

## Tasks

- [x] 1. Create core reusable services
  - [x] 1.1 Create AuctionStatusService for real-time status determination
    - Implement `getAuctionStatus()` method that checks endTime against current time
    - Implement `isAuctionActive()` helper method
    - Add TypeScript interfaces for auction status types
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [ ]* 1.2 Write property test for AuctionStatusService
    - **Property 1: Auction Status Real-Time Determination**
    - **Validates: Requirements 1.1, 1.2, 1.3**
  
  - [x] 1.3 Create SearchFilterService for case-insensitive partial matching
    - Implement `buildSearchCondition()` method with SQL generation
    - Implement `buildMultiSelectFilter()` method with OR logic
    - Add field mapping configurations for different entity types
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2_
  
  - [ ]* 1.4 Write property tests for SearchFilterService
    - **Property 10: Case-Insensitive Partial Search**
    - **Property 15: Multi-Category Filter OR Logic**
    - **Validates: Requirements 7.1, 8.1, 8.6**
  
  - [x] 1.5 Create PaginationService for consistent pagination logic
    - Implement `getPaginationMeta()` method for metadata calculation
    - Implement `getOffset()` method for database queries
    - Implement `validateParams()` method for input sanitization
    - _Requirements: 18.2, 18.4, 19.2, 19.4, 20.2, 20.4_
  
  - [ ]* 1.6 Write property test for PaginationService
    - **Property 26: Pagination Metadata Accuracy**
    - **Validates: Requirements 18.4, 19.4, 20.4**
  
  - [x] 1.7 Create PDFTemplateService for standardized letterhead/footer
    - Extract letterhead function from existing pdf-generation.service.ts
    - Extract footer function from existing pdf-generation.service.ts
    - Implement `addLetterhead()` method with NEM branding
    - Implement `addFooter()` method with company details
    - Implement `getMaxContentY()` helper for content positioning
    - _Requirements: 21.1, 21.2, 21.3, 21.4_
  
  - [x] 1.8 Create ExportService for CSV and PDF generation
    - Implement `generateCSV()` method with RFC 4180 compliance
    - Implement `escapeCSVField()` private method for proper escaping
    - Implement `generatePDF()` method using PDFTemplateService
    - Add TypeScript interfaces for ExportColumn and ExportOptions
    - _Requirements: 12.2, 12.3, 23.1, 23.2, 23.3_
  
  - [ ]* 1.9 Write property tests for ExportService
    - **Property 35: CSV RFC 4180 Compliance**
    - **Property 38: CSV Round-Trip Preservation**
    - **Validates: Requirements 23.1, 23.2, 23.5**

- [x] 2. Fix data integrity and logic bugs
  - [x] 2.1 Update all case list components to use AuctionStatusService
    - Update adjuster my-cases page to call getAuctionStatus()
    - Update manager cases page to call getAuctionStatus()
    - Update admin cases page to call getAuctionStatus()
    - Update case card components to display real-time status
    - _Requirements: 1.2, 1.3, 1.6_
  
  - [x] 2.2 Fix case creation redirect to /adjuster/my-cases
    - Update case creation API response to return correct redirect URL
    - Update frontend case creation handler to redirect to /adjuster/my-cases
    - Add success message display after redirect
    - Ensure newly created case appears at top of list
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [ ]* 2.3 Write property test for case list ordering
    - **Property 2: Case List Ordering After Creation**
    - **Validates: Requirements 2.4**
  
  - [x] 2.4 Fix fraud alert count query and cache invalidation
    - Update admin dashboard fraud alert query to exclude dismissed/resolved
    - Add cache invalidation on fraud alert creation
    - Add cache invalidation on fraud alert dismissal
    - Set cache TTL to 5 minutes
    - _Requirements: 3.1, 3.2, 3.4, 3.6_
  
  - [ ]* 2.5 Write property tests for fraud alert system
    - **Property 3: Fraud Alert Count Consistency**
    - **Property 4: Fraud Alert Filtering**
    - **Property 5: Cache Invalidation on Fraud Alert Changes**
    - **Validates: Requirements 3.1, 3.3, 3.4, 3.6**
  
  - [x] 2.6 Implement Payment Aging report
    - Create report API endpoint at /api/reports/payment-aging
    - Implement aging bucket calculation (0-7, 8-14, 15-21, 22+ days)
    - Include columns: payment status, amount, due date, days overdue
    - Add error handling with specific error messages
    - _Requirements: 4.2, 4.3, 4.6_
  
  - [ ]* 2.7 Write property test for Payment Aging report
    - **Property 6: Payment Aging Report Structure**
    - **Validates: Requirements 4.2, 4.3**
  
  - [x] 2.8 Replace dollar signs with Naira symbol in finance dashboard
    - Update all currency display components to use ₦ symbol
    - Update currency formatting function to format as "₦X,XXX,XXX.XX"
    - Remove DollarSign icon imports and replace with generic currency icon
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [ ]* 2.9 Write property test for currency formatting
    - **Property 8: Currency Symbol Consistency**
    - **Validates: Requirements 5.1, 5.3**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [-] 4. Implement UI/UX fixes
  - [x] 4.1 Remove "Send Notification" button from auction management
    - Remove button from auction management page UI
    - Verify automatic notifications are sent after document generation
    - Add "Notifications Sent" status indicator
    - Add "Retry Notification" button for failed notifications only
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 4.2 Fix search functionality across all entity types
    - Update auction search to search assetDetails JSON fields (make, model, description)
    - Update case search to search claimReference, assetType, assetDetails
    - Update vendor search to search company name, email, phone number
    - Update user search to search name, email, role
    - Implement case-insensitive partial matching using SearchFilterService
    - Add "No results found" message when search returns empty
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.7_
  
  - [ ]* 4.3 Write property tests for search functionality
    - **Property 11: Auction Search Field Coverage**
    - **Property 12: Case Search Field Coverage**
    - **Property 13: Vendor Search Field Coverage**
    - **Property 14: User Search Field Coverage**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.5**
  
  - [x] 4.4 Fix multi-category filter to use OR logic
    - Update filter logic to use SearchFilterService.buildMultiSelectFilter()
    - Change from AND logic to OR logic for category selection
    - Display count of active filters
    - Add "Clear all filters" button
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [x] 4.5 Fix location filter with partial matching
    - Implement case-insensitive partial matching for location search
    - Add location autocomplete suggestions from database
    - Ensure location filter combines with other filters using AND logic
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  
  - [ ]* 4.6 Write property tests for filter logic
    - **Property 17: Location Partial Matching**
    - **Property 19: Combined Filter Application**
    - **Validates: Requirements 9.1, 9.4**
  
  - [x] 4.7 Enhance auction cards to show specific asset names
    - Extract asset name from assetDetails for vehicles: "{make} {model} {year}"
    - Extract asset name from assetDetails for electronics/property: item name
    - Fall back to "{assetType} - {claimReference}" if specific name unavailable
    - Truncate asset names to 50 characters with ellipsis
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [ ]* 4.8 Write property tests for asset name extraction
    - **Property 20: Asset Name Extraction for Vehicles**
    - **Property 21: Asset Name Extraction for Other Types**
    - **Property 22: Asset Name Truncation**
    - **Validates: Requirements 10.2, 10.3, 10.5**
  
  - [x] 4.9 Fix notification dropdown alignment
    - Update notification UI to position dropdown relative to bell icon
    - Ensure dropdown is fully visible on mobile devices
    - Align dropdown below and to the right of bell icon on desktop
    - Prevent dropdown from being cut off by screen edges
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [-] 6. Implement export functionality for all pages
  - [x] 6.1 Add export to Finance Payments page
    - Add "Export" dropdown button with CSV and PDF options
    - Implement CSV export with columns: Payment ID, Auction ID, Vendor Name, Amount, Status, Payment Method, Created Date, Verified Date
    - Implement PDF export using ExportService and PDFTemplateService
    - Respect current filters and search when exporting
    - Set filename as "finance-payments-{date}.{format}"
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.7_
  
  - [ ]* 6.2 Write property tests for Finance Payments export
    - **Property 23: CSV Export Data Completeness**
    - **Property 24: PDF Export Template Consistency**
    - **Property 25: Export Filename Format**
    - **Validates: Requirements 12.2, 12.3, 12.4, 12.5, 12.7**
  
  - [x] 6.3 Add export to Cases Created page
    - Add "Export" dropdown button with CSV and PDF options
    - Implement CSV export with columns: Claim Reference, Asset Type, Status, Created Date, Adjuster Name, Market Value, Reserve Price, Location
    - Implement PDF export using ExportService and PDFTemplateService
    - Respect status filters and search when exporting
    - Set filename as "cases-{status}-{date}.{format}"
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.7_
  
  - [x] 6.4 Add export to Wallet Transactions page
    - Add "Export" dropdown button with CSV and PDF options
    - Implement CSV export with columns: Transaction ID, Type, Amount, Balance After, Description, Date, Reference
    - Implement PDF export using ExportService and PDFTemplateService
    - Respect date range filters when exporting
    - Set filename as "wallet-transactions-{date}.{format}"
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.7_
  
  - [x] 6.5 Add export to Bid History page
    - Add "Export" dropdown button with CSV and PDF options
    - Implement CSV export with columns: Auction ID, Asset Name, Bid Amount, Bid Date, Status (Won/Lost/Active), Final Price
    - Exclude "watching" auctions from export (only actual bids)
    - Implement PDF export using ExportService and PDFTemplateService
    - Respect auction status filters when exporting
    - Set filename as "bid-history-{date}.{format}"
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.8_
  
  - [x] 6.6 Add export to My Cases page
    - Add "Export" dropdown button with CSV and PDF options
    - Implement CSV export with columns: Claim Reference, Asset Type, Status, Created Date, Market Value, Reserve Price, Location, Damage Severity
    - Implement PDF export using ExportService and PDFTemplateService
    - Respect status filters and search when exporting
    - Set filename as "my-cases-{date}.{format}"
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.7_
  
  - [x] 6.7 Add export to System Logs page
    - Add "Export" dropdown button with CSV and PDF options (admin only)
    - Implement CSV export with columns: Timestamp, User, Action, Resource Type, Resource ID, IP Address, Status
    - Implement PDF export using ExportService and PDFTemplateService
    - Respect date range and action type filters when exporting
    - Limit exports to 5000 most recent records with warning message
    - Set filename as "system-logs-{date}.{format}"
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.7, 17.8_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement pagination for large data lists
  - [x] 8.1 Add pagination to Wallet Transactions page
    - Implement pagination with 10 transactions per page
    - Add pagination controls (Previous, Page Numbers, Next)
    - Display total count and current range (e.g., "Showing 11-20 of 156")
    - Preserve filters and search when navigating pages
    - Disable "Previous" on first page, "Next" on last page
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.7, 18.8_
  
  - [ ]* 8.2 Write property tests for Wallet Transactions pagination
    - **Property 27: Pagination Filter Preservation**
    - **Property 28: Pagination Button State**
    - **Validates: Requirements 18.5, 18.7, 18.8**
  
  - [x] 8.3 Add pagination to System Logs page
    - Implement pagination with 20 log entries per page
    - Add pagination controls (Previous, Page Numbers, Next)
    - Display total count and current range (e.g., "Showing 21-40 of 2,543")
    - Preserve date range and action type filters when navigating pages
    - Default to most recent logs first (descending order)
    - Disable "Previous" on first page, "Next" on last page
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8_
  
  - [x] 8.4 Add pagination to Users List page
    - Implement pagination with 20 users per page
    - Add pagination controls (Previous, Page Numbers, Next)
    - Display total count and current range (e.g., "Showing 21-40 of 156")
    - Preserve role and status filters when navigating pages
    - Preserve search query when navigating pages
    - Disable "Previous" on first page, "Next" on last page
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8_

- [x] 9. Implement PDF standardization and leaderboard cleanup
  - [x] 9.1 Refactor all PDF generation to use PDFTemplateService
    - Update Bill of Sale generation to use PDFTemplateService
    - Update Liability Waiver generation to use PDFTemplateService
    - Update Pickup Authorization generation to use PDFTemplateService
    - Update all report PDFs to use PDFTemplateService
    - Ensure consistent fonts, colors, and spacing
    - _Requirements: 21.1, 21.2, 21.5, 21.6_
  
  - [ ]* 9.2 Write property tests for PDF standardization
    - **Property 29: PDF Letterhead Consistency**
    - **Property 30: PDF Footer Consistency**
    - **Property 31: PDF Export Metadata**
    - **Validates: Requirements 21.1, 21.2, 21.6, 21.7**
  
  - [x] 9.3 Implement test user filtering in leaderboard
    - Update leaderboard query to exclude users with email containing "test", "demo", "uat"
    - Exclude users with names containing "Test", "Demo", "UAT"
    - Exclude users with vendorId matching test patterns (test-, demo-, uat-)
    - Add admin configuration option to mark specific users as test accounts
    - Set cache TTL to 5 minutes for filtered leaderboard
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.6, 22.7_
  
  - [ ]* 9.4 Write property tests for leaderboard filtering
    - **Property 32: Leaderboard Test User Exclusion by Email**
    - **Property 33: Leaderboard Test User Exclusion by Name**
    - **Property 34: Leaderboard Test User Exclusion by Pattern**
    - **Validates: Requirements 22.1, 22.2, 22.3**

- [-] 10. Final checkpoint and validation
  - [x] 10.1 Run all unit tests and property-based tests
    - Verify all property tests pass with minimum 100 iterations
    - Verify all unit tests pass
    - Fix any failing tests
  
  - [ ] 10.2 Perform integration testing
    - Test end-to-end export flow for all 6 pages
    - Test search with filters and pagination combined
    - Test auction status display across all UI components
    - Test cache invalidation for fraud alerts and leaderboard
    - Test PDF generation with standardized templates
  
  - [ ] 10.3 Complete manual testing checklist
    - Verify all UI/UX fixes work correctly on desktop and mobile
    - Verify all export functionality works with various data sets
    - Verify pagination works correctly with filters
    - Verify leaderboard excludes test users
    - Test with special characters (₦, quotes, commas) in exports
  
  - [ ] 10.4 Add database indexes for performance optimization
    - Add index on salvageCases (claimReference, assetType, locationName)
    - Add index on auctions (status, endTime)
    - Add index on users (email, fullName)
    - Add index on vendors (businessName, status)
    - Add index on wallet transactions (vendorId, createdAt DESC)
    - Add index on system logs (createdAt DESC, id)
  
  - [ ] 10.5 Update documentation
    - Update API documentation for new export endpoints
    - Add user guide section on export functionality
    - Add admin guide for test user filtering configuration
    - Add developer guide for new services and utilities
    - Create runbook for troubleshooting export/search issues

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- All services are designed to be reusable across multiple components
- Export functionality respects user permissions and role-based access control
- Pagination preserves filters and search state across page navigation
- PDF standardization ensures consistent branding across all generated documents
