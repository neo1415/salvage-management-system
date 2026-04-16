# Requirements Document

## ⚠️ CRITICAL IMPLEMENTATION PRINCIPLES

**THIS SPEC IS PART OF A LARGER SYSTEM - NEVER SACRIFICE THE WHOLE FOR A PART**

### Non-Negotiable Rules:
1. **NEVER trade security for convenience** - Database constraints, foreign keys, and data integrity are sacred
2. **NEVER trade performance for quick fixes** - Optimize queries, use proper indexes, maintain efficiency  
3. **NEVER skip fixing broken things** - If something fails that affects the overall application, fix it even if not in current task
4. **NEVER weaken the system to pass tests** - Fix tests properly by creating proper test data, not by removing constraints
5. **ALWAYS think holistically** - This feature integrates with existing auction, payment, and escrow systems
6. **ALWAYS verify integration points** - Check existing services before creating new ones
7. **ALWAYS run tests before marking complete** - Failing tests mean incomplete work
8. **ALWAYS maintain audit trails** - Financial transactions require reliable, immutable audit logs

### When You Encounter Issues:
- ❌ DON'T: Remove database constraints to make tests pass
- ❌ DON'T: Skip broken functionality to move to next task  
- ❌ DON'T: Create duplicate services when existing ones can be enhanced
- ✅ DO: Create proper test data that satisfies all constraints
- ✅ DO: Fix broken things even if slightly outside current task scope
- ✅ DO: Integrate with existing services and enhance them
- ✅ DO: Maintain security, performance, and data integrity at all costs

**Remember: We're building a production-grade financial system, not just completing tasks.**

---

## RESPONSIBLE DEVELOPMENT PRINCIPLES

This is an enterprise financial application that will handle millions to billions of Nigerian Naira. Every line of code must be written with the highest standards of responsibility and diligence.

### Core Principles:

1. **UNDERSTAND BEFORE CREATING**
   - Always check what already exists before creating new services, functions, or components
   - Search the codebase for similar functionality that can be reused or extended
   - Read existing implementations to understand patterns and architecture
   - Integration is preferred over duplication

2. **NO SHORTCUTS IN FINANCIAL LOGIC**
   - Every calculation involving money must be precise and tested
   - Deposit amounts, refunds, and transfers must be atomic and traceable
   - Never assume - always verify with actual database queries
   - Use transactions for all multi-step financial operations

3. **COMPREHENSIVE ERROR HANDLING**
   - Every service method must handle errors gracefully
   - Log all errors with sufficient context for debugging
   - Return meaningful error messages to users
   - Never silently fail on financial operations

4. **THOROUGH TESTING**
   - Unit tests must cover all edge cases, not just happy paths
   - Integration tests must verify actual database state
   - Test files must actually run and pass - fix Vitest/test runner issues immediately
   - Mock external dependencies but verify integration points

5. **AUDIT TRAIL EVERYTHING**
   - Every deposit, freeze, unfreeze, and refund must be logged
   - Include timestamps, user IDs, amounts, and reasons
   - Make it possible to reconstruct the complete history of any transaction
   - Compliance and debugging depend on comprehensive audit trails

6. **IDEMPOTENCY FOR CRITICAL OPERATIONS**
   - Auction closure, payment creation, and refunds must be idempotent
   - Prevent duplicate charges or refunds
   - Handle retries gracefully without side effects

7. **SECURITY FIRST**
   - Validate all inputs rigorously
   - Check authorization before any financial operation
   - Prevent SQL injection, XSS, and other common vulnerabilities
   - Sensitive data must be encrypted at rest and in transit

8. **PERFORMANCE WITH SCALE IN MIND**
   - Optimize database queries for thousands of concurrent auctions
   - Use indexes appropriately
   - Avoid N+1 queries
   - Consider caching for read-heavy operations

### Before Starting Any Task:

1. Read the existing codebase to understand what's already implemented
2. Identify integration points with existing services
3. **VERIFY REQUIREMENTS AGAINST IMPLEMENTATION** - Don't assume existing code meets requirements
4. Compare each acceptance criterion line-by-line against actual code behavior
5. Check database schemas for required fields before claiming functionality exists
6. Plan the implementation with error handling and edge cases in mind
7. Write tests that actually verify the behavior
8. Review the code as if millions of naira depend on it - because they do

### Remember:

- This is not a prototype or proof of concept
- Real users will trust this system with their money
- Bugs in financial logic can cause significant financial loss
- Your code will be audited by regulators and security experts
- Take the time to do it right the first time

---

## Introduction

This document specifies requirements for a deposit-based auction bidding system that transforms the current full-amount freeze model into a more capital-efficient deposit model. The system enables vendors to participate in auctions by freezing only a percentage of their bid amount as deposit, implements an automated fallback chain for failed winners, provides grace period extensions for document signing and payment, handles deposit forfeiture, and offers hybrid payment options. All business rules are configurable through a system admin interface.

## Glossary

- **Vendor**: A registered user who places bids on auction assets
- **Finance_Officer (FO)**: Staff member who manages auction operations and vendor interactionsns
- **System_Admin**: Administrator who configures business rules and system parameters
- **Escrow_Wallet**: Vendor's wallet containing balance, frozenAmount, and availableBalance
- **Deposit**: Percentage of bid amount frozen in escrow (default 10%)
- **Reserve_Price**: Minimum acceptable bid, calculated as 70% of salvage value
- **Fallback_Chain**: Automated promotion of next eligible bidder when winner fails
- **Grace_Extension**: Additional time granted by FO for document signing or payment
- **Forfeiture**: Penalty applied when winner signs documents but fails to pay
- **Hybrid_Payment**: Payment using combination of wallet balance and Paystack
- **Tier_1_Vendor**: Vendor with maximum bid limit of ₦500,000
- **Bid_Increment**: Minimum amount between consecutive bids (₦20,000)
- **Document_Validity_Period**: Time window for signing required documents (default 48 hours)
- **Fallback_Buffer_Period**: Wait time before promoting next bidder (default 24 hours)
- **Top_Bidders**: Number of highest bidders whose deposits remain frozen after auction closes (default 3)
- **Paystack**: Payment gateway for processing card/bank payments
- **Bill_of_Sale**: Legal document transferring asset ownership
- **Liability_Waiver**: Document releasing platform from post-sale liability

## Requirements

### Requirement 1: Dynamic Deposit Calculation

**User Story:** As a vendor, I want to place bids by freezing only a deposit percentage instead of the full amount, so that I can participate in multiple auctions with limited capital.

#### Acceptance Criteria

1. WHEN a vendor places a bid, THE Deposit_Calculator SHALL calculate deposit as max(bid_amount × deposit_rate, minimum_deposit_floor)
2. THE Deposit_Calculator SHALL use configurable deposit_rate with default value of 10%
3. THE Deposit_Calculator SHALL use configurable minimum_deposit_floor with default value of ₦100,000
4. WHEN a Tier_1_Vendor places a bid up to ₦500,000, THE Deposit_Calculator SHALL calculate maximum deposit as ₦50,000
5. WHEN the same vendor increases their bid on the same auction, THE Deposit_Calculator SHALL calculate incremental deposit as (new_deposit - previous_deposit)
6. FOR ALL deposit calculations, THE Deposit_Calculator SHALL return a non-negative integer value in Naira

### Requirement 2: Pre-Bid Eligibility Validation

**User Story:** As a vendor, I want to know if I have sufficient funds before placing a bid, so that I don't attempt invalid bids.

#### Acceptance Criteria

1. WHEN a vendor attempts to place a bid, THE Bid_Validator SHALL verify availableBalance >= max(reserve_price × deposit_rate, minimum_deposit_floor)
2. WHEN a vendor's availableBalance is insufficient, THE Bid_Validator SHALL return error message "Insufficient available balance for deposit"
3. WHEN a vendor's bid is below reserve_price, THE Bid_Validator SHALL return error message "Bid must be at least ₦{reserve_price}"
4. WHEN a vendor's bid increment is less than ₦20,000 above current highest bid, THE Bid_Validator SHALL return error message "Minimum bid increment is ₦20,000"
5. WHEN a Tier_1_Vendor attempts to bid above ₦500,000, THE Bid_Validator SHALL return error message "Tier 1 vendors cannot bid above ₦500,000"
6. WHEN all validation passes, THE Bid_Validator SHALL return success status with calculated deposit amount

### Requirement 3: Deposit Freeze on Bid Placement

**User Story:** As a vendor, I want my deposit to be frozen when I place a bid, so that the system can guarantee my commitment.

#### Acceptance Criteria

1. WHEN a vendor places a valid bid, THE Escrow_Service SHALL increase frozenAmount by deposit amount
2. WHEN a vendor places a valid bid, THE Escrow_Service SHALL decrease availableBalance by deposit amount
3. WHEN a vendor increases their existing bid, THE Escrow_Service SHALL freeze only the incremental deposit amount
4. WHEN deposit freeze succeeds, THE Bid_Service SHALL create bid record with status "active" and depositAmount field
5. WHEN deposit freeze fails due to insufficient funds, THE Bid_Service SHALL return error and not create bid record
6. FOR ALL deposit freeze operations, THE Escrow_Service SHALL maintain invariant: balance = availableBalance + frozenAmount

### Requirement 4: Deposit Unfreeze on Outbid

**User Story:** As a vendor, I want my deposit unfrozen when I'm outbid, so that I can use those funds for other auctions.

#### Acceptance Criteria

1. WHEN a vendor is outbid by another vendor, THE Escrow_Service SHALL decrease frozenAmount by the outbid vendor's deposit amount
2. WHEN a vendor is outbid by another vendor, THE Escrow_Service SHALL increase availableBalance by the outbid vendor's deposit amount
3. WHEN a vendor is outbid, THE Bid_Service SHALL update their bid status to "outbid"
4. WHEN the same vendor places a new higher bid after being outbid, THE Escrow_Service SHALL freeze the new deposit amount
5. FOR ALL unfreeze operations, THE Escrow_Service SHALL maintain invariant: balance = availableBalance + frozenAmount

### Requirement 5: Top Bidders Deposit Retention

**User Story:** As a finance officer, I want top bidders' deposits to remain frozen after auction closes, so that we have fallback options if the winner fails.

#### Acceptance Criteria

1. WHEN an auction closes, THE Auction_Closure_Service SHALL identify the top N bidders where N is configurable (default 3)
2. WHEN an auction closes, THE Auction_Closure_Service SHALL keep deposits frozen for top N bidders
3. WHEN an auction closes, THE Auction_Closure_Service SHALL unfreeze deposits for all bidders ranked below top N
4. WHEN an auction closes with fewer than N bidders, THE Auction_Closure_Service SHALL keep all bidders' deposits frozen
5. WHEN top bidders are identified, THE Auction_Closure_Service SHALL update auction status to "awaiting_documents"
6. WHEN top bidders are identified, THE Auction_Closure_Service SHALL record winner as bidder with highest bid amount

### Requirement 6: Document Generation and Validity Period

**User Story:** As a winning vendor, I want to receive documents to sign within a specified timeframe, so that I can complete the purchase process.

#### Acceptance Criteria

1. WHEN an auction closes with a winner, THE Document_Service SHALL generate Bill_of_Sale document
2. WHEN an auction closes with a winner, THE Document_Service SHALL generate Liability_Waiver document
3. WHEN documents are generated, THE Document_Service SHALL set validity deadline as current_time + document_validity_period (default 48 hours)
4. WHEN documents are generated, THE Notification_Service SHALL send notification to winner with document links
5. WHEN documents are generated, THE Auction_Service SHALL update auction status to "awaiting_documents"
6. WHEN document_validity_period is configurable, THE System_Admin SHALL be able to modify the default 48-hour period

### Requirement 7: Grace Period Extension by Field Officer

**User Story:** As a finance officer, I want to grant time extensions to vendors who need more time to sign documents, so that we don't lose legitimate buyers due to timing issues.

#### Acceptance Criteria

1. WHEN a Finance Officer views an auction awaiting documents, THE Finance_Officer_Dashboard SHALL display "Grant Extension" button
2. WHEN a Finance Officer clicks "Grant Extension", THE Extension_Service SHALL verify extensionCount < max_grace_extensions (default 2)
3. WHEN extension limit is not reached, THE Extension_Service SHALL increase document deadline by grace_extension_duration (default 24 hours)
4. WHEN extension is granted, THE Extension_Service SHALL increment extensionCount
5. WHEN extension is granted, THE Extension_Service SHALL record grantedBy, grantedAt, reason, and newDeadline
6. WHEN extension limit is reached, THE Extension_Service SHALL disable "Grant Extension" button and display "Maximum extensions reached"
7. WHEN max_grace_extensions is configurable, THE System_Admin SHALL be able to modify the default limit of 2 extensions

### Requirement 8: Document Signing Tracking

**User Story:** As a vendor, I want to sign required documents electronically, so that I can proceed to payment.

#### Acceptance Criteria

1. WHEN a vendor accesses document signing page, THE Document_Service SHALL display Bill_of_Sale and Liability_Waiver
2. WHEN a vendor signs both documents, THE Document_Service SHALL record signature timestamps
3. WHEN both documents are signed, THE Document_Service SHALL update auction status to "awaiting_payment"
4. WHEN both documents are signed, THE Payment_Service SHALL calculate remaining_amount as final_bid - deposit_amount
5. WHEN both documents are signed, THE Payment_Service SHALL set payment deadline as current_time + payment_deadline_after_signing (default 72 hours)
6. WHEN documents are signed, THE Notification_Service SHALL send payment instructions to vendor

### Requirement 9: Automated Fallback Chain Trigger

**User Story:** As a finance officer, I want the system to automatically promote the next bidder when the winner fails, so that I don't have to manually manage fallback scenarios.

#### Acceptance Criteria

1. WHEN document validity period expires without signatures, THE Fallback_Service SHALL wait for fallback_buffer_period (default 24 hours)
2. WHEN fallback_buffer_period elapses, THE Fallback_Service SHALL mark current winner as "failed_to_sign"
3. WHEN current winner fails, THE Fallback_Service SHALL unfreeze the failed winner's deposit
4. WHEN current winner fails, THE Fallback_Service SHALL identify next eligible bidder from top N bidders
5. WHEN next eligible bidder is found, THE Fallback_Service SHALL promote them to winner status
6. WHEN next eligible bidder is promoted, THE Document_Service SHALL generate new documents with fresh validity period
7. WHEN payment deadline expires without payment, THE Fallback_Service SHALL trigger the same fallback process after buffer period

### Requirement 10: Fallback Eligibility Validation

**User Story:** As a system, I want to skip bidders who are no longer eligible for fallback promotion, so that we only promote bidders who can complete the purchase.

#### Acceptance Criteria

1. WHEN evaluating next bidder for promotion, THE Fallback_Service SHALL verify bidder's deposit is still frozen
2. WHEN evaluating next bidder for promotion, THE Fallback_Service SHALL verify bidder has not withdrawn funds below required deposit
3. WHEN a bidder is ineligible, THE Fallback_Service SHALL skip to the next bidder in ranking
4. WHEN all top N bidders are ineligible, THE Fallback_Service SHALL mark auction status as "failed_all_fallbacks"
5. WHEN auction is marked "failed_all_fallbacks", THE Fallback_Service SHALL unfreeze all remaining frozen deposits
6. WHEN auction is marked "failed_all_fallbacks", THE Notification_Service SHALL alert Finance Officer for manual intervention

### Requirement 11: Deposit Forfeiture on Payment Failure

**User Story:** As a finance officer, I want to forfeit a vendor's deposit when they sign documents but fail to pay, so that we can penalize non-serious bidders.

#### Acceptance Criteria

1. WHEN payment deadline expires after document signing, THE Forfeiture_Service SHALL calculate forfeiture_amount as deposit_amount × forfeiture_percentage (default 100%)
2. WHEN forfeiture is triggered, THE Forfeiture_Service SHALL mark deposit as "forfeited" without unfreezing it
3. WHEN forfeiture is triggered, THE Forfeiture_Service SHALL update vendor's escrow record with forfeitedAmount field
4. WHEN forfeiture is triggered, THE Forfeiture_Service SHALL update auction status to "deposit_forfeited"
5. WHEN forfeiture occurs, THE Notification_Service SHALL notify vendor of forfeiture with reason
6. WHEN forfeiture_percentage is configurable, THE System_Admin SHALL be able to modify the default 100% penalty

### Requirement 12: Forfeited Funds Transfer by Field Officer

**User Story:** As a finance officer, I want to transfer forfeited deposits to the platform account, so that penalties are collected and accounted for.

#### Acceptance Criteria

1. WHEN a Finance Officer views an auction with forfeited deposit, THE Payment_Details_Card SHALL display "Transfer Forfeited Funds" button
2. WHEN a Finance Officer clicks "Transfer Forfeited Funds", THE Transfer_Service SHALL verify auction status is "deposit_forfeited"
3. WHEN transfer is initiated, THE Transfer_Service SHALL decrease vendor's frozenAmount by forfeitedAmount
4. WHEN transfer is initiated, THE Transfer_Service SHALL increase platform_account balance by forfeitedAmount
5. WHEN transfer completes, THE Transfer_Service SHALL record transaction with type "forfeiture_transfer", amount, vendorId, auctionId, and transferredBy
6. WHEN transfer completes, THE Transfer_Service SHALL update auction status to "forfeiture_collected"
7. WHEN remaining frozen amount exists after forfeiture, THE Escrow_Service SHALL keep it frozen until auction is fully resolved

### Requirement 13: Hybrid Payment Calculation

**User Story:** As a vendor, I want to pay the remaining amount after my deposit is deducted, so that I complete the purchase efficiently.

#### Acceptance Criteria

1. WHEN a vendor accesses payment page after signing documents, THE Payment_Service SHALL display final_bid amount
2. WHEN a vendor accesses payment page, THE Payment_Service SHALL display deposit_amount already committed
3. WHEN a vendor accesses payment page, THE Payment_Service SHALL calculate remaining_amount as final_bid - deposit_amount
4. WHEN a vendor accesses payment page, THE Payment_Service SHALL display availableBalance in wallet
5. WHEN a vendor accesses payment page, THE Payment_Service SHALL offer payment options: "Wallet Only", "Paystack Only", or "Hybrid"
6. WHEN remaining_amount > availableBalance, THE Payment_Service SHALL disable "Wallet Only" option

### Requirement 14: Wallet-Only Payment Processing

**User Story:** As a vendor with sufficient wallet balance, I want to pay entirely from my wallet, so that I avoid payment gateway fees.

#### Acceptance Criteria

1. WHEN a vendor selects "Wallet Only" payment, THE Payment_Service SHALL verify availableBalance >= remaining_amount
2. WHEN wallet payment is processed, THE Payment_Service SHALL decrease availableBalance by remaining_amount
3. WHEN wallet payment is processed, THE Payment_Service SHALL decrease frozenAmount by deposit_amount
4. WHEN wallet payment is processed, THE Payment_Service SHALL create payment record with type "wallet", amount as final_bid, and status "completed"
5. WHEN wallet payment succeeds, THE Auction_Service SHALL update auction status to "paid"
6. WHEN wallet payment succeeds, THE Notification_Service SHALL send payment confirmation to vendor and Finance Officer

### Requirement 15: Paystack-Only Payment Processing

**User Story:** As a vendor with insufficient wallet balance, I want to pay the remaining amount via Paystack, so that I can complete the purchase using my card or bank account.

#### Acceptance Criteria

1. WHEN a vendor selects "Paystack Only" payment, THE Payment_Service SHALL initialize Paystack transaction with amount as remaining_amount
2. WHEN Paystack transaction is initialized, THE Payment_Service SHALL set transaction amount as fixed value (vendor cannot modify)
3. WHEN Paystack payment succeeds, THE Payment_Service SHALL decrease frozenAmount by deposit_amount
4. WHEN Paystack payment succeeds, THE Payment_Service SHALL create payment record with type "paystack", amount as final_bid, paystackReference, and status "completed"
5. WHEN Paystack payment succeeds, THE Auction_Service SHALL update auction status to "paid"
6. WHEN Paystack payment fails, THE Payment_Service SHALL allow vendor to retry without penalty

### Requirement 16: Hybrid Payment Processing

**User Story:** As a vendor, I want to use my available wallet balance plus Paystack for the remainder, so that I minimize payment gateway fees.

#### Acceptance Criteria

1. WHEN a vendor selects "Hybrid" payment, THE Payment_Service SHALL calculate wallet_portion as min(availableBalance, remaining_amount)
2. WHEN a vendor selects "Hybrid" payment, THE Payment_Service SHALL calculate paystack_portion as remaining_amount - wallet_portion
3. WHEN hybrid payment is processed, THE Payment_Service SHALL first deduct wallet_portion from availableBalance
4. WHEN wallet deduction succeeds, THE Payment_Service SHALL initialize Paystack transaction with amount as paystack_portion (fixed, non-modifiable)
5. WHEN Paystack payment succeeds, THE Payment_Service SHALL decrease frozenAmount by deposit_amount
6. WHEN Paystack payment succeeds, THE Payment_Service SHALL create payment record with type "hybrid", walletAmount, paystackAmount, total as final_bid, and status "completed"
7. WHEN Paystack payment fails after wallet deduction, THE Payment_Service SHALL refund wallet_portion to availableBalance and allow retry

### Requirement 17: Finance Officer Payment Details Interface

**User Story:** As a finance officer, I want to see payment transaction cards with action buttons, so that I can manage auction payments efficiently without manual bidder selection.

#### Acceptance Criteria

1. WHEN a Finance Officer accesses payment transactions page, THE Payment_Transactions_UI SHALL display payment cards grouped by status
2. WHEN an auction is in "awaiting_documents" status, THE Payment_Details_Card SHALL display "Grant Extension" button
3. WHEN an auction is in "deposit_forfeited" status, THE Payment_Details_Card SHALL display "Transfer Forfeited Funds" button
4. WHEN an auction is in "failed_all_fallbacks" status, THE Payment_Details_Card SHALL display "Manual Intervention Required" badge
5. WHEN a Finance Officer clicks on payment card, THE Payment_Details_Modal SHALL display full auction history
6. WHEN payment details modal is displayed, THE Payment_Details_Modal SHALL show timeline of all bid events, document events, payment events, and fallback events

### Requirement 18: System Admin Configuration Interface

**User Story:** As a system admin, I want to configure all business rules from a central interface, so that I can adjust system behavior without code changes.

#### Acceptance Criteria

1. WHEN a System_Admin accesses admin configuration page, THE Admin_Config_UI SHALL display all configurable parameters
2. THE Admin_Config_UI SHALL display deposit_rate field with default value 10% and validation range 1-100%
3. THE Admin_Config_UI SHALL display minimum_deposit_floor field with default value ₦100,000 and validation minimum ₦1,000
4. THE Admin_Config_UI SHALL display tier_1_limit field with default value ₦500,000
5. THE Admin_Config_UI SHALL display minimum_bid_increment field with default value ₦20,000
6. THE Admin_Config_UI SHALL display document_validity_period field with default value 48 hours
7. THE Admin_Config_UI SHALL display max_grace_extensions field with default value 2
8. THE Admin_Config_UI SHALL display grace_extension_duration field with default value 24 hours
9. THE Admin_Config_UI SHALL display fallback_buffer_period field with default value 24 hours
10. THE Admin_Config_UI SHALL display top_bidders_to_keep_frozen field with default value 3
11. THE Admin_Config_UI SHALL display forfeiture_percentage field with default value 100%
12. THE Admin_Config_UI SHALL display payment_deadline_after_signing field with default value 72 hours

### Requirement 19: Configuration Change Validation and Persistence

**User Story:** As a system admin, I want my configuration changes to be validated and saved, so that invalid settings don't break the system.

#### Acceptance Criteria

1. WHEN a System_Admin modifies a configuration value, THE Config_Validator SHALL validate the value against defined constraints
2. WHEN deposit_rate is set outside 1-100% range, THE Config_Validator SHALL return error "Deposit rate must be between 1% and 100%"
3. WHEN minimum_deposit_floor is set below ₦1,000, THE Config_Validator SHALL return error "Minimum deposit floor must be at least ₦1,000"
4. WHEN all validations pass, THE Config_Service SHALL save configuration to system_config table
5. WHEN configuration is saved, THE Config_Service SHALL record change timestamp, changedBy admin ID, and previous values
6. WHEN configuration is saved, THE Config_Service SHALL apply new values to all subsequent operations immediately

### Requirement 20: Configuration Change Audit Trail

**User Story:** As a system admin, I want to see a history of configuration changes, so that I can track who changed what and when.

#### Acceptance Criteria

1. WHEN a System_Admin accesses configuration history page, THE Config_History_UI SHALL display all configuration changes in reverse chronological order
2. WHEN displaying configuration history, THE Config_History_UI SHALL show parameter name, old value, new value, changed by, and timestamp
3. WHEN a System_Admin filters configuration history, THE Config_History_UI SHALL support filtering by parameter name, date range, and admin user
4. WHEN a System_Admin views a specific configuration change, THE Config_History_UI SHALL display full context including reason for change if provided
5. FOR ALL configuration changes, THE Config_Service SHALL maintain immutable audit log records

### Requirement 21: Backward Compatibility with Existing Auctions

**User Story:** As a system, I want to handle auctions created before the deposit system was implemented, so that existing auctions complete without errors.

#### Acceptance Criteria

1. WHEN an auction was created before deposit system deployment, THE Auction_Service SHALL identify it by absence of depositAmount field in bids
2. WHEN processing a legacy auction bid, THE Escrow_Service SHALL freeze full bid amount (100%) instead of deposit percentage
3. WHEN a legacy auction closes, THE Auction_Closure_Service SHALL apply legacy closure logic without fallback chain
4. WHEN a legacy auction winner pays, THE Payment_Service SHALL process full amount without deposit deduction
5. FOR ALL new auctions created after deployment, THE Auction_Service SHALL use deposit-based logic exclusively

### Requirement 22: Deposit System Feature Flag

**User Story:** As a system admin, I want to enable or disable the deposit system globally, so that I can roll back to the old system if critical issues arise.

#### Acceptance Criteria

1. WHEN a System_Admin accesses feature flags page, THE Feature_Flag_UI SHALL display "Enable Deposit System" toggle
2. WHEN deposit system is disabled, THE Auction_Service SHALL use legacy full-amount freeze logic for all new auctions
3. WHEN deposit system is enabled, THE Auction_Service SHALL use deposit-based logic for all new auctions
4. WHEN deposit system is disabled mid-auction, THE Auction_Service SHALL continue using deposit logic for auctions already in progress
5. WHEN feature flag is toggled, THE Config_Service SHALL record toggle event with timestamp and admin ID

### Requirement 23: Vendor Deposit History and Transparency

**User Story:** As a vendor, I want to see a history of my deposits across all auctions, so that I can track my frozen funds and understand my financial commitments.

#### Acceptance Criteria

1. WHEN a vendor accesses their wallet page, THE Wallet_UI SHALL display current balance, availableBalance, and frozenAmount
2. WHEN a vendor accesses deposit history, THE Wallet_UI SHALL display all deposit freeze and unfreeze events
3. WHEN displaying deposit history, THE Wallet_UI SHALL show auction ID, asset name, deposit amount, event type (freeze/unfreeze/forfeit), and timestamp
4. WHEN a vendor has active deposits, THE Wallet_UI SHALL display list of auctions with frozen deposits and amounts
5. WHEN a vendor clicks on an auction in deposit history, THE Wallet_UI SHALL navigate to auction details page

### Requirement 24: Notification System for Deposit Events

**User Story:** As a vendor, I want to receive notifications about deposit-related events, so that I stay informed about my auction participation.

#### Acceptance Criteria

1. WHEN a vendor's deposit is frozen, THE Notification_Service SHALL send notification "Deposit of ₦{amount} frozen for auction {asset_name}"
2. WHEN a vendor is outbid and deposit is unfrozen, THE Notification_Service SHALL send notification "Deposit of ₦{amount} unfrozen - you were outbid on {asset_name}"
3. WHEN a vendor wins an auction, THE Notification_Service SHALL send notification "Congratulations! You won {asset_name}. Please sign documents within {hours} hours"
4. WHEN a vendor's documents are about to expire, THE Notification_Service SHALL send reminder 6 hours before deadline
5. WHEN a vendor receives grace extension, THE Notification_Service SHALL send notification "Extension granted: New deadline is {new_deadline}"
6. WHEN a vendor's deposit is forfeited, THE Notification_Service SHALL send notification "Deposit of ₦{amount} forfeited due to payment failure on {asset_name}"

### Requirement 25: Parser and Pretty Printer for Configuration Files

**User Story:** As a developer, I want to parse and format configuration files reliably, so that system configuration can be imported and exported without data loss.

#### Acceptance Criteria

1. WHEN a configuration file is provided, THE Config_Parser SHALL parse it into a SystemConfig object
2. WHEN an invalid configuration file is provided, THE Config_Parser SHALL return descriptive error with line number and issue
3. THE Config_Pretty_Printer SHALL format SystemConfig objects back into valid configuration files
4. FOR ALL valid SystemConfig objects, parsing then printing then parsing SHALL produce an equivalent object (round-trip property)
5. WHEN configuration is exported, THE Config_Pretty_Printer SHALL include comments explaining each parameter
6. WHEN configuration is imported, THE Config_Parser SHALL validate all values against business rule constraints

### Requirement 26: Escrow Wallet Invariant Enforcement

**User Story:** As a system, I want to maintain wallet balance invariants at all times, so that financial data remains consistent and auditable.

#### Acceptance Criteria

1. FOR ALL escrow wallet operations, THE Escrow_Service SHALL enforce invariant: balance = availableBalance + frozenAmount + forfeitedAmount
2. WHEN any wallet operation completes, THE Escrow_Service SHALL verify the invariant holds
3. WHEN invariant violation is detected, THE Escrow_Service SHALL rollback the transaction and log critical error
4. WHEN invariant violation is detected, THE Escrow_Service SHALL send alert to system administrators
5. FOR ALL wallet state transitions, THE Escrow_Service SHALL record before and after snapshots in audit log

### Requirement 27: Concurrent Bid Handling

**User Story:** As a system, I want to handle simultaneous bids on the same auction correctly, so that race conditions don't cause incorrect deposit calculations or double-freezing.

#### Acceptance Criteria

1. WHEN multiple vendors place bids simultaneously on the same auction, THE Bid_Service SHALL process bids sequentially using database-level locking
2. WHEN a vendor's bid is being processed, THE Bid_Service SHALL lock the vendor's escrow wallet record
3. WHEN a vendor's bid is being processed, THE Bid_Service SHALL lock the auction record
4. WHEN locks are acquired, THE Bid_Service SHALL re-validate bid eligibility before freezing deposit
5. WHEN bid processing completes, THE Bid_Service SHALL release all locks
6. WHEN lock acquisition times out, THE Bid_Service SHALL return error "System busy, please retry"

### Requirement 28: Idempotent Payment Processing

**User Story:** As a vendor, I want duplicate payment submissions to be handled safely, so that I'm not charged multiple times if I accidentally click "Pay" twice.

#### Acceptance Criteria

1. WHEN a vendor initiates payment, THE Payment_Service SHALL generate unique idempotency key
2. WHEN a vendor submits payment with existing idempotency key, THE Payment_Service SHALL return the original payment result without reprocessing
3. WHEN Paystack webhook is received multiple times for same transaction, THE Payment_Service SHALL process it only once
4. WHEN payment is already marked "completed", THE Payment_Service SHALL reject any new payment attempts for that auction
5. FOR ALL payment operations, THE Payment_Service SHALL use database transactions to ensure atomicity

### Requirement 29: Deposit Calculation Edge Cases

**User Story:** As a system, I want to handle edge cases in deposit calculation correctly, so that unusual bid amounts don't cause errors.

#### Acceptance Criteria

1. WHEN a vendor bids exactly the reserve_price, THE Deposit_Calculator SHALL calculate deposit as max(reserve_price × deposit_rate, minimum_deposit_floor)
2. WHEN calculated deposit equals minimum_deposit_floor, THE Deposit_Calculator SHALL use minimum_deposit_floor
3. WHEN a vendor's bid results in deposit less than ₦1, THE Deposit_Calculator SHALL round up to ₦1
4. WHEN a Tier_1_Vendor bids ₦500,000, THE Deposit_Calculator SHALL calculate deposit as ₦50,000 (not exceeding tier limit)
5. WHEN deposit_rate is changed mid-auction, THE Deposit_Calculator SHALL use the rate that was active when the bid was placed

### Requirement 30: Fallback Chain Termination Conditions

**User Story:** As a system, I want to terminate the fallback chain appropriately, so that auctions don't remain in limbo indefinitely.

#### Acceptance Criteria

1. WHEN all top N bidders have failed or are ineligible, THE Fallback_Service SHALL mark auction as "failed_all_fallbacks"
2. WHEN auction is marked "failed_all_fallbacks", THE Fallback_Service SHALL unfreeze all remaining deposits
3. WHEN auction is marked "failed_all_fallbacks", THE Fallback_Service SHALL record failure reason and timestamp
4. WHEN Finance Officer manually intervenes on failed auction, THE Auction_Service SHALL allow status change to "manual_resolution"
5. WHEN auction is in "manual_resolution", THE Auction_Service SHALL allow Finance Officer to select any bidder or cancel auction

