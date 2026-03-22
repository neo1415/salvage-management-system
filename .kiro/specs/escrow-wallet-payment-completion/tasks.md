# Tasks

## Epic: Escrow Wallet Payment Completion

### Phase 1: Database Schema and Core Services

- [x] 1.1 Add pickup confirmation fields to auctions table
  - [x] 1.1.1 Create migration to add pickupConfirmedVendor, pickupConfirmedVendorAt, pickupConfirmedAdmin, pickupConfirmedAdminAt, pickupConfirmedAdminBy fields
  - [x] 1.1.2 Update auctions schema type definitions
  - [x] 1.1.3 Run migration and verify schema changes

- [x] 1.2 Enhance document service with progress tracking
  - [x] 1.2.1 Implement checkAllDocumentsSigned() function
  - [x] 1.2.2 Implement getDocumentProgress() function
  - [x] 1.2.3 Write unit tests for document progress functions
  - [x] 1.2.4 Verify functions return correct data for various signing states

- [x] 1.3 Implement automatic fund release trigger
  - [x] 1.3.1 Implement triggerFundReleaseOnDocumentCompletion() function
  - [x] 1.3.2 Integrate trigger into signDocument() function
  - [x] 1.3.3 Add error handling and Finance Officer alerts
  - [x] 1.3.4 Write unit tests for fund release trigger
  - [x] 1.3.5 Write integration tests for complete signing → release flow

### Phase 2: API Endpoints

- [x] 2.1 Create wallet payment confirmation endpoint
  - [x] 2.1.1 Implement POST /api/payments/[id]/confirm-wallet route
  - [x] 2.1.2 Add validation for vendorId and payment status
  - [x] 2.1.3 Update payment status to 'wallet_confirmed'
  - [x] 2.1.4 Write integration tests for endpoint
  - [x] 2.1.5 Test error cases (insufficient funds, invalid payment)

- [x] 2.2 Create document progress endpoint
  - [x] 2.2.1 Implement GET /api/auctions/[id]/documents/progress route
  - [x] 2.2.2 Return document signing progress data
  - [x] 2.2.3 Write integration tests for endpoint
  - [x] 2.2.4 Test with various signing states (0/3, 1/3, 2/3, 3/3)

- [x] 2.3 Create manual fund release endpoint (Finance Officer)
  - [x] 2.3.1 Implement POST /api/payments/[id]/release-funds route
  - [x] 2.3.2 Add Finance Officer role authorization
  - [x] 2.3.3 Call escrowService.releaseFunds() with audit logging
  - [x] 2.3.4 Write integration tests for endpoint
  - [x] 2.3.5 Test authorization (only Finance Officers can access)

- [x] 2.4 Create vendor pickup confirmation endpoint
  - [x] 2.4.1 Implement POST /api/auctions/[id]/confirm-pickup route
  - [x] 2.4.2 Validate pickup authorization code
  - [x] 2.4.3 Update auction pickupConfirmedVendor status
  - [x] 2.4.4 Send notification to Admin/Manager
  - [x] 2.4.5 Write integration tests for endpoint

- [x] 2.5 Create admin pickup confirmation endpoint
  - [x] 2.5.1 Implement POST /api/admin/auctions/[id]/confirm-pickup route
  - [x] 2.5.2 Add Admin/Manager role authorization
  - [x] 2.5.3 Update auction pickupConfirmedAdmin status
  - [x] 2.5.4 Mark transaction as 'completed'
  - [x] 2.5.5 Trigger fund release if not already released
  - [x] 2.5.6 Write integration tests for endpoint

### Phase 3: Vendor UI Components

- [x] 3.1 Create wallet payment confirmation component
  - [x] 3.1.1 Build WalletPaymentConfirmation component
  - [x] 3.1.2 Display frozen amount and payment details
  - [x] 3.1.3 Add "Confirm Payment from Wallet" button
  - [x] 3.1.4 Integrate with confirm-wallet API endpoint
  - [x] 3.1.5 Write unit tests for component
  - [x] 3.1.6 Test responsive design on mobile

- [ ] 3.2 Update vendor payment page to show wallet option
  - [ ] 3.2.1 Modify src/app/(dashboard)/vendor/payments/[id]/page.tsx
  - [ ] 3.2.2 Detect escrow_wallet payment method
  - [ ] 3.2.3 Show WalletPaymentConfirmation instead of Paystack/Bank Transfer
  - [ ] 3.2.4 Add link to documents page after confirmation
  - [ ] 3.2.5 Write integration tests for payment page
  - [ ] 3.2.6 Test with various payment methods

- [x] 3.3 Create document signing progress component
  - [x] 3.3.1 Build DocumentSigningProgress component
  - [x] 3.3.2 Display progress bar (X/3 documents signed)
  - [x] 3.3.3 Show document list with status badges
  - [x] 3.3.4 Display success banner when all signed
  - [x] 3.3.5 Write unit tests for component
  - [x] 3.3.6 Test with various progress states

- [x] 3.4 Integrate progress component into documents page
  - [x] 3.4.1 Modify src/app/(dashboard)/vendor/documents/page.tsx
  - [x] 3.4.2 Fetch document progress from API
  - [x] 3.4.3 Display DocumentSigningProgress component
  - [x] 3.4.4 Update progress after each document signing
  - [x] 3.4.5 Write integration tests for documents page

- [x] 3.5 Create pickup confirmation component
  - [x] 3.5.1 Build PickupConfirmation component
  - [x] 3.5.2 Add pickup authorization code input
  - [x] 3.5.3 Add "Confirm Pickup" button
  - [x] 3.5.4 Integrate with confirm-pickup API endpoint
  - [x] 3.5.5 Write unit tests for component
  - [x] 3.5.6 Test code validation

- [x] 3.6 Add pickup confirmation to vendor dashboard
  - [x] 3.6.1 Modify src/app/(dashboard)/vendor/dashboard/page.tsx
  - [x] 3.6.2 Show "Confirm Pickup" button for verified payments
  - [x] 3.6.3 Display PickupConfirmation modal
  - [x] 3.6.4 Update UI after confirmation
  - [x] 3.6.5 Write integration tests for dashboard

### Phase 4: Finance Officer UI Components

- [x] 4.1 Create escrow payment details component
  - [x] 4.1.1 Build EscrowPaymentDetails component
  - [x] 4.1.2 Display escrow status, document progress, wallet balance
  - [x] 4.1.3 Add "Manual Release Funds" button
  - [x] 4.1.4 Integrate with release-funds API endpoint
  - [x] 4.1.5 Write unit tests for component
  - [x] 4.1.6 Test manual release flow

- [x] 4.2 Update Finance Officer payments page
  - [x] 4.2.1 Modify src/app/(dashboard)/finance/payments/page.tsx
  - [x] 4.2.2 Add payment source column (Paystack, Bank Transfer, Escrow Wallet)
  - [x] 4.2.3 Add escrow status badge (Frozen, Released, Failed)
  - [x] 4.2.4 Add filter for payment method "Escrow Wallet"
  - [x] 4.2.5 Display EscrowPaymentDetails in payment details modal
  - [x] 4.2.6 Write integration tests for payments page
  - [x] 4.2.7 Test filtering and sorting

- [x] 4.3 Add escrow payment stats to dashboard
  - [x] 4.3.1 Modify src/app/(dashboard)/finance/dashboard/page.tsx
  - [x] 4.3.2 Add "Escrow Wallet Payments" stat card
  - [x] 4.3.3 Show count and percentage of escrow payments
  - [x] 4.3.4 Add chart showing escrow vs other payment methods
  - [x] 4.3.5 Write integration tests for dashboard

### Phase 5: Admin/Manager UI Components

- [x] 5.1 Create admin pickup confirmation component
  - [x] 5.1.1 Build AdminPickupConfirmation component
  - [x] 5.1.2 Display vendor pickup confirmation status
  - [x] 5.1.3 Add notes field and "Confirm Pickup" button
  - [x] 5.1.4 Integrate with admin confirm-pickup API endpoint
  - [x] 5.1.5 Write unit tests for component

- [x] 5.2 Create pickup confirmations list page
  - [x] 5.2.1 Create src/app/(dashboard)/admin/pickups/page.tsx
  - [x] 5.2.2 Display list of pending pickup confirmations
  - [x] 5.2.3 Show vendor confirmation status
  - [x] 5.2.4 Add AdminPickupConfirmation modal
  - [x] 5.2.5 Write integration tests for page

- [x] 5.3 Add pickup notifications to admin dashboard
  - [x] 5.3.1 Modify src/app/(dashboard)/admin/dashboard/page.tsx
  - [x] 5.3.2 Add "Pending Pickup Confirmations" widget
  - [x] 5.3.3 Show count of pending confirmations
  - [x] 5.3.4 Add link to pickups page

### Phase 6: Notifications and Alerts

- [x] 6.1 Implement document signing progress notifications
  - [x] 6.1.1 Send push notification after each document signed (1/3, 2/3)
  - [x] 6.1.2 Send SMS after all documents signed
  - [x] 6.1.3 Write integration tests for notifications

- [x] 6.2 Implement payment complete notifications
  - [x] 6.2.1 Send SMS and email with pickup authorization code
  - [x] 6.2.2 Include pickup location and deadline
  - [x] 6.2.3 Write integration tests for notifications

- [x] 6.3 Implement pickup reminder notifications
  - [x] 6.3.1 Create cron job to check pickup deadlines
  - [x] 6.3.2 Send reminder SMS 24 hours before deadline
  - [x] 6.3.3 Write integration tests for reminders

- [x] 6.4 Implement fund release failure alerts
  - [x] 6.4.1 Send email to Finance Officer when automatic release fails
  - [x] 6.4.2 Include error details and payment ID
  - [x] 6.4.3 Write integration tests for alerts

- [x] 6.5 Implement pickup confirmation notifications
  - [x] 6.5.1 Send notification to Admin when vendor confirms pickup
  - [x] 6.5.2 Send notification to Vendor when admin confirms pickup
  - [x] 6.5.3 Write integration tests for notifications

### Phase 7: Audit Trail and Reporting

- [x] 7.1 Enhance audit logging for escrow payments
  - [x] 7.1.1 Log wallet payment confirmation
  - [x] 7.1.2 Log document signing progress
  - [x] 7.1.3 Log automatic fund release
  - [x] 7.1.4 Log manual fund release by Finance Officer
  - [x] 7.1.5 Log pickup confirmations
  - [x] 7.1.6 Write unit tests for audit logging

- [x] 7.2 Create escrow payment audit trail view
  - [x] 7.2.1 Build EscrowPaymentAuditTrail component
  - [x] 7.2.2 Display timeline of events
  - [x] 7.2.3 Show timestamps, users, IP addresses
  - [x] 7.2.4 Highlight errors in red
  - [x] 7.2.5 Write unit tests for component

- [x] 7.3 Add audit trail to Finance Officer payment details
  - [x] 7.3.1 Integrate EscrowPaymentAuditTrail into payment details modal
  - [x] 7.3.2 Add CSV export functionality
  - [x] 7.3.3 Write integration tests

- [x] 7.4 Create escrow payment performance report
  - [x] 7.4.1 Create src/app/(dashboard)/finance/reports/escrow/page.tsx
  - [x] 7.4.2 Show total escrow payments and amount processed
  - [x] 7.4.3 Show automation success rate (auto vs manual)
  - [x] 7.4.4 Show document signing completion rate
  - [x] 7.4.5 Show average processing time
  - [x] 7.4.6 Add chart showing escrow payments over time
  - [x] 7.4.7 Add date range filtering
  - [x] 7.4.8 Add PDF and Excel export
  - [x] 7.4.9 Write integration tests for report

### Phase 8: Testing and Quality Assurance

- [x] 8.1 End-to-end testing
  - [x] 8.1.1 Test complete flow: wallet funding → bid → win → confirm payment → sign documents → funds released → pickup confirmed
  - [x] 8.1.2 Test manual fund release by Finance Officer
  - [x] 8.1.3 Test pickup confirmation workflow
  - [x] 8.1.4 Test error scenarios (Paystack failure, insufficient funds)
  - [x] 8.1.5 Test concurrent document signing

- [x] 8.2 Performance testing
  - [ ] 8.2.1 Test fund release trigger performance (<30 seconds)
  - [ ] 8.2.2 Test document progress API response time (<500ms)
  - [ ] 8.2.3 Test Finance Officer dashboard load time with 1000+ payments
  - [ ] 8.2.4 Test notification delivery time (<5 seconds)

- [x] 8.3 Security testing
  - [x] 8.3.1 Test authorization for Finance Officer endpoints
  - [x] 8.3.2 Test pickup code validation
  - [x] 8.3.3 Test wallet balance invariant enforcement
  - [x] 8.3.4 Test audit log immutability
  - [x] 8.3.5 Test Paystack transfer idempotency

- [x] 8.4 User acceptance testing
  - [x] 8.4.1 Test with real vendors on staging environment
  - [x] 8.4.2 Test with Finance Officers on staging environment
  - [x] 8.4.3 Collect feedback and iterate
  - [x] 8.4.4 Verify all acceptance criteria met

### Phase 9: Documentation and Deployment

- [ ] 9.1 Create user documentation
  - [ ] 9.1.1 Write vendor guide for wallet payment and document signing
  - [ ] 9.1.2 Write Finance Officer guide for escrow payment management
  - [ ] 9.1.3 Write Admin guide for pickup confirmation
  - [ ] 9.1.4 Create troubleshooting guide for common issues

- [ ] 9.2 Create technical documentation
  - [ ] 9.2.1 Document API endpoints with examples
  - [ ] 9.2.2 Document database schema changes
  - [ ] 9.2.3 Document service layer functions
  - [ ] 9.2.4 Document error handling and recovery procedures

- [ ] 9.3 Deploy to staging environment
  - [ ] 9.3.1 Run database migrations
  - [ ] 9.3.2 Deploy backend services
  - [ ] 9.3.3 Deploy frontend components
  - [ ] 9.3.4 Verify all features working
  - [ ] 9.3.5 Run smoke tests

- [ ] 9.4 Deploy to production
  - [ ] 9.4.1 Create deployment plan with rollback strategy
  - [ ] 9.4.2 Run database migrations
  - [ ] 9.4.3 Deploy with feature flag disabled
  - [ ] 9.4.4 Enable feature flag for 10% of users
  - [ ] 9.4.5 Monitor error rates and performance
  - [ ] 9.4.6 Gradually increase to 100% of users
  - [ ] 9.4.7 Monitor automation success rate

- [ ] 9.5 Post-deployment monitoring
  - [ ] 9.5.1 Monitor automatic fund release success rate (target >90%)
  - [ ] 9.5.2 Monitor average processing time (target <24 hours)
  - [ ] 9.5.3 Monitor error rates (target <5%)
  - [ ] 9.5.4 Monitor manual intervention rate (target <10%)
  - [ ] 9.5.5 Collect vendor feedback on payment experience
  - [ ] 9.5.6 Create weekly report for stakeholders
