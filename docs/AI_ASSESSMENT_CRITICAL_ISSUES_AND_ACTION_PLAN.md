# AI Assessment Critical Issues & Action Plan

## Date: March 7, 2026

## Critical Issues Identified

### Issue 1: Vision API Cannot Detect Damage on Totaled Cars

**Problem**: Google Vision API returns generic labels like "Vehicle", "Car", "Motor vehicle" without any damage keywords, even for severely damaged/totaled vehicles.

**Evidence from Log**:
```
✅ No damage keywords detected - vehicle appears to be in good condition
severity: 'minor'
salvageValue: 35200000 (100% of market value)
```

**Root Cause**: Google Vision API is designed for object detection, NOT damage assessment. It cannot reliably identify vehicle damage.

**Impact**: 
- Totaled cars assessed as "minor" damage
- Salvage values incorrectly set at 90-100% of market value
- Vendors will lose trust in AI assessment system
- Business risk of overpaying for salvage vehicles

### Issue 2: Seed Scripts Need Standardization Across All Makes

**Problem**: Mercedes-specific seed approach needs to be applied consistently to all vehicle makes.

**Current State**:
- ✅ Mercedes: Has proper seed scripts
- ✅ Toyota: Has seed scripts
- ✅ Audi: Has seed scripts
- ✅ Lexus: Has seed scripts
- ✅ Hyundai: Has seed scripts
- ✅ Kia: Has seed scripts
- ✅ Nissan: Has seed scripts (but may need verification)

**Risk**: Inconsistent data quality across makes could lead to incorrect valuations.

---

## Recommended Action Plan

### Immediate Actions (Today)

#### 1. Accept Vision API Limitations

**Decision**: Vision API is fundamentally limited for damage detection. The current bugfix spec addressed false positives (normal car parts detected as damage), but cannot address false negatives (actual damage not detected).

**Options**:

**Option A: Migrate to Gemini (Recommended)**
- Gemini 2.0 Flash has multimodal capabilities specifically designed for image analysis
- Can analyze photos and provide detailed damage assessments
- You already have a migration spec: `.kiro/specs/gemini-damage-detection-migration/`
- Status: Phase 1 complete, Phase 2 in progress

**Option B: Add Conservative Fallback**
- When Vision API returns NO damage keywords, assume "moderate" damage by default
- This is safer than assuming "minor" for unknown cases
- Quick fix but not ideal long-term solution

**Recommendation**: Proceed with Gemini migration (Option A). It's the only sustainable solution.

#### 2. Verify Seed Script Consistency

**Action**: Run audit script to verify all makes have proper seed data.

**Script to Create**:
```bash
npx tsx scripts/audit-all-vehicle-makes.ts
```

This will check:
- All makes have both valuations and damage deductions
- Condition categories are standardized (poor, fair, good, excellent)
- No missing or malformed data

---

### Short-Term Actions (This Week)

#### 1. Complete Gemini Migration

**Current Status**: 
- Phase 1: ✅ Complete (Foundation and Environment Setup)
- Phase 2: 🔄 In Progress (Gemini Integration and Core Functionality)
- Phases 3-7: ⏳ Pending

**Next Steps**:
1. Complete Phase 2 tasks (Gemini service implementation)
2. Implement Phase 3 (Fallback chain with Vision API)
3. Test with real vehicle photos (Phase 4-5)
4. Deploy to production (Phase 6-7)

**Timeline**: 3-5 days for full migration

#### 2. Update Bugfix Spec Documentation

**Action**: Update `.kiro/specs/ai-damage-detection-false-positives-fix/bugfix.md` to document Vision API limitations.

**Add Section**:
```markdown
## Known Limitations

### Vision API Cannot Detect Damage

Google Vision API is designed for object detection, not damage assessment. It can identify car parts (bumper, door, wheel) but cannot reliably detect damage to those parts.

**Examples**:
- Totaled car → Returns: "Vehicle", "Car", "Motor vehicle" (no damage keywords)
- Severely damaged bumper → Returns: "Bumper", "Car" (no damage indication)
- Cracked windshield → Returns: "Windshield", "Glass" (no crack detection)

**Impact**: The system will assess vehicles with no damage keywords as "minor" damage, which is incorrect for genuinely damaged vehicles.

**Solution**: Migrate to Gemini 2.0 Flash multimodal AI, which has image analysis capabilities specifically designed for damage assessment.
```

#### 3. Standardize Seed Scripts

**Action**: Create a verification script that checks all seed data for consistency.

**Checks**:
- All makes have valuations for all condition categories
- All makes have damage deductions for all damage types
- Condition categories match: poor, fair, good, excellent
- No duplicate or conflicting data

---

### Medium-Term Actions (Next 2 Weeks)

#### 1. Implement Manual Override System

**Purpose**: Allow adjusters to correct AI mistakes until Gemini migration is complete.

**Features**:
- Adjuster can override AI damage severity
- Adjuster can override salvage value
- All overrides logged in audit trail
- Manager approval required for overrides > 20% difference

**Spec**: Create new spec for this feature

#### 2. Add Confidence Scoring

**Purpose**: Indicate when AI assessment is uncertain.

**Logic**:
- Vision API with no damage keywords → Low confidence (30%)
- Vision API with damage keywords → Medium confidence (60%)
- Gemini with detailed analysis → High confidence (85-95%)

**Display**: Show confidence score to adjusters so they know when to review carefully

---

## Decision Required

**Question**: Which path do you want to take for the immediate Vision API issue?

**Option A: Gemini Migration (Recommended)**
- Timeline: 3-5 days
- Effort: Medium (complete existing spec)
- Result: Proper damage detection
- Risk: Low (fallback to Vision API if Gemini fails)

**Option B: Conservative Fallback**
- Timeline: 1 hour
- Effort: Low (simple code change)
- Result: Safer default for unknown cases
- Risk: Medium (still not accurate, just less wrong)

**Option C: Do Both**
- Implement Option B today as temporary fix
- Complete Option A this week as permanent solution
- Timeline: 1 hour + 3-5 days
- Risk: Lowest (immediate safety + long-term accuracy)

---

## Seed Script Verification

**Action Required**: Run the audit script to verify all makes have proper data.

**Command**:
```bash
npx tsx scripts/audit-all-vehicle-makes.ts
```

**Expected Output**:
- List of all makes in database
- Condition categories for each make
- Any non-standard categories flagged
- Recommendations for fixes

**If Issues Found**:
1. Update seed scripts for affected makes
2. Re-run seeds with `--force` flag
3. Verify data integrity

---

## Summary

**Critical Issue**: Vision API cannot detect damage on totaled cars.

**Root Cause**: Vision API is designed for object detection, not damage assessment.

**Immediate Fix**: Choose Option A, B, or C above.

**Long-Term Solution**: Complete Gemini migration (already in progress).

**Secondary Issue**: Verify seed script consistency across all makes.

**Next Steps**: 
1. Decide on immediate fix approach
2. Run seed script audit
3. Continue Gemini migration

---

## Questions for You

1. **Which option do you prefer for the immediate Vision API issue?** (A, B, or C)

2. **Should I create the audit script now?** This will check all vehicle makes for data consistency.

3. **Do you want to prioritize Gemini migration?** I can help complete the remaining phases.

4. **Should I update the bugfix spec to document Vision API limitations?**

Let me know your preferences and I'll proceed accordingly.
