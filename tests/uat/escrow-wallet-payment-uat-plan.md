# User Acceptance Testing (UAT) Plan
## Escrow Wallet Payment Completion Feature

### Document Information
- **Feature**: Escrow Wallet Payment Completion
- **Version**: 1.0
- **Date**: 2024
- **Environment**: Staging
- **Status**: Ready for UAT

---

## 1. UAT Overview

### 1.1 Purpose
This UAT plan validates that the escrow wallet payment completion feature meets business requirements and provides a satisfactory user experience for vendors, finance officers, and administrators.

### 1.2 Scope
- Vendor wallet payment confirmation flow
- Document signing progress tracking
- Automatic fund release after document completion
- Finance Officer escrow payment management
- Admin pickup confirmation workflow
- Notifications and alerts
- Audit trail and reporting

### 1.3 Out of Scope
- Performance testing (covered in Task 8.2)
- Security testing (covered in Task 8.3)
- Automated E2E testing (covered in Task 8.1)

### 1.4 Success Criteria
- All acceptance criteria from requirements document validated
- No critical or high-severity bugs found
- User satisfaction rating ≥ 4.0/5.0
- All user workflows completed successfully
- Documentation is clear and accurate

---

## 2. Test Environment

### 2.1 Staging Environment Details
- **URL**: https://staging.salvage-app.com
- **Database**: Staging database (isolated from production)
- **Payment Gateway**: Paystack Test Mode
- **SMS/Email**: Test mode (no real messages sent)

### 2.2 Test Data Requirements
- 5 test vendor accounts with funded wallets
- 3 test finance officer accounts
- 2 test admin accounts
- 10 test auctions with various states
- Test payment records with escrow_wallet method
- Test documents for signing

### 2.3 Access Requirements
- Staging environment access for all testers
- Test account credentials
- VPN access (if required)
- Mobile devices for mobile testing

---

## 3. Test Participants

### 3.1 Vendor Testers (3-5 users)
**Profile**: Real vendors or vendor representatives
**Tasks**: 
- Complete wallet payment confirmation
- Sign documents and track progress
- Confirm pickup with authorization code
- Provide feedback on user experience

**Test Accounts**:
- vendor-uat-1@test.com
- vendor-uat-2@test.com
- vendor-uat-3@test.com
- vendor-uat-4@test.com
- vendor-uat-5@test.com

### 3.2 Finance Officer Testers (2-3 users)
**Profile**: Real finance officers or finance team members
**Tasks**:
- Monitor escrow payments
- Manually release funds when needed
- Review audit trails
- Generate reports
- Provide feedback on dashboard usability

**Test Accounts**:
- finance-uat-1@test.com
- finance-uat-2@test.com
- finance-uat-3@test.com

### 3.3 Admin Testers (2 users)
**Profile**: Real administrators or managers
**Tasks**:
- Confirm vendor pickups
- Review pickup confirmation list
- Provide feedback on admin workflow

**Test Accounts**:
- admin-uat-1@test.com
- admin-uat-2@test.com

### 3.4 UAT Coordinator
**Role**: Oversee UAT execution, collect feedback, track issues
**Responsibilities**:
- Schedule UAT sessions
- Provide test accounts and instructions
- Monitor test progress
- Collect and document feedback
- Triage and prioritize issues

---

## 4. UAT Test Scenarios

### 4.1 Vendor Test Scenarios

#### Scenario V1: Complete Wallet Payment Flow (Happy Path)
**Objective**: Validate end-to-end wallet payment experience

**Prerequisites**:
- Vendor has won an auction
- Vendor has sufficient frozen funds in wallet
- Payment method is escrow_wallet

**Test Steps**:
1. Login as vendor
2. Navigate to Payments page
3. Verify payment source shows "Escrow Wallet"
4. Verify frozen amount is displayed correctly
5. Click "Confirm Payment from Wallet" button
6. Verify confirmation modal appears
7. Confirm payment
8. Verify success message appears
9. Verify redirect to Documents page
10. Verify 3 documents are listed (Bill of Sale, Liability Waiver, Pickup Authorization)
11. Verify progress shows "0/3 documents signed"
12. Sign first document
13. Verify progress updates to "1/3 documents signed"
14. Verify notification received
15. Sign second document
16. Verify progress updates to "2/3 documents signed"
17. Verify notification received
18. Sign third document
19. Verify progress updates to "3/3 documents signed"
20. Verify success banner appears
21. Verify notification received with pickup code
22. Navigate to Dashboard
23. Verify "Confirm Pickup" button appears
24. Click "Confirm Pickup"
25. Enter pickup authorization code
26. Confirm pickup
27. Verify success message

**Expected Results**:
- All steps complete without errors
- UI is intuitive and easy to use
- Progress tracking is clear
- Notifications are timely and informative
- Pickup code is received and works correctly

**Acceptance Criteria Validated**:
- Requirement 1: All criteria (1.1-1.8)
- Requirement 2: All criteria (2.1-2.8)
- Requirement 5: Criteria (5.1-5.4)

---

#### Scenario V2: Document Signing with Interruptions
**Objective**: Validate that vendors can sign documents over multiple sessions

**Test Steps**:
1. Login as vendor
2. Confirm wallet payment
3. Sign first document
4. Logout
5. Wait 1 hour
6. Login again
7. Navigate to Documents page
8. Verify progress shows "1/3 documents signed"
9. Sign second document
10. Close browser
11. Open browser and login
12. Navigate to Documents page
13. Verify progress shows "2/3 documents signed"
14. Sign third document
15. Verify payment completes

**Expected Results**:
- Progress is preserved across sessions
- No data loss occurs
- User can resume where they left off

---

#### Scenario V3: Mobile Wallet Payment Experience
**Objective**: Validate mobile user experience

**Test Steps**:
1. Access staging site on mobile device
2. Login as vendor
3. Complete wallet payment confirmation
4. Sign all 3 documents on mobile
5. Confirm pickup on mobile

**Expected Results**:
- All UI elements are touch-friendly
- Text is readable without zooming
- Buttons are appropriately sized
- Progress bar displays correctly
- No horizontal scrolling required

---

#### Scenario V4: Error Handling - Invalid Pickup Code
**Objective**: Validate error handling for invalid pickup codes

**Test Steps**:
1. Complete payment and document signing
2. Navigate to pickup confirmation
3. Enter invalid pickup code
4. Attempt to confirm

**Expected Results**:
- Clear error message displayed
- User can retry with correct code
- No system errors occur

---

### 4.2 Finance Officer Test Scenarios

#### Scenario F1: Monitor Escrow Payments
**Objective**: Validate Finance Officer dashboard and payment monitoring

**Test Steps**:
1. Login as Finance Officer
2. Navigate to Payments page
3. Verify payment source column shows "Escrow Wallet" for escrow payments
4. Verify escrow status badges display correctly (Frozen, Released, Failed)
5. Filter payments by "Escrow Wallet" method
6. Verify only escrow payments are shown
7. Click on an escrow payment
8. Verify payment details modal shows:
   - Payment amount
   - Escrow status
   - Document progress (X/3)
   - Wallet balance
   - Frozen amount
9. Navigate to Dashboard
10. Verify "Escrow Wallet Payments" stat card displays
11. Verify count and percentage are correct

**Expected Results**:
- All escrow payment information is accurate
- Filtering works correctly
- Dashboard stats are correct
- UI is clear and professional

**Acceptance Criteria Validated**:
- Requirement 4: All criteria (4.1-4.10)

---

#### Scenario F2: Manual Fund Release
**Objective**: Validate manual fund release functionality

**Prerequisites**:
- Escrow payment with all documents signed
- Automatic release has not occurred (or failed)

**Test Steps**:
1. Login as Finance Officer
2. Navigate to Payments page
3. Filter by "Escrow Wallet"
4. Find payment with all documents signed
5. Click on payment to view details
6. Verify "Manual Release Funds" button is visible
7. Click "Manual Release Funds"
8. Verify confirmation modal appears
9. Confirm manual release
10. Verify success message appears
11. Verify payment status updates to "Verified"
12. Verify escrow status updates to "Released"
13. Navigate to audit trail
14. Verify manual release is logged with Finance Officer name

**Expected Results**:
- Manual release completes successfully
- Payment status updates correctly
- Audit trail records the action
- No errors occur

**Acceptance Criteria Validated**:
- Requirement 4: Criteria (4.5-4.7)

---

#### Scenario F3: Review Audit Trail
**Objective**: Validate audit trail completeness and accuracy

**Test Steps**:
1. Login as Finance Officer
2. Navigate to Payments page
3. Select an escrow payment
4. View audit trail
5. Verify timeline shows all events:
   - Wallet funded
   - Bid placed
   - Funds frozen
   - Auction won
   - Documents generated
   - Document 1 signed
   - Document 2 signed
   - Document 3 signed
   - Funds released
   - Pickup confirmed
6. Verify each event shows:
   - Timestamp
   - User
   - IP address (if applicable)
   - Device type (if applicable)
7. Export audit trail to CSV
8. Verify CSV contains all data

**Expected Results**:
- All events are logged
- Timestamps are accurate
- User information is correct
- CSV export works correctly

**Acceptance Criteria Validated**:
- Requirement 6: All criteria (6.1-6.7)

---

#### Scenario F4: Generate Escrow Performance Report
**Objective**: Validate reporting functionality

**Test Steps**:
1. Login as Finance Officer
2. Navigate to Reports > Escrow Performance
3. Verify report displays:
   - Total escrow payments
   - Total amount processed
   - Automation success rate
   - Document signing completion rate
   - Average processing time
   - Chart showing payments over time
4. Apply date range filter
5. Verify data updates correctly
6. Export report to PDF
7. Verify PDF is generated correctly
8. Export report to Excel
9. Verify Excel file contains all data

**Expected Results**:
- All metrics are accurate
- Charts display correctly
- Filtering works as expected
- Export functionality works

**Acceptance Criteria Validated**:
- Requirement 9: All criteria (9.1-9.10)

---

#### Scenario F5: Handle Failed Fund Release
**Objective**: Validate error handling and alerts

**Prerequisites**:
- Escrow payment with automatic release failure (simulated)

**Test Steps**:
1. Check email for fund release failure alert
2. Verify email contains:
   - Payment ID
   - Error details
   - Link to payment
3. Login as Finance Officer
4. Navigate to failed payment
5. Verify error details are displayed
6. Click "Retry Release"
7. Verify retry is successful

**Expected Results**:
- Alert email is received
- Error details are clear
- Retry functionality works
- Issue is resolved

**Acceptance Criteria Validated**:
- Requirement 7: All criteria (7.1-7.10)

---

### 4.3 Admin Test Scenarios

#### Scenario A1: Confirm Vendor Pickup
**Objective**: Validate admin pickup confirmation workflow

**Prerequisites**:
- Vendor has confirmed pickup

**Test Steps**:
1. Login as Admin
2. Navigate to Dashboard
3. Verify "Pending Pickup Confirmations" widget shows count
4. Click on widget to view pickups page
5. Verify list of pending confirmations displays
6. Verify vendor confirmation status is shown
7. Click on a pickup to view details
8. Verify vendor confirmation timestamp is shown
9. Enter notes (e.g., "Item collected in good condition")
10. Click "Confirm Pickup"
11. Verify success message appears
12. Verify pickup is removed from pending list
13. Verify transaction status updates to "Completed"

**Expected Results**:
- Pickup confirmation workflow is smooth
- Notes field works correctly
- Status updates properly
- No errors occur

**Acceptance Criteria Validated**:
- Requirement 5: Criteria (5.5-5.10)

---

#### Scenario A2: Review Pickup Confirmations List
**Objective**: Validate pickup confirmations list page

**Test Steps**:
1. Login as Admin
2. Navigate to Pickups page
3. Verify list shows:
   - Auction ID
   - Vendor name
   - Vendor confirmation status
   - Vendor confirmation timestamp
   - Action button
4. Sort by confirmation date
5. Verify sorting works
6. Filter by pending confirmations
7. Verify filtering works

**Expected Results**:
- List displays all relevant information
- Sorting and filtering work correctly
- UI is clear and organized

---

## 5. Feedback Collection

### 5.1 Feedback Form
After completing test scenarios, testers will complete a feedback form covering:

#### Usability (1-5 scale)
- How easy was it to complete the wallet payment?
- How clear was the document signing progress?
- How intuitive was the pickup confirmation process?
- How easy was it to find information on the dashboard?

#### Functionality (Yes/No/Partially)
- Did all features work as expected?
- Were there any errors or bugs?
- Were notifications timely and helpful?
- Was the audit trail complete and accurate?

#### Performance (1-5 scale)
- How fast did pages load?
- How responsive was the UI?
- Were there any delays or timeouts?

#### Overall Satisfaction (1-5 scale)
- Overall, how satisfied are you with this feature?
- Would you recommend this feature to other users?

#### Open-Ended Questions
- What did you like most about this feature?
- What did you like least about this feature?
- What improvements would you suggest?
- Any other comments or feedback?

### 5.2 Feedback Collection Methods
- Online survey (Google Forms or similar)
- One-on-one interviews
- Group feedback sessions
- Written feedback via email

---

## 6. Issue Tracking

### 6.1 Issue Severity Levels
- **Critical**: Feature is unusable, blocks testing
- **High**: Major functionality broken, workaround exists
- **Medium**: Minor functionality issue, does not block testing
- **Low**: Cosmetic issue, typo, minor UI issue

### 6.2 Issue Template
```
Issue ID: UAT-XXX
Title: [Brief description]
Severity: [Critical/High/Medium/Low]
Scenario: [Scenario ID]
Tester: [Tester name]
Date: [Date found]

Description:
[Detailed description of the issue]

Steps to Reproduce:
1. [Step 1]
2. [Step 2]
3. [Step 3]

Expected Result:
[What should happen]

Actual Result:
[What actually happened]

Screenshots/Videos:
[Attach if available]

Environment:
- Browser: [Browser name and version]
- Device: [Desktop/Mobile, OS]
- Account: [Test account used]
```

### 6.3 Issue Resolution Process
1. UAT Coordinator logs issue in tracking system
2. Development team triages issue
3. Critical/High issues are fixed immediately
4. Medium/Low issues are prioritized for future sprints
5. Tester verifies fix in staging
6. Issue is closed when verified

---

## 7. UAT Schedule

### 7.1 Preparation Phase (Week 1)
- **Day 1-2**: Set up staging environment
- **Day 3**: Create test data
- **Day 4**: Prepare test accounts
- **Day 5**: Distribute UAT plan and credentials

### 7.2 Execution Phase (Week 2)
- **Day 1**: Vendor testing (Scenarios V1-V4)
- **Day 2**: Finance Officer testing (Scenarios F1-F5)
- **Day 3**: Admin testing (Scenarios A1-A2)
- **Day 4**: Mobile testing and edge cases
- **Day 5**: Feedback collection and issue review

### 7.3 Review Phase (Week 3)
- **Day 1-2**: Fix critical and high-severity issues
- **Day 3**: Retest fixed issues
- **Day 4**: Collect final feedback
- **Day 5**: UAT sign-off meeting

---

## 8. UAT Deliverables

### 8.1 Test Execution Report
- Summary of test scenarios executed
- Pass/fail status for each scenario
- Issues found and their severity
- Overall test coverage

### 8.2 Feedback Summary Report
- Aggregated feedback scores
- Common themes and suggestions
- User satisfaction metrics
- Recommendations for improvements

### 8.3 Issue Log
- Complete list of issues found
- Issue severity and status
- Resolution details
- Verification status

### 8.4 UAT Sign-Off Document
- Confirmation that UAT is complete
- Acceptance criteria validation
- Go/No-Go recommendation for production
- Signatures from stakeholders

---

## 9. Acceptance Criteria Validation Checklist

### Requirement 1: Vendor Wallet Payment Confirmation UI
- [ ] 1.1: Payment source indicator displays
- [ ] 1.2: Frozen amount shows correctly
- [ ] 1.3: Confirm payment button displays
- [ ] 1.4: Confirmation modal appears
- [ ] 1.5: Payment status updates to wallet_confirmed
- [ ] 1.6: Success message displays
- [ ] 1.7: Redirects to documents page
- [ ] 1.8: Insufficient funds error displays

### Requirement 2: Document Signing Progress Tracking
- [ ] 2.1: Progress indicator shows X/3
- [ ] 2.2: Status badges display correctly
- [ ] 2.3: Progress updates to 1/3
- [ ] 2.4: Progress updates to 2/3
- [ ] 2.5: Progress updates to 3/3 with message
- [ ] 2.6: Success banner displays
- [ ] 2.7: Payment page shows document status
- [ ] 2.8: Push notifications sent

### Requirement 3: Automatic Fund Release
- [ ] 3.1: Fund release triggers within 30 seconds
- [ ] 3.2: releaseFunds() called correctly
- [ ] 3.3: Paystack transfer executes
- [ ] 3.4: Payment status updates to verified
- [ ] 3.5: Case status updates to sold
- [ ] 3.6: Pickup code generated
- [ ] 3.7: SMS and email sent
- [ ] 3.8: Audit log created
- [ ] 3.9: Paystack failure handled
- [ ] 3.10: Push notification sent
- [ ] 3.11: Wallet transaction history updated

### Requirement 4: Finance Officer Dashboard
- [ ] 4.1: Payment source column displays
- [ ] 4.2: Escrow status badges display
- [ ] 4.3: Payment details show all info
- [ ] 4.4: Fund release status displays
- [ ] 4.5: Manual release button shows
- [ ] 4.6: Manual release confirmation modal
- [ ] 4.7: Manual release logs correctly
- [ ] 4.8: Payment filtering works
- [ ] 4.9: Payment stats display
- [ ] 4.10: Failure alerts sent

### Requirement 5: Pickup Confirmation
- [ ] 5.1: Confirm pickup button displays
- [ ] 5.2: Pickup modal appears
- [ ] 5.3: Pickup code validates
- [ ] 5.4: Vendor status updates
- [ ] 5.5: Admin notification sent
- [ ] 5.6: Admin sees pending confirmations
- [ ] 5.7: Admin status updates
- [ ] 5.8: Transaction marked completed
- [ ] 5.9: Fund release triggered if needed
- [ ] 5.10: Audit log created

### Requirement 6: Audit Trail
- [ ] 6.1: Timeline displays all events
- [ ] 6.2: Event details show correctly
- [ ] 6.3: Paystack reference logged
- [ ] 6.4: CSV export works
- [ ] 6.5: Failed events highlighted
- [ ] 6.6: Audit log filtering works
- [ ] 6.7: Wallet balance changes shown

### Requirement 7: Error Handling
- [ ] 7.1: Paystack errors logged
- [ ] 7.2: Finance Officer email sent
- [ ] 7.3: Vendor error message displays
- [ ] 7.4: Funds remain frozen on failure
- [ ] 7.5: Error details display
- [ ] 7.6: Retry release works
- [ ] 7.7: Insufficient funds error displays
- [ ] 7.8: Document signing failure handled
- [ ] 7.9: Incomplete documents warning logged
- [ ] 7.10: Audit log created for errors

### Requirement 8: Notifications
- [ ] 8.1: Funds frozen SMS sent
- [ ] 8.2: First document notification sent
- [ ] 8.3: Second document notification sent
- [ ] 8.4: All documents SMS/email sent
- [ ] 8.5: Funds released SMS/email sent
- [ ] 8.6: Pickup reminder sent
- [ ] 8.7: Manual release SMS sent
- [ ] 8.8: Fund release failure SMS sent

### Requirement 9: Reporting
- [ ] 9.1: Escrow report section displays
- [ ] 9.2: Total payments and amount shown
- [ ] 9.3: Automation success rate shown
- [ ] 9.4: Document completion rate shown
- [ ] 9.5: Average processing time shown
- [ ] 9.6: Chart displays correctly
- [ ] 9.7: Date range filtering works
- [ ] 9.8: PDF and Excel export work
- [ ] 9.9: Top vendors shown
- [ ] 9.10: Failed payment reasons shown

### Requirement 10: Security
- [ ] 10.1: Document verification enforced
- [ ] 10.2: Frozen amount verification enforced
- [ ] 10.3: Payment status verification enforced
- [ ] 10.4: HTTPS and SSL verified
- [ ] 10.5: Transfer reference used
- [ ] 10.6: Balance invariant enforced
- [ ] 10.7: Finance Officer auth required
- [ ] 10.8: Sensitive data encrypted
- [ ] 10.9: Transaction references masked
- [ ] 10.10: NDPR compliance verified

---

## 10. UAT Sign-Off

### 10.1 Sign-Off Criteria
- [ ] All test scenarios executed
- [ ] All critical and high-severity issues resolved
- [ ] All acceptance criteria validated
- [ ] User satisfaction rating ≥ 4.0/5.0
- [ ] Feedback collected and documented
- [ ] UAT deliverables completed

### 10.2 Sign-Off Approvals

**UAT Coordinator**
- Name: ___________________________
- Signature: ___________________________
- Date: ___________________________

**Product Owner**
- Name: ___________________________
- Signature: ___________________________
- Date: ___________________________

**Finance Manager**
- Name: ___________________________
- Signature: ___________________________
- Date: ___________________________

**Technical Lead**
- Name: ___________________________
- Signature: ___________________________
- Date: ___________________________

### 10.3 Go/No-Go Decision
- [ ] **GO**: Feature is ready for production deployment
- [ ] **NO-GO**: Feature requires additional work before deployment

**Reason (if No-Go)**:
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________

---

## Appendix A: Test Account Credentials

### Vendor Accounts
| Email | Password | Wallet Balance | Frozen Amount |
|-------|----------|----------------|---------------|
| vendor-uat-1@test.com | Test123!@# | ₦1,000,000 | ₦400,000 |
| vendor-uat-2@test.com | Test123!@# | ₦800,000 | ₦300,000 |
| vendor-uat-3@test.com | Test123!@# | ₦1,500,000 | ₦500,000 |
| vendor-uat-4@test.com | Test123!@# | ₦600,000 | ₦200,000 |
| vendor-uat-5@test.com | Test123!@# | ₦2,000,000 | ₦700,000 |

### Finance Officer Accounts
| Email | Password | Role |
|-------|----------|------|
| finance-uat-1@test.com | Test123!@# | Finance Officer |
| finance-uat-2@test.com | Test123!@# | Finance Officer |
| finance-uat-3@test.com | Test123!@# | Finance Manager |

### Admin Accounts
| Email | Password | Role |
|-------|----------|------|
| admin-uat-1@test.com | Test123!@# | Admin |
| admin-uat-2@test.com | Test123!@# | Manager |

---

## Appendix B: Contact Information

### UAT Coordinator
- Name: [To be assigned]
- Email: [To be assigned]
- Phone: [To be assigned]

### Technical Support
- Name: [To be assigned]
- Email: [To be assigned]
- Phone: [To be assigned]

### Product Owner
- Name: [To be assigned]
- Email: [To be assigned]
- Phone: [To be assigned]

---

## Appendix C: Troubleshooting Guide

### Issue: Cannot login to staging
**Solution**: 
1. Verify you're using the correct URL
2. Check credentials are correct
3. Clear browser cache and cookies
4. Try incognito/private mode
5. Contact UAT Coordinator

### Issue: Payment not showing escrow wallet option
**Solution**:
1. Verify auction has escrow_wallet payment method
2. Verify vendor has frozen funds
3. Refresh the page
4. Contact Technical Support

### Issue: Document signing not working
**Solution**:
1. Verify all 3 documents are generated
2. Check browser console for errors
3. Try different browser
4. Contact Technical Support

### Issue: Notifications not received
**Solution**:
1. Check spam/junk folder
2. Verify phone number/email is correct
3. Remember: Staging uses test mode (no real messages)
4. Check notification logs in admin panel

### Issue: Manual fund release fails
**Solution**:
1. Verify all documents are signed
2. Verify payment status is correct
3. Check error message for details
4. Contact Technical Support

---

**End of UAT Plan**
