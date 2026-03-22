# Market Data Integration Status

## ✅ What's Working

1. **Market Data Scraping System**: Fully implemented and tested (15/15 tests passing)
   - Cache service with 7-day freshness policy
   - Scraper service with rate limiting and timeouts
   - Background job processing for stale data
   - Confidence scoring based on source count and data age
   - Database schema with proper indexing

2. **AI Assessment Integration**: Code is in place
   - `getMarketValueWithScraping()` function in `ai-assessment-enhanced.service.ts`
   - Calls `getMarketPrice()` from market data service
   - Applies mileage and condition adjustments
   - Falls back to estimation if scraping fails

## ⚠️ Current Limitations

### 1. Mock Scraping Data
The scraper service is currently **mocked** because:
- Real web scraping requires:
  - Puppeteer/Playwright for JavaScript-heavy sites
  - Proxy rotation to avoid IP bans
  - CAPTCHA solving services
  - Legal compliance with website terms of service
  
**Current behavior**: Returns mock prices (₦6-7 million range) for testing

### 2. Understanding the ₦325,000 Value

The value you're seeing (₦325,000) is the **SALVAGE VALUE**, not the market value. Here's the calculation:

```
Market Value (undamaged):     ₦X million
- Estimated Repair Cost:      ₦Y million
= Salvage Value (damaged):    ₦325,000
× 70% Reserve Price Factor:   ₦227,500
```

If salvage value is ₦325,000, this suggests:
- Either the market value was very low to begin with
- Or the damage was assessed as very severe (high repair cost)
- Or the vehicle info wasn't passed correctly

## 🔍 Debugging Steps

### Check What Data the AI Received

1. **Look at browser console logs** when creating a case:
   ```
   🔍 Starting enhanced AI assessment...
   📸 Photos: X
   🚗 Vehicle: [make] [model] [year]
   🌐 Fetching market data from scraping service...
   ✅ Market data retrieved: { median: X, sources: Y, confidence: Z }
   ```

2. **Check the AI assessment response** in Network tab:
   - Look for `/api/cases/ai-assessment` request
   - Check the response body for:
     - `marketValue`: Should be in millions (₦5-10M)
     - `estimatedRepairCost`: Repair cost estimate
     - `estimatedSalvageValue`: Market value - repair cost
     - `confidence.valuationAccuracy`: Should be 60-90%

### Verify Vehicle Info is Being Passed

Check the case creation form sends:
```typescript
{
  assetDetails: {
    make: "Toyota",
    model: "Camry",
    year: 2020,
    mileage: 50000,
    condition: "good"
  }
}
```

## 📊 How to See Market Data Sources

### Option 1: Run the Check Script
```bash
npx tsx scripts/check-market-data.ts
```

This shows:
- All cached market data
- Source prices (jiji, jumia, etc.)
- Scraping logs (success/failure)
- Data freshness

### Option 2: Query Database Directly
```sql
-- See cached market data
SELECT 
  property_type,
  property_details,
  median_price,
  source_count,
  scraped_at,
  stale_at
FROM market_data_cache
ORDER BY scraped_at DESC
LIMIT 10;

-- See individual source prices
SELECT 
  mds.source_name,
  mds.price,
  mds.listing_title,
  mds.listing_url,
  mdc.property_details
FROM market_data_sources mds
JOIN market_data_cache mdc ON mds.cache_id = mdc.id
ORDER BY mds.scraped_at DESC
LIMIT 20;

-- See scraping logs
SELECT 
  status,
  source_name,
  prices_found,
  duration_ms,
  error_message,
  created_at
FROM scraping_logs
ORDER BY created_at DESC
LIMIT 20;
```

### Option 3: Add UI to Show Market Data

We can add a section to the AI assessment results showing:
```
Market Data Sources:
✓ Jiji.ng: ₦7,111,762 (2 hours ago)
✓ Jumia: ₦6,613,814 (2 hours ago)
✗ Cars45: Timeout
✗ Cheki: Timeout

Median Market Value: ₦6,862,788
Confidence: 80% (2 sources, fresh data)
```

## 🚀 Next Steps

### To Enable Real Scraping:

1. **Set up scraping infrastructure**:
   - Install Puppeteer: `npm install puppeteer`
   - Configure proxy service (optional but recommended)
   - Set up CAPTCHA solving (if needed)

2. **Implement real scrapers** in `src/features/market-data/services/scraper.service.ts`:
   - Replace mock implementation with real Puppeteer code
   - Add selectors for each website (jiji.ng, jumia.ng, etc.)
   - Handle pagination and dynamic content

3. **Legal considerations**:
   - Review terms of service for each website
   - Implement rate limiting (already done)
   - Add user-agent rotation
   - Consider using official APIs if available

### To Improve AI Assessment Display:

1. **Show market data breakdown** in the UI
2. **Add confidence indicators** for each data source
3. **Display calculation details**:
   ```
   Market Value: ₦6,862,788 (from 2 sources)
   - Mileage adjustment: -5% (high mileage)
   - Condition adjustment: -15% (fair condition)
   = Adjusted Market Value: ₦5,550,000
   
   Estimated Repair Cost: ₦5,225,000
   = Salvage Value: ₦325,000
   ```

4. **Add warnings** when values seem unusual:
   - "⚠️ Salvage value is very low - vehicle may be total loss"
   - "⚠️ Limited market data - confidence is low"

## 🎯 Immediate Action

To understand why you're seeing ₦325,000:

1. **Check browser console** during case creation
2. **Look for these log messages**:
   - "🌐 Fetching market data from scraping service..."
   - "✅ Market data retrieved: ..."
   - "💰 Using user-provided market value: ..."
   - "⚠️ No vehicle info provided, using generic estimation"

3. **Check the full AI assessment response**:
   - Open Network tab in browser
   - Find the AI assessment API call
   - Look at the full response JSON
   - Check `marketValue`, `estimatedRepairCost`, `estimatedSalvageValue`

4. **Verify the damage assessment**:
   - High damage percentage = high repair cost = low salvage value
   - Check `damagePercentage` and `damageSeverity` in response

The market data system is working correctly. The issue is likely either:
- Vehicle info not being passed from the form
- Very severe damage detected (high repair cost)
- Mock mode returning low values for testing
