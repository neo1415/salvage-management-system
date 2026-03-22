# End-to-End Tests for Escrow Wallet Payment Completion

## Overview

This directory contains comprehensive end-to-end tests for the escrow wallet payment completion feature. These tests validate the complete user journey from wallet payment confirmation through document signing, fund release, and pickup confirmation.

## Test Coverage

### Task 8.1.1: Complete Flow
- **File**: `escrow-wallet-payment-completion.spec.ts`
- **Test**: "should complete full escrow payment flow from wallet confirmation to pickup"
- **Coverage**:
  - Vendor wallet payment confirmation UI
  - Document signing progress tracking (0/3 → 1/3 → 2/3 → 3/3)
  - Automatic fund release after all documents signed
  - Pickup authorization code generation
  - Vendor pickup confirmation
  - Admin pickup confirmation
  - Transaction completion

### Task 8.1.2: Manual Fund Release
- **Test**: "should allow Finance Officer to manually release funds after all documents signed"
- **Coverage**:
  - Finance Officer authentication and authorization
  - Escrow payment filtering
  - Manual release button visibility (only when documents complete)
  - Manual release confirmation modal
  - Audit log entry for manual release
  - Payment status update to verified

### Task 8.1.3: Pickup Confirmation Workflow
- **Test**: "should complete pickup confirmation workflow with vendor and admin"
- **Coverage**:
  - Vendor pickup confirmation with authorization code
  - Invalid code validation
  - Admin notification of vendor confirmation
  - Admin pickup confirmation with notes
  - Transaction completion status
  - Notification to vendor after admin confirmation

### Task 8.1.4: Error Scenarios
- **Test**: "should handle Paystack transfer failure gracefully"
  - Paystack API failure simulation
  - Error message display to vendor
  - Finance Officer alert notification
  - Retry release functionality
  
- **Test**: "should handle insufficient frozen funds error"
  - Insufficient funds validation
  - Error message display
  - Payment status preservation

### Task 8.1.5: Concurrent Document Signing
- **Test**: "should handle concurrent document signing correctly"
  - Multiple browser sessions for same vendor
  - Document status synchronization
  - Duplicate signing prevention
  - Single fund release trigger
  
- **Test**: "should prevent race condition in fund release"
  - Rapid sequential document signing
  - Idempotent fund release
  - Payment verification uniqueness

## Additional Test Scenarios

### Finance Officer Dashboard Integration
- Escrow payment statistics display
- Payment filtering by escrow wallet method
- Escrow status badges (Frozen, Released, Failed)

### Audit Trail Verification
- Complete event logging
- Timestamp and user information
- CSV export functionality

### Notification Verification
- Progress notifications (1/3, 2/3)
- Completion notifications (3/3)
- SMS and email delivery

### Mobile Responsiveness
- Wallet payment confirmation on mobile
- Document signing progress on mobile
- Touch-friendly UI elements

### Accessibility
- Keyboard navigation support
- ARIA labels and roles
- Screen reader compatibility

## Running the Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run specific test file
```bash
npx playwright test escrow-wallet-payment-completion.spec.ts
```

### Run specific test suite
```bash
npx playwright test escrow-wallet-payment-completion.spec.ts -g "Complete Flow"
```

### Run in headed mode (see browser)
```bash
npx playwright test --headed
```

### Run in debug mode
```bash
npx playwright test --debug
```

### Run on specific browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Run mobile tests
```bash
npx playwright test --project="Mobile Chrome"
npx playwright test --project="Mobile Safari"
```

## Test Data Requirements

### Prerequisites
Before running these tests, ensure the following test data exists:

1. **Test Users**:
   - Vendor: `vendor-e2e@test.com` (password: `Test123!@#`)
   - Finance Officer: `finance-e2e@test.com` (password: `Test123!@#`)
   - Admin: `admin-e2e@test.com` (password: `Test123!@#`)

2. **Test Auction**:
   - Auction with escrow_wallet payment method
   - Frozen funds in vendor wallet
   - Payment record in pending status
   - Three documents generated (Bill of Sale, Liability Waiver, Pickup Authorization)

3. **Environment**:
   - Local development server running on `http://localhost:3000`
   - Database with test data seeded
   - Paystack test API keys configured

### Test Data Setup Script
Run the test data setup script before executing E2E tests:

```bash
npm run db:seed:e2e
```

## Test Isolation

Each test is designed to be independent and should:
- Create its own test data when possible
- Clean up after execution
- Not depend on other tests' state
- Use unique identifiers to avoid conflicts

## Debugging Failed Tests

### View test report
```bash
npx playwright show-report
```

### View screenshots
Failed test screenshots are saved to `test-results/` directory.

### View traces
Traces are captured on first retry and can be viewed with:
```bash
npx playwright show-trace test-results/[test-name]/trace.zip
```

### Common Issues

1. **Timeout errors**: Increase timeout in `playwright.config.ts` or specific test
2. **Element not found**: Check selectors and ensure elements are visible
3. **Authentication failures**: Verify test user credentials
4. **API mocking issues**: Check route patterns and response formats

## CI/CD Integration

These tests are configured to run in CI/CD pipelines with:
- 2 retries on failure
- Sequential execution (workers: 1)
- HTML report generation
- Screenshot and trace capture on failure

## Best Practices

1. **Use data-testid attributes**: Prefer `data-testid` over text selectors for stability
2. **Wait for navigation**: Use `waitForURL()` instead of arbitrary timeouts
3. **Mock external APIs**: Mock Paystack and SMS/email services in tests
4. **Test user flows**: Focus on complete user journeys, not individual components
5. **Keep tests maintainable**: Use helper functions for common actions

## Requirements Validation

These E2E tests validate the following requirements from the spec:

- ✅ Requirement 1: Vendor Wallet Payment Confirmation UI
- ✅ Requirement 2: Document Signing Progress Tracking
- ✅ Requirement 3: Automatic Fund Release on Document Completion
- ✅ Requirement 4: Finance Officer Escrow Payment Dashboard
- ✅ Requirement 5: Pickup Confirmation Workflow
- ✅ Requirement 6: Escrow Payment Audit Trail
- ✅ Requirement 7: Escrow Payment Error Handling
- ✅ Requirement 8: Escrow Payment Notifications

## Contributing

When adding new E2E tests:
1. Follow the existing test structure
2. Add descriptive test names
3. Include comments explaining test steps
4. Update this README with new test coverage
5. Ensure tests are independent and isolated
