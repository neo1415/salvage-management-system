# AI Valuation & Damage Detection Critical Bugs

**Date:** March 7, 2026  
**Status:** 🔴 CRITICAL - Production Impact

## Executive Summary

Two critical bugs are affecting AI assessment accuracy:

1. **Valuation Bug:** Mercedes (and likely other non-Toyota makes) return incorrect prices due to wrong condition category mappings
2. **Damage Detection Bug:** Vision API detects damage correctly but `identifyDamagedComponents` incorrectly filters it out, always returning "minor" damage

---

## Bug #1: Incorrect Valuation Prices for Non-Toyota Vehicles

### Symptoms
- Mercedes GLE 350 W166 2016 (excellent, 50k km) returns ₦5-12M instead of ₦26-32M
- Toyota Camry 2021 works correctly (₦18M for fair condition)
- Issue affects Mercedes and likely other makes

### Root Cause Analysis

**Database Investigation:**
```sql
SELECT * FROM vehicle_valuations 
WHERE make = 'Mercedes-Benz' 
  AND model = 'GLE350 W166' 
  AND year = 2016;
```

**Results:**
| Condition | Low | Average | High |
|-----------|-----|---------|------|
| `nig_used_low` | ₦5M | ₦8.5M | ₦12M |
| `tokunbo_low` | ₦18M | ₦25M | ₦32M |

**Problem:** The seed data uses non-standard condition categories:
- ❌ `nig_used_low`, `tokunbo_low` (custom categories)
- ✅ Should be: `excellent`, `good`, `fair`, `poor` (standard)

**Why Toyota Works:**
Toyota seed data uses correct standard categories (`excellent`, `good`, `fair`, `poor`), so the valuation query finds exact matches.

**Why Mercedes Fails:**
1. User selects "excellent" condition
2. Query looks for `conditionCategory = 'excellent'`
3. No match found (database has `nig_used_low` instead)
4. Falls back to wrong price tier or estimation

### Market Reality Check

According to [Nigerian market data](https://veriontech.com/mercedes-benz-gle350-prices-in-nigeria-2024/):
- **2016 Mercedes GLE350 (fairly-used):** ₦26,000,000
- **Excellent condition, 50k km:** ₦28-32M expected

### Fix Required

**File:** `scripts/seeds/mercedes/mercedes-valuations.seed.ts`

**Current (WRONG):**
```typescript
{
  conditionCategory: 'nig_used_low',  // ❌ Non-standard
  lowPrice: '5000000',
  averagePrice: '8500000',
  highPrice: '12000000'
}
```

**Should Be (CORRECT):**
```typescript
// Excellent condition (pristine, low mileage)
{
  conditionCategory: 'excellent',
  lowPrice: '28000000',
  averagePrice: '30000000',
  highPrice: '32000000'
},
// Good condition (normal wear)
{
  conditionCategory: 'good',
  lowPrice: '24000000',
  averagePrice: '26000000',
  highPrice: '28000000'
},
// Fair condition (higher mileage, some wear)
{
  conditionCategory: 'fair',
  lowPrice: '18000000',
  averagePrice: '21000000',
  highPrice: '24000000'
},
// Poor condition (high mileage, needs work)
{
  conditionCategory: 'poor',
  lowPrice: '12000000',
  averagePrice: '15000000',
  highPrice: '18000000'
}
```

---

## Bug #2: Damage Detection Always Returns "Minor"

### Symptoms
- Car with visible collision damage returns "minor" severity
- Even totaled cars show "minor" damage
- Salvage value is too high (close to market value)

### Evidence from Logs

```
🚨 Damage detected: "Traffic collision" (score: 0.8100646138191223)
⚠️ Damage detected in 1 labels, total score: 81.00646138191223
...
✅ Total damage score below threshold - no significant damage detected
```

**Analysis:**
1. ✅ Vision API correctly detects "Traffic collision" with 81% confidence
2. ✅ `calculateDamageScore` correctly identifies damage (score: 81)
3. ❌ `identifyDamagedComponents` incorrectly says "no significant damage"
4. ❌ Result: No damage components → No deductions → "minor" severity

### Root Cause

**File:** `src/features/cases/services/ai-assessment-enhanced.service.ts`  
**Function:** `identifyDamagedComponents` (Line 585)

**The Bug:**
```typescript
function identifyDamagedComponents(damageScore: DamageScore): DamageInput[] {
  const DAMAGE_THRESHOLD = 30;
  
  // Calculate total damage score
  const totalScore = damageScore.structural + damageScore.mechanical + 
                     damageScore.cosmetic + damageScore.electrical + 
                     damageScore.interior;
  
  // ❌ BUG: This check is WRONG!
  // It checks if TOTAL is below threshold, but should check INDIVIDUAL scores
  if (totalScore < DAMAGE_THRESHOLD) {
    console.log('✅ Total damage score below threshold - no significant damage detected');
    return [];  // Returns empty array → No damage components!
  }
  
  // The rest of the code checks individual scores correctly,
  // but it never runs because of the early return above!
}
```

**Why It Fails:**
- Vision API detects "Traffic collision" → 81 score goes to ONE category (e.g., cosmetic)
- `damageScore = { structural: 0, mechanical: 0, cosmetic: 81, electrical: 0, interior: 0 }`
- `totalScore = 0 + 0 + 81 + 0 + 0 = 81`
- ✅ 81 > 30, so it passes the threshold check
- BUT: The individual category checks below have threshold 30
- `cosmetic: 81 > 30` ✅ Should add cosmetic damage
- However, the log shows "no significant damage" which means the early return is triggered

**Wait, let me re-read the code...**

Actually, looking at the log again:
```
✅ Total damage score below threshold - no significant damage detected
```

This message appears AFTER the damage calculation, which means the `totalScore` must be < 30. But we saw score of 81!

**The REAL Bug:** The `calculateDamageScore` function is returning all zeros!

Let me check that function...

### The ACTUAL Root Cause

**File:** `src/features/cases/services/ai-assessment-enhanced.service.ts`  
**Function:** `calculateDamageScore` (Line 324)

The function looks for damage keywords in Vision API labels:
```typescript
const damageKeywords = [
  'damage', 'damaged', 'broken', 'crack', 'cracked', 'dent', 'dented',
  'scratch', 'scratched', 'rust', 'rusted', 'collision', 'bent',
  // ... more keywords
];
```

**The Problem:**
1. Vision API returns: `"Traffic collision"` (score: 0.81)
2. Function checks: `desc.includes('collision')` ✅ Match found!
3. Damage is detected: `totalDamageScore = 81, damageCount = 1`
4. BUT: The categorization logic looks for SPECIFIC combinations:
   ```typescript
   const cosmeticDamage = labels.filter(l => {
     const desc = l.description.toLowerCase();
     return damageKeywords.some(k => desc.includes(k)) &&
            (desc.includes('bumper') || desc.includes('panel') || ...);
   });
   ```
5. ❌ "Traffic collision" doesn't include "bumper", "panel", etc.
6. ❌ All category arrays are empty
7. ❌ Function returns all zeros: `{ structural: 0, mechanical: 0, cosmetic: 0, electrical: 0, interior: 0 }`

**The Fix:** When damage is detected but can't be categorized, assign it to a default category (cosmetic) instead of returning zeros.

---

## Recommended Fixes

### Priority 1: Fix Mercedes Valuation Data (IMMEDIATE)

1. Update `scripts/seeds/mercedes/mercedes-valuations.seed.ts`
2. Replace non-standard categories with standard ones
3. Use correct market prices (₦26-32M range for 2016 GLE350)
4. Re-run seed script
5. Verify with test case

### Priority 2: Fix Damage Detection Logic (CRITICAL)

**Option A: Assign Uncat egorized Damage to Default Category**
```typescript
function calculateDamageScore(labels: Array<{ description: string; score: number }>): DamageScore {
  // ... existing damage detection ...
  
  if (damageCount === 0) {
    return { structural: 0, mechanical: 0, cosmetic: 0, electrical: 0, interior: 0 };
  }
  
  // Categorize damage...
  const structuralDamage = labels.filter(...);
  const mechanicalDamage = labels.filter(...);
  const cosmeticDamage = labels.filter(...);
  const electricalDamage = labels.filter(...);
  const interiorDamage = labels.filter(...);
  
  // ✅ FIX: If damage detected but not categorized, assign to cosmetic
  const categorizedCount = structuralDamage.length + mechanicalDamage.length + 
                           cosmeticDamage.length + electricalDamage.length + 
                           interiorDamage.length;
  
  if (categorizedCount === 0 && damageCount > 0) {
    console.log(`⚠️ Damage detected but not categorized - assigning to cosmetic`);
    return {
      structural: 0,
      mechanical: 0,
      cosmetic: avgScore,  // Assign uncategorized damage to cosmetic
      electrical: 0,
      interior: 0
    };
  }
  
  // ... rest of function ...
}
```

**Option B: Use Gemini Instead of Vision API**

Gemini provides structured damage assessment with proper categorization. The issue is Gemini might not be configured or is failing.

**Check Gemini Status:**
```bash
npx tsx scripts/validate-gemini-config.ts
```

If Gemini is not working, the system falls back to Vision API, which has the categorization bug.

---

## Testing Plan

### Test Case 1: Mercedes Valuation
```typescript
// Input
{
  make: 'Mercedes-Benz',
  model: 'GLE350 W166',
  year: 2016,
  condition: 'excellent',
  mileage: 50000
}

// Expected Output
{
  marketValue: ~₦30,000,000 (range: ₦28-32M),
  source: 'database',
  confidence: 95
}
```

### Test Case 2: Damaged Vehicle
```typescript
// Input: Photos of collision damage
{
  make: 'Toyota',
  model: 'Camry',
  year: 2021,
  condition: 'fair',
  photos: [/* collision damage photos */]
}

// Expected Output
{
  damageSeverity: 'moderate' or 'severe' (NOT 'minor'),
  damageScore: {
    cosmetic: > 30 (or other category > 30)
  },
  estimatedRepairCost: > ₦1,000,000,
  salvageValue: < marketValue * 0.7
}
```

---

## Impact Assessment

### Current State
- ❌ Mercedes valuations are 70-80% too low
- ❌ Damaged vehicles are assessed as "minor" damage
- ❌ Salvage values are too high (close to market value)
- ❌ Users cannot trust AI assessments

### After Fix
- ✅ Accurate valuations for all makes
- ✅ Proper damage severity classification
- ✅ Realistic salvage value calculations
- ✅ Trustworthy AI assessments

---

## Next Steps

1. **Create bugfix spec** for both issues
2. **Fix Mercedes seed data** (and audit other makes)
3. **Fix damage categorization logic** in Vision API fallback
4. **Test with real vehicle photos** from test gallery
5. **Verify Gemini configuration** and prioritize using it over Vision API

Would you like me to create a bugfix spec to systematically address these issues?
