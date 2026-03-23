# How to Test Severity Mismatch Fix

## Quick Test (Recommended)

Run the simple verification script:
```bash
npx tsx scripts/verify-severity-fix-simple.ts
```

Expected output:
```
✅ ALL TESTS PASSED!
   Severity mismatch bug is FIXED!
```

## Manual Testing in Browser

### Step 1: Create a Case with Severe Damage
1. Navigate to `/adjuster/cases/new`
2. Fill in vehicle details (e.g., Toyota Camry 2021)
3. Upload 3+ photos showing severe damage
4. Wait for AI assessment to complete

### Step 2: Check Browser Console
Look for these logs:
```javascript
🎯 COMPLETE AI assessment stored: {
  damageSeverity: 'severe',
  confidenceScore: 87,
  ...
}

📤 Sending case data to backend with AI assessment: {
  severity: 'severe',
  confidence: 87
}
```

### Step 3: Check Server Logs
Look for these logs in your terminal:
```
📥 Backend received AI assessment from frontend: {
  severity: 'severe',
  confidence: 87,
  salvageValue: 166253
}

✅ Using AI assessment from frontend: {
  severity: 'severe',
  ...
}

💾 Storing case in database with values: {
  damageSeverity: 'severe',
  ...
}

✅ Case stored successfully in database: {
  damageSeverity: 'severe',
  ...
}
```

### Step 4: Verify Database
Query the database:
```sql
SELECT 
  claim_reference,
  damage_severity,
  estimated_salvage_value,
  (ai_assessment->>'confidenceScore')::int as confidence
FROM salvage_cases
ORDER BY created_at DESC
LIMIT 1;
```

Expected result:
```
damage_severity: 'severe'
confidence: 87
```

## What to Look For

✅ **CORRECT Behavior:**
- AI returns severity='severe'
- Frontend stores severity='severe'
- Backend receives severity='severe'
- Database stores severity='severe'
- All logs show consistent severity value

❌ **INCORRECT Behavior (OLD BUG):**
- AI returns severity='severe'
- Backend logs: "⚠️ No AI assessment from frontend - using fallback values"
- Database stores severity='moderate' (fallback value)

## Troubleshooting

If severity is still wrong:

1. **Check frontend is sending data:**
   - Look for `📤 Sending case data` log in browser console
   - Verify `aiAssessmentResult` object is present

2. **Check backend receives data:**
   - Look for `📥 Backend received AI assessment` log in server
   - Verify `hasAssessment: true`

3. **Check database storage:**
   - Look for `💾 Storing case in database` log
   - Verify `damageSeverity` matches AI result

4. **Clear browser cache:**
   - Old JavaScript may be cached
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
