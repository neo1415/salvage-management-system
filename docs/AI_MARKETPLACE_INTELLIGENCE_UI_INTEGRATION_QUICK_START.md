# AI Marketplace Intelligence - UI Integration Quick Start

## What Was Integrated

### 1. Price Predictions on Auction Detail Pages
**Location:** Vendor → Auctions → [Click any active auction]

**What You'll See:**
- A "Price Prediction" card showing:
  - Predicted final price
  - Expected price range (lower/upper bounds)
  - Confidence score with visual indicator
  - "How is this calculated?" expandable section
  - Number of similar auctions analyzed
  - Market adjustments applied

**When It Shows:**
- Only for **active** or **extended** auctions
- Hidden for closed/cancelled auctions

### 2. Personalized Recommendations Feed
**Location:** Vendor → Auctions → "For You" Tab

**What You'll See:**
- A new "For You" tab (with sparkle ✨ icon) next to "Active" tab
- Grid of recommended auction cards with:
  - Match score (how relevant the auction is)
  - Reason tags (why it's recommended)
  - Auction details (asset, price, time remaining)
  - "Not Interested" button for feedback

**Features:**
- Infinite scroll (loads more as you scroll)
- Refresh button to get new recommendations
- Empty state if no recommendations available

## How to Test

### Test Price Predictions

1. **Navigate to an active auction:**
   ```
   http://localhost:3000/vendor/auctions
   → Click any auction with "Active" or "Extended" status
   ```

2. **Scroll down to see the prediction card:**
   - Located between GPS Location and Bid History sections
   - Shows predicted price with confidence level

3. **Click "How is this calculated?":**
   - Expands to show prediction methodology
   - Shows data points used
   - Shows market adjustments applied

### Test Recommendations Feed

1. **Navigate to auctions page:**
   ```
   http://localhost:3000/vendor/auctions
   ```

2. **Click "For You" tab:**
   - Second tab in the navigation (after "Active")
   - Has a sparkle icon ✨

3. **View recommendations:**
   - See personalized auction recommendations
   - Each card shows match score and reasons
   - Scroll down to load more (infinite scroll)

4. **Test "Not Interested" button:**
   - Click on any recommendation card
   - Click "Not Interested" button
   - Card should be removed from feed

5. **Test Refresh:**
   - Click "Refresh" button at top
   - Should reload recommendations

## API Endpoints

### Get Price Prediction
```bash
GET /api/auctions/{auctionId}/prediction
Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": {
    "predictedPrice": 1500000,
    "lowerBound": 1350000,
    "upperBound": 1650000,
    "confidenceScore": 0.85,
    "confidenceLevel": "High",
    "method": "historical",
    "sampleSize": 15
  }
}
```

### Get Recommendations
```bash
GET /api/vendors/{vendorId}/recommendations?limit=10
Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "auctionId": "uuid",
        "matchScore": 0.92,
        "reasonCodes": ["similar_bids", "preferred_type"],
        "auctionDetails": { ... }
      }
    ],
    "count": 10
  }
}
```

## Troubleshooting

### Prediction Card Not Showing

**Check:**
1. Is the auction **active** or **extended**? (Predictions only show for these statuses)
2. Open browser console - any errors?
3. Check network tab - is `/api/auctions/[id]/prediction` being called?
4. Check API response - does it return valid data?

**Common Issues:**
- **Auction is closed:** Predictions don't show for closed auctions
- **Insufficient data:** API returns 200 with message "Insufficient data for price prediction"
- **Authentication error:** User not logged in or session expired

### "For You" Tab Not Showing Recommendations

**Check:**
1. Is user logged in as a vendor?
2. Open browser console - any errors?
3. Check network tab - is `/api/vendors/[id]/recommendations` being called?
4. Check API response - does it return recommendations?

**Common Issues:**
- **New vendor:** No bidding history = no recommendations (shows empty state)
- **Authentication error:** User not logged in or session expired
- **API error:** Check server logs for errors

### Real-Time Updates Not Working

**Check:**
1. Is Socket.IO connected? (Look for green "Live updates active" indicator)
2. Open browser console - any Socket.IO errors?
3. Check server logs - is Socket.IO server running?

**Common Issues:**
- **Polling fallback:** Shows yellow "Updates every 3 seconds" (Socket.IO not connected)
- **WebSocket blocked:** Firewall or proxy blocking WebSocket connections

## Development Commands

### Run Development Server
```bash
npm run dev
```

### Run E2E Tests
```bash
# Test prediction flow
npm run test:e2e tests/e2e/intelligence/vendor-prediction-flow.e2e.test.ts

# Test recommendation flow
npm run test:e2e tests/e2e/intelligence/vendor-recommendation-flow.e2e.test.ts
```

### Check TypeScript Errors
```bash
npm run type-check
```

### Run All Intelligence Tests
```bash
# Unit tests
npm run test tests/unit/intelligence/

# Integration tests
npm run test tests/integration/intelligence/

# E2E tests
npm run test:e2e tests/e2e/intelligence/
```

## Next Steps

1. **Manual Testing:** Test both features in the browser
2. **E2E Tests:** Run automated tests to verify functionality
3. **Performance Testing:** Verify API response times <200ms
4. **User Feedback:** Get feedback from vendors on accuracy and relevance
5. **Monitoring:** Set up monitoring for prediction accuracy and recommendation effectiveness

## Support

For issues or questions:
1. Check browser console for errors
2. Check server logs for API errors
3. Review integration documentation: `docs/AI_MARKETPLACE_INTELLIGENCE_UI_INTEGRATION_COMPLETE.md`
4. Review API documentation: `docs/AI_MARKETPLACE_INTELLIGENCE_QUICK_REFERENCE.md`
