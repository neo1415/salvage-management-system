# Realistic Cost Analysis for NEM Insurance - AI Damage Assessment

## NEM Insurance Actual Data (2024-2025)

Based on publicly available financial reports:

**2024 Financial Year:**
- Insurance Revenue: ₦97.9 billion
- Claims Expenses: ₦24.9 billion
- Claims Ratio: 25.5%

**2025 Financial Year:**
- Insurance Revenue: ₦152.35 billion (56% growth)
- Claims Expenses: Estimated ~₦38-40 billion (based on similar ratio)

## Estimating Salvage Cases Volume

### Industry Context
- NEM is one of Nigeria's top 10 insurance companies
- Motor insurance is a significant portion of non-life business
- Not all claims result in salvage (only total loss/severe damage cases)
- Typical salvage rate: 5-10% of motor claims

### Conservative Estimate

**Assumptions:**
- Motor insurance represents ~20-30% of non-life premium
- Claims ratio for motor: ~30-40%
- Salvage cases: ~5-8% of motor claims
- NEM has 10-15 branches nationwide

**Calculation:**
- Annual motor claims: ₦24.9B × 25% (motor share) = ₦6.2B
- Average claim value: ₦500K - ₦2M
- Total motor claims: ~3,000 - 12,000 per year
- Salvage cases (7%): ~210 - 840 per year

**Daily Average:**
- **Low estimate**: 210 cases/year ÷ 365 days = **0.6 cases/day**
- **High estimate**: 840 cases/year ÷ 365 days = **2.3 cases/day**
- **Realistic average**: **1-2 cases per day**

### Peak vs Normal Days

- **Normal days**: 0-1 case
- **Peak days** (after holidays, bad weather): 3-5 cases
- **Slow days**: 0 cases
- **Monthly average**: 30-70 cases

---

## Revised Cost Analysis

### Scenario 1: Current Volume (1-2 cases/day)

**Monthly Volume**: ~45 cases

**Claude 3.5 Haiku:**
- Cost per assessment: $0.0092
- Monthly cost: 45 × $0.0092 = **$0.41/month** (~₦650)

**GPT-4o Mini:**
- Cost per assessment: $0.00165
- Monthly cost: 45 × $0.00165 = **$0.07/month** (~₦110)

### Scenario 2: Growth Phase (5 cases/day)

**Monthly Volume**: ~150 cases

**Claude 3.5 Haiku:**
- Monthly cost: 150 × $0.0092 = **$1.38/month** (~₦2,200)

**GPT-4o Mini:**
- Monthly cost: 150 × $0.00165 = **$0.25/month** (~₦400)

### Scenario 3: Multi-Tenant SaaS (10 companies, 5 cases/day each)

**Monthly Volume**: ~1,500 cases

**Claude 3.5 Haiku:**
- Monthly cost: 1,500 × $0.0092 = **$13.80/month** (~₦22,000)

**GPT-4o Mini:**
- Monthly cost: 1,500 × $0.00165 = **$2.48/month** (~₦4,000)

---

## Reality Check: I Was WAY Off

### My Original Estimate
- **250 cases/day** = 7,500 cases/month
- **$69/month for Claude**

### Actual Reality for NEM
- **1-2 cases/day** = 45 cases/month
- **$0.41/month for Claude** = ₦650/month
- **$0.07/month for GPT-4o Mini** = ₦110/month

### The Math Error
I assumed 250 cases/day based on... nothing. That would mean:
- 91,250 cases/year
- More salvage cases than NEM's TOTAL motor claims
- Completely unrealistic for a single company

---

## Recommendation: REVISED

### For Current NEM Volume (1-2 cases/day)

**Option 1: Claude 3.5 Haiku Primary (RECOMMENDED)**
- Cost: **~₦650/month** ($0.41)
- Quality: Best-in-class for damage assessment
- Reliability: Industry-leading uptime
- **Why**: At this price, quality and reliability matter more than saving ₦540/month

**Option 2: GPT-4o Mini Primary**
- Cost: **~₦110/month** ($0.07)
- Quality: Good enough for most cases
- Reliability: Very good
- **Why**: If budget is extremely tight

**Option 3: Hybrid (Claude + GPT-4o Mini fallback)**
- Cost: **~₦700/month** ($0.45)
- Best of both worlds
- **Why**: Overkill at this volume, but provides redundancy

### The Real Issue: Gemini Reliability

At 1-2 cases/day, the cost difference is **negligible**:
- Claude: ₦650/month
- GPT-4o Mini: ₦110/month
- **Difference: ₦540/month** (~$0.34/month)

**The question isn't cost - it's reliability.**

If Gemini has been down for a week, that's:
- 7-14 cases blocked
- Adjusters can't process claims
- Vendors can't bid on auctions
- Revenue impact >> ₦650/month

---

## Final Recommendation

### Immediate Action (Today)

**Use Claude 3.5 Haiku as primary**
- Sign up at https://console.anthropic.com/
- Get $5 free credit (covers ~543 assessments)
- Add payment method after testing
- Cost: **₦650/month** for current volume

**Why Claude over GPT-4o Mini?**
1. Better at structured analysis (your use case)
2. More reliable than Gemini
3. Cost difference is trivial (₦540/month)
4. Quality matters for insurance claims

### Don't Worry About Cost Until...

You hit **100+ cases/day** (multi-tenant SaaS with 50+ companies). At that point:
- Claude: ~₦27,600/month ($18)
- GPT-4o Mini: ~₦4,950/month ($3.20)

Then cost optimization matters. Right now, at 1-2 cases/day, **reliability >> cost**.

---

## The Gemini Free Tier Trap

**Gemini Free Tier:**
- Cost: ₦0
- Reliability: Week-long outages
- **Hidden cost**: Blocked claims, frustrated users, lost productivity

**Claude Paid Tier:**
- Cost: ₦650/month
- Reliability: 99.9% uptime
- **Value**: Claims process smoothly, users happy

**ROI Calculation:**
- If one blocked claim costs NEM ₦500K in delayed salvage recovery
- And Claude prevents that once per year
- ROI: ₦500,000 ÷ ₦7,800/year = **6,410% ROI**

---

## Summary

**Your instinct was right** - I was wildly overestimating volume.

**Actual cost for NEM:**
- Claude: **₦650/month** (not ₦69,000)
- GPT-4o Mini: **₦110/month** (not ₦12,000)

**Recommendation:**
Go with Claude. At ₦650/month, the reliability and quality are worth it. You'll spend more on coffee this month than on AI damage assessment.

**When to reconsider:**
When you hit 50+ cases/day (multi-tenant SaaS). Then optimize for cost.
