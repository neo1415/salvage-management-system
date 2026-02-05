# External Integrations

This directory contains integrations with external APIs and services.

## Available Integrations

### Google Cloud Services

#### 1. Google Document AI (`google-document-ai.ts`)
- **Purpose**: Extract text from documents using OCR
- **Use Cases**: NIN extraction from ID cards, CAC certificate parsing
- **API**: Google Cloud Document AI
- **Cost**: Pay-per-use
- **Configuration**: `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`

#### 2. Google Geolocation (`google-geolocation.ts`)
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

#### 3. Paystack Bank Verification (`paystack-bank-verification.ts`)
- **Purpose**: Verify bank account details
- **Use Cases**: Vendor bank account verification for payouts
- **API**: Paystack Bank Account Resolution API
- **Cost**: Free (included in Paystack)
- **Configuration**: `PAYSTACK_SECRET_KEY`

### Government Services

#### 4. NIN Verification (`nin-verification.ts`)
- **Purpose**: Verify National Identification Number
- **Use Cases**: Vendor KYC verification
- **API**: NIMC API (mock implementation - requires government approval)
- **Cost**: TBD (pending NIMC integration)
- **Configuration**: None (mock)
- **Status**: Mock implementation - production requires NIMC API access

### Image Optimization

#### 5. TinyPNG (`tinypng.ts`)
- **Purpose**: Compress images before upload
- **Use Cases**: Reduce photo file sizes for faster uploads
- **API**: TinyPNG API
- **Cost**: 500 free compressions/month, then $0.009 per image
- **Configuration**: `TINYPNG_API_KEY`

## Setup Instructions

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
- [ ] NIMC API (NIN verification) - pending government approval
- [ ] Additional payment providers
- [ ] SMS providers (Termii already integrated)
- [ ] Email providers (Resend already integrated)
