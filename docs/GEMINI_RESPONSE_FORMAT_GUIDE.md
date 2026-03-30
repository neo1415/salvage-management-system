# Gemini Response Format Guide

## Quick Reference for Developers

This guide explains how Gemini damage detection responses are formatted and validated.

## Response Structure

### Clean Response Example (CORRECT)

```json
{
  "itemDetails": {
    "detectedMake": "Mercedes-Benz",
    "detectedModel": "GLE-Class",
    "detectedYear": "2016",
    "bodyStyle": "SUV",
    "overallCondition": "Fair"
  },
  "damagedParts": [
    {
      "part": "front bumper",
      "severity": "severe",
      "confidence": 90
    },
    {
      "part": "driver front door",
      "severity": "moderate",
      "confidence": 85
    }
  ],
  "severity": "severe",
  "airbagDeployed": false,
  "totalLoss": false,
  "summary": "Severe damage to front bumper and driver door. Vehicle is repairable.",
  "confidence": 87.5,
  "method": "gemini"
}
```

### What Gets Filtered Out (INCORRECT)

❌ **Verbose reasoning text:**
```json
{
  "trim": "AMG Line (estimated from wheels/styling, not fully verified.)"
}
```

✅ **Correct - field omitted:**
```json
{
  // trim field not included
}
```

❌ **Undefined fields:**
```json
{
  "color": undefined,
  "storage": undefined
}
```

✅ **Correct - fields omitted:**
```json
{
  // color and storage fields not included
}
```

## Field Validation Rules

### itemDetails Fields

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `detectedMake` | string | No | Must be clean text, no reasoning |
| `detectedModel` | string | No | Must be clean text, no reasoning |
| `detectedYear` | string | No | Must be clean text, no reasoning |
| `color` | string | No | Omit if not clearly visible |
| `trim` | string | No | Omit if not clearly visible |
| `bodyStyle` | string | No | Omit if not clearly visible |
| `storage` | string | No | Omit if not clearly visible (electronics) |
| `overallCondition` | string | No | Must be: "Excellent", "Good", "Fair", or "Poor" |
| `notes` | string | No | Only for discrepancies or critical observations |

### Sanitization Logic

Fields are rejected if they:
1. Contain parentheses `()` AND are longer than 50 characters
2. Contain words like "estimated", "appears to be" AND are longer than 50 characters
3. Are empty strings
4. Are not strings (null, undefined, numbers, etc.)

### Example Sanitization

```typescript
// Input from Gemini
const rawResponse = {
  trim: "AMG Line (estimated from wheels/styling, not fully verified.) While trim is allowed...",
  color: "White",
  storage: undefined,
  notes: ""
};

// After sanitization
const sanitizedResponse = {
  color: "White"
  // trim, storage, and notes omitted
};
```

## Vehicle Context Validation

### Matching Vehicle

**Form data:** Toyota Camry 2021  
**Photos show:** Toyota Camry 2021

**Response:**
```json
{
  "itemDetails": {
    "detectedMake": "Toyota",
    "detectedModel": "Camry",
    "detectedYear": "2021",
    "bodyStyle": "Sedan",
    "overallCondition": "Good"
  }
}
```

### Mismatched Vehicle

**Form data:** Toyota Camry 2021  
**Photos show:** Mercedes-Benz GLE 2016

**Response:**
```json
{
  "itemDetails": {
    "detectedMake": "Mercedes-Benz",
    "detectedModel": "GLE-Class",
    "detectedYear": "2016",
    "bodyStyle": "SUV",
    "overallCondition": "Fair",
    "notes": "Vehicle in photos appears to be a 2016 Mercedes-Benz GLE, which differs from the provided information (2021 Toyota Camry). Please verify vehicle information with the claimant."
  }
}
```

## Common Patterns

### Pattern 1: Uncertain Field

**Gemini sees:** Blurry photo, can't determine trim level

**Correct response:**
```json
{
  "itemDetails": {
    "detectedMake": "Toyota",
    "detectedModel": "Camry"
    // trim field omitted
  }
}
```

**Incorrect response:**
```json
{
  "itemDetails": {
    "detectedMake": "Toyota",
    "detectedModel": "Camry",
    "trim": "SE (possibly, but not fully visible in photos)"
  }
}
```

### Pattern 2: Multiple Uncertain Fields

**Gemini sees:** Dark photos, limited visibility

**Correct response:**
```json
{
  "itemDetails": {
    "detectedMake": "Honda",
    "detectedModel": "Accord",
    "overallCondition": "Fair"
    // Only include fields that are clearly visible
  }
}
```

### Pattern 3: Vehicle Mismatch

**Correct response:**
```json
{
  "itemDetails": {
    "detectedMake": "Actual Make",
    "detectedModel": "Actual Model",
    "detectedYear": "Actual Year",
    "notes": "Vehicle in photos appears to be [actual vehicle], which differs from the provided information ([provided vehicle]). Please verify vehicle information with the claimant."
  }
}
```

## Integration Points

### Frontend Display

```typescript
// Display itemDetails in UI
if (assessment.itemDetails) {
  const { detectedMake, detectedModel, detectedYear, notes } = assessment.itemDetails;
  
  // Show vehicle info
  console.log(`Vehicle: ${detectedYear} ${detectedMake} ${detectedModel}`);
  
  // Show discrepancy warning if present
  if (notes && notes.includes('differs from')) {
    showWarning(notes);
  }
}
```

### API Response

```typescript
// API returns clean, sanitized data
{
  "success": true,
  "data": {
    "aiAssessment": {
      "itemDetails": {
        // Only fields with clean values
      },
      "damagedParts": [...],
      "severity": "moderate",
      // ... other fields
    }
  }
}
```

## Debugging

### Check for Verbose Reasoning

```typescript
// Look for these patterns in logs
console.warn(`[Gemini Service] Rejecting field value with reasoning text: ...`);
```

### Verify Field Omission

```typescript
// Check that undefined fields are removed
const hasUndefinedFields = Object.values(itemDetails).some(v => v === undefined);
console.assert(!hasUndefinedFields, 'itemDetails should not have undefined fields');
```

### Test Sanitization

```typescript
// Run test script
npx tsx scripts/test-gemini-ux-fixes.ts
```

## Best Practices

1. **Always check for `notes` field** - it may contain critical discrepancy information
2. **Don't assume all fields are present** - only confident fields are included
3. **Display clean data to users** - no need to explain why fields are missing
4. **Log sanitization warnings** - helps identify prompt issues
5. **Test with real photos** - ensure prompts work as expected

## Troubleshooting

### Issue: Too many fields omitted

**Cause:** Photos may be low quality or unclear  
**Solution:** Request better photos from user

### Issue: Verbose reasoning still appearing

**Cause:** Gemini not following prompt instructions  
**Solution:** Check sanitization logs, may need to adjust sanitization rules

### Issue: Vehicle mismatch not detected

**Cause:** Prompt may not be clear enough  
**Solution:** Review prompt construction in `constructVehiclePrompt()`

## Related Documentation

- [GEMINI_UX_AND_DATA_QUALITY_FIXES.md](./GEMINI_UX_AND_DATA_QUALITY_FIXES.md) - Complete implementation details
- [AI_ASSESSMENT_IMPROVEMENTS_SUMMARY.md](./AI_ASSESSMENT_IMPROVEMENTS_SUMMARY.md) - Overall AI assessment improvements
- [GEMINI_DETAILED_ANALYSIS_FIX_SUMMARY.md](./GEMINI_DETAILED_ANALYSIS_FIX_SUMMARY.md) - Detailed analysis display fixes
