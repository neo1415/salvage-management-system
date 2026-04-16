# Salvage Recovery Methodology for Insurance Claims

**Date**: 2026-04-15  
**Status**: Research Complete - Implementation Pending  
**Context**: Insurance Salvage Management System

## Executive Summary

This document defines the proper methodology for calculating salvage recovery metrics in an insurance claims management system when claim payout data is unavailable.

## Problem Statement

The current system calculates recovery metrics using:
- **Recovery Value** = Auction Sale Price
- **Profit** = Recovery Value - Market Value (pre-damage)
- **Recovery Rate** = Recovery Value / Market Value × 100%

This is **INCORRECT** for insurance salvage management because:
1. Market Value (pre-damage) is not the baseline for recovery calculations
2. The proper baseline is the Claim Amount Paid to the policyholder
3. We currently don't have Claim Amount Paid data in the system

## Industry Standard: Salvage Recovery Metrics

### What is Salvage Recovery?

According to insurance industry standards ([source](https://fastercapital.com)):
> "Salvage in insurance is the amount of money that an insurer can recover from selling the damaged property after paying the insured for the loss."

### The Proper Formula (When Claim Data Available)

```
Recovery Value = Auction Sale Price
Net Loss = Claim Paid - Recovery Value
Recovery Rate = (Recovery Value / Claim Paid) × 100%
```

**Example**:
- Insurance paid claim: ₦1,000,000
- Salvage sold for: ₦300,000
- Recovery Rate: 30%
- Net Loss to Insurer: ₦700,000

### What Recovery Rate Means

Recovery Rate is the percentage of the claim payout that was recovered through salvage sale. This is a KEY METRIC for insurance companies to track how much they recover from total loss claims.

**Industry Benchmarks**:
- 0% to 20%: Very low recovery
- 20% to 50%: Moderate recovery (common for total loss vehicles)
- 50%+: Strong recovery


## Current System Limitations

### Missing Data Field

The `salvage_cases` table does not have a `claimAmountPaid` field. This field would store:
- The actual amount the insurance company paid to the policyholder
- This is the proper baseline for recovery calculations
- Different from market value (pre-damage value)

### Why Market Value is Wrong

Market Value represents the pre-damage value of the asset. Using it as the baseline gives:
- **Negative profits** (₦-290M in current data)
- **Incorrect recovery rates** (1.87% instead of realistic 20-50%)
- **Misleading business metrics**

The issue: We're comparing salvage sale price (₦5.5M) to pre-damage value (₦296M), which makes no sense for insurance recovery.

## Recommended Solution (Without Claim Data)

Since we don't have claim amount data yet, we need an alternative approach that's still meaningful for business decisions.

### Option 1: Use Estimated Salvage Value (RECOMMENDED)

Calculate recovery efficiency based on estimated salvage value vs actual sale price:

```
Estimated Salvage Value = Market Value × Salvage Percentage
Salvage Percentage = typically 20-40% for total loss vehicles
Recovery Efficiency = (Actual Sale Price / Estimated Salvage Value) × 100%
```

**Example**:
- Market Value: ₦15,000,000
- Estimated Salvage (30%): ₦4,500,000
- Actual Sale Price: ₦5,000,000
- Recovery Efficiency: 111% (sold above estimate)

**Metrics to Track**:
- Total Salvage Value Recovered
- Average Recovery Efficiency
- Recovery by Asset Type
- Recovery by Condition


### Option 2: Track Gross Recovery Only

Simply track salvage recovery without calculating rates:

```
Total Salvage Recovered = Sum of all auction sales
Average Salvage per Case = Total / Number of Cases
Recovery by Asset Type
Recovery Trend Over Time
```

**Pros**: Simple, accurate, no misleading percentages  
**Cons**: Less actionable for business decisions

### Option 3: Add Claim Amount Field (FUTURE)

Add `claimAmountPaid` field to database schema for proper calculations:

```sql
ALTER TABLE salvage_cases 
ADD COLUMN claim_amount_paid DECIMAL(15,2);
```

Then use proper industry formula:
```
Recovery Rate = (Salvage Sale / Claim Paid) × 100%
Net Loss = Claim Paid - Salvage Sale
```

## Recommended Implementation

### Phase 1: Immediate Fix (Use Option 1)

1. Add `estimatedSalvageValue` calculation to repository
2. Update metrics to show:
   - Total Salvage Recovered (actual ₦ amount)
   - Recovery Efficiency (vs estimated salvage value)
   - Average Sale Price by Asset Type
3. Remove misleading "Profit" and "Recovery Rate" metrics
4. Add clear labels explaining what metrics mean

### Phase 2: Future Enhancement (Option 3)

1. Add `claimAmountPaid` field to schema
2. Update data entry forms to capture claim amount
3. Implement proper recovery rate calculations
4. Keep both metrics (efficiency vs estimate, rate vs claim)

## Updated Metrics Definitions

### For Current System (Without Claim Data)

**Total Salvage Recovered**: Sum of all auction sale prices  
**Average Recovery per Case**: Total recovered / number of cases  
**Recovery Efficiency**: Actual sale / estimated salvage value  
**Top Performing Asset Types**: Asset types with highest recovery efficiency


### For Future System (With Claim Data)

**Recovery Rate**: (Salvage sale / claim paid) × 100%  
**Net Loss**: Claim paid - salvage sale  
**Loss Ratio**: Net loss / claim paid  
**Recovery by Claim Size**: Group by claim amount ranges

## Data We Currently Have

From investigation of 21 sold cases:
- Total Market Value: ₦296,405,331 (pre-damage)
- Total Salvage Recovered: ₦5,530,000 (auction sales)
- Average per Case: ₦263,333
- All cases have auction bids/sales

## Proposed New Report Structure

### Summary Section
```
Total Cases Sold: 20
Total Salvage Recovered: ₦5,530,000
Average Recovery per Case: ₦276,500
Period: [Date Range]
```

### Recovery Efficiency Section
```
Asset Type | Cases | Avg Market Value | Avg Salvage | Efficiency
Vehicle    | 15    | ₦14,820,000     | ₦280,000   | 95%
Property   | 5     | ₦18,000,000     | ₦260,000   | 87%
```

### Trend Analysis
```
Show salvage recovery over time
Identify seasonal patterns
Track improvement in recovery rates
```

### No Misleading Metrics
- Remove "Profit" (negative ₦290M makes no sense)
- Remove "Recovery Rate" based on market value (1.87% is wrong)
- Remove "Profit Margin" (-98% is meaningless)

## References

Content rephrased for compliance with licensing restrictions from:
- [FasterCapital: Salvage in Insurance](https://fastercapital.com/content/From-Losses-to-Loss-Adjustment-Expenses--Uncovering-Salvage-in-Insurance.html)
- [Legal Clarity: Insurance Salvage Recovery Process](https://legalclarity.org/how-the-insurance-salvage-recovery-process-works/)

## Next Steps

1. Review this methodology with business stakeholders
2. Decide between Option 1 (estimated salvage) or Option 2 (gross recovery only)
3. Update repository and service layer with new calculations
4. Update UI components to show correct metrics
5. Document the methodology for users
6. Consider adding claim amount field in future release
