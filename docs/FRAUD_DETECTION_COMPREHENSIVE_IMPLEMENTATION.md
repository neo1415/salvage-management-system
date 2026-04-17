# Fraud Detection Comprehensive Implementation Guide

## Executive Summary

Based on research into salvage auction fraud patterns and machine learning detection methods, this document outlines a comprehensive fraud detection system for the NEM Insurance Salvage Auction platform.

**Current Status:**
- ✅ Fraud detection service exists (`src/features/intelligence/services/fraud-detection.service.ts`)
- ✅ Fraud alerts API exists (`src/app/api/intelligence/fraud/alerts/route.ts`)
- ✅ Admin fraud alerts page exists (`src/app/(dashboard)/admin/intelligence/page.tsx`)
- ❌ Vendor recommendations NOT working (empty feed)
- ❌ Fraud patterns need to be defined and implemented
- ❌ AI integration for fraud detection not configured

---

## Part 1: Fraud Patterns in Salvage Auctions

### 1.1 Shill Bidding (Primary Threat)

**Definition:** Fraudulent bidding by sellers or their associates to artificially inflate auction prices.

**Detection Patterns:**
```typescript
interface ShillBiddingIndicators {
  // Pattern 1: Same bidder repeatedly losing to same winner
  repeatedLosses: {
    bidderId: string;
    winnerId: string;
    auctionCount: number;
    lossRate: number; // >80% suspicious
  };
  
  // Pattern 2: Bidding only on specific seller's auctions
  sellerAffinity: {
    bidderId: string;
    sellerId: string;
    bidPercentage: number; // >70% suspicious
    totalBids: number;
  };
  
  // Pattern 3: Last-minute bid patterns
  lastMinuteBidding: {
    bidderId: string;
    bidsInLast5Minutes: number;
    totalBids: number;
    ratio: number; // >60% suspicious
  };
  
  // Pattern 4: Rapid bid escalation
  bidEscalation: {
    bidderId: string;
    averageTimeBetweenBids: number; // <30 seconds suspicious
    bidIncrements: number[]; // Consistent small increments suspicious
  };
  
  // Pattern 5: New account with aggressive bidding
  newAccountPattern: {
    bidderId: string;
    accountAge: number; // <7 days suspicious
    bidsPlaced: number; // >10 bids suspicious
    averageBidAmount: number;
  };
}
```

**Risk Score Calculation:**
```typescript
function calculateShillBiddingRisk(indicators: ShillBiddingIndicators): number {
  let score = 0;
  
  // Repeated losses (30 points)
  if (indicators.repeatedLosses.lossRate > 0.8) score += 30;
  else if (indicators.repeatedLosses.lossRate > 0.6) score += 20;
  
  // Seller affinity (25 points)
  if (indicators.sellerAffinity.bidPercentage > 0.7) score += 25;
  else if (indicators.sellerAffinity.bidPercentage > 0.5) score += 15;
  
  // Last-minute bidding (20 points)
  if (indicators.lastMinuteBidding.ratio > 0.6) score += 20;
  else if (indicators.lastMinuteBidding.ratio > 0.4) score += 10;
  
  // Rapid escalation (15 points)
  if (indicators.bidEscalation.averageTimeBetweenBids < 30) score += 15;
  else if (indicators.bidEscalation.averageTimeBetweenBids < 60) score += 8;
  
  // New account (10 points)
  if (indicators.newAccountPattern.accountAge < 7 && 
      indicators.newAccountPattern.bidsPlaced > 10) score += 10;
  
  return Math.min(score, 100);
}
```

### 1.2 Payment Fraud

**Patterns:**
```typescript
interface PaymentFraudIndicators {
  // Pattern 1: Multiple failed payment attempts
  failedPayments: {
    vendorId: string;
    failureCount: number; // >3 suspicious
    timeWindow: number; // Within 24 hours
  };
  
  // Pattern 2: Overpayment scam
  overpayment: {
    vendorId: string;
    paidAmount: number;
    requiredAmount: number;
    difference: number; // >10% suspicious
  };
  
  // Pattern 3: Payment method switching
  methodSwitching: {
    vendorId: string;
    methodChanges: number; // >2 suspicious
    timeWindow: number;
  };
  
  // Pattern 4: Chargeback history
  chargebackHistory: {
    vendorId: string;
    chargebackCount: number; // >1 suspicious
    totalTransactions: number;
    chargebackRate: number; // >5% suspicious
  };
}
```

### 1.3 Account Manipulation

**Patterns:**
```typescript
interface AccountManipulationIndicators {
  // Pattern 1: Multiple accounts from same IP
  ipClustering: {
    ipAddress: string;
    accountCount: number; // >3 suspicious
    accountIds: string[];
  };
  
  // Pattern 2: Rapid account creation
  rapidCreation: {
    ipAddress: string;
    accountsCreated: number;
    timeWindow: number; // <24 hours
  };
  
  // Pattern 3: Suspicious profile changes
  profileChanges: {
    vendorId: string;
    nameChanges: number;
    emailChanges: number;
    phoneChanges: number;
    timeWindow: number;
  };
}
```

### 1.4 Bid Manipulation Tactics

**Patterns:**
```typescript
interface BidManipulationIndicators {
  // Pattern 1: Bid shielding (placing high bid then retracting)
  bidShielding: {
    bidderId: string;
    highBidsPlaced: number;
    bidsRetracted: number;
    retractionRate: number; // >30% suspicious
  };
  
  // Pattern 2: Bid sniping (automated last-second bidding)
  bidSniping: {
    bidderId: string;
    bidsInLastSecond: number;
    totalBids: number;
    snipingRate: number; // >50% suspicious
  };
  
  // Pattern 3: Bid siphoning (contacting bidders off-platform)
  bidSiphoning: {
    sellerId: string;
    reportedContacts: number;
    suspiciousMessages: number;
  };
}
```

---

## Part 2: AI-Powered Fraud Detection

### 2.1 Using Gemini/Claude for Fraud Analysis

**When to Use AI:**
1. Complex pattern recognition across multiple data points
2. Natural language analysis of vendor communications
3. Anomaly detection in bidding behavior
4. Risk assessment with reasoning

**Cost-Effective Approach:**
```typescript
// Use AI only for high-risk cases (score > 60)
async function analyzeFraudWithAI(
  indicators: FraudIndicators,
  riskScore: number
): Promise<FraudAnalysis> {
  // Only use AI for high-risk cases
  if (riskScore < 60) {
    return {
      riskLevel: riskScore > 40 ? 'medium' : 'low',
      reasoning: 'Rule-based analysis',
      confidence: 0.7,
    };
  }
  
  // Use Gemini (primary) with Claude fallback
  const prompt = `Analyze this auction fraud case:
  
Risk Score: ${riskScore}/100

Indicators:
${JSON.stringify(indicators, null, 2)}

Provide:
1. Risk assessment (low/medium/high/critical)
2. Primary fraud type (shill bidding, payment fraud, etc.)
3. Specific evidence
4. Recommended action
5. Confidence level (0-1)

Format as JSON.`;

  try {
    // Try Gemini first (free tier)
    const result = await geminiAnalyze(prompt);
    return result;
  } catch (error) {
    // Fallback to Claude if Gemini fails
    const result = await claudeAnalyze(prompt);
    return result;
  }
}
```

### 2.2 Fraud Detection Service Enhancement

**File:** `src/features/intelligence/services/fraud-detection.service.ts`

```typescript
export class FraudDetectionService {
  // Add new method for comprehensive fraud analysis
  async analyzeVendorBehavior(vendorId: string): Promise<FraudAlert> {
    // 1. Gather all indicators
    const shillIndicators = await this.detectShillBidding(vendorId);
    const paymentIndicators = await this.detectPaymentFraud(vendorId);
    const accountIndicators = await this.detectAccountManipulation(vendorId);
    const bidIndicators = await this.detectBidManipulation(vendorId);
    
    // 2. Calculate risk score
    const riskScore = this.calculateOverallRisk({
      shill: shillIndicators,
      payment: paymentIndicators,
      account: accountIndicators,
      bid: bidIndicators,
    });
    
    // 3. Use AI for high-risk cases
    let aiAnalysis = null;
    if (riskScore > 60) {
      aiAnalysis = await this.analyzeFraudWithAI({
        shill: shillIndicators,
        payment: paymentIndicators,
        account: accountIndicators,
        bid: bidIndicators,
      }, riskScore);
    }
    
    // 4. Create fraud alert if needed
    if (riskScore > 40) {
      return await this.createFraudAlert({
        vendorId,
        riskScore,
        indicators: {
          shill: shillIndicators,
          payment: paymentIndicators,
          account: accountIndicators,
          bid: bidIndicators,
        },
        aiAnalysis,
        severity: riskScore > 80 ? 'critical' : riskScore > 60 ? 'high' : 'medium',
      });
    }
    
    return null;
  }
  
  private async detectShillBidding(vendorId: string) {
    // Query database for shill bidding patterns
    const bidHistory = await db
      .select()
      .from(bids)
      .where(eq(bids.vendorId, vendorId))
      .orderBy(desc(bids.createdAt))
      .limit(100);
    
    // Analyze patterns
    const repeatedLosses = this.analyzeRepeatedLosses(bidHistory);
    const sellerAffinity = this.analyzeSellerAffinity(bidHistory);
    const lastMinuteBidding = this.analyzeLastMinuteBidding(bidHistory);
    const bidEscalation = this.analyzeBidEscalation(bidHistory);
    const newAccountPattern = await this.analyzeNewAccountPattern(vendorId);
    
    return {
      repeatedLosses,
      sellerAffinity,
      lastMinuteBidding,
      bidEscalation,
      newAccountPattern,
    };
  }
  
  // ... implement other detection methods
}
```

---

## Part 3: Vendor Recommendations Fix

### 3.1 Why Recommendations Are Empty

**Current Issue:** The recommendation service exists but likely has no data or the algorithm isn't generating recommendations.

**Root Causes:**
1. No vendor interaction data tracked
2. No vendor preferences stored
3. No auction similarity calculations
4. No recommendation generation job running

### 3.2 Fix Implementation

**Step 1: Track Vendor Interactions**

```typescript
// src/features/intelligence/services/interaction-tracking.service.ts
export class InteractionTrackingService {
  async trackAuctionView(vendorId: string, auctionId: string) {
    await db.insert(vendorInteractions).values({
      vendorId,
      auctionId,
      interactionType: 'view',
      timestamp: new Date(),
    });
  }
  
  async trackBidPlacement(vendorId: string, auctionId: string) {
    await db.insert(vendorInteractions).values({
      vendorId,
      auctionId,
      interactionType: 'bid',
      timestamp: new Date(),
    });
  }
  
  async trackAuctionWatch(vendorId: string, auctionId: string) {
    await db.insert(vendorInteractions).values({
      vendorId,
      auctionId,
      interactionType: 'watch',
      timestamp: new Date(),
    });
  }
}
```

**Step 2: Generate Recommendations**

```typescript
// src/features/intelligence/services/recommendation.service.ts
export class RecommendationService {
  async generateRecommendations(vendorId: string): Promise<Recommendation[]> {
    // 1. Get vendor's bidding history
    const bidHistory = await this.getVendorBidHistory(vendorId);
    
    // 2. Extract preferences (asset types, price ranges, conditions)
    const preferences = this.extractPreferences(bidHistory);
    
    // 3. Find similar active auctions
    const activeAuctions = await db
      .select()
      .from(auctions)
      .where(eq(auctions.status, 'active'))
      .limit(50);
    
    // 4. Score and rank auctions
    const scoredAuctions = activeAuctions.map(auction => ({
      auction,
      score: this.calculateMatchScore(auction, preferences),
    }));
    
    // 5. Return top 10
    return scoredAuctions
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ auction, score }) => ({
        auctionId: auction.id,
        matchScore: score,
        reason: this.generateReason(auction, preferences),
      }));
  }
  
  private calculateMatchScore(auction: Auction, preferences: VendorPreferences): number {
    let score = 0;
    
    // Asset type match (40 points)
    if (preferences.preferredAssetTypes.includes(auction.case.assetType)) {
      score += 40;
    }
    
    // Price range match (30 points)
    const price = parseFloat(auction.currentBid || auction.case.reservePrice);
    if (price >= preferences.minPrice && price <= preferences.maxPrice) {
      score += 30;
    }
    
    // Condition match (20 points)
    if (preferences.preferredConditions.includes(auction.case.damageSeverity)) {
      score += 20;
    }
    
    // Location proximity (10 points)
    const distance = this.calculateDistance(
      preferences.location,
      auction.case.gpsLocation
    );
    if (distance < 50) score += 10;
    else if (distance < 100) score += 5;
    
    return score;
  }
}
```

**Step 3: Add Cron Job to Generate Recommendations**

```typescript
// src/app/api/cron/generate-recommendations/route.ts
export async function GET(request: NextRequest) {
  try {
    // Get all active vendors
    const vendors = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.status, 'active'));
    
    // Generate recommendations for each vendor
    for (const vendor of vendors) {
      const recommendations = await recommendationService.generateRecommendations(vendor.id);
      
      // Store recommendations
      await db.insert(vendorRecommendations).values(
        recommendations.map(rec => ({
          vendorId: vendor.id,
          auctionId: rec.auctionId,
          matchScore: rec.matchScore,
          reason: rec.reason,
          createdAt: new Date(),
        }))
      );
    }
    
    return NextResponse.json({ success: true, vendorsProcessed: vendors.length });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## Part 4: Implementation Roadmap

### Phase 1: Fraud Pattern Detection (Week 1)
- [ ] Implement shill bidding detection
- [ ] Implement payment fraud detection
- [ ] Implement account manipulation detection
- [ ] Add fraud risk scoring

### Phase 2: AI Integration (Week 2)
- [ ] Add Gemini/Claude fraud analysis
- [ ] Implement AI fallback chain
- [ ] Add fraud reasoning generation
- [ ] Test AI accuracy

### Phase 3: Fraud Alerts System (Week 3)
- [ ] Create fraud alerts in database
- [ ] Build admin fraud alerts page
- [ ] Add email notifications
- [ ] Implement alert review workflow

### Phase 4: Vendor Recommendations (Week 4)
- [ ] Track vendor interactions
- [ ] Build recommendation algorithm
- [ ] Generate recommendations daily
- [ ] Display recommendations in vendor dashboard

### Phase 5: Monitoring & Optimization (Week 5)
- [ ] Add fraud detection metrics
- [ ] Monitor false positive rate
- [ ] Tune detection thresholds
- [ ] Optimize AI usage costs

---

## Part 5: Cost Analysis

### AI Usage for Fraud Detection

**Scenario:** 45 cases/month, 10% flagged as high-risk

```
High-risk cases per month: 45 × 0.10 = 4.5 ≈ 5 cases
AI analysis per case: 1 request

Gemini Flash 2.0 (Primary):
- Input: 2,000 tokens (fraud indicators)
- Output: 500 tokens (analysis)
- Cost: $0.00001875 per case
- Monthly: 5 × $0.00001875 = $0.00009375

Claude Haiku 3.5 (Fallback, 10% of time):
- Input: 2,000 tokens
- Output: 500 tokens  
- Cost: $0.00125 per case
- Monthly: 0.5 × $0.00125 = $0.000625

Total Fraud Detection: $0.00072/month (₦1.15)
```

**Recommendation Generation:**

```
Daily job: 1 run/day × 30 days = 30 runs
Vendors: ~50 active vendors
AI reasoning per recommendation: Optional

Without AI: $0/month (rule-based only)
With AI reasoning (10 vendors): $0.15/month

Total: $0.15/month (₦240)
```

**Grand Total AI Cost:**
- Damage Assessment: $0.43/month
- Fraud Detection: $0.00072/month
- Recommendations: $0.15/month
- **Total: $0.58/month (₦928)**

Still well under $5/month budget!

---

## Part 6: Next Steps

### Immediate Actions:

1. **Research Complete** ✅
2. **Implement Shill Bidding Detection** (Priority 1)
3. **Fix Vendor Recommendations** (Priority 2)
4. **Connect to Admin Fraud Alerts Page** (Priority 3)
5. **Add AI Analysis for High-Risk Cases** (Priority 4)

### Questions for You:

1. Should we start with shill bidding detection or vendor recommendations first?
2. Do you want AI reasoning for all fraud alerts or only high-risk ones?
3. Should recommendations be generated daily or real-time?
4. What fraud alert severity levels do you want? (low/medium/high/critical)

---

## References

Content rephrased for compliance with licensing restrictions. Original research from:
- ResearchGate: "Online Detection of Shill Bidding Fraud Based on Machine Learning"
- Springer: "Building High-Quality Auction Fraud Dataset"
- FastCapital: "Auction Fraud Prevention Strategies"
- Insurance Thought Leadership: "Salvage Fraud: The Overlooked Risk"
