# AI Assessment - Where Does The Data Come From?

## The Honest Truth

Right now, the AI assessment gets its data from **3 sources**:

1. **Google Cloud Vision API** (Real AI analyzing your photos)
2. **Hardcoded formulas** (Math we wrote)
3. **Hardcoded lookup tables** (Data we manually entered)

Let me break down EXACTLY what comes from where:

---

## Data Source Breakdown

### 1. From Google Cloud Vision API (Real AI) ✅

**What it provides:**
```typescript
// Google analyzes your photos and returns:
{
  labels: [
    { description: "Car", score: 0.95 },
    { description: "Vehicle", score: 0.92 },
    { description: "Damage", score: 0.88 },
    { description: "Dent", score: 0.85 },
    { description: "Broken glass", score: 0.82 },
    { description: "Collision", score: 0.78 }
  ]
}
```

**How it works:**
- You upload photos
- We send them to Google's servers
- Google's AI (trained on millions of images) analyzes them
- Returns labels describing what it sees
- Each label has a confidence score (0-1)

**This is REAL AI** - Google trained it on massive datasets

---

### 2. From Hardcoded Formulas (Our Math) ⚠️

**Market Value Estimation** (if you don't provide it):
```typescript
// Location: src/features/cases/services/ai-assessment-enhanced.service.ts
// Lines: 350-380

function estimateMarketValue(vehicleInfo?: VehicleInfo): number {
  // HARDCODED lookup table (we manually entered these values)
  const baseValues: Record<string, number> = {
    'Toyota Camry': 10000000,    // ← We made this up based on market research
    'Honda Accord': 9500000,     // ← We made this up
    'Toyota Corolla': 7500000,   // ← We made this up
    'Honda Civic': 7000000,      // ← We made this up
    // ... more vehicles
  };
  
  const baseValue = baseValues[`${make} ${model}`] || 8000000; // Default guess
  
  // HARDCODED depreciation formula (15% per year)
  const age = currentYear - vehicleInfo.year;
  const depreciatedValue = baseValue * Math.pow(0.85, age);
  
  return depreciatedValue;
}
```

**Where these numbers come from:**
- ❌ NOT from a database
- ❌ NOT from an API
- ✅ Manually researched Nigerian car prices
- ✅ Hardcoded into the source code
- ⚠️ Only covers ~10 popular vehicles
- ⚠️ Needs manual updates

---

**Repair Cost Estimation**:
```typescript
// Location: src/features/cases/services/ai-assessment-enhanced.service.ts
// Lines: 400-420

function estimateRepairCost(damageScore: DamageScore): number {
  // HARDCODED cost multipliers (we made these up)
  const costs = {
    structural: damageScore.structural * 50000,  // ₦50k per damage point
    mechanical: damageScore.mechanical * 30000,  // ₦30k per damage point
    cosmetic: damageScore.cosmetic * 10000,      // ₦10k per damage point
    electrical: damageScore.electrical * 20000,  // ₦20k per damage point
    interior: damageScore.interior * 15000,      // ₦15k per damage point
  };
  
  return Object.values(costs).reduce((sum, cost) => sum + cost, 0);
}
```

**Where these numbers come from:**
- ❌ NOT from a parts database
- ❌ NOT from repair shop APIs
- ✅ Estimated based on typical Nigerian repair costs
- ✅ Hardcoded multipliers
- ⚠️ Very rough estimates
- ⚠️ Doesn't account for specific parts or labor rates

---

**Damage Scoring**:
```typescript
// Location: src/features/cases/services/ai-assessment-enhanced.service.ts
// Lines: 300-330

function calculateDamageScore(labels): DamageScore {
  // HARDCODED keyword lists (we decided what words mean what)
  const structuralKeywords = ['frame', 'chassis', 'pillar', 'roof', 'floor'];
  const mechanicalKeywords = ['engine', 'transmission', 'axle', 'suspension'];
  const cosmeticKeywords = ['dent', 'scratch', 'paint', 'bumper'];
  
  // Match Google's labels against our keywords
  // If Google says "frame damage" → structural score increases
  // If Google says "dent" → cosmetic score increases
}
```

**Where this comes from:**
- ✅ Google provides the labels (real AI)
- ⚠️ We decide which labels mean "structural" vs "cosmetic" (hardcoded)
- ⚠️ We decide the scoring formula (hardcoded)

---

### 3. From User Input (You Provide) ✅

**What you can provide:**
```typescript
{
  vehicleInfo: {
    make: 'Toyota',           // ← You enter this
    model: 'Camry',           // ← You enter this
    year: 2020,               // ← You enter this
    marketValue: 8500000,     // ← You enter this (BEST option!)
    mileage: 45000,           // ← You enter this
    condition: 'good'         // ← You enter this
  }
}
```

**If you provide `marketValue`:**
- ✅ System uses YOUR value (most accurate)
- ✅ Skips the hardcoded lookup table
- ✅ Much better results

**If you DON'T provide `marketValue`:**
- ⚠️ System looks up vehicle in hardcoded table
- ⚠️ If not found, uses default (₦8,000,000)
- ❌ Very inaccurate

---

## The Complete Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    USER UPLOADS PHOTOS                       │
│                  + Vehicle Information                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              GOOGLE CLOUD VISION API                         │
│  • Analyzes photos with real AI                              │
│  • Returns labels: "Car", "Damage", "Dent", etc.            │
│  • Returns confidence scores                                 │
│  • Cost: $0.0015 per image                                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              OUR HARDCODED LOGIC                             │
│                                                              │
│  1. Match labels to damage categories                        │
│     • "frame" → structural damage                            │
│     • "dent" → cosmetic damage                               │
│     • "engine" → mechanical damage                           │
│                                                              │
│  2. Calculate damage scores (0-100)                          │
│     • structural: 75 (severe)                                │
│     • cosmetic: 60 (moderate)                                │
│     • mechanical: 45 (moderate)                              │
│                                                              │
│  3. Look up market value                                     │
│     IF user provided value:                                  │
│       ✅ Use user's value                                    │
│     ELSE:                                                    │
│       ⚠️ Look up in hardcoded table                         │
│       ⚠️ Apply depreciation formula                         │
│                                                              │
│  4. Calculate repair cost                                    │
│     ⚠️ Use hardcoded multipliers:                           │
│     • structural × ₦50k                                      │
│     • mechanical × ₦30k                                      │
│     • cosmetic × ₦10k                                        │
│                                                              │
│  5. Calculate salvage value                                  │
│     salvageValue = marketValue - repairCost                  │
│                                                              │
│  6. Calculate reserve price                                  │
│     reservePrice = salvageValue × 0.7                        │
│                                                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    RETURN ASSESSMENT                         │
│  {                                                           │
│    damageSeverity: 'moderate',                               │
│    estimatedSalvageValue: 5300000,                           │
│    reservePrice: 3710000,                                    │
│    confidence: 72%,                                          │
│    warnings: ['Low confidence - manual review recommended']  │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## What's Real vs What's Fake

### ✅ REAL (From Google AI)
- Photo analysis
- Damage detection
- Label identification
- Confidence scores

### ⚠️ ESTIMATED (Hardcoded by us)
- Market values (only ~10 vehicles)
- Depreciation rates (15% per year)
- Repair cost multipliers
- Damage category mapping
- Severity thresholds

### ❌ MISSING (Not implemented yet)
- Real-time market data
- Parts pricing database
- Labor rate database
- Historical sale prices
- Dealer pricing APIs
- Insurance valuation data

---

## How to Get Better Results

### Option 1: Provide Market Value (BEST)
```typescript
// Instead of letting system guess
vehicleInfo: {
  make: 'Toyota',
  model: 'Camry',
  year: 2020,
  marketValue: 8500000  // ← YOU provide this from dealer/valuation
}

// Result: 85% confidence (much better!)
```

### Option 2: Use Enhanced Version
```typescript
// Use the new enhanced service
import { assessDamageEnhanced } from '@/features/cases/services/ai-assessment-enhanced.service';

const assessment = await assessDamageEnhanced({
  photos,
  vehicleInfo: {
    make: 'Toyota',
    model: 'Camry',
    year: 2020,
    marketValue: 8500000  // Provide if you have it
  }
});

// Returns detailed breakdown with confidence scores
```

### Option 3: Build Real Data Sources (Future)
```typescript
// What we SHOULD do (not implemented yet):

// 1. Integrate with vehicle valuation API
const marketValue = await getMarketValue({
  make: 'Toyota',
  model: 'Camry',
  year: 2020,
  mileage: 45000,
  condition: 'good'
});

// 2. Get real parts pricing
const partsCost = await getPartsCost({
  vehicle: 'Toyota Camry 2020',
  damagedParts: ['front bumper', 'hood', 'windshield']
});

// 3. Get labor rates
const laborCost = await getLaborRates({
  location: 'Lagos',
  repairType: 'collision'
});

// 4. Check historical sales
const similarCases = await getSimilarCases({
  make: 'Toyota',
  model: 'Camry',
  damageSeverity: 'moderate'
});
```

---

## The Bottom Line

**Current Reality:**
- 30% Real AI (Google Vision analyzing photos)
- 70% Hardcoded formulas and lookup tables

**To improve accuracy, you need:**
1. Provide actual market value (don't let it guess)
2. Upload 5+ quality photos
3. Provide complete vehicle info
4. Review and override when needed

**Future improvements needed:**
1. Real vehicle valuation API
2. Parts pricing database
3. Labor rate database
4. Historical sales data
5. Machine learning on your own cases

---

## Example: Where Each Number Comes From

```typescript
Assessment Result:
{
  marketValue: 8500000,           // ← From hardcoded table OR user input
  estimatedRepairCost: 3200000,   // ← From hardcoded multipliers
  estimatedSalvageValue: 5300000, // ← Calculated: marketValue - repairCost
  reservePrice: 3710000,          // ← Calculated: salvageValue × 0.7
  
  damageScore: {
    structural: 75,               // ← From Google labels + our keyword matching
    mechanical: 45,               // ← From Google labels + our keyword matching
    cosmetic: 60,                 // ← From Google labels + our keyword matching
  },
  
  labels: [                       // ← From Google Cloud Vision API (REAL AI)
    "Car",
    "Damage",
    "Dent",
    "Broken glass"
  ],
  
  confidence: {
    overall: 72,                  // ← Calculated from our formula
    vehicleDetection: 90,         // ← Based on if you provided make/model
    damageDetection: 85,          // ← From Google's confidence scores
    valuationAccuracy: 60,        // ← Based on if you provided market value
    photoQuality: 75              // ← Based on number of photos
  }
}
```

---

## Questions?

**Q: Is the AI "smart"?**
A: The photo analysis (Google Vision) is very smart. The pricing calculations are just basic math with hardcoded numbers.

**Q: Can I trust the market value?**
A: Only if YOU provide it. Otherwise it's a rough guess from a small lookup table.

**Q: Why not use real data?**
A: We need to integrate with:
- Vehicle valuation APIs (cost money)
- Parts databases (need to build/buy)
- Historical sales data (need to collect over time)

**Q: What should I do now?**
A: Always provide the actual market value if you know it. Don't rely on the system's guess.

---

**The honest answer**: Right now it's 30% real AI, 70% hardcoded estimates. To make it trustworthy, we need real data sources.
