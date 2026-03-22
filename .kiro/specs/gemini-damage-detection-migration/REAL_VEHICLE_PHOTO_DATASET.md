# Real Vehicle Photo Test Dataset

## Overview

This document catalogs the real vehicle photos collected for testing the Gemini damage detection migration. Photos are organized by damage severity and special conditions.

## Dataset Statistics

- **Total Photos**: 23
- **Undamaged Vehicles**: 4 photos
- **Light Severity**: 3 photos
- **Moderate Severity**: 3 photos
- **High Severity**: 5 photos
- **Airbag Deployed**: 3 photos
- **Total Loss**: 3 photos
- **Unknown/Test**: 2 photos

## Photo Categories

### 1. Undamaged Vehicles (4 photos)
**Location**: `vehicle-test-gallery/Toyota camry 2021-no-damage/`

- `344x258.jpg` - Clean Toyota Camry 2021
- `images (10).jpg` - Pristine condition
- `images (11).jpg` - No visible damage
- `images (12).jpg` - Excellent condition

**Expected Results**:
- All damage scores < 30
- Severity: 'minor'
- Airbag deployed: false
- Total loss: false

### 2. Light Severity Damage (3 photos)
**Location**: `vehicle-test-gallery/light-severity/`

- `download (1).jpg` - Minor cosmetic damage
- `images (1).jpg` - Small dent/scratch
- `images (2).jpg` - Light body damage

**Expected Results**:
- At least one damage score 30-50
- Severity: 'minor'
- Airbag deployed: false
- Total loss: false

### 3. Moderate Severity Damage (3 photos)
**Location**: `vehicle-test-gallery/moderate-severity/`

- `feb780a0cbf04ff69f76602c7b71adfb_hrs.jpg` - Moderate front damage
- `images (8).jpg` - Significant body damage
- `images (9).jpg` - Multiple panel damage

**Expected Results**:
- At least one damage score 50-70
- Severity: 'moderate'
- Airbag deployed: possibly
- Total loss: false

### 4. High Severity Damage (5 photos)
**Location**: `vehicle-test-gallery/Toyota-camry-2021-high-severity/`

- `images (3).jpg` - Severe front-end damage
- `images (4).jpg` - Major structural damage
- `images (5).jpg` - Extensive damage
- `images (6).jpg` - Heavy collision damage
- `images (7).jpg` - Severe impact damage

**Expected Results**:
- At least one damage score > 70
- Severity: 'severe'
- Airbag deployed: likely
- Total loss: possibly

### 5. Airbag Deployed (3 photos)
**Location**: `vehicle-test-gallery/airbags-deployed/`

- `download (2).jpg` - Visible airbag deployment
- `images (13).jpg` - Deployed airbags
- `images (14).jpg` - Airbag deployment evidence

**Expected Results**:
- Airbag deployed: true
- At least one damage score > 50
- Severity: 'moderate' or 'severe'
- Total loss: possibly

### 6. Total Loss Vehicles (3 photos)
**Location**: `vehicle-test-gallery/Totalled/`

- `car-crashed-into-a-lamp-post-royalty-free-image-1585640031.avif` - Complete destruction
- `images (15).jpg` - Beyond repair
- `images (16).jpg` - Total loss condition

**Expected Results**:
- Multiple damage scores > 75
- Severity: 'severe'
- Airbag deployed: likely true
- Total loss: true

### 7. Unknown/Test Cases (2 photos)
**Location**: `vehicle-test-gallery/extra-to-figure-out-with-no-hints/`

These photos will be used for blind testing without hints to validate Gemini's assessment capabilities.

## Test Coverage

### Damage Types Covered
- ✅ Cosmetic damage (scratches, dents, paint)
- ✅ Structural damage (frame, pillars)
- ✅ Mechanical damage (engine, suspension)
- ✅ Interior damage (airbags, dashboard)
- ✅ Electrical damage (lights, wiring)

### Severity Levels Covered
- ✅ No damage (baseline)
- ✅ Minor damage (10-30%)
- ✅ Moderate damage (40-60%)
- ✅ Severe damage (70-90%)
- ✅ Total loss (>75%)

### Special Conditions Covered
- ✅ Airbag deployment
- ✅ Total loss determination
- ✅ Multiple angles (front, side, rear)
- ✅ Different vehicle types (sedans)
- ✅ Various lighting conditions

## Usage in Tests

### Task 18.1: Damaged Vehicle Tests
Use photos from:
- Light severity (3 photos)
- Moderate severity (3 photos)
- High severity (5 photos)
- Airbag deployed (3 photos)
- Total loss (3 photos)

**Total**: 17 damaged vehicle photos

### Task 18.2: Undamaged Vehicle Tests
Use photos from:
- Toyota Camry 2021 no damage (4 photos)

**Total**: 4 undamaged vehicle photos

### Task 18.3: Property-Based Accuracy Tests
Use all 21 photos with known expected outcomes

## Requirements Validation

✅ **Requirement 8.1**: 17 photos of damaged vehicles (exceeds minimum of 10)  
✅ **Requirement 8.3**: 4 photos of undamaged vehicles (exceeds minimum of 3)  
✅ **Requirement 8.5**: Various damage severity levels covered  
✅ **Requirement 8.6**: 3 photos with deployed airbags (meets minimum of 2)  
✅ **Requirement 8.7**: 3 photos of total loss vehicles (exceeds minimum of 2)  

## Notes

- All photos are real-world examples
- Photos represent actual salvage vehicle conditions
- Dataset includes edge cases (AVIF format in total loss)
- Photos organized by expected assessment outcome
- Suitable for both automated and manual validation
