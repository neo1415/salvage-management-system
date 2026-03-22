# AI Assessment Accuracy Improvement Plan

## Current Problems

### 1. **No Vehicle Context**
- AI doesn't know make/model/year
- Estimates value without knowing what car it is
- A damaged 2020 Mercedes is worth more than a damaged 2005 Toyota

### 2. **Simplistic Damage Calculation**
- Just counts damage-related labels
- Doesn't consider:
  - Severity of damage (minor dent vs total loss)
  - Location of damage (cosmetic vs structural)
  - Repairability
  - Parts availability

### 3. **Arbitrary Market Value**
- Currently: `500000 + (photos.length * 50000)`
- This is completely made up!
- Should use actual vehicle valuation data

### 4. **No Validation**
- No confidence thresholds
- No sanity checks
- No comparison with similar cases

---

## Improved Solution

### Phase 1: Enhanced AI Assessment (Immediate)

#### 1.1 Use Vehicle Context
```typescript
// BEFORE: AI runs without knowing the vehicle
const aiAssessment = await assessDamage(photos, estimatedMarketValue);

// AFTER: AI gets full vehicle context
const aiAssessment = await assessDamage({
  photos,
  vehicleInfo: {
    make: 'Toyota',
    model: 'Camry',
    year: 2020,
    vin: 'ABC123...',
    marketValue: 8500000 // From valuation API
  }
});
```

#### 1.2 Multi-Stage Analysis
```typescript
// Stage 1: Detect vehicle type and validate
const vehicleDetection = await detectVehicleType(photos);
// Returns: { type: 'sedan', confidence: 0.95, make: 'Toyota', model: 'Camry' }

// Stage 2: Analyze damage severity
const damageAnalysis = await analyzeDamage(photos, vehicleDetection);
// Returns: { 
//   structural: true, 
//   cosmetic: true,
//   affectedParts: ['front bumper', 'hood', 'windshield'],
//   severity: 'moderate'
// }

// Stage 3: Estimate repair costs
const repairEstimate = await estimateRepairCosts(damageAnalysis, vehicleInfo);
// Returns: { 
//   repairCost: 2500000,
//   isRepairable: true,
//   salvageValue: 6000000
// }
```

#### 1.3 Use Google Vision Advanced Features
```typescript
// Object Detection (not just labels)
const [objectResult] = await visionClient.objectLocalization(image);
// Returns: Bounding boxes for damaged parts

// Safe Search (detect if photos are valid)
const [safeSearchResult] = await visionClient.safeSearchDetection(image);
// Returns: Confidence that photos are appropriate

// Image Properties (detect photo quality)
const [propertiesResult] = await visionClient.imageProperties(image);
// Returns: Dominant colors, quality metrics
```

---

### Phase 2: Vehicle Valuation Integration

#### 2.1 Use Real Valuation APIs

**Option A: Nigerian Auto Market Data**
- Partner with local dealers for pricing data
- Build database of common vehicles and their values
- Update monthly

**Option B: International APIs (adapted for Nigeria)**
- Kelley Blue Book API (US)
- CAP HPI (UK)
- Adjust for Nigerian market (import costs, duties, local demand)

**Option C: Build Internal Database**
```typescript
// Vehicle valuation database
const vehicleValues = {
  'Toyota Camry 2020': {
    excellent: 9500000,
    good: 8500000,
    fair: 7000000,
    poor: 5500000
  },
  'Honda Accord 2019': {
    excellent: 8800000,
    good: 7800000,
    fair: 6500000,
    poor: 5000000
  }
  // ... more vehicles
};
```

#### 2.2 Depreciation Calculator
```typescript
function calculateMarketValue(vehicle: VehicleInfo): number {
  const baseValue = getBaseValue(vehicle.make, vehicle.model, vehicle.year);
  const age = currentYear - vehicle.year;
  const mileage = vehicle.mileage || estimateMileage(age);
  
  // Apply depreciation
  let value = baseValue;
  value *= Math.pow(0.85, age); // 15% per year
  value *= getMileageAdjustment(mileage);
  value *= getConditionAdjustment(vehicle.condition);
  
  return Math.round(value);
}
```

---

### Phase 3: Damage Assessment Improvements

#### 3.1 Damage Severity Scoring
```typescript
interface DamageScore {
  structural: number;    // 0-100 (frame, engine, transmission)
  mechanical: number;    // 0-100 (engine, brakes, suspension)
  cosmetic: number;      // 0-100 (paint, dents, scratches)
  electrical: number;    // 0-100 (lights, electronics)
  interior: number;      // 0-100 (seats, dashboard, airbags)
}

function calculateDamageScore(labels: Label[], objects: Object[]): DamageScore {
  // Analyze detected damage
  const structuralKeywords = ['frame', 'chassis', 'pillar', 'roof', 'floor'];
  const mechanicalKeywords = ['engine', 'transmission', 'axle', 'suspension'];
  const cosmeticKeywords = ['dent', 'scratch', 'paint', 'bumper'];
  
  // Score each category based on detected damage
  return {
    structural: scoreCategory(labels, structuralKeywords),
    mechanical: scoreCategory(labels, mechanicalKeywords),
    cosmetic: scoreCategory(labels, cosmeticKeywords),
    electrical: scoreCategory(labels, ['wire', 'light', 'battery']),
    interior: scoreCategory(labels, ['seat', 'airbag', 'dashboard'])
  };
}
```

#### 3.2 Repairability Assessment
```typescript
function assessRepairability(damageScore: DamageScore, vehicleValue: number): {
  isRepairable: boolean;
  estimatedRepairCost: number;
  recommendation: string;
} {
  // Structural damage > 70% = likely total loss
  if (damageScore.structural > 70) {
    return {
      isRepairable: false,
      estimatedRepairCost: vehicleValue * 0.8,
      recommendation: 'Total loss - structural damage too severe'
    };
  }
  
  // Calculate repair costs
  const repairCost = 
    (damageScore.structural * 50000) +
    (damageScore.mechanical * 30000) +
    (damageScore.cosmetic * 10000) +
    (damageScore.electrical * 20000) +
    (damageScore.interior * 15000);
  
  // If repair cost > 70% of value, recommend total loss
  if (repairCost > vehicleValue * 0.7) {
    return {
      isRepairable: false,
      estimatedRepairCost: repairCost,
      recommendation: 'Total loss - repair cost exceeds 70% of vehicle value'
    };
  }
  
  return {
    isRepairable: true,
    estimatedRepairCost: repairCost,
    recommendation: 'Repairable - proceed with repair estimate'
  };
}
```

---

### Phase 4: Confidence & Validation

#### 4.1 Confidence Scoring
```typescript
interface AssessmentConfidence {
  overall: number;        // 0-100
  vehicleDetection: number;
  damageDetection: number;
  valuationAccuracy: number;
  photoQuality: number;
  reasons: string[];
}

function calculateConfidence(
  photos: string[],
  vehicleInfo: VehicleInfo,
  damageAnalysis: DamageAnalysis
): AssessmentConfidence {
  const confidence: AssessmentConfidence = {
    overall: 0,
    vehicleDetection: 0,
    damageDetection: 0,
    valuationAccuracy: 0,
    photoQuality: 0,
    reasons: []
  };
  
  // Photo quality check
  if (photos.length < 5) {
    confidence.photoQuality = 50;
    confidence.reasons.push('Insufficient photos (need 5+ for accurate assessment)');
  } else {
    confidence.photoQuality = Math.min(100, photos.length * 15);
  }
  
  // Vehicle detection confidence
  if (vehicleInfo.make && vehicleInfo.model && vehicleInfo.year) {
    confidence.vehicleDetection = 90;
  } else {
    confidence.vehicleDetection = 40;
    confidence.reasons.push('Vehicle information incomplete');
  }
  
  // Damage detection confidence
  if (damageAnalysis.labels.length > 5) {
    confidence.damageDetection = 85;
  } else {
    confidence.damageDetection = 60;
    confidence.reasons.push('Limited damage labels detected');
  }
  
  // Valuation accuracy
  if (vehicleInfo.marketValue && vehicleInfo.marketValue > 0) {
    confidence.valuationAccuracy = 80;
  } else {
    confidence.valuationAccuracy = 30;
    confidence.reasons.push('Market value not provided - using estimate');
  }
  
  // Calculate overall confidence
  confidence.overall = Math.round(
    (confidence.vehicleDetection * 0.3) +
    (confidence.damageDetection * 0.3) +
    (confidence.valuationAccuracy * 0.2) +
    (confidence.photoQuality * 0.2)
  );
  
  return confidence;
}
```

#### 4.2 Sanity Checks
```typescript
function validateAssessment(assessment: DamageAssessmentResult): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  // Check 1: Salvage value shouldn't exceed market value
  if (assessment.estimatedSalvageValue > assessment.marketValue) {
    warnings.push('Salvage value exceeds market value - review assessment');
  }
  
  // Check 2: Reserve price should be 60-80% of salvage value
  const expectedReserve = assessment.estimatedSalvageValue * 0.7;
  if (Math.abs(assessment.reservePrice - expectedReserve) > expectedReserve * 0.2) {
    warnings.push('Reserve price calculation may be incorrect');
  }
  
  // Check 3: Damage percentage should match severity
  if (assessment.damageSeverity === 'minor' && assessment.damagePercentage > 60) {
    warnings.push('Damage severity and percentage mismatch');
  }
  
  // Check 4: Confidence score minimum threshold
  if (assessment.confidenceScore < 50) {
    warnings.push('Low confidence score - manual review recommended');
  }
  
  return {
    isValid: warnings.length === 0,
    warnings
  };
}
```

---

### Phase 5: Historical Data & Learning

#### 5.1 Build Case History Database
```typescript
// Store every assessment for learning
interface CaseHistory {
  caseId: string;
  vehicleInfo: VehicleInfo;
  aiAssessment: DamageAssessmentResult;
  actualSalePrice: number;      // What it actually sold for
  actualRepairCost: number;     // What repairs actually cost
  managerAdjustments: {
    originalEstimate: number;
    adjustedEstimate: number;
    reason: string;
  };
}

// Use historical data to improve estimates
function getHistoricalAverage(
  make: string,
  model: string,
  damageSeverity: string
): number {
  const similarCases = database.query(`
    SELECT AVG(actualSalePrice) as avgPrice
    FROM case_history
    WHERE vehicleMake = ? 
    AND vehicleModel = ?
    AND damageSeverity = ?
    AND createdAt > DATE_SUB(NOW(), INTERVAL 6 MONTH)
  `, [make, model, damageSeverity]);
  
  return similarCases.avgPrice;
}
```

#### 5.2 Manager Override Tracking
```typescript
// Track when managers adjust AI estimates
function trackManagerOverride(
  caseId: string,
  aiEstimate: number,
  managerEstimate: number,
  reason: string
) {
  // Store override
  database.insert('manager_overrides', {
    caseId,
    aiEstimate,
    managerEstimate,
    difference: managerEstimate - aiEstimate,
    differencePercent: ((managerEstimate - aiEstimate) / aiEstimate) * 100,
    reason,
    timestamp: new Date()
  });
  
  // Analyze patterns
  analyzeOverridePatterns();
}

// Learn from overrides
function analyzeOverridePatterns() {
  // If AI consistently underestimates Toyota Camry by 15%,
  // adjust future estimates accordingly
  const patterns = database.query(`
    SELECT 
      vehicleMake,
      vehicleModel,
      AVG(differencePercent) as avgDifference
    FROM manager_overrides
    WHERE timestamp > DATE_SUB(NOW(), INTERVAL 3 MONTH)
    GROUP BY vehicleMake, vehicleModel
    HAVING COUNT(*) > 5
  `);
  
  // Apply learned adjustments
  patterns.forEach(pattern => {
    if (Math.abs(pattern.avgDifference) > 10) {
      console.log(`Learned: ${pattern.vehicleMake} ${pattern.vehicleModel} needs ${pattern.avgDifference}% adjustment`);
    }
  });
}
```

---

## Implementation Priority

### Immediate (This Week)
1. ✅ Add vehicle context to AI assessment
2. ✅ Implement confidence scoring
3. ✅ Add sanity checks and validation
4. ✅ Improve damage severity calculation

### Short Term (Next 2 Weeks)
5. ⬜ Build vehicle valuation database (top 50 vehicles in Nigeria)
6. ⬜ Implement depreciation calculator
7. ⬜ Add photo quality checks
8. ⬜ Use Google Vision object detection (not just labels)

### Medium Term (Next Month)
9. ⬜ Integrate with vehicle valuation API
10. ⬜ Build case history database
11. ⬜ Implement manager override tracking
12. ⬜ Add historical data analysis

### Long Term (Next Quarter)
13. ⬜ Machine learning model for damage assessment
14. ⬜ Automated learning from historical data
15. ⬜ Integration with parts pricing APIs
16. ⬜ Real-time market value updates

---

## Accuracy Metrics

### Current Baseline
- Confidence: ~50-60% (no vehicle context)
- Accuracy: Unknown (no validation)
- Manager override rate: Unknown

### Target Metrics
- Confidence: >80% (with vehicle context)
- Accuracy: Within 15% of actual sale price
- Manager override rate: <30%
- Time to assessment: <30 seconds

---

## Cost Implications

### Google Vision API Costs
- Label Detection: $1.50 per 1,000 images
- Object Detection: $1.50 per 1,000 images
- Safe Search: $1.50 per 1,000 images
- **Total per case (5 photos)**: ~$0.02

### Additional APIs
- Vehicle Valuation API: $0.10 per lookup
- Parts Pricing API: $0.05 per lookup
- **Total per case**: ~$0.17

### ROI
- More accurate assessments = better auction prices
- Reduced manager time reviewing cases
- Fewer disputes with vendors
- **Estimated value**: $50-100 per case improvement

---

## Next Steps

1. Review this plan with the team
2. Prioritize features based on business impact
3. Start with Phase 1 (Enhanced AI Assessment)
4. Build vehicle valuation database
5. Implement confidence scoring
6. Test with real cases and measure accuracy

---

**Key Takeaway**: The current AI assessment is a starting point. To make it trustworthy, we need:
1. Vehicle context (make/model/year/value)
2. Multi-stage analysis (detection → damage → valuation)
3. Confidence scoring and validation
4. Historical data and learning
5. Manager oversight and feedback loop
