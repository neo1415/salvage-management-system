# Requirements Document

## Introduction

This feature completes the escrow wallet payment flow by adding missing automation for fund release when vendors complete document signing. Currently, vendors can fund their wallets and have funds frozen when winning bids, but there's no automated trigger to release frozen funds to NEM Insurance when all required documents are signed. This creates manual work for Finance Officers and delays the payment completion process.

## Glossary

- **Escrow_Wallet**: Pre-funded vendor wallet where bid amounts are frozen until pickup
- **Frozen_Funds**: Wallet balance that is reserved for a specific auction but not yet transferred
- **Fund_Release**: Transfer of frozen funds from vendor wallet to NEM Insurance bank account
- **Document_Signing**: Process where vendor digitally signs required documents (Bill of Sale, Liability Waiver, Pickup Authorization)
- **Finance_Officer**: Insurance staff who verify payments and can manually trigger fund releases
- **Vendor**: External buyer who has won an auction and must complete payment
- **Payment_Record**: Database record tracking payment status for an auction
- **Paystack_Transfers_API**: Paystack service for transferring funds to bank accounts
- **Pickup_Confirmation**: Process where vendor and admin confirm item has been collected

## Requirements

### Requirement 1: Vendor Wallet Payment Confirmation UI

**User Story:** As a Vendor, I want to see a "Confirm Payment from Wallet" option on the payment page when I have frozen funds, so that I can complete payment without re-entering payment details.

#### Acceptance Criteria

1. WHEN Vendor accesses payment page for auction with escrow_wallet payment method THEN THE System SHALL display payment source indicator showing "Payment Source: Escrow Wallet"
2. WHEN payment page displays escrow_wallet payment THEN THE System SHALL show frozen amount with text "₦[amount] frozen in your wallet"
3. WHEN payment page displays escrow_wallet payment THEN THE System SHALL display "Confirm Payment from Wallet" button instead of Paystack/Bank Transfer options
4. WHEN Vendor clicks "Confirm Payment from Wallet" THEN THE System SHALL display confirmation modal with text "Confirm you want to pay ₦[amount] from your wallet balance?"
5. WHEN Vendor confirms wallet payment THEN THE System SHALL update payment record status to 'wallet_confirmed'
6. WHEN wallet payment is confirmed THEN THE System SHALL display success message "Payment confirmed! Sign all documents to complete the process"
7. WHEN wallet payment is confirmed THEN THE System SHALL redirect Vendor to documents page
8. WHEN Vendor has insufficient frozen funds THEN THE System SHALL display error "Insufficient frozen funds. Please contact support."

### Requirement 2: Document Signing Progress Tracking

**User Story:** As a Vendor, I want to see my document signing progress (1/3, 2/3, 3/3), so that I know how many documents I still need to sign before payment is released.

#### Acceptance Criteria

1. WHEN Vendor accesses documents page THEN THE System SHALL display progress indicator showing "Documents Signed: X/3"
2. WHEN Vendor views document list THEN THE System SHALL show status badge for each document: "Pending" (yellow), "Signed" (green), "Voided" (red)
3. WHEN Vendor signs first document THEN THE System SHALL update progress to "1/3 documents signed"
4. WHEN Vendor signs second document THEN THE System SHALL update progress to "2/3 documents signed"
5. WHEN Vendor signs third document THEN THE System SHALL update progress to "3/3 documents signed - Payment will be released automatically"
6. WHEN all documents are signed THEN THE System SHALL display success banner "All documents signed! Your payment is being processed."
7. WHEN Vendor views payment page THEN THE System SHALL show document signing status with link to documents page
8. WHEN document signing progress changes THEN THE System SHALL send push notification "X/3 documents signed. Y documents remaining."

### Requirement 3: Automatic Fund Release on Document Completion

**User Story:** As the System, I want to automatically release frozen funds to NEM Insurance when all 3 documents are signed, so that payment is completed without manual intervention.

#### Acceptance Criteria

1. WHEN Vendor signs third and final document THEN THE System SHALL trigger automatic fund release within 30 seconds
2. WHEN fund release is triggered THEN THE System SHALL call escrowService.releaseFunds() with vendorId, amount, auctionId, and userId
3. WHEN releaseFunds() executes THEN THE System SHALL transfer funds from vendor wallet to NEM Insurance via Paystack Transfers API
4. WHEN Paystack transfer succeeds THEN THE System SHALL update payment record status to 'verified'
5. WHEN payment is verified THEN THE System SHALL update case status to 'sold'
6. WHEN payment is verified THEN THE System SHALL generate pickup authorization code
7. WHEN payment is verified THEN THE System SHALL send SMS and email to Vendor with pickup authorization code
8. WHEN payment is verified THEN THE System SHALL create audit log entry "Funds released automatically after document signing completion"
9. WHEN Paystack transfer fails THEN THE System SHALL log error and notify Finance Officer for manual intervention
10. WHEN fund release completes THEN THE System SHALL send push notification to Vendor "Payment complete! Your pickup code is [CODE]"
11. WHEN fund release completes THEN THE System SHALL update wallet transaction history with "Funds released for auction [ID]"

### Requirement 4: Finance Officer Escrow Payment Dashboard

**User Story:** As a Finance Officer, I want to see escrow wallet payments with their document signing status and fund release status, so that I can monitor automated payments and manually intervene when needed.

#### Acceptance Criteria

1. WHEN Finance Officer accesses payments page THEN THE System SHALL display payment source column showing "Paystack", "Bank Transfer", or "Escrow Wallet"
2. WHEN payment list displays escrow_wallet payments THEN THE System SHALL show escrow status badge: "Frozen" (yellow), "Released" (green), "Failed" (red)
3. WHEN Finance Officer views escrow payment details THEN THE System SHALL display frozen amount, available wallet balance, and document signing progress (X/3)
4. WHEN Finance Officer views escrow payment THEN THE System SHALL show fund release status: "Pending Document Signing", "Ready for Release", "Released", "Failed"
5. WHEN escrow payment has all documents signed but funds not released THEN THE System SHALL display "Manual Release" button
6. WHEN Finance Officer clicks "Manual Release" THEN THE System SHALL display confirmation modal "Manually release ₦[amount] from vendor wallet?"
7. WHEN Finance Officer confirms manual release THEN THE System SHALL call escrowService.releaseFunds() and log "Funds released manually by Finance Officer [name]"
8. WHEN Finance Officer filters payments THEN THE System SHALL support filtering by payment method including "Escrow Wallet"
9. WHEN Finance Officer views payment stats THEN THE System SHALL show "Escrow Wallet Payments: X (Y% of total)"
10. WHEN escrow payment fails automatic release THEN THE System SHALL send email alert to Finance Officer with error details

### Requirement 5: Pickup Confirmation Workflow

**User Story:** As a Vendor, I want to confirm pickup after collecting the salvage item, so that the system knows the transaction is complete.

#### Acceptance Criteria

1. WHEN payment is verified THEN THE System SHALL display "Confirm Pickup" button on vendor dashboard
2. WHEN Vendor clicks "Confirm Pickup" THEN THE System SHALL display modal "Have you collected the item? Enter pickup authorization code to confirm"
3. WHEN Vendor enters pickup code THEN THE System SHALL validate code matches generated code
4. WHEN pickup code is valid THEN THE System SHALL update auction status to 'pickup_confirmed_vendor'
5. WHEN vendor confirms pickup THEN THE System SHALL send notification to Admin/Manager "Vendor confirmed pickup for auction [ID]"
6. WHEN Admin/Manager views pickup confirmations THEN THE System SHALL display list of pending confirmations
7. WHEN Admin/Manager confirms pickup THEN THE System SHALL update auction status to 'pickup_confirmed_admin'
8. WHEN both vendor and admin confirm pickup THEN THE System SHALL mark transaction as 'completed'
9. WHEN pickup is confirmed by both parties THEN THE System SHALL trigger fund release if not already released
10. WHEN pickup confirmation is complete THEN THE System SHALL create audit log entry "Pickup confirmed by vendor and admin"

### Requirement 6: Escrow Payment Audit Trail

**User Story:** As a Finance Officer, I want to see complete audit trail for escrow wallet payments, so that I can track fund movements and troubleshoot issues.

#### Acceptance Criteria

1. WHEN Finance Officer views escrow payment details THEN THE System SHALL display timeline of events: "Wallet funded", "Bid placed", "Funds frozen", "Auction won", "Documents generated", "Document 1 signed", "Document 2 signed", "Document 3 signed", "Funds released", "Pickup confirmed"
2. WHEN audit trail displays THEN THE System SHALL show timestamp, user, IP address, and device type for each event
3. WHEN fund release occurs THEN THE System SHALL log Paystack transfer reference and transfer status
4. WHEN Finance Officer exports audit trail THEN THE System SHALL support CSV export with all event details
5. WHEN escrow payment has errors THEN THE System SHALL highlight failed events in red with error message
6. WHEN Finance Officer searches audit logs THEN THE System SHALL support filtering by payment method "escrow_wallet"
7. WHEN audit trail displays THEN THE System SHALL show wallet balance changes: "Balance: ₦900k → ₦500k (₦400k frozen)"

### Requirement 7: Escrow Payment Error Handling

**User Story:** As the System, I want to handle escrow payment errors gracefully, so that vendors and Finance Officers know what went wrong and how to fix it.

#### Acceptance Criteria

1. WHEN Paystack transfer fails THEN THE System SHALL log error with Paystack error code and message
2. WHEN Paystack transfer fails THEN THE System SHALL send email to Finance Officer with subject "Escrow Payment Failed - Action Required"
3. WHEN Paystack transfer fails THEN THE System SHALL display error message to Vendor "Payment processing failed. Our team has been notified."
4. WHEN Paystack transfer fails THEN THE System SHALL keep funds frozen and payment status as 'pending'
5. WHEN Finance Officer views failed payment THEN THE System SHALL display error details and "Retry Release" button
6. WHEN Finance Officer clicks "Retry Release" THEN THE System SHALL attempt fund release again
7. WHEN vendor wallet has insufficient frozen funds THEN THE System SHALL display error "Frozen funds mismatch. Please contact support."
8. WHEN document signing fails THEN THE System SHALL not trigger fund release
9. WHEN fund release is triggered but documents are not all signed THEN THE System SHALL log warning and skip release
10. WHEN error occurs THEN THE System SHALL create audit log entry with error type, error message, and timestamp

### Requirement 8: Escrow Payment Notifications

**User Story:** As a Vendor, I want to receive notifications at each step of the escrow payment process, so that I know what actions I need to take.

#### Acceptance Criteria

1. WHEN funds are frozen THEN THE System SHALL send SMS "₦[amount] frozen in your wallet for auction [ID]. Complete payment by signing documents."
2. WHEN Vendor signs first document THEN THE System SHALL send push notification "1/3 documents signed. 2 documents remaining."
3. WHEN Vendor signs second document THEN THE System SHALL send push notification "2/3 documents signed. 1 document remaining."
4. WHEN Vendor signs third document THEN THE System SHALL send SMS and email "All documents signed! Payment is being processed."
5. WHEN funds are released THEN THE System SHALL send SMS and email "Payment complete! Your pickup code is [CODE]. Collect item within 48 hours."
6. WHEN pickup deadline approaches THEN THE System SHALL send reminder SMS "Reminder: Collect your item by [date] using code [CODE]"
7. WHEN Finance Officer manually releases funds THEN THE System SHALL send SMS to Vendor "Payment verified by Finance Officer. Your pickup code is [CODE]."
8. WHEN fund release fails THEN THE System SHALL send SMS to Vendor "Payment processing delayed. Our team is working on it."

### Requirement 9: Escrow Payment Reporting

**User Story:** As a Finance Officer, I want to see reports on escrow wallet payment performance, so that I can track automation success rate and identify issues.

#### Acceptance Criteria

1. WHEN Finance Officer accesses reports page THEN THE System SHALL display "Escrow Wallet Payments" report section
2. WHEN report displays THEN THE System SHALL show total escrow payments, total amount processed, and average processing time
3. WHEN report displays THEN THE System SHALL show automation success rate: "X% automatically released, Y% manually released, Z% failed"
4. WHEN report displays THEN THE System SHALL show document signing completion rate: "X% completed all documents, Y% incomplete"
5. WHEN report displays THEN THE System SHALL show average time from auction win to fund release
6. WHEN report displays THEN THE System SHALL show chart of escrow payments over time (daily/weekly/monthly)
7. WHEN Finance Officer filters report THEN THE System SHALL support date range filtering
8. WHEN Finance Officer exports report THEN THE System SHALL support PDF and Excel export
9. WHEN report displays THEN THE System SHALL show top 10 vendors by escrow wallet usage
10. WHEN report displays THEN THE System SHALL show failed payment reasons with count

### Requirement 10: Escrow Payment Security

**User Story:** As the System, I want to ensure escrow wallet payments are secure and compliant with NDPR, so that vendor funds are protected.

#### Acceptance Criteria

1. WHEN fund release is triggered THEN THE System SHALL verify all 3 documents are signed before proceeding
2. WHEN fund release is triggered THEN THE System SHALL verify frozen amount matches payment amount
3. WHEN fund release is triggered THEN THE System SHALL verify payment status is 'pending' or 'wallet_confirmed'
4. WHEN Paystack transfer is initiated THEN THE System SHALL use HTTPS and verify SSL certificate
5. WHEN Paystack transfer is initiated THEN THE System SHALL include transfer reference for idempotency
6. WHEN wallet balance is updated THEN THE System SHALL verify balance invariant: balance = availableBalance + frozenAmount
7. WHEN Finance Officer manually releases funds THEN THE System SHALL require authentication and log officer ID
8. WHEN audit logs are created THEN THE System SHALL encrypt sensitive data (wallet IDs, amounts, transfer references)
9. WHEN vendor views wallet balance THEN THE System SHALL mask transaction references except last 4 characters
10. WHEN escrow payment data is stored THEN THE System SHALL comply with NDPR data retention policies (2 years minimum)
