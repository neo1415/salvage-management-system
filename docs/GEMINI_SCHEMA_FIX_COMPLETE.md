# Gemini Schema Mismatch Fix - Complete

## Problem Summary

The system was broken due to a schema mismatch between the Gemini service and the enhanced assessment service:

- **gemini-damage-detection.ts** was returning OLD format with `structural`, `mechanical`, `cosmetic`, `electrical`, `interior` fields
- **ai-assessment-enhanced.service.ts** was expecting these fields and using them directly
- Result: System worked but didn't follow the new requirements for item-specific analysis

## Requirements Implemented

### Prompt 1 Requirements:
1. ✅ Gemini analyzes the ENTIRE item FIRST (identification section)
2. ✅ THEN analyzes damage with SPECIFIC part names
3. ✅ Only DAMAGED parts in the response
4. ✅ Conservative total loss criteria (NOT 75% threshold)

### Prompt 2 Requirements:
1. ✅ SPECIFIC prompts for vehicles (bumpers, doors, windshield, etc.)
2. ✅ SPECIFIC prompts for electronics (screen, housing, camera, ports, battery, etc.)
3. ✅ SPECIFIC prompts for machinery (frame, motor, hydraulics, electrical, etc.)
4. ✅ Insurance-grade quality analysis
5. ✅ Only damaged parts sent to price search

## Changes Made

### 1. Updated `src/lib/integrations/gemini-damage-detection.ts`

#### New Interfaces:
```typescript
export interface ItemDetails {
  detectedMake?: string;
  detectedModel?: string;
  detectedYear?: string;
  color?: string;
  trim?: string;
  bodyStyle?: string;
  storage?: string;
  overallCondition?: string;
  notes?: string;
}

export interface DamagedPart {
  part: string;              // Specific part name (e.g., "driver front door")
  severity: 'minor' | 'moderate' | 'severe';
  confidence: number;        // 0-100
}

export interface GeminiDamageAssessment {
  itemDetails?: ItemDetails;  // Overall item identification
  damagedParts: DamagedPart[]; // Only damaged parts
  severity: 'minor' | 'moderate' | 'severe';
  airbagDeployed: boolean;
  totalLoss: boolean;
  summary: string;
  confidence: number;
  method: 'gemini';
}
```

#### Updated Response Schema:
- Removed: `structural`, `mechanical`, `cosmetic`, `electrical`, `interior` fields
- Added: `itemDetails` object (optional)
- Added: `damagedParts` array (required)
- Schema now matches new format

#### New Prompt Functions:
- `constructVehiclePrompt()` - Vehicle-specific analysis with 2 sections:
  - Section 1: Vehicle identification (make/model/year/trim/color/body style)
  - Section 2: Damage analysis with specific parts (driver front door, front bumper, etc.)
  - Section 3: Overall assessment with conservative total loss criteria

- `constructElectronicsPrompt()` - Electronics-specific analysis:
  - Section 1: Device identification (brand/model/storage/color)
  - Section 2: Damage analysis with electronics parts (front screen glass, rear camera lens, etc.)
  - Section 3: Overall assessment

- `constructMachineryPrompt()` - Machinery-specific analysis:
  - Section 1: Machinery identification (type/brand/model)
  - Section 2: Damage analysis with machinery parts (engine block, hydraulic cylinder, etc.)
  - Section 3: Overall assessment

#### Updated Validation:
- `parseAndValidateResponse()` now validates `damagedParts` array
- Validates each part has: `part`, `severity`, `confidence`
- Calculates overall confidence from part confidences
- Parses optional `itemDetails` object

#### Updated detectDamageWithGemini:
- Now uses `geminiResult.damagedParts` directly
- Maps parts to `damagedComponents` format
- No more conversion from scores to components

### 2. Updated `src/features/cases/services/ai-assessment-enhanced.service.ts`

#### New Conversion Function:
```typescript
function convertDamagedPartsToScores(damagedParts: DamagedPart[]): DamageScore {
  // Maps specific parts to 5 categories using keywords
  // Returns legacy DamageScore format for backward compatibility
}
```

**Category Mapping:**
- **Structural**: frame, chassis, pillar, rocker, floor pan, housing
- **Mechanical**: engine, transmission, suspension, drivetrain, motor, hydraulic
- **Cosmetic**: bumper, hood, door, fender, panel, paint, trim, glass, screen
- **Electrical**: wiring, battery, alternator, sensor, circuit, charging port
- **Interior**: seat, dashboard, steering wheel, console, airbag, upholstery

**Severity to Score Mapping:**
- Minor: 30
- Moderate: 60
- Severe: 90

#### Updated Gemini Result Handling:
```typescript
// OLD:
const damageScore: DamageScore = {
  structural: geminiResult.structural,
  mechanical: geminiResult.mechanical,
  cosmetic: geminiResult.cosmetic,
  electrical: geminiResult.electrical,
  interior: geminiResult.interior,
};

// NEW:
const damageScore: DamageScore = convertDamagedPartsToScores(geminiResult.damagedParts);
```

#### Updated Logging:
```typescript
// OLD:
console.log(`   Structural: ${geminiResult.structural}, Mechanical: ${geminiResult.mechanical}`);

// NEW:
console.log(`   Damaged parts: ${geminiResult.damagedParts.length}`);
console.log(`   Converted scores - Structural: ${damageScore.structural}, Mechanical: ${damageScore.mechanical}`);
```

## Response Format Example

### Vehicle Example:
```json
{
  "itemDetails": {
    "detectedMake": "Toyota",
    "detectedModel": "Camry",
    "detectedYear": "2020",
    "color": "White",
    "trim": "SE",
    "bodyStyle": "Sedan",
    "overallCondition": "Good"
  },
  "damagedParts": [
    {"part": "driver front door", "severity": "severe", "confidence": 85},
    {"part": "front bumper", "severity": "severe", "confidence": 90}
  ],
  "severity": "severe",
  "airbagDeployed": true,
  "totalLoss": false,
  "summary": "Severe damage to driver side with deployed airbag. Front bumper and driver door require replacement. Vehicle is repairable but requires significant work."
}
```

### Electronics Example:
```json
{
  "itemDetails": {
    "detectedMake": "Apple",
    "detectedModel": "iPhone 13 Pro",
    "detectedYear": "2021",
    "color": "Graphite",
    "storage": "256GB",
    "overallCondition": "Fair"
  },
  "damagedParts": [
    {"part": "front screen glass", "severity": "moderate", "confidence": 90},
    {"part": "rear camera lens", "severity": "minor", "confidence": 85}
  ],
  "severity": "moderate",
  "airbagDeployed": false,
  "totalLoss": false,
  "summary": "Cracked front screen glass with functional LCD. Minor scratch on rear camera lens. Device is functional and repairable."
}
```

### Machinery Example:
```json
{
  "itemDetails": {
    "detectedMake": "Honda",
    "detectedModel": "EU2200i",
    "detectedYear": "2020",
    "overallCondition": "Good",
    "notes": "Portable generator"
  },
  "damagedParts": [
    {"part": "engine housing", "severity": "moderate", "confidence": 85},
    {"part": "control panel display", "severity": "minor", "confidence": 90}
  ],
  "severity": "moderate",
  "airbagDeployed": false,
  "totalLoss": false,
  "summary": "Dented engine housing and cracked control panel display. Generator is operational and repairable with replacement parts."
}
```

## Conservative Total Loss Criteria

### Vehicles - Total Loss ONLY if:
- Frame/chassis is bent, twisted, or structurally compromised
- Cabin/passenger compartment has collapsed or severe intrusion
- Multiple major systems destroyed (engine + transmission + suspension)
- Fire damage affecting entire vehicle structure
- Complete submersion with water damage to all systems

### Vehicles - NOT Total Loss if:
- Only body panels damaged (bumpers, doors, fenders, hood, trunk)
- Only cosmetic damage (paint, trim, glass)
- Single system damage (only engine OR only transmission)
- Repairable structural damage
- Airbag deployment alone

### Electronics - Total Loss ONLY if:
- Screen completely shattered with LCD damage
- Device bent or structurally compromised
- Water damage with corrosion visible
- Multiple critical components damaged
- Device non-functional and repair cost exceeds replacement

### Machinery - Total Loss ONLY if:
- Frame/chassis bent, twisted, or structurally compromised
- Engine/motor destroyed or seized
- Multiple major systems destroyed
- Fire damage affecting entire structure
- Safety hazards that cannot be repaired

## Benefits

1. **Insurance-Grade Quality**: Prompts are designed for insurance claims work
2. **Item-Specific Analysis**: Different prompts for vehicles, electronics, machinery
3. **Specific Part Names**: "driver front door" instead of generic "door"
4. **Only Damaged Parts**: Reduces noise and improves price search accuracy
5. **Conservative Total Loss**: Prevents false total loss determinations
6. **Backward Compatible**: Conversion function maintains compatibility with existing code

## Testing

All TypeScript compilation errors resolved:
- ✅ `src/lib/integrations/gemini-damage-detection.ts`: No diagnostics
- ✅ `src/features/cases/services/ai-assessment-enhanced.service.ts`: No diagnostics

## Next Steps

1. Test with real vehicle photos to verify Gemini returns correct format
2. Test with electronics photos (phones, laptops)
3. Test with machinery photos (generators, equipment)
4. Verify part price searches work with specific part names
5. Verify salvage calculations use correct damaged parts

## Files Modified

1. `src/lib/integrations/gemini-damage-detection.ts`
   - Updated interfaces (ItemDetails, DamagedPart, GeminiDamageAssessment)
   - Updated GEMINI_RESPONSE_SCHEMA
   - Updated parseAndValidateResponse()
   - Rewrote constructDamageAssessmentPrompt() with 3 item-type-specific prompts
   - Updated detectDamageWithGemini()

2. `src/features/cases/services/ai-assessment-enhanced.service.ts`
   - Added convertDamagedPartsToScores() function
   - Updated Gemini result handling to use damagedParts
   - Updated logging to show damaged parts count

## Status

✅ **COMPLETE** - All requirements implemented, all TypeScript errors resolved, system ready for testing.
