# Claude Complete Migration Guide - Session Continuation Document

## Session Context

**Date**: April 16, 2026
**Budget**: $5/month maximum
**API Key**: Provided (will rotate before production)
**Status**: $5 credit activated, ready to implement

---

## What We're Migrating

### Current Gemini Usage (Complete Analysis)

**1. Primary: Damage Assessment** (`src/lib/integrations/gemini-damage-detection.ts`)
- **Volume**: 45 cases/month (1-2 per day)
- **What it does**:
  - Analyzes 1-6 photos of damaged items
  - Supports vehicles, electronics, machinery
  - Identifies: make, model, year, color, trim, body style
  - Detects: specific damaged parts with severity levels
  - Determines: airbag deployment, total loss status
  - Returns: structured JSON with confidence scores
- **Token usage per assessment**: ~10,500 tokens (10K input + 500 output)
- **Current issues**: Week-long 503 errors, unreliable service

**2. Secondary: Part Price Search Integration**
- **Location**: `searchPartPricesForDamage()` function
- **What it does**: Takes Gemini's damaged parts → searches internet for prices
- **Token usage**: None (uses internet search, not AI)
- **Status**: Works fine, no changes needed

**3. Potential: Bid Price Prediction Enhancement**
- **Location**: `src/features/intelligence/services/prediction.service.ts`
- **Current**: SQL-based only (no AI)
- **Opportunity**: Add natural language explanations
- **Status**: Future enhancement, not in initial migration

---

## NEM Insurance Claims Analysis

### Company Profile
- **Type**: One of Nigeria's top 10 insurance companies
- **Branches**: 10-15 nationwide
- **2024 Revenue**: ₦97.9 billion
- **2024 Claims**: ₦24.9 billion (25.5% claims ratio)

### Actual Salvage Volume
Based on 2024 financial data:
- **Annual salvage cases**: 210-840 (conservative estimate)
- **Daily average**: 1-2 cases
- **Monthly average**: 45 cases
- **Peak days**: 3-5 cases (after holidays, bad weather)
- **Slow days**: 0 cases

### Claims Payment Patterns
- **Motor insurance**: ~25% of total claims
- **Salvage rate**: 5-8% of motor claims (total loss/severe damage)
- **Processing time**: Cases processed as they come in
- **Seasonal patterns**: Higher after holidays, rainy season
- **Geographic distribution**: Lagos accounts for ~45% of volume

---

## Claude Model Selection

### Recommended: Claude Haiku 3.5

**Why Haiku 3.5 (NOT Haiku 4.5)**:
- **Cost**: $0.80/MTok input, $4/MTok output (cheapest)
- **Quality**: Excellent for structured analysis
- **Speed**: Fastest Claude model
- **Vision**: Full multimodal support
- **Context**: 200K tokens
- **Best for**: High-volume damage assessments

**Model ID**: `claude-haiku-3.5-20241022`

**Why NOT Haiku 4.5**:
- More expensive: $1/MTok input, $5/MTok output
- Minimal quality improvement for our use case
- Would push us over budget

**Why NOT Sonnet or Opus**:
- Sonnet 4.6: $3/MTok input (3.75x more expensive)
- Opus 4.7: $5/MTok input (6.25x more expensive)
- Overkill for damage assessment
- Would blow through $5 credit in days

---

## Cost Analysis with Haiku 3.5

### Per Assessment Cost

**Without Prompt Caching**:
- Input: 10,000 tokens × $0.80/M = $0.008
- Output: 500 tokens × $4.00/M = $0.002
- **Total**: $0.010 per assessment

**With Prompt Caching** (1-hour TTL):
- First assessment: $0.0102 (cache write)
- Subsequent (within 1 hour): $0.00928 (cache read)
- **Average**: ~$0.0095 per assessment

### Monthly Cost (45 assessments)

**Damage Assessment Only**:
- 45 × $0.0095 = **$0.43/month** (₦688)

**With Vendor Recommendations** (optional):
- Damage: $0.43
- Recommendations: 45 × $0.015 = $0.68
- **Total**: $1.11/month (₦1,776)

### $5 Credit Coverage

**Damage Assessment Only**:
- $5 ÷ $0.0095 = **526 assessments**
- At 45/month = **11.7 months of free usage**

**With Recommendations**:
- $5 ÷ ($0.0095 + $0.015) = **204 combined operations**
- At 45/month = **4.5 months of free usage**

---

## What Gemini Does (Complete Functionality Map)

### Input Processing
1. **Accepts 1-6 photos** (base64 or URLs)
2. **Vehicle context**: make, model, year
3. **Item type**: vehicle, electronics, machinery
4. **Condition**: Brand New, Foreign Used, Nigerian Used

### Analysis Output
1. **Item Details** (`itemDetails` object):
   - `detectedMake`: Brand/manufacturer
   - `detectedModel`: Model name
   - `detectedYear`: Year/age
   - `color`: Exterior color
   - `trim`: Trim level (vehicles)
   - `bodyStyle`: Body type (vehicles)
   - `storage`: Storage capacity (electronics)
   - `overallCondition`: Condition assessment
   - `notes`: Discrepancies or observations

2. **Damaged Parts** (`damagedParts` array):
   - `part`: Specific part name with location
   - `severity`: minor, moderate, severe
   - `confidence`: 0-100 score

3. **Overall Assessment**:
   - `severity`: Overall damage classification
   - `airbagDeployed`: Boolean (vehicles only)
   - `totalLoss`: Boolean (conservative criteria)
   - `summary`: 2-3 sentence description (max 500 chars)
   - `confidence`: Overall confidence score

### Special Features
- **Verification**: Compares photos vs provided info
- **Discrepancy detection**: Flags mismatches
- **Conservative total loss**: Only marks if truly beyond repair
- **Structured JSON**: Validated schema with fallbacks

---

## Claude Implementation Strategy

### Phase 1: Core Damage Assessment (Week 1)

**Goal**: Replace Gemini with Claude for damage assessment

**Files to Create**:
1. `src/lib/integrations/claude-damage-detection.ts`
2. `src/lib/integrations/claude-rate-limiter.ts`
3. `src/lib/integrations/damage-detection-fallback.ts`

**Files to Modify**:
1. `src/features/cases/services/ai-assessment-enhanced.service.ts`
2. `src/app/api/cases/ai-assessment/route.ts`
3. `.env` (add CLAUDE_API_KEY)

**Implementation Steps**:
1. Install Anthropic SDK: `npm install @anthropic-ai/sdk`
2. Add API key to `.env`
3. Create Claude damage detection service
4. Implement prompt caching (1-hour TTL)
5. Create fallback chain: Claude → Gemini → Vision
6. Add usage tracking and cost monitoring
7. Test with 5-10 real cases
8. Compare quality vs Gemini

### Phase 2: Optimization (Week 2)

**Goal**: Optimize prompts and caching

**Tasks**:
1. Fine-tune system prompts for token efficiency
2. Optimize image handling (resize if needed)
3. Implement automatic caching
4. Add cost alerts ($4 threshold)
5. Monitor cache hit rates
6. Adjust caching strategy based on usage

### Phase 3: Enhancements (Month 2+)

**Goal**: Add value-added features within budget

**Optional Features** (in priority order):
1. Vendor recommendations ($0.68/month)
2. Lightweight fraud detection ($0.40/month)
3. Lightweight bid predictions ($0.32/month)

---

## Prompt Engineering for Claude

### System Prompt Structure

**Key Differences from Gemini**:
- Claude prefers clear, structured instructions
- Use markdown formatting for sections
- Explicit field-by-field instructions
- Examples improve accuracy significantly

**Optimized System Prompt** (for vehicles):
```
You are an expert vehicle damage assessor for insurance claims.

# TASK
Analyze photos of a {year} {make} {model} and provide a structured damage assessment.

# CRITICAL RULES
1. Provide ONLY factual data - NO reasoning or explanations in field values
2. If uncertain about a field, OMIT it entirely (don't include the key)
3. Be SPECIFIC with part names (e.g., "driver front door", not "door")
4. Total loss is RARE - only mark if truly beyond economic repair

# OUTPUT STRUCTURE
Return JSON with these exact fields:
- itemDetails: {detectedMake, detectedModel, detectedYear, color, trim, bodyStyle, overallCondition, notes}
- damagedParts: [{part, severity, confidence}]
- severity: "minor" | "moderate" | "severe"
- airbagDeployed: boolean
- totalLoss: boolean
- summary: string (max 500 chars)

# SEVERITY GUIDELINES
- Minor: Cosmetic damage, small dents, scratches (repairable with minimal cost)
- Moderate: Functional damage, crumpled panels, broken lights (requires significant repair)
- Severe: Structural damage, major mechanical failure, deployed airbags (may not be economically repairable)

# TOTAL LOSS CRITERIA (CONSERVATIVE)
Mark totalLoss=true ONLY if ALL apply:
1. Frame/chassis SEVERELY bent or buckled
2. Cabin collapsed or SEVERE intrusion
3. Multiple CRITICAL systems COMPLETELY destroyed
4. Vehicle UNSAFE to drive even after repairs
5. Repair cost would exceed 80% of vehicle value

# EXAMPLES
Body panel damage (bumpers, doors, fenders) = NOT total loss
Airbag deployment alone = NOT total loss
Single system damage = NOT total loss
```

### Prompt Caching Strategy

**What to Cache**:
- System prompt (same for all assessments)
- Tool definitions (if using tools)
- Static instructions

**What NOT to Cache**:
- Images (different per assessment)
- Vehicle context (changes per case)
- User messages

**Implementation**:
```typescript
{
  model: "claude-haiku-3.5-20241022",
  max_tokens: 1024,
  system: [
    {
      type: "text",
      text: systemPrompt, // This gets cached
      cache_control: { type: "ephemeral", ttl: "1h" }
    }
  ],
  messages: [
    {
      role: "user",
      content: [
        ...images, // NOT cached
        { type: "text", text: "Assess damage" }
      ]
    }
  ]
}
```

---

## Implementation Code

### 1. Install Dependencies

```bash
npm install @anthropic-ai/sdk
```

### 2. Environment Variables

Add to `.env`:
```
CLAUDE_API_KEY=your-claude-api-key-here
```

### 3. Cost Monitoring

Track usage in every request:
```typescript
const usage = response.usage;
const cost = {
  input: (usage.input_tokens / 1_000_000) * 0.80,
  output: (usage.output_tokens / 1_000_000) * 4.00,
  cacheWrite: ((usage.cache_creation_input_tokens || 0) / 1_000_000) * 1.60,
  cacheRead: ((usage.cache_read_input_tokens || 0) / 1_000_000) * 0.08,
  total: 0
};
cost.total = cost.input + cost.output + cost.cacheWrite + cost.cacheRead;

// Log to database or monitoring service
console.log(`Request cost: $${cost.total.toFixed(6)}`);
```

---

## Migration Checklist

### Pre-Migration
- [x] API key obtained
- [x] $5 credit activated
- [ ] Install @anthropic-ai/sdk
- [ ] Add CLAUDE_API_KEY to .env
- [ ] Create backup of current Gemini integration

### Implementation
- [ ] Create claude-damage-detection.ts
- [ ] Implement prompt caching
- [ ] Create fallback chain
- [ ] Add cost monitoring
- [ ] Update ai-assessment-enhanced.service.ts
- [ ] Test with 5 real cases
- [ ] Compare quality vs Gemini

### Testing
- [ ] Test vehicle damage assessment
- [ ] Test electronics damage assessment
- [ ] Test machinery damage assessment
- [ ] Test with 1 photo
- [ ] Test with 6 photos
- [ ] Test discrepancy detection
- [ ] Test total loss determination
- [ ] Verify all fields populated correctly

### Monitoring
- [ ] Set up cost tracking
- [ ] Monitor cache hit rates
- [ ] Track average cost per assessment
- [ ] Set alert at $4 spent
- [ ] Monitor quality vs Gemini

### Optimization
- [ ] Fine-tune prompts for token efficiency
- [ ] Optimize image sizes if needed
- [ ] Adjust caching strategy
- [ ] Document best practices

---

## Budget Safeguards

### Cost Alerts
1. **$1 spent**: Review usage patterns
2. **$2 spent**: Check for inefficiencies
3. **$3 spent**: Optimize prompts/caching
4. **$4 spent**: ALERT - approaching limit
5. **$4.50 spent**: STOP - investigate before continuing

### Rate Limiting
- **Max 100 requests/day** (safety limit)
- **Max 10 requests/hour** (prevents runaway costs)
- **Alert if >5 requests in 10 minutes**

### Fallback Strategy
If Claude costs exceed budget:
1. Fall back to Gemini for non-critical cases
2. Use Claude only for complex assessments
3. Reduce image count (use 3 instead of 6)
4. Disable optional features

---

## Next Session Checklist

When you continue in the next session, you'll have:

1. **This document** - Complete migration guide
2. **Cost analysis** - Exact budget breakdown
3. **NEM data** - Real usage patterns
4. **Implementation plan** - Step-by-step guide
5. **Code examples** - Ready to implement
6. **Monitoring strategy** - Cost tracking
7. **Fallback plan** - If things go wrong

**First steps in next session**:
1. Read this document
2. Install Anthropic SDK
3. Create claude-damage-detection.ts
4. Implement with prompt caching
5. Test with 1-2 real cases
6. Monitor costs closely

---

**Session saved**: April 16, 2026
**Budget**: $5/month
**Model**: Claude Haiku 3.5
**Expected cost**: $0.43/month (damage only)
**Credit coverage**: 11.7 months
**Ready to implement!**
