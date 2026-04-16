# E2E Tests for AI Marketplace Intelligence

## Overview

This directory contains comprehensive end-to-end tests for the AI-Powered Marketplace Intelligence system. These tests validate complete user workflows for predictions, recommendations, fraud detection, analytics, and PWA offline functionality.

## Test Coverage

### Task 12.3.1: Vendor Prediction Viewing Flow
**File**: `vendor-prediction-flow.e2e.test.ts`

**Coverage**:
- Vendor login and navigation to auction detail page
- Prediction card display with price range (predicted price, lower bound, upper bound)
- Confidence indicator visualization with color coding (High/Medium/Low)
- "How is this calculated?" expandable section
- Prediction explanation modal with method, data points, and market adjustments
- Real-time prediction updates via Socket.IO
- Mobile responsive design
- Error states (no prediction available)
- Keyboard navigation and accessibility
- ARIA labels and screen reader support

**Test Scenarios**:
- ✅ Display prediction card on auction detail page
- ✅ Display price range with lower and upper bounds
- ✅ Display confidence indicator with correct color coding
- ✅ Expand "How is this calculated?" section
- ✅ Display prediction explanation details
- ✅ Handle real-time prediction updates
- ✅ Display error state when prediction unavailable
- ✅ Mobile responsive layout
- ✅ Touch gesture support
- ✅ Keyboard navigation
- ✅ ARIA labels

### Task 12.3.2: Vendor Recommendation Feed Flow
**File**: `vendor-recommendation-flow.e2e.test.ts`

**Coverage**:
- Vendor login and navigation to "For You" tab
- Recommendation cards display with match scores (0-100%)
- Reason codes as colored tags (win rate, similar items, trending, etc.)
- Infinite scroll/pagination
- "Not Interested" button functionality with feedback tracking
- Click-through to auction details
- Real-time recommendation updates via Socket.IO
- Mobile touch gestures and swipe support
- Empty state (no recommendations)
- Auction stats (watching count, time remaining)

**Test Scenarios**:
- ✅ Navigate to "For You" tab and display recommendations
- ✅ Display recommendation cards with match scores
- ✅ Display reason codes as colored tags
- ✅ Support infinite scroll/pagination
- ✅ Handle "Not Interested" button click
- ✅ Navigate to auction details on card click
- ✅ Display real-time recommendation updates
- ✅ Display empty state when no recommendations
- ✅ Display auction stats
- ✅ Mobile responsive layout
- ✅ Touch gestures and swipe support
- ✅ Keyboard navigation
- ✅ ARIA labels
- ✅ Performance (load within 2 seconds)

### Task 12.3.3: Admin Fraud Alert Review Flow
**File**: `admin-fraud-alert-flow.e2e.test.ts`

**Coverage**:
- Admin login and navigation to intelligence dashboard
- Fraud alerts table display with risk scores, entity types, and reasons
- Fraud alert detail modal opening
- Fraud evidence display (patterns, anomalies, data)
- Action buttons (Dismiss, Confirm, Suspend)
- Fraud alert status updates
- Real-time fraud alert notifications via Socket.IO
- Filtering and sorting alerts
- Empty state (no pending alerts)

**Test Scenarios**:
- ✅ Navigate to intelligence dashboard
- ✅ Display fraud alerts table
- ✅ Display risk scores with color coding
- ✅ Open fraud alert detail modal
- ✅ Display fraud evidence in detail modal
- ✅ Display action buttons in detail modal
- ✅ Confirm fraud alert
- ✅ Dismiss fraud alert
- ✅ Update fraud alert status
- ✅ Receive real-time fraud alert notifications
- ✅ Filter alerts by status
- ✅ Sort alerts by risk score
- ✅ Display empty state when no alerts
- ✅ Mobile responsive layout
- ✅ Touch interactions
- ✅ Keyboard navigation
- ✅ ARIA labels
- ✅ Performance (load within 2 seconds)

### Task 12.3.4: Admin Analytics Dashboard Flow
**File**: `admin-analytics-flow.e2e.test.ts`

**Coverage**:
- Admin login and navigation to analytics page
- Asset performance matrix display
- Attribute performance tabs (Make, Model, Year, Condition)
- Temporal patterns heatmap
- Geographic distribution map
- Vendor segments visualization
- Conversion funnel diagram
- Session analytics metrics (avg session, bounce rate, return rate)
- Filters (assetType, dateRange, region)
- "Export All Analytics" functionality
- Drill-down functionality
- Chart tooltips and interactions

**Test Scenarios**:
- ✅ Navigate to analytics page
- ✅ Display asset performance matrix
- ✅ Display attribute performance tabs
- ✅ Display temporal patterns heatmap
- ✅ Display geographic distribution map
- ✅ Display vendor segments visualization
- ✅ Display conversion funnel diagram
- ✅ Display session analytics metrics
- ✅ Filter analytics by asset type
- ✅ Filter analytics by date range
- ✅ Filter analytics by region
- ✅ Export all analytics data
- ✅ Drill down into asset performance details
- ✅ Render charts without errors
- ✅ Display chart tooltips on hover
- ✅ Mobile responsive layout
- ✅ Touch interactions on charts
- ✅ Keyboard navigation
- ✅ ARIA labels for charts
- ✅ Text alternatives for visual data
- ✅ Performance (load within 3 seconds)

### Task 12.3.5: Mobile PWA Offline Functionality
**File**: `mobile-pwa-offline.e2e.test.ts`

**Coverage**:
- Service worker installation and registration
- Offline prediction caching (5-min TTL)
- Offline recommendation caching (15-min TTL)
- Offline mode indicators
- Background Sync for interaction tracking
- Pull-to-refresh gesture
- Swipe gestures on recommendation cards
- Network reconnection handling
- Cached data timestamp display
- Cache miss handling
- Intermittent connectivity handling

**Test Scenarios**:
- ✅ Install service worker
- ✅ Cache prediction data for offline access
- ✅ Cache recommendation data for offline access
- ✅ Display offline mode indicator
- ✅ Respect 5-minute TTL for prediction cache
- ✅ Respect 15-minute TTL for recommendation cache
- ✅ Queue interaction tracking for Background Sync
- ✅ Support pull-to-refresh gesture
- ✅ Support swipe gestures on recommendation cards
- ✅ Handle network reconnection gracefully
- ✅ Show cached data timestamp when offline
- ✅ Handle offline prediction requests gracefully
- ✅ Handle offline recommendation requests gracefully
- ✅ Update service worker when new version available
- ✅ Cache static assets for offline use
- ✅ Announce offline status to screen readers
- ✅ Load cached data quickly when offline (under 1 second)
- ✅ Handle cache miss gracefully
- ✅ Handle intermittent connectivity

## Running the Tests

### Run all intelligence E2E tests
```bash
npx playwright test tests/e2e/intelligence
```

### Run specific test file
```bash
npx playwright test tests/e2e/intelligence/vendor-prediction-flow.e2e.test.ts
npx playwright test tests/e2e/intelligence/vendor-recommendation-flow.e2e.test.ts
npx playwright test tests/e2e/intelligence/admin-fraud-alert-flow.e2e.test.ts
npx playwright test tests/e2e/intelligence/admin-analytics-flow.e2e.test.ts
npx playwright test tests/e2e/intelligence/mobile-pwa-offline.e2e.test.ts
```

### Run specific test suite
```bash
npx playwright test tests/e2e/intelligence/vendor-prediction-flow.e2e.test.ts -g "Vendor Prediction Viewing Flow"
```

### Run in headed mode (see browser)
```bash
npx playwright test tests/e2e/intelligence --headed
```

### Run in debug mode
```bash
npx playwright test tests/e2e/intelligence --debug
```

### Run on specific browser
```bash
npx playwright test tests/e2e/intelligence --project=chromium
npx playwright test tests/e2e/intelligence --project=firefox
npx playwright test tests/e2e/intelligence --project=webkit
```

### Run mobile tests
```bash
npx playwright test tests/e2e/intelligence --project="Mobile Chrome"
npx playwright test tests/e2e/intelligence --project="Mobile Safari"
```

## Test Data Requirements

### Prerequisites
Before running these tests, ensure the following test data exists:

1. **Test Users**:
   - Vendor: `vendor-e2e@test.com` (password: `Test123!@#`)
   - Admin: `admin-e2e@test.com` (password: `Test123!@#`)

2. **Test Auctions**:
   - Active auctions with predictions
   - Auctions with various asset types (vehicle, property, electronics, machinery)
   - Auctions with different damage severities

3. **Test Recommendations**:
   - Vendor with bidding history
   - Active auctions matching vendor preferences

4. **Test Fraud Alerts**:
   - Pending fraud alerts with various risk scores
   - Fraud alerts with different entity types (vendor, case, auction)

5. **Test Analytics Data**:
   - Historical auction data for analytics
   - Vendor segments data
   - Geographic distribution data

6. **Environment**:
   - Local development server running on `http://localhost:3000`
   - Database with test data seeded
   - Service worker enabled
   - Socket.IO server running

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
5. **Service worker issues**: Clear browser cache and reload
6. **Offline mode issues**: Verify service worker is registered before going offline

## CI/CD Integration

These tests are configured to run in CI/CD pipelines with:
- 2 retries on failure
- Sequential execution (workers: 1)
- HTML report generation
- Screenshot and trace capture on failure

## Best Practices

1. **Use data-testid attributes**: Prefer `data-testid` over text selectors for stability
2. **Wait for navigation**: Use `waitForURL()` instead of arbitrary timeouts
3. **Mock external APIs**: Mock Socket.IO and external services in tests
4. **Test user flows**: Focus on complete user journeys, not individual components
5. **Keep tests maintainable**: Use helper functions for common actions
6. **Test offline scenarios**: Always test both online and offline states
7. **Verify accessibility**: Include keyboard navigation and ARIA label tests
8. **Test mobile responsiveness**: Use mobile viewports and touch gestures

## Requirements Validation

These E2E tests validate the following requirements from the spec:

### Vendor Features
- ✅ Requirement 1: Auction Price Prediction
- ✅ Requirement 2: Historical Data Analysis for Price Prediction
- ✅ Requirement 3: Cold-Start Handling for Price Prediction
- ✅ Requirement 4: Smart Vendor Recommendations
- ✅ Requirement 5: Vendor Bidding Pattern Analysis
- ✅ Requirement 6: Cold-Start Handling for Vendor Recommendations
- ✅ Requirement 7: Interaction Data Collection

### Admin Features
- ✅ Requirement 14: Fraud Detection System
- ✅ Requirement 16: Monitoring and Accuracy Tracking
- ✅ Analytics Dashboard (Asset Performance, Temporal Patterns, Geographic Distribution)
- ✅ Vendor Segments Visualization
- ✅ Conversion Funnel Analysis
- ✅ Session Analytics

### PWA Features
- ✅ Service Worker Installation
- ✅ Offline Caching (Predictions: 5-min TTL, Recommendations: 15-min TTL)
- ✅ Background Sync for Interaction Tracking
- ✅ Pull-to-Refresh Gesture
- ✅ Swipe Gestures
- ✅ Network Reconnection Handling

### Non-Functional Requirements
- ✅ NFR1.1: Performance (page load <2s on 3G)
- ✅ NFR5.3: User Experience (mobile-optimized, responsive)
- ✅ NFR6: Accessibility (keyboard navigation, ARIA labels, screen reader support)

## Contributing

When adding new E2E tests:
1. Follow the existing test structure
2. Add descriptive test names
3. Include comments explaining test steps
4. Update this README with new test coverage
5. Ensure tests are independent and isolated
6. Test both success and error scenarios
7. Include mobile and accessibility tests

## Test Statistics

- **Total Test Files**: 5
- **Total Test Scenarios**: 100+
- **Browsers Tested**: Chromium, Firefox, WebKit
- **Mobile Devices Tested**: Pixel 5, iPhone 13
- **Accessibility Tests**: Keyboard navigation, ARIA labels, screen reader support
- **Performance Tests**: Load time, cache performance
- **Offline Tests**: Service worker, caching, Background Sync

## Known Limitations

1. **Service Worker**: Some browsers may not support service workers in test mode
2. **Background Sync**: Background Sync API may not be available in all test environments
3. **Offline Mode**: Playwright's offline mode may not perfectly simulate real network conditions
4. **Real-time Updates**: Socket.IO tests may require additional setup for CI/CD environments
5. **Chart Interactions**: Some chart libraries may not support programmatic interactions in tests

## Future Enhancements

1. Add visual regression tests for charts and visualizations
2. Add performance profiling tests
3. Add load testing for real-time updates
4. Add cross-browser compatibility tests
5. Add internationalization (i18n) tests
6. Add security tests (XSS, CSRF, etc.)
