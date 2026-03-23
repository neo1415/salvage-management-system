# External Integrations

This directory contains integrations with external APIs and services.

## Available Integrations

### Google Cloud Services

#### 1. Google Gemini 2.0 Flash (`gemini-damage-detection.ts`)
- **Purpose**: Advanced multimodal AI damage assessment for vehicles
- **Use Cases**: Analyze vehicle photos to detect and score damage across multiple categories
- **API**: Google Gemini 2.0 Flash API
- **SDK Version**: @google/generative-ai v0.24.1
- **Cost**: Free tier - 10 requests/minute, 1,500 requests/day
- **Configuration**: `GEMINI_API_KEY`
- **Features**:
  - Structured damage scoring (structural, mechanical, cosmetic, electrical, interior)
  - Severity classification (minor/moderate/severe)
  - Airbag deployment detection
  - Total loss determination
  - Automatic fallback to Vision API when unavailable
  - Rate limiting to stay within free tier
  - Comprehensive logging and monitoring
  - Retry logic for transient failures
- **Fallback Chain**: Gemini → Vision API → Neutral scores

**Usage Example**:
```typescript
import { assessDamageWithGemini } from '@/lib/integrations/gemini-damage-detection';

const assessment = await assessDamageWithGemini(
  ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
  { make: 'Toyota', model: 'Camry', year: 2021 }
);

console.log(`Structural damage: ${assessment.structural}/100`);
console.log(`Severity: ${assessment.severity}`);
console.log(`Total loss: ${assessment.totalLoss}`);
```

**Rate Limiting** (`gemini-rate-limiter.ts`):
- Enforces 10 requests/minute (sliding window)
- Enforces 1,500 requests/day (resets at UTC midnight)
- Automatic quota checking before each request
- Warnings logged at 80% (1,200) and 90% (1,350) of daily quota
- Automatic fallback to Vision API when quota exceeded

**Fallback Chain** (orchestrated by `ai-assessment.service.ts`):
1. **Primary: Gemini 2.0 Flash** (most accurate)
   - Requires vehicle context (make, model, year)
   - Checks rate limiter before attempting
   - 10-second timeout per request
   - Retries once on transient failures (5xx errors)
   
2. **Fallback 1: Google Cloud Vision API** (keyword matching)
   - Triggered when Gemini fails or quota exceeded
   - Uses existing Vision API integration
   - No rate limits (pay-per-use)
   
3. **Fallback 2: Neutral scores** (safe defaults)
   - Triggered when both Gemini and Vision fail
   - Returns 50 for all damage categories
   - Severity set to 'moderate'
   - Ensures system never fails completely

**Error Handling**:
- **Authentication errors**: Immediate fallback (no retry)
- **Rate limit errors**: Immediate fallback to Vision API
- **Timeout errors**: Retry once after 2 seconds, then fallback
- **Network errors**: Retry once after 2 seconds, then fallback
- **Validation errors**: Immediate fallback (no retry)
- All errors logged with request ID for traceability

**Monitoring** (`/api/admin/gemini-metrics`):
- Success rates by method (Gemini, Vision, Neutral)
- Average response times
- Daily quota usage and remaining
- Error rates by type
- Active alerts for threshold violations
- See `src/lib/monitoring/README.md` for details

#### 2. Google Document AI (`google-document-ai.ts`)
- **Purpose**: Extract text from documents using OCR
- **Use Cases**: NIN extraction from ID cards, CAC certificate parsing
- **API**: Google Cloud Document AI
- **Cost**: Pay-per-use
- **Configuration**: `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`

#### 3. Google Geolocation (`google-geolocation.ts`)
- **Purpose**: Accurate location detection for case creation
- **Use Cases**: GPS capture at accident sites
- **API**: Google Maps Geolocation API
- **Cost**: $5 per 1,000 requests (~$15/month for 3,000 cases)
- **Configuration**: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- **Features**:
  - Hybrid approach (Google API + browser fallback)
  - Works offline (falls back to browser geolocation)
  - Reverse geocoding for human-readable addresses
  - Much more accurate than browser geolocation alone

**Usage Example**:
```typescript
import { getAccurateGeolocation } from '@/lib/integrations/google-geolocation';

// Get location (automatically uses best available method)
const location = await getAccurateGeolocation();
console.log(`Lat: ${location.latitude}, Lng: ${location.longitude}`);
console.log(`Accuracy: ${location.accuracy}m`);
console.log(`Source: ${location.source}`); // 'google-api' or 'browser'
console.log(`Location: ${location.locationName}`);
```

### Payment Services

#### 4. Paystack Bank Verification (`paystack-bank-verification.ts`)
- **Purpose**: Verify bank account details
- **Use Cases**: Vendor bank account verification for payouts
- **API**: Paystack Bank Account Resolution API
- **Cost**: Free (included in Paystack)
- **Configuration**: `PAYSTACK_SECRET_KEY`

### Government Services

#### 5. NIN Verification (`nin-verification.ts`)
- **Purpose**: Verify National Identification Number
- **Use Cases**: Vendor KYC verification
- **API**: NIMC API (mock implementation - requires government approval)
- **Cost**: TBD (pending NIMC integration)
- **Configuration**: None (mock)
- **Status**: Mock implementation - production requires NIMC API access

### Image Optimization

#### 6. TinyPNG (`tinypng.ts`)
- **Purpose**: Compress images before upload
- **Use Cases**: Reduce photo file sizes for faster uploads
- **API**: TinyPNG API
- **Cost**: 500 free compressions/month, then $0.009 per image
- **Configuration**: `TINYPNG_API_KEY`

## Setup Instructions

### Google Gemini API

1. **Get API Key**:
   - Go to https://aistudio.google.com/apikey
   - Sign in with your Google account
   - Click "Create API Key"
   - Copy the API key

2. **Add to Environment**:
   ```bash
   GEMINI_API_KEY=your-gemini-api-key-here
   ```

3. **Monitor Usage**:
   - View usage at https://aistudio.google.com/usage
   - Free tier limits: 10 requests/minute, 1,500 requests/day
   - System automatically falls back to Vision API when limits are reached
   - Check metrics at `/api/admin/gemini-metrics` (admin only)

4. **Test**:
   - Create a case with vehicle photos
   - Check logs for "Gemini assessment successful" message
   - Verify detailed damage scores are returned
   - Check that method field indicates 'gemini'

**Rate Limiting**:
- The system enforces rate limits automatically via `GeminiRateLimiter`
- Sliding window for minute-based limiting (10 requests/minute)
- Daily counter with UTC midnight reset (1,500 requests/day)
- Warnings logged at 80% (1,200) and 90% (1,350) of daily quota
- Error logged when quota exhausted (1,500 requests)
- Automatic fallback to Vision API when quota exceeded
- Daily quota resets at midnight UTC

**Fallback Behavior**:
The system uses a three-tier fallback chain orchestrated by `ai-assessment.service.ts`:

1. **Primary: Gemini 2.0 Flash** (most accurate)
   - Requires vehicle context (make, model, year)
   - Checks rate limiter before attempting
   - 10-second timeout per request
   - Retries once on transient failures (5xx errors)
   - Logs: "Attempting Gemini assessment"
   
2. **Fallback 1: Google Cloud Vision API** (keyword matching)
   - Triggered when Gemini fails or quota exceeded
   - Uses existing Vision API integration
   - No rate limits (pay-per-use)
   - Logs: "Falling back to Vision API" with reason
   
3. **Fallback 2: Neutral scores** (safe defaults)
   - Triggered when both Gemini and Vision fail
   - Returns 50 for all damage categories
   - Severity set to 'moderate'
   - Ensures system never fails completely
   - Logs: "All AI methods failed, returning neutral scores"

**Response Format**:
All methods return a unified response format with backward compatibility:

```typescript
{
  // Existing fields (always present)
  labels: string[];
  confidenceScore: number;
  damagePercentage: number;
  damageSeverity: 'minor' | 'moderate' | 'severe';
  estimatedSalvageValue: number;
  reservePrice: number;
  processedAt: Date;
  
  // New optional fields (only when using Gemini)
  method?: 'gemini' | 'vision' | 'neutral';
  detailedScores?: {
    structural: number;
    mechanical: number;
    cosmetic: number;
    electrical: number;
    interior: number;
  };
  airbagDeployed?: boolean;
  totalLoss?: boolean;
  summary?: string;
}
```

**Troubleshooting**:

| Issue | Cause | Solution |
|-------|-------|----------|
| Gemini always falls back | API key not configured or invalid | Check `GEMINI_API_KEY` in environment |
| Slow responses | Network latency or API timeout | Check logs for timeout errors, verify network |
| Inaccurate scores | Poor photo quality or missing vehicle context | Ensure vehicle context provided, use clear photos |
| Quota exhausted | >1,500 requests in 24 hours | Wait for UTC midnight reset, or upgrade to paid tier |
| Fallback chain not working | Service initialization failed | Check logs for initialization errors |

**Monitoring and Alerts**:

Access metrics via admin API:
```bash
curl -X GET https://your-domain.com/api/admin/gemini-metrics \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Alerting thresholds:
- **Critical**: Gemini failure rate >20%
- **Critical**: Daily quota >1,350 requests (90%)
- **Warning**: Daily quota >1,200 requests (80%)
- **Warning**: Average response time >15 seconds
- **Warning**: Overall error rate >5%

See `src/lib/monitoring/README.md` for detailed monitoring documentation.

### Google Geolocation API

1. **Enable APIs** in Google Cloud Console:
   - Go to https://console.cloud.google.com/apis/library
   - Enable "Maps JavaScript API"
   - Enable "Geolocation API"
   - Enable "Geocoding API"

2. **Create API Key**:
   - Go to https://console.cloud.google.com/apis/credentials
   - Click "Create Credentials" → "API Key"
   - Copy the API key

3. **Restrict API Key** (recommended for production):
   - Click on the API key
   - Under "Application restrictions", select "HTTP referrers"
   - Add your domain (e.g., `https://yourdomain.com/*`)
   - Under "API restrictions", select "Restrict key"
   - Select: Maps JavaScript API, Geolocation API, Geocoding API

4. **Add to Environment**:
   ```bash
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-api-key-here
   ```

5. **Test**:
   - Open case creation page
   - Click GPS button
   - Check console for "GPS captured via google-api" message
   - Verify accuracy is better than browser geolocation

### Cost Estimation

**Google Gemini API**:
- Free tier: 10 requests/minute, 1,500 requests/day
- Typical usage: 100 cases/day = 100 requests/day
- Monthly cost: $0 (within free tier)
- Automatic fallback prevents quota overages

**Google Geolocation API**:
- $5 per 1,000 requests
- Typical usage: 100 cases/day × 30 days = 3,000 requests/month
- Monthly cost: ~$15

**Free Tier**:
- $200 free credit per month (40,000 requests)
- More than enough for MVP and early growth

## Testing

All integrations have unit tests in `tests/unit/integrations/`:
- `google-geolocation.test.ts` - Geolocation service tests
- More tests coming soon

Run tests:
```bash
npm run test:unit -- integrations
```

## Error Handling

All integrations follow consistent error handling patterns:
1. Try-catch blocks for all API calls
2. User-friendly error messages
3. Graceful fallbacks where possible
4. Detailed logging for debugging

## Security

- API keys are stored in environment variables
- Never commit API keys to version control
- Use `.env.local` for local development
- Use Vercel environment variables for production
- Restrict API keys to specific domains in production

## Future Integrations

Planned integrations:
- [x] Google Gemini 2.0 Flash (AI damage detection) - v0.24.1 installed
- [ ] NIMC API (NIN verification) - pending government approval
- [ ] Additional payment providers
- [ ] SMS providers (Termii already integrated)
- [ ] Email providers (Resend already integrated)
