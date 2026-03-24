# Heavy Equipment Search - Detailed Changes

## File 1: query-builder.service.ts

### Location
`src/features/internet-search/services/query-builder.service.ts`

### Function Modified
`buildMachineryQuery(machinery: MachineryIdentifier): string`

### Changes Made

#### 1. Restructured Query Building Order
**Before**: Brand + MachineryType + Model + Year
```typescript
let query = `${machinery.brand} ${machinery.machineryType}`;
if (machinery.model) query += ` ${machinery.model}`;
if (machinery.year) query += ` ${machinery.year}`;
```

**After**: Brand + Model + Year + Condition + MachineryType
```typescript
let query = `${machinery.brand}`;
if (machinery.model) query += ` ${machinery.model}`;
if (machinery.year) query += ` ${machinery.year}`;

// Add condition terms for better accuracy
if (machinery.condition) {
  const normalizedCondition = normalizeCondition(machinery.condition);
  if (normalizedCondition) {
    const conditionTerms = CONDITION_SEARCH_TERMS[normalizedCondition];
    if (conditionTerms && conditionTerms.length > 0) {
      query += ` ${conditionTerms[0]}`;
    }
  }
}

query += ` ${machinery.machineryType}`;
```

#### 2. Added Nigerian Marketplace Prioritization
**Before**:
```typescript
if (isHeavyEquipment) {
  query += ' heavy equipment construction excavator dealer';
}
```

**After**:
```typescript
if (isHeavyEquipment) {
  // Prioritize Nigerian marketplaces for heavy equipment
  query += ' price Nigeria site:jiji.ng OR site:cheki.ng';
}
```

### Impact
- Cleaner query structure
- Condition terms included in query
- Site operators force Nigerian marketplace results
- Removed redundant terms

---

## File 2: internet-search.service.ts

### Location
`src/features/internet-search/services/internet-search.service.ts`

### Function Modified
`searchMarketPrice(options: SearchMarketPriceOptions): Promise<MarketPriceResult>`

### Changes Made

#### 1. Increased Default Results for Machinery
**Before**:
```typescript
const { item, maxResults = 10, timeout = 3000 } = options;
```

**After**:
```typescript
// Increase maxResults for machinery to get more Nigerian marketplace results
const defaultMaxResults = options.item.type === 'machinery' ? 15 : 10;
const { item, maxResults = defaultMaxResults, timeout = 3000 } = options;
```

#### 2. Added Comprehensive Query Logging
**Before**: No logging
```typescript
const query = queryBuilder.buildMarketQuery(item);
const searchPromise = serperApi.search(query, { num: maxResults });
```

**After**: Detailed logging
```typescript
const query = queryBuilder.buildMarketQuery(item);

// Log the actual query being sent to Serper
console.log(`🔍 Serper Search Query: "${query}"`);
console.log(`📊 Search Parameters: maxResults=${maxResults}, timeout=${timeout}ms, itemType=${item.type}`);

const searchPromise = serperApi.search(query, { num: maxResults });
```

#### 3. Added Search Results Logging
**Before**: No logging
```typescript
const searchResults = await Promise.race([searchPromise, timeoutPromise]);
```

**After**: Detailed result logging
```typescript
const searchResults = await Promise.race([searchPromise, timeoutPromise]);

// Log search results summary
console.log(`📄 Search Results: ${searchResults.organic.length} results found`);
console.log(`🌐 Result Sources: ${searchResults.organic.map(r => new URL(r.link).hostname).join(', ')}`);
```

#### 4. Added Price Extraction Logging
**Before**: No logging
```typescript
const priceData = priceExtractor.extractPrices(
  searchResults.organic, 
  item.type,
  item.type === 'vehicle' ? item.year : undefined
);
```

**After**: Detailed price logging
```typescript
const priceData = priceExtractor.extractPrices(
  searchResults.organic, 
  item.type,
  item.type === 'vehicle' ? item.year : undefined
);

// Log extracted prices with sources
console.log(`💰 Prices Extracted: ${priceData.prices.length} prices found`);
priceData.prices.forEach((price, index) => {
  console.log(
    `  ${index + 1}. ₦${price.price.toLocaleString()} from ${price.source} ` +
    `(confidence: ${price.confidence}%) - "${price.originalText}"`
  );
});
```

### Impact
- 50% more results for machinery (15 vs 10)
- Complete visibility into search process
- Easy debugging of pricing issues

---

## File 3: price-extraction.service.ts

### Location
`src/features/internet-search/services/price-extraction.service.ts`

### Changes Made

#### 1. Added Jiji.ng Specific Price Pattern
**Before**: 6 patterns
```typescript
const NAIRA_PATTERNS = [
  /₦\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
  /NGN\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
  /([0-9,]+(?:\.[0-9]{1,2})?)\s*naira/gi,
  /₦\s*([0-9]+(?:\.[0-9]+)?)\s*([mk]|million|thousand)/gi,
  /([0-9]+(?:\.[0-9]+)?)\s*(million|thousand)\s*naira/gi,
  /₦\s*([0-9]+(?:\.[0-9]+)?)\s*([mk]|million|thousand)\s*(?:[-–—to]|and)\s*₦?\s*([0-9]+(?:\.[0-9]+)?)\s*([mk]|million|thousand)?/gi
];
```

**After**: 7 patterns (added Jiji.ng specific)
```typescript
const NAIRA_PATTERNS = [
  // ... existing patterns ...
  
  // NEW: Jiji.ng specific format: "₦ 120,000,000" (space after ₦ and commas in large numbers)
  /₦\s+([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?)/gi
];
```

#### 2. Enhanced extractPrices() with Detailed Logging
**Before**: No logging
```typescript
extractPrices(results, itemType, targetYear): PriceExtractionResult {
  const extractedPrices: ExtractedPrice[] = [];
  
  for (const result of results) {
    const snippetPrices = this.extractFromText(...);
    extractedPrices.push(...snippetPrices);
    // ... more extraction
  }
  
  const validPrices = this.validateAndDeduplicatePrices(...);
  return { prices: validPrices, ... };
}
```

**After**: Comprehensive logging
```typescript
extractPrices(results, itemType, targetYear): PriceExtractionResult {
  const extractedPrices: ExtractedPrice[] = [];
  
  console.log(`🔍 Starting price extraction from ${results.length} search results`);
  
  for (const result of results) {
    const domain = this.extractDomain(result.link);
    console.log(`\n📄 Processing result from: ${domain}`);
    console.log(`   Title: ${result.title.substring(0, 80)}...`);
    console.log(`   Snippet: ${result.snippet.substring(0, 100)}...`);
    
    const snippetPrices = this.extractFromText(...);
    if (snippetPrices.length > 0) {
      console.log(`   ✅ Found ${snippetPrices.length} price(s) in snippet`);
      snippetPrices.forEach(p => console.log(`      - ${p.originalText} = ₦${p.price.toLocaleString()}`));
    }
    // ... more extraction with logging
  }
  
  console.log(`\n📊 Total prices extracted before filtering: ${extractedPrices.length}`);
  const validPrices = this.validateAndDeduplicatePrices(...);
  console.log(`📊 Valid prices after filtering: ${validPrices.length}`);
  
  return { prices: validPrices, ... };
}
```

#### 3. Improved parseNairaPrice() with Better Comma Handling
**Before**:
```typescript
private parseNairaPrice(match, ...): ExtractedPrice | null {
  try {
    let price = 0;
    let confidence = 70;
    
    if (match.length >= 3 && match[2]) {
      // Handle abbreviations
      price = number * multiplier;
      confidence += 20;
    } else {
      // Handle regular format
      price = parseFloat(match[1].replace(/,/g, ''));
    }
    
    confidence += this.getSourceConfidenceBonus(url);
    return { price, currency: 'NGN', ... };
  } catch (error) {
    return null;
  }
}
```

**After**:
```typescript
private parseNairaPrice(match, ...): ExtractedPrice | null {
  try {
    let price = 0;
    let confidence = 70;
    
    if (match.length >= 3 && match[2]) {
      // Handle abbreviations
      price = number * multiplier;
      confidence += 20;
    } else {
      // Handle regular format (including large numbers with commas)
      const cleanedNumber = match[1].replace(/,/g, '');
      price = parseFloat(cleanedNumber);
      
      // Higher confidence for properly formatted large numbers (with commas)
      if (match[1].includes(',')) {
        confidence += 10;
      }
    }
    
    const sourceBonus = this.getSourceConfidenceBonus(url);
    confidence += sourceBonus;
    
    const domain = this.extractDomain(url);
    console.log(`   💵 Parsed: ${match[0]} → ₦${price.toLocaleString()} (confidence: ${Math.min(confidence, 100)}%, source: ${domain})`);
    
    return { price, currency: 'NGN', ... };
  } catch (error) {
    console.log(`   ❌ Failed to parse price: ${match[0]} - ${error}`);
    return null;
  }
}
```

### Impact
- Better extraction of Jiji.ng prices (₦ 120,000,000)
- +10% confidence for properly formatted numbers
- Complete visibility into price parsing
- Better error handling

---

## Testing Checklist

- [ ] Run test script: `tsx scripts/test-heavy-equipment-search-improvements.ts`
- [ ] Verify query includes `site:jiji.ng OR site:cheki.ng`
- [ ] Confirm 15 results are processed
- [ ] Check prices are from Jiji.ng/Cheki.ng
- [ ] Validate prices in ₦100M-₦130M range
- [ ] Review detailed logs for debugging
- [ ] Test with other heavy equipment (Komatsu, JCB, etc.)
- [ ] Verify no regression for other item types (vehicles, electronics)

## Performance Considerations

- **API Calls**: No increase (still 1 call per search)
- **Processing Time**: Minimal increase due to logging (~10-20ms)
- **Memory**: Negligible increase
- **Rate Limits**: No impact (same number of API calls)

## Monitoring

Watch for these metrics after deployment:
1. Average price for CAT 320 searches (should be ₦100M+)
2. Percentage of results from Nigerian marketplaces (should be >70%)
3. Price extraction success rate (should be >80%)
4. Search confidence scores (should be >70%)
