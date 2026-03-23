# Universal AI Internet Search System - Requirements

## Overview
Replace the current market data scraping system with a real-time AI-powered internet search system that provides market estimates and salvage values for any item type (vehicles, phones, laptops, watches, etc.) by leveraging Serper.dev API for Google search results. The current system scrapes specific Nigerian marketplaces (Jiji, Cars45, Cheki, Jumia) but is limited to vehicles and has reliability issues. The new system will use Google search to find pricing information universally across all item types.

## Business Requirements

### BR1: Universal Market Research
- **Requirement**: System must work universally for any item type, not just vehicles
- **Items Supported**: Cars, phones, laptops, watches, electronics, appliances, etc.
- **Search Capability**: Real-time internet search that returns the same results a user would get manually searching Google
- **Integration Point**: Seamlessly integrated into case creation workflow

### BR2: Cost-Effective Implementation
- **Primary API**: Serper.dev (Free tier: 2,500 searches/month, Paid: $0.30/1K searches)
- **Usage Estimate**: 50-500 case creations per month maximum
- **Cost Target**: Stay within free tier initially, minimal cost if exceeded ($0.15-$1.50/month)
- **Scalability**: Can upgrade to paid tier as volume grows

### BR3: Dual Search Functionality
- **Market Estimate**: Real-time search for item market value based on condition, year, mileage (if applicable)
- **Salvage Value**: AI-driven search for specific damaged parts pricing based on Gemini damage detection results
- **Condition Mapping**: 
  - Excellent → "Brand New" 
  - Good → "Foreign Used" (Tokunbo)
  - Fair → "Nigerian Used"
  - Poor → "Heavily Used"

## Functional Requirements

### FR1: Case Creation Integration
- **Trigger**: Automatic search when user completes vehicle/item details (make, model, year, condition, mileage)
- **Display**: Market estimate appears in real-time during case creation
- **Fallback**: Use existing database values if API fails or returns no results
- **Performance**: Search results within 2-3 seconds (Serper.dev avg: 1-2s)

### FR2: AI Damage Detection Integration
- **Input**: Gemini AI damage detection results (damaged components list)
- **Process**: Construct specific search queries for damaged parts (e.g., "Lexus 2021 bumper price Nigeria")
- **Output**: Salvage value calculation based on part replacement costs
- **Intelligence**: Smart query construction based on detected damage severity and components

### FR3: Universal Query Construction
- **Vehicle Queries**: "{Make} {Model} {Year} {Condition} price Nigeria"
- **Electronics Queries**: "{Brand} {Model} {Condition} price Nigeria" 
- **Part Queries**: "{Make} {Year} {Part} price Nigeria"
- **Localization**: Nigeria-focused searches with fallback to global results
- **Condition Translation**: Map UI conditions to search terms

### FR4: Search Result Processing
- **Data Extraction**: Parse Google search results for price information
- **Price Detection**: Extract numerical price values from search snippets
- **Confidence Scoring**: Rate result reliability based on source and data quality
- **Aggregation**: Combine multiple results for more accurate estimates
- **Caching**: Cache results to minimize API calls for similar searches

## Technical Requirements

### TR1: API Integration
- **Primary**: Serper.dev Google Search API
- **Authentication**: API key-based authentication
- **Rate Limiting**: Respect API limits (free tier: 2,500/month)
- **Error Handling**: Graceful fallback to database when API unavailable
- **Monitoring**: Track API usage and costs

### TR2: Performance Requirements
- **Response Time**: < 3 seconds for search completion
- **Availability**: 99.5% uptime with fallback mechanisms
- **Concurrency**: Handle multiple simultaneous searches
- **Caching**: 24-hour cache for identical queries to reduce API calls

### TR3: Data Quality
- **Validation**: Validate extracted price data for reasonableness
- **Source Filtering**: Prioritize reliable sources (OLX, Jiji, Cars45, etc.)
- **Outlier Detection**: Filter out unrealistic price outliers
- **Currency Handling**: Ensure all prices are in Nigerian Naira (₦)

## Integration Requirements

### IR1: Existing System Integration
- **Replace**: Current market data scraping system (`getMarketPrice()` in market-data.service.ts)
- **Replace**: Current `getMarketValueWithScraping()` function in ai-assessment-enhanced.service.ts
- **Maintain**: Backward compatibility with existing AI assessment workflow
- **Enhance**: Integrate with Gemini damage detection for salvage calculations
- **Preserve**: Existing condition mapping and quality tier systems
- **Preserve**: Database-first fallback strategy (check valuation database before internet search)

### IR2: Database Integration
- **Fallback**: Use existing vehicle valuation database when API fails (maintain current database-first strategy)
- **Caching**: Store successful search results in existing market data cache system
- **Analytics**: Log search queries and results using existing scraping logger service
- **Migration**: Gradual replacement of scraping system with internet search
- **Compatibility**: Maintain existing MarketPrice interface and response format

## Security Requirements

### SR1: API Security
- **Key Management**: Secure storage of Serper.dev API keys in environment variables
- **Rate Limiting**: Implement client-side rate limiting to prevent abuse
- **Input Validation**: Sanitize all search queries to prevent injection attacks
- **Error Logging**: Log API errors without exposing sensitive information

### SR2: Data Privacy
- **No PII**: Ensure search queries don't contain personally identifiable information
- **Audit Trail**: Log search activities for debugging and optimization
- **Compliance**: Ensure searches comply with terms of service

## Success Criteria

### SC1: Functionality
- ✅ Successfully replace manual database seeding with real-time searches
- ✅ Provide market estimates for 95% of common vehicle makes/models
- ✅ Generate salvage values based on AI-detected damage
- ✅ Support universal item types beyond vehicles

### SC2: Performance
- ✅ Search results returned within 3 seconds
- ✅ 99% API success rate with proper fallback handling
- ✅ Stay within free tier limits for initial deployment
- ✅ Seamless integration with existing case creation flow

### SC3: User Experience
- ✅ Market estimates appear automatically during case creation
- ✅ No additional user input required for basic searches
- ✅ Clear indication when estimates are from internet vs database
- ✅ Graceful handling of search failures

## Constraints

### C1: API Limitations
- **Free Tier**: 2,500 searches per month limit
- **Rate Limits**: Respect Serper.dev rate limiting
- **Geographic**: Primarily Nigeria-focused results
- **Language**: English language searches only

### C2: Technical Constraints
- **Existing Architecture**: Must integrate with current Next.js/TypeScript codebase
- **Database**: PostgreSQL with Drizzle ORM
- **AI Integration**: Must work with existing Gemini AI damage detection
- **Deployment**: Vercel-compatible implementation

### C3: Business Constraints
- **Budget**: Minimal cost increase for MVP phase
- **Timeline**: Implement within existing development sprint cycles
- **Maintenance**: Low maintenance overhead required
- **Scalability**: Must handle growth from 50 to 500+ cases/month

## Acceptance Criteria

### AC1: Core Functionality
- [ ] User creates case with Toyota Camry 2021, system automatically searches and displays market estimate
- [ ] Gemini AI detects bumper damage, system searches for "Toyota Camry 2021 bumper price" and calculates salvage value
- [ ] System works for non-vehicle items (iPhone 13, MacBook Pro, etc.)
- [ ] Fallback to database works when API is unavailable

### AC2: Integration
- [ ] Seamless integration with existing case creation UI
- [ ] Market estimates appear in real-time without page refresh
- [ ] AI assessment includes both market value and salvage value
- [ ] Existing condition mapping system continues to work

### AC3: Performance
- [ ] Search results appear within 3 seconds
- [ ] System handles 10 concurrent searches without degradation
- [ ] API usage stays within free tier limits for expected volume
- [ ] Proper error handling and user feedback for failures

## Dependencies

### D1: External Services
- **Serper.dev API**: Primary search service
- **Google Search**: Underlying search engine
- **Existing Database**: Fallback data source
- **Gemini AI**: Damage detection integration

### D2: Internal Systems
- **Case Creation UI**: Integration point
- **AI Assessment Service**: Core integration
- **Database Schema**: May need updates for caching
- **Environment Configuration**: API key management

## Risks and Mitigations

### R1: API Reliability
- **Risk**: Serper.dev API downtime or rate limiting
- **Mitigation**: Robust fallback to existing database, caching, retry logic

### R2: Search Quality
- **Risk**: Poor search results or price extraction accuracy
- **Mitigation**: Result validation, multiple source aggregation, manual override capability

### R3: Cost Overrun
- **Risk**: Exceeding free tier limits
- **Mitigation**: Usage monitoring, caching, query optimization

### R4: Performance Impact
- **Risk**: Slow search results affecting user experience
- **Mitigation**: Asynchronous processing, loading indicators, timeout handling