# Fraud Detection & Recommendations - Quick Start Guide

**Last Updated:** April 16, 2026

---

## 🚀 Quick Overview

We're implementing a comprehensive fraud detection system with 4 main components:

1. **Duplicate Vehicle Detection** (AI-powered) - CRITICAL ⭐
2. **IP Tracking & Identity Verification** - Foundation
3. **Vendor Recommendations** - User-facing feature
4. **Complete Fraud Detection** - Ongoing monitoring

**Total Cost:** $0.68/month (well under $5 budget!)

---

## 📁 Critical Files - READ THESE FIRST!

### Master Guides (In Order):
1. **`docs/NEXT_SESSION_FRAUD_IMPLEMENTATION_SUMMARY.md`** ⭐
   - Start here for next session
   - Complete task list
   - What's done, what's next

2. **`docs/COMPLETE_FRAUD_AND_RECOMMENDATIONS_IMPLEMENTATION.md`** ⭐⭐⭐
   - Master implementation guide
   - All 4 phases with code examples
   - **DO NOT LOSE THIS FILE!**

3. **`docs/FRAUD_DETECTION_COMPREHENSIVE_IMPLEMENTATION.md`**
   - Fraud patterns and algorithms
   - Detection strategies

4. **`docs/SESSION_SUMMARY_FRAUD_AND_AI_IMPLEMENTATION.md`**
   - Previous session summary
   - Research findings

---

## ✅ What's Done (Phase 1 Foundation)

### 1. Database Schema
**File:** `src/lib/db/schema/fraud-tracking.ts`
- fraud_attempts table
- vendor_interactions table
- vendor_recommendations table

### 2. Migration
**File:** `drizzle/migrations/add-fraud-tracking-tables.sql`
- Ready to run!
- Creates all tables + indexes
- Adds IP tracking to bids table

### 3. Duplicate Detection Service
**File:** `src/features/fraud/services/duplicate-detection.service.ts`
- AI photo comparison
- VIN/license plate checks
- Confidence scoring

### 4. Fraud Logging Service
**File:** `src/features/fraud/services/fraud-logging.service.ts`
- Logs fraud attempts
- Creates admin alerts
- Captures full user details

### 5. Case Creation API
**File:** `src/app/api/cases/route.ts`
- Duplicate check added
- Blocks fraudulent submissions

---

## 🔄 What's Next (Immediate Tasks)

### 1. Run Migration
```bash
psql -U your_user -d your_database -f drizzle/migrations/add-fraud-tracking-tables.sql
```

### 2. Fix Imports
In `src/features/fraud/services/fraud-logging.service.ts`:
```typescript
import { eq, desc } from 'drizzle-orm';
```

### 3. Test Duplicate Detection
Create: `scripts/test-duplicate-detection.ts`

### 4. Create IP Middleware
Create: `src/middleware.ts`

### 5. Update Bid API
Update: `src/app/api/auctions/[id]/bids/route.ts`

---

## 🎯 How It Works

### Duplicate Vehicle Detection Flow:

```
User submits case
    ↓
Check if vehicle type
    ↓
Quick checks (VIN, license plate)
    ↓
Find similar vehicles (make/model/year/color)
    ↓
AI compares photos
    ↓
Confidence > 85%?
    ↓
YES → Block + Log fraud attempt + Alert admin
NO → Create case normally
```

### What AI Analyzes:
- Unique damage patterns
- Interior features
- Modifications/accessories
- Paint condition
- Visible identifiers
- Tire/wheel condition

---

## 💰 Cost Breakdown

| Feature | Monthly Cost |
|---------|-------------|
| Damage Assessment | $0.43 |
| Duplicate Detection | $0.10 |
| Fraud Analysis | $0.001 |
| Recommendations | $0.15 |
| **Total** | **$0.68** |

**Budget:** $5.00/month  
**Remaining:** $4.32/month ✅

---

## 🧪 Testing Commands

```bash
# Test duplicate detection
npx tsx scripts/test-duplicate-detection.ts

# Test IP tracking
npx tsx scripts/test-ip-tracking.ts

# Generate recommendations
npx tsx scripts/generate-recommendations-test.ts

# Test fraud detection
npx tsx scripts/test-fraud-detection.ts
```

---

## 📊 Database Tables

### fraud_attempts
Stores all fraud attempt details:
- User info (name, email, ID)
- IP address & user agent
- Attempted data
- Matched case (for duplicates)
- AI confidence score
- Review status

### vendor_interactions
Tracks vendor behavior:
- Vendor ID
- Auction ID
- Interaction type (view, bid, watch)
- Timestamp

### vendor_recommendations
Stores recommendations:
- Vendor ID
- Auction ID
- Match score (0-100)
- Reason for recommendation

---

## 🚨 Fraud Detection Patterns

### Duplicate Vehicle (Implemented)
- VIN match: 100% confidence
- License plate: 95% confidence
- AI photo comparison: >85% confidence

### Shill Bidding (Next Phase)
- Repeated losses to same winner (>80%)
- Seller affinity (>70%)
- Last-minute bidding (>60%)
- Rapid escalation (<30 sec)
- New account aggressive bidding

### Payment Fraud (Next Phase)
- Multiple failed payments (>3)
- Overpayment scams (>10%)
- Payment method switching (>2)
- Chargeback patterns (>5%)

### IP Clustering (Next Phase)
- Multiple accounts from same IP
- Competing bids from same IP
- Smart gateway detection

---

## 🎓 Key Concepts

### Smart IP Analysis
- **Don't flag:** Office workers using same gateway IP
- **Do flag:** Multiple vendors from same IP bidding AGAINST each other
- **How:** Check if vendors from same IP are competing on same auctions

### AI Confidence Threshold
- **85%** for duplicate detection
- Tunable based on false positive rate
- Higher = fewer false positives, might miss some duplicates
- Lower = catch more duplicates, more false positives

### Fraud Alert Severity
- **Critical:** Confidence >90%, immediate action needed
- **High:** Confidence 70-90%, review soon
- **Medium:** Confidence 50-70%, monitor
- **Low:** Confidence <50%, informational

---

## 📝 Implementation Phases

### Phase 1: Duplicate Detection (Week 1) ✅ Foundation Complete
- Database schema ✅
- Duplicate detection service ✅
- Fraud logging ✅
- Case API update ✅
- **Next:** Run migration, test

### Phase 2: IP Tracking (Week 1)
- IP capture middleware
- Bid tracking update
- Smart IP analysis
- Device fingerprinting

### Phase 3: Recommendations (Week 2)
- Interaction tracking
- Recommendation algorithm
- Daily cron job
- Vendor dashboard

### Phase 4: Complete Fraud Detection (Week 3)
- Shill bidding detection
- Payment fraud detection
- Daily fraud detection cron
- Admin enhancements

---

## ✨ Success Criteria

- [ ] Duplicate submissions blocked
- [ ] Fraud attempts logged with full details
- [ ] Admin receives alerts
- [ ] Recommendations feed populated
- [ ] IP tracking working
- [ ] Smart IP analysis accurate
- [ ] AI cost under $1/month
- [ ] All fraud patterns implemented

---

## 🆘 Troubleshooting

### Migration Fails
- Check database connection
- Verify table names don't conflict
- Check user permissions

### AI Analysis Fails
- Check Gemini API key
- Check Claude API key
- Verify image format (base64)
- Check prompt length

### False Positives
- Lower confidence threshold
- Review AI reasoning
- Check photo quality
- Verify vehicle details accuracy

### False Negatives
- Raise confidence threshold
- Improve photo quality requirements
- Add more comparison features
- Review similar vehicle query

---

## 📞 Support

For questions or issues:
1. Check `docs/NEXT_SESSION_FRAUD_IMPLEMENTATION_SUMMARY.md`
2. Review `docs/COMPLETE_FRAUD_AND_RECOMMENDATIONS_IMPLEMENTATION.md`
3. Check fraud attempt logs in database
4. Review AI analysis reasoning

---

## 🎉 Quick Wins

Already implemented:
- ✅ AI-powered duplicate detection
- ✅ Fraud attempt logging
- ✅ Admin fraud alerts
- ✅ Full audit trail
- ✅ Under budget!

Next quick wins:
- Run migration (5 minutes)
- Test duplicate detection (10 minutes)
- Add IP tracking (30 minutes)

---

**Ready to continue? Start with `docs/NEXT_SESSION_FRAUD_IMPLEMENTATION_SUMMARY.md`!**

