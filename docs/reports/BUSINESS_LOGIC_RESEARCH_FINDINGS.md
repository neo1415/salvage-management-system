# Business Logic Research Findings - Salvage Recovery Calculations

**Date**: 2026-04-15  
**Research Topic**: Proper salvage recovery metrics when claim data unavailable  
**Status**: Research Complete - Awaiting Decision

## Your Question

> "We don't have access to the paid claims here... is it possible to use salvage value here? We can't really rely on claim paid since we don't have that data yet... but don't just forget about it... it's possible we can have it later... but for now, we need to make do with what we have."

## What I Found

### The Industry Standard (When You Have Claim Data)

Insurance companies calculate salvage recovery like this:

```
Recovery Rate = (Salvage Sale Price / Claim Amount Paid) × 100%
```

**Example**:
- Insurance paid policyholder: ₦1,000,000
- Sold salvage for: ₦300,000  
- Recovery Rate: 30%
- Net Loss: ₦700,000

This tells the insurer: "We recovered 30% of what we paid out."

### Why Our Current Calculation is Wrong

We're currently doing:
```
Recovery Rate = (Salvage Sale / Market Value) × 100%
Profit = Salvage Sale - Market Value
```

This gives us:
- Recovery Rate: 1.87%
- Profit: -₦290,875,331

These numbers are meaningless because:
1. Market Value is the pre-damage value (what the car was worth before the accident)
2. We're comparing ₦5.5M in salvage sales to ₦296M in pre-damage values
3. This makes no sense for insurance recovery tracking


## Solutions for Your Situation (No Claim Data Yet)

Good news: You already have `estimatedSalvageValue` and `reservePrice` in your database!

### Option 1: Use Existing Estimated Salvage Value ⭐ RECOMMENDED

Your database already has `estimatedSalvageValue` for all 21 sold cases. Use this to calculate recovery efficiency:

```
Recovery Efficiency = (Actual Sale Price / Estimated Salvage Value) × 100%
```

**Real example from your data**:
- Case: GIA-8823
- Market Value: ₦1,500,000
- Estimated Salvage: ₦450,000 (already in DB)
- Actual Sale: ₦370,000
- Recovery Efficiency: 82.2%

**Another example**:
- Case: CTE-82863
- Market Value: ₦52,000
- Estimated Salvage: ₦4,160 (already in DB)
- Actual Sale: ₦30,000
- Recovery Efficiency: 721.2% (way above estimate!)

**What you'd track**:
- Total Salvage Recovered: ₦5,530,000
- Average Recovery Efficiency: Calculate from actual data
- Recovery Efficiency by Asset Type
- Cases that beat/missed estimates
- Comparison to Reserve Price

**Pros**:
- Uses REAL data already in your database
- No guessing or hallucinating numbers
- Shows if your auction process is working well
- Can identify which cases performed above/below expectations
- Makes business sense

**Cons**:
- Not the "true" recovery rate (that needs claim data)
- Depends on accuracy of initial salvage estimates

### Option 2: Track Gross Recovery Only

Just track the money coming in, no percentages:

```
Total Salvage Recovered: ₦5,530,000
Average per Case: ₦276,500
Recovery by Asset Type
Trend over time
```

**Pros**:
- Simple and accurate
- No misleading percentages
- Easy to understand

**Cons**:
- Less useful for decision-making
- Can't benchmark performance
- Doesn't show if you're doing well or poorly


### Option 3: Add Claim Amount Field (Future)

Add the field to your database so you can do proper calculations later:

```sql
ALTER TABLE salvage_cases 
ADD COLUMN claim_amount_paid DECIMAL(15,2);
```

Then you can calculate the real recovery rate:
```
Recovery Rate = (Salvage Sale / Claim Paid) × 100%
```

**Pros**:
- Industry standard metric
- Most meaningful for insurance business
- Can benchmark against other insurers

**Cons**:
- Requires schema change
- Need to update data entry process
- Historical data won't have this field

## My Recommendation

**Short Term (Now)**: Use Option 1 (Estimated Salvage Value)
- Remove the misleading "Profit" and "Recovery Rate" metrics
- Show "Total Salvage Recovered" and "Recovery Efficiency"
- Use 30% as estimated salvage percentage (can adjust based on your data)
- This gives you actionable metrics without claim data

**Long Term (Future)**: Add Option 3 (Claim Amount Field)
- Plan to add `claimAmountPaid` field in next schema update
- Update forms to capture this data going forward
- Then you can show both metrics:
  - Recovery Efficiency (vs estimated salvage)
  - Recovery Rate (vs claim paid)

## What This Means for Your Current Report

### Remove These (Misleading):
- ❌ Total Profit: ₦-290,875,331
- ❌ Profit Margin: -98.13%
- ❌ Recovery Rate: 1.87% (based on market value)

### Show These Instead:
- ✅ Total Salvage Recovered: ₦5,530,000
- ✅ Average Recovery per Case: ₦276,500
- ✅ Recovery Efficiency: [Calculate vs estimated salvage]
- ✅ Top Performing Asset Types
- ✅ Recovery Trend Over Time


## Example: How the Report Would Look

### Current (Wrong):
```
Summary:
Total Cases: 20
Total Market Value: ₦296,405,331
Total Recovery Value: ₦5,530,000
Total Profit: ₦-290,875,331  ❌ Makes no sense
Average Recovery Rate: 1.87%  ❌ Meaningless
Profit Margin: -98.13%  ❌ Wrong metric
```

### Proposed (Option 1 - Using Real Data):
```
Salvage Recovery Summary:
Total Cases Sold: 21
Total Salvage Recovered: ₦5,530,000
Average per Case: ₦263,333
Period: Jan 2026 - Apr 2026

Recovery Efficiency (Actual vs Estimated Salvage):
Vehicle: [Calculate from actual data]
Electronics: [Calculate from actual data]
Property: [Calculate from actual data]

Top Performers (Real Examples):
- Case CTE-82863: 721% efficiency (₦30K vs ₦4.1K estimate)
- Case APP-2738: 224% efficiency (₦120K vs ₦53.6K estimate)
- Case GIA-8823: 82% efficiency (₦370K vs ₦450K estimate)

Performance vs Reserve Price:
- Above Reserve: [Count cases]
- Below Reserve: [Count cases]
- Average Premium: [Calculate]
```

### Future (Option 3 - With Claim Data):
```
Salvage Recovery Summary:
Total Cases Sold: 20
Total Claims Paid: ₦8,500,000
Total Salvage Recovered: ₦5,530,000
Net Loss: ₦2,970,000
Recovery Rate: 65%  ✅ Industry standard metric

This means: We recovered 65% of what we paid out in claims.
```

## Questions for You

1. **Which option do you prefer?**
   - Option 1: Estimated salvage value (recommended)
   - Option 2: Gross recovery only
   - Option 3: Add claim field now (requires schema change)

2. **If Option 1, what salvage percentage should we use?**
   - 30% is typical for total loss vehicles
   - Can vary by asset type (vehicles vs property vs machinery)
   - We can analyze your historical data to calibrate this

3. **Do you want to add claim amount field in the future?**
   - This would let you track proper recovery rates
   - Requires updating data entry process
   - Historical data won't have this field

## Next Steps

Once you decide:
1. I'll update the calculation logic in the repository
2. Update the service layer with new metrics
3. Update the UI to show correct information
4. Add clear labels explaining what each metric means
5. Remove misleading metrics

## References

Research sources (content rephrased for compliance):
- FasterCapital: Salvage in Insurance
- Legal Clarity: Insurance Salvage Recovery Process
- Industry standards for salvage recovery calculations
