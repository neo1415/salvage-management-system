# Gemini Architecture - Complete Analysis

**Date**: 2026-04-16  
**Purpose**: Complete understanding of current Gemini implementation before Claude migration  
**Status**: ✅ COMPLETE - Ready for Claude implementation

---

## Executive Summary

The current system uses **Gemini 2.5 Flash** as the primary AI damage detection service with a fallback chain to Vision API. This document provides a complete architectural analysis to ensure the Claude migration replicates ALL functionality exactly.

### Key Statistics
- **Main Implementation**: `src/lib/integrations/gemini-damage-detection.ts` (1906 lines)
- **Service Layer**: `src/features/cases/services/ai-assessment-enhanced.service.ts` (2317 lines)
- **API Endpoint**: `src/app/api/cases/ai-assessment/route.ts`
- **Current Volume**: 45 assessments/month (1-2 per day)
- **Image Limit**: 1-10 images per assessment (max 10 for budget)
- **Rate Limits**: 10 requests/minute, 1,500 requests/day (Gemini free tier)

---

## 1. Complete Gemini Functionality Map

### 1.1 Core Features

#### A. Multimodal Damage Assessment
- **Input**: 1-10 images (JPEG, PNG, WebP, base64 data URLs)
- **Output**: Structured JSON with damage analysis
- **Supported Items**:
  - Vehicles (primary use case)
  - Electronics (phones, laptops, tablets)
  - Machinery/Equipment (generators, tools)

#### B. Item Identification
```typescript
interface ItemDetails {
  detectedMake?: string;      // Brand/manufacturer
  detectedModel?: string;     // Model name
  detectedYear?: string;      // Year/age
  color?: string;             // Color
  trim?: string;              // Trim level (vehicles)
  bodyStyle?: string;         // Body type (vehicles)
  storage?: string;           // Storage capacity (electronics)
  overallCondition?: string;  // Condition assessment
  notes?: string;             // Discrepancy notes
}
```

**Critical Feature**: Vehicle verification - compares provided info with detected info and flags mismatches

#### C. Damaged Parts Detection
```typescript
interface DamagedPart {
  part: string;              // Specific part name with location
  severity: 'minor' | 'moderate' | 'severe';
  confidence: number;        // 0-100
}
```

**Key Characteristics**:
- Only lists DAMAGED parts (not undamaged)
- Specific location names (e.g., "driver front door", not just "door")
- Part-level severity classification
- Confidence scoring per part

#### D. Overall Assessment
- **Severity**: minor | moderate | severe (overall classification)
- **Airbag Deployment**: boolean (critical safety indicator)
- **Total Loss**: boolean (CONSERVATIVE criteria - see section 1.3)
- **Summary**: 2-3 sentences, max 500 characters
- **Confidence**: 0-100 (average of part confidences)

### 1.2 Prompt Engineering

#### Vehicle Prompt Structure
1. **Section 1: Vehicle Identification**
   - Verify provided make/model/year
   - Detect trim, color, body style
   - Flag discrepancies with notes

2. **Section 2: Damage Analysis**
   - List ONLY damaged parts
   - Specific part names with locations
   - Severity + confidence per part
   - Part categories: Exterior, Structural, Mechanical, Electrical, Interior

3. **Section 3: Overall Assessment**
   - Overall severity classification
   - Airbag deployment detection
   - **CONSERVATIVE total loss criteria** (see below)
   - Summary generation

#### Electronics Prompt Structure
- Similar structure adapted for devices
- Focus on: screen, housing, cameras, ports, battery, internal components
- No airbag detection (always false)
- Different total loss criteria (bent frame, water damage, multiple critical components)

#### Machinery Prompt Structure
- Adapted for equipment/generators/tools
- Focus on: structural, mechanical, hydraulic, electrical, operational, safety
- No airbag detection (always false)
- Total loss criteria: frame damage, engine destruction, multiple system failures

### 1.3 Total Loss Determination - CRITICAL

**Gemini uses EXTREMELY CONSERVATIVE criteria** - this is intentional to avoid false positives:

```
Set totalLoss to TRUE only if ALL of these apply:
1. Frame/chassis is SEVERELY bent, twisted, or buckled
2. Cabin has COLLAPSED or has SEVERE intrusion
3. Multiple CRITICAL systems are COMPLETELY destroyed
4. Vehicle would be UNSAFE to drive even after repairs
5. Repair cost would exceed 80% of vehicle value
```

**Examples that are NOT total loss**:
- Front and rear body panel damage
- Airbag deployment alone
- Single major system damage
- Repairable frame damage
- Side impact with door/panel damage but intact frame

**This is a key differentiator** - Gemini is trained to be conservative to avoid insurance fraud.

### 1.4 Response Validation & Sanitization

#### Field Validation Rules
1. **Damage Scores**: Clamped to 0-100, default 50 if invalid
2. **Severity**: Must be 'minor' | 'moderate' | 'severe', default 'moderate'
3. **Booleans**: Must be true/false, default false
4. **Summary**: Max 500 chars, truncated if longer, default text if empty
5. **Item Details**: Reject reasoning text, only factual data

#### Critical Sanitization
```typescript
// REJECT values with reasoning/explanations
// CORRECT: {"color": "White"}
// INCORRECT: {"color": "White (appears to be white but lighting makes it hard to confirm)"}
```

**Reasoning**: Response shown directly to adjusters/vendors - must be professional and concise

---

## 2. Integration Architecture

### 2.1 Call Flow

```
User submits case with photos
    ↓
API: /api/cases/ai-assessment (POST)
    ↓
Service: assessDamageEnhanced()
    ↓
Fallback Chain: analyzePhotosWithFallback()
    ├─→ ATTEMPT 1: Gemini (if enabled + rate limit OK + context provided)
    │   ├─→ SUCCESS: Return Gemini results
    │   └─→ FAIL: Log error, proceed to Vision
    ├─→ ATTEMPT 2: Vision API
    │   ├─→ SUCCESS: Return Vision results
    │   └─→ FAIL: Log error, proceed to neutral
    └─→ ATTEMPT 3: Neutral scores (fallback)
        └─→ ALWAYS SUCCEEDS: Return default scores
```

### 2.2 Gemini Service Initialization

```typescript
// Auto-initializes on module load
initializeGeminiService()
  ├─→ Validate GEMINI_API_KEY exists
  ├─→ Check API key format (min 20 chars)
  ├─→ Initialize GoogleGenerativeAI client
  ├─→ Configure gemini-2.5-flash model
  ├─→ Validate connection (attempt model access)
  └─→ Set serviceConfig.enabled = true/false
```

**Key Points**:
- Graceful degradation if API key missing/invalid
- Logs warnings but doesn't crash
- Falls back to Vision API automatically

### 2.3 Rate Limiting

**Gemini Free Tier Limits**:
- 10 requests/minute
- 1,500 requests/day

**Implementation**: `src/lib/integrations/gemini-rate-limiter.ts`
- In-memory tracking (per-minute and per-day)
- Checks quota before each request
- Records successful requests
- Returns quota status (allowed/denied + remaining counts)

**Fallback Behavior**: If rate limit exceeded, falls back to Vision API

### 2.4 Error Handling & Retry Logic

#### Error Classification
```typescript
enum ErrorType {
  TRANSIENT = 'transient',      // 5xx errors - retry once
  AUTHENTICATION = 'authentication', // Invalid API key - no retry
  VALIDATION = 'validation',     // Invalid input/response - no retry
  TIMEOUT = 'timeout',           // Request timeout - no retry
  UNKNOWN = 'unknown'            // Unknown error - no retry
}
```

#### Retry Strategy
- **Transient errors (5xx)**: Retry once after 2 seconds
- **All other errors**: No retry, immediate fallback
- **Timeout**: 30 seconds per request (increased for multiple photos)

### 2.5 Part Price Integration

**Critical Feature**: Gemini's damaged parts are used for part price searches

```typescript
// Flow:
1. Gemini detects damaged parts with specific names
2. Part names passed to internetSearchService.searchMultiplePartPrices()
3. Searches Jiji.ng and other Nigerian marketplaces
4. Returns part prices for salvage calculation
5. Damage calculation service uses prices for accurate deductions
```

**Key Insight**: Gemini's specific part names (e.g., "driver front door") are preserved for search accuracy

---

## 3. Data Structures

### 3.1 Input Structures

#### VehicleContext (for Gemini)
```typescript
interface VehicleContext {
  make: string;
  model: string;
  year: number;
  itemType?: string; // 'vehicle' | 'electronics' | 'machinery'
}
```

#### UniversalItemInfo (for Service Layer)
```typescript
interface UniversalItemInfo {
  type: 'vehicle' | 'electronics' | 'appliance' | 'watch' | 'machinery' | 'other';
  condition: 'Brand New' | 'Foreign Used (Tokunbo)' | 'Nigerian Used' | 'Heavily Used';
  
  // Type-specific fields
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  brand?: string;
  storageCapacity?: string;
  batteryHealth?: number;
  age?: number;
  brandPrestige?: 'luxury' | 'premium' | 'standard' | 'budget';
}
```

### 3.2 Output Structures

#### GeminiDamageAssessment (Raw Gemini Output)
```typescript
interface GeminiDamageAssessment {
  itemDetails?: ItemDetails;
  damagedParts: DamagedPart[];
  severity: 'minor' | 'moderate' | 'severe';
  airbagDeployed: boolean;
  totalLoss: boolean;
  summary: string;
  confidence: number;
  method: 'gemini';
}
```

#### EnhancedDamageAssessment (Final Output)
```typescript
interface EnhancedDamageAssessment {
  // Basic info
  labels: string[];
  confidenceScore: number;
  damagePercentage: number;
  damageSeverity: 'minor' | 'moderate' | 'severe';
  
  // Damage details
  damageScore: DamageScore; // Converted from damagedParts
  confidence: AssessmentConfidence;
  itemDetails?: ItemDetails;
  damagedParts?: DamagedPart[];
  
  // Financial estimates
  marketValue: number;
  estimatedRepairCost: number;
  estimatedSalvageValue: number;
  reservePrice: number;
  damageBreakdown?: Array<{...}>;
  isTotalLoss?: boolean;
  priceSource?: string;
  qualityTier: QualityTier;
  
  // Recommendations
  isRepairable: boolean;
  recommendation: string;
  summary?: string; // Gemini's summary for display
  warnings: string[];
  
  // Metadata
  processedAt: Date;
  photoCount: number;
  analysisMethod: 'gemini' | 'vision' | 'neutral' | 'mock';
}
```

### 3.3 Legacy DamageScore Conversion

**Critical Conversion**: Gemini's `damagedParts[]` → Legacy `DamageScore`

```typescript
interface DamageScore {
  structural: number;    // 0-100
  mechanical: number;    // 0-100
  cosmetic: number;      // 0-100
  electrical: number;    // 0-100
  interior: number;      // 0-100
}
```

**Mapping Logic**:
- Each damaged part mapped to category based on keywords
- Severity → Score: minor=30, moderate=60, severe=90
- Category score = MAX score of all parts in that category
- Fallback to cosmetic if no category match

---

## 4. Image Handling

### 4.1 Supported Formats
- **MIME Types**: image/jpeg, image/png, image/webp
- **Extensions**: .jpg, .jpeg, .png, .webp
- **Input Types**: Regular URLs OR base64 data URLs

### 4.2 Image Conversion

```typescript
// Handles both:
1. Regular URLs: Fetch → ArrayBuffer → Base64
2. Data URLs: Extract base64 directly from data:image/...;base64,...
```

### 4.3 Photo Count Handling
- **Minimum**: 1 photo (API endpoint requires 3 for full assessment)
- **Maximum**: 10 photos (budget constraint)
- **Gemini Limit**: 6 photos per request (logs warning if more, processes first 6)

---

## 5. Cost Analysis

### 5.1 Gemini 2.5 Flash Pricing
- **Input**: $0.075/MTok (1M tokens)
- **Output**: $0.30/MTok (1M tokens)
- **Images**: ~258 tokens per image (at default resolution)

### 5.2 Current Usage Calculation
```
Per Assessment (10 images):
- Prompt: ~2,000 tokens
- Images: 10 × 258 = 2,580 tokens
- Total Input: ~4,580 tokens
- Output: ~500 tokens (JSON response)

Cost per assessment:
- Input: 4,580 × $0.075/1M = $0.00034
- Output: 500 × $0.30/1M = $0.00015
- Total: $0.00049 per assessment

Monthly cost (45 assessments):
- 45 × $0.00049 = $0.022/month
- Well under $5/month budget ✅
```

---

## 6. Critical Implementation Details

### 6.1 Structured JSON Output

Gemini is configured with:
```typescript
generationConfig: {
  responseMimeType: "application/json",
  responseSchema: GEMINI_RESPONSE_SCHEMA
}
```

**Schema enforces**:
- Required fields: itemDetails, damagedParts, severity, airbagDeployed, totalLoss, summary
- Field types and constraints
- Enum values for severity
- Array structure for damagedParts

### 6.2 Prompt Caching

**NOT CURRENTLY IMPLEMENTED** but recommended for Claude:
- Cache system prompts (vehicle/electronics/machinery templates)
- 1-hour TTL
- Reduces input token costs by ~50%

### 6.3 Logging & Traceability

Every request has a unique `requestId`:
```typescript
const requestId = `gemini-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
```

**Logged Events**:
- Service initialization
- API calls (attempts, retries, failures)
- Response parsing
- Validation warnings
- Error classification
- Fallback triggers

### 6.4 Security Considerations

1. **API Key Masking**: Only last 4 chars logged
2. **PII Handling**: No user data in logs
3. **Input Validation**: All inputs validated before API call
4. **Response Sanitization**: Removes reasoning text, validates types

---

## 7. Fallback Chain Details

### 7.1 Trigger Conditions

**Gemini → Vision Fallback**:
- Gemini not enabled (API key missing/invalid)
- Rate limit exceeded
- API error (5xx after retry, 4xx, timeout)
- No vehicle context provided
- Gemini returns invalid response

**Vision → Neutral Fallback**:
- Vision API fails
- Vision returns no labels
- Vision confidence too low

### 7.2 Neutral Scores (Last Resort)

```typescript
{
  structural: 50,
  mechanical: 50,
  cosmetic: 50,
  electrical: 50,
  interior: 50,
  method: 'neutral'
}
```

**Used when**: Both Gemini and Vision fail completely

---

## 8. Testing & Validation

### 8.1 Current Test Coverage
- Unit tests for validation functions
- Integration tests for API endpoints
- E2E tests for full assessment flow

### 8.2 Validation Functions
- `validateDamageScore()`: Clamps scores to 0-100
- `validateBoolean()`: Ensures boolean type
- `validateSummary()`: Checks length, truncates if needed
- `validateAndCorrectSeverity()`: Ensures severity matches scores
- `parseAndValidateResponse()`: Complete response validation

---

## 9. Key Differences from Vision API

| Feature | Gemini | Vision API |
|---------|--------|------------|
| **Item Identification** | ✅ Yes (make/model/year/color/trim) | ❌ No |
| **Specific Part Names** | ✅ Yes ("driver front door") | ❌ No (generic labels) |
| **Severity Classification** | ✅ Per-part + overall | ❌ Overall only |
| **Airbag Detection** | ✅ Yes | ❌ No |
| **Total Loss Logic** | ✅ Conservative criteria | ❌ Simple threshold |
| **Structured Output** | ✅ JSON schema enforced | ❌ Label array |
| **Context Awareness** | ✅ Uses vehicle context | ❌ No context |
| **Cost** | 💰 $0.00049/assessment | 💰 Free (Google Cloud) |

---

## 10. Migration Checklist for Claude

### Must Replicate
- ✅ Item identification (make/model/year/color/trim)
- ✅ Specific part names with locations
- ✅ Per-part severity + confidence
- ✅ Conservative total loss criteria
- ✅ Airbag deployment detection
- ✅ Vehicle verification (mismatch detection)
- ✅ Structured JSON output
- ✅ Response validation & sanitization
- ✅ Error handling & retry logic
- ✅ Rate limiting
- ✅ Fallback to Gemini (reverse of current)
- ✅ Part price integration
- ✅ Multi-item type support (vehicles/electronics/machinery)

### Improvements for Claude
- ✅ Prompt caching (1-hour TTL)
- ✅ Better cost optimization
- ✅ Potentially better accuracy
- ✅ Longer context window (200K tokens)

### Must NOT Change
- ❌ API endpoint structure
- ❌ Response format (EnhancedDamageAssessment)
- ❌ Fallback chain behavior
- ❌ Part price search integration
- ❌ Total loss criteria (keep conservative)

---

## 11. Next Steps

1. ✅ **COMPLETE**: Understand Gemini architecture (THIS DOCUMENT)
2. ⏭️ **NEXT**: Design Claude implementation
   - Create `src/lib/integrations/claude-damage-detection.ts`
   - Replicate ALL Gemini functionality
   - Add prompt caching
   - Implement rate limiting
3. ⏭️ **THEN**: Update fallback chain
   - Claude → Gemini → Vision → Neutral
4. ⏭️ **THEN**: Test thoroughly
   - Unit tests
   - Integration tests
   - E2E tests
   - Cost validation
5. ⏭️ **FINALLY**: Deploy with monitoring

---

## 12. Questions Answered

### Q: What does Gemini do?
A: Multimodal damage assessment with item identification, specific part detection, severity classification, airbag detection, and conservative total loss determination.

### Q: How does it integrate?
A: Primary AI service in fallback chain (Gemini → Vision → Neutral), called from enhanced assessment service, results used for part price searches and salvage calculations.

### Q: What must Claude replicate?
A: EVERYTHING - item identification, part detection, severity classification, total loss logic, response format, validation, error handling, rate limiting.

### Q: What can Claude improve?
A: Cost (with prompt caching), potentially accuracy, longer context window.

### Q: What's the budget?
A: $5/month for 45 assessments with 10 images each. Claude Haiku 3.5 with caching: $0.43/month ✅

---

**Status**: ✅ ARCHITECTURE FULLY UNDERSTOOD - READY FOR CLAUDE IMPLEMENTATION

**Next Document**: `CLAUDE_IMPLEMENTATION_PLAN.md`
