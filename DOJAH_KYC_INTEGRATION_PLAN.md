# Dojah KYC Integration Plan for NEM Salvage System

**Date**: January 24, 2026  
**Provider**: Dojah  
**Estimated Integration Time**: 8-12 hours  
**Status**: READY TO IMPLEMENT

---

## ✅ GOOD NEWS: YOU'RE 70% THERE!

Your database schema already has most of the fields needed for Tier 2 KYC. Here's what you have:

### Current Schema (src/lib/db/schema/vendors.ts)

```typescript
✅ tier: 'tier1_bvn' | 'tier2_full'
✅ bvnEncrypted: string
✅ bvnVerifiedAt: timestamp
✅ cacNumber: string
✅ tin: string
✅ bankAccountNumber: string
✅ bankName: string
✅ bankAccountName: string
✅ cacCertificateUrl: string
✅ bankStatementUrl: string
✅ ninCardUrl: string
✅ ninVerified: timestamp
✅ bankAccountVerified: timestamp
```

---

## ⚠️ WHAT YOU NEED TO ADD

### 1. Missing Database Fields

Add these to your vendors schema:

```typescript
// Add to vendors table
ninNumber: varchar('nin_number', { length: 11 }), // NIN is 11 digits
ninVerificationData: jsonb('nin_verification_data'), // Store NIMC response
addressProofUrl: varchar('address_proof_url', { length: 500 }), // Utility bill
addressVerifiedAt: timestamp('address_verified_at'),
photoIdUrl: varchar('photo_id_url', { length: 500 }), // Passport/Voter's Card/Driver's License
photoIdType: varchar('photo_id_type', { length: 50 }), // 'passport' | 'voters_card' | 'drivers_license'
photoIdVerifiedAt: timestamp('photo_id_verified_at'),
selfieUrl: varchar('selfie_url', { length: 500 }), // For biometric matching
biometricVerifiedAt: timestamp('biometric_verified_at'),
amlScreenedAt: timestamp('aml_screened_at'), // PEP/Sanctions check
amlRiskLevel: varchar('aml_risk_level', { length: 20 }), // 'low' | 'medium' | 'high'
```

### 2. For Corporate Vendors (Business Entities)

```typescript
// Add to vendors table
businessType: varchar('business_type', { length: 50 }), // 'sole_proprietor' | 'limited_company' | 'partnership'
cacForm7Url: varchar('cac_form7_url', { length: 500 }), // Directors list
directorIds: jsonb('director_ids').$type<Array<{
  name: string;
  bvn: string;
  nin: string;
  photoIdUrl: string;
  verified: boolean;
}>>(),
businessAddressProofUrl: varchar('business_address_proof_url', { length: 500 }),
```

---

## 🔧 DOJAH API INTEGRATION STEPS

### Step 1: Get Dojah API Keys

1. Sign up at [https://dojah.io](https://dojah.io)
2. Get your API keys from dashboard
3. Add to `.env`:

```bash
DOJAH_API_KEY=your_api_key_here
DOJAH_APP_ID=your_app_id_here
DOJAH_PUBLIC_KEY=your_public_key_here
```

### Step 2: Install Dojah SDK (Optional)

```bash
npm install @dojah/node-sdk
```

Or use direct API calls with axios (which you already have).

### Step 3: Create Dojah Service

Create `src/features/kyc/services/dojah.service.ts`:

```typescript
import axios from 'axios';

const DOJAH_BASE_URL = 'https://api.dojah.io';

export class DojahService {
  private apiKey: string;
  private appId: string;

  constructor() {
    this.apiKey = process.env.DOJAH_API_KEY!;
    this.appId = process.env.DOJAH_APP_ID!;
  }

  private getHeaders() {
    return {
      'Authorization': this.apiKey,
      'AppId': this.appId,
      'Content-Type': 'application/json',
    };
  }

  // 1. BVN Verification
  async verifyBVN(bvn: string, firstName: string, lastName: string) {
    const response = await axios.post(
      `${DOJAH_BASE_URL}/api/v1/kyc/bvn`,
      {
        bvn,
        first_name: firstName,
        last_name: lastName,
      },
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  // 2. NIN Verification
  async verifyNIN(nin: string) {
    const response = await axios.post(
      `${DOJAH_BASE_URL}/api/v1/kyc/nin`,
      { nin },
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  // 3. Phone Number Verification
  async verifyPhone(phoneNumber: string) {
    const response = await axios.post(
      `${DOJAH_BASE_URL}/api/v1/kyc/phone_number`,
      { phone_number: phoneNumber },
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  // 4. Document Verification (ID Card)
  async verifyDocument(documentImageUrl: string, documentType: string) {
    const response = await axios.post(
      `${DOJAH_BASE_URL}/api/v1/kyc/document`,
      {
        document_image: documentImageUrl,
        document_type: documentType, // 'passport', 'voters_card', 'drivers_license'
      },
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  // 5. Biometric Verification (Selfie Match)
  async verifyBiometric(selfieUrl: string, idPhotoUrl: string) {
    const response = await axios.post(
      `${DOJAH_BASE_URL}/api/v1/kyc/biometric`,
      {
        selfie_image: selfieUrl,
        id_image: idPhotoUrl,
      },
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  // 6. Liveness Check
  async checkLiveness(videoUrl: string) {
    const response = await axios.post(
      `${DOJAH_BASE_URL}/api/v1/kyc/liveness`,
      { video_url: videoUrl },
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  // 7. Address Verification
  async verifyAddress(utilityBillUrl: string) {
    const response = await axios.post(
      `${DOJAH_BASE_URL}/api/v1/kyc/address`,
      { document_image: utilityBillUrl },
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  // 8. CAC Verification (For Business)
  async verifyCAC(cacNumber: string) {
    const response = await axios.post(
      `${DOJAH_BASE_URL}/api/v1/kyc/cac`,
      { rc_number: cacNumber },
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  // 9. AML Screening
  async screenAML(fullName: string, dateOfBirth: string) {
    const response = await axios.post(
      `${DOJAH_BASE_URL}/api/v1/kyc/aml`,
      {
        full_name: fullName,
        date_of_birth: dateOfBirth,
      },
      { headers: this.getHeaders() }
    );
    return response.data;
  }
}

export const dojahService = new DojahService();
```

### Step 4: Create Tier 2 Upgrade API Endpoint

Create `src/app/api/vendors/upgrade-tier2/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db';
import { vendors } from '@/lib/db/schema/vendors';
import { dojahService } from '@/features/kyc/services/dojah.service';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      nin,
      photoIdUrl,
      photoIdType,
      selfieUrl,
      addressProofUrl,
      cacNumber, // For business
      cacForm7Url, // For business
    } = body;

    // 1. Verify NIN
    const ninResult = await dojahService.verifyNIN(nin);
    if (!ninResult.success) {
      return NextResponse.json({ error: 'NIN verification failed' }, { status: 400 });
    }

    // 2. Verify Photo ID
    const idResult = await dojahService.verifyDocument(photoIdUrl, photoIdType);
    if (!idResult.success) {
      return NextResponse.json({ error: 'ID verification failed' }, { status: 400 });
    }

    // 3. Biometric Match (Selfie vs ID Photo)
    const biometricResult = await dojahService.verifyBiometric(selfieUrl, photoIdUrl);
    if (!biometricResult.success || biometricResult.match_score < 0.8) {
      return NextResponse.json({ error: 'Biometric verification failed' }, { status: 400 });
    }

    // 4. Verify Address
    const addressResult = await dojahService.verifyAddress(addressProofUrl);
    if (!addressResult.success) {
      return NextResponse.json({ error: 'Address verification failed' }, { status: 400 });
    }

    // 5. AML Screening
    const amlResult = await dojahService.screenAML(
      ninResult.data.full_name,
      ninResult.data.date_of_birth
    );

    // 6. If business, verify CAC
    if (cacNumber) {
      const cacResult = await dojahService.verifyCAC(cacNumber);
      if (!cacResult.success) {
        return NextResponse.json({ error: 'CAC verification failed' }, { status: 400 });
      }
    }

    // 7. Update vendor to Tier 2
    await db
      .update(vendors)
      .set({
        tier: 'tier2_full',
        ninNumber: nin,
        ninVerificationData: ninResult.data,
        ninVerified: new Date(),
        photoIdUrl,
        photoIdType,
        photoIdVerifiedAt: new Date(),
        selfieUrl,
        biometricVerifiedAt: new Date(),
        addressProofUrl,
        addressVerifiedAt: new Date(),
        amlScreenedAt: new Date(),
        amlRiskLevel: amlResult.risk_level,
        updatedAt: new Date(),
      })
      .where(eq(vendors.userId, session.user.id));

    return NextResponse.json({
      success: true,
      message: 'Successfully upgraded to Tier 2',
      tier: 'tier2_full',
    });
  } catch (error) {
    console.error('Tier 2 upgrade error:', error);
    return NextResponse.json(
      { error: 'Failed to upgrade to Tier 2' },
      { status: 500 }
    );
  }
}
```

### Step 5: Create Tier 2 Upgrade UI

Create `src/app/(dashboard)/vendor/upgrade-tier2/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function UpgradeTier2Page() {
  const router = useRouter();
  const { data: session } = useSession();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nin: '',
    photoIdType: 'passport',
    photoIdFile: null as File | null,
    selfieFile: null as File | null,
    addressProofFile: null as File | null,
    cacNumber: '',
    cacForm7File: null as File | null,
  });

  const handleFileUpload = async (file: File): Promise<string> => {
    // Upload to Cloudinary
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'kyc_documents');

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    const data = await response.json();
    return data.secure_url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setError(null);

    try {
      // Upload files to Cloudinary
      const photoIdUrl = formData.photoIdFile
        ? await handleFileUpload(formData.photoIdFile)
        : '';
      const selfieUrl = formData.selfieFile
        ? await handleFileUpload(formData.selfieFile)
        : '';
      const addressProofUrl = formData.addressProofFile
        ? await handleFileUpload(formData.addressProofFile)
        : '';
      const cacForm7Url = formData.cacForm7File
        ? await handleFileUpload(formData.cacForm7File)
        : '';

      // Submit to API
      const response = await fetch('/api/vendors/upgrade-tier2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nin: formData.nin,
          photoIdUrl,
          photoIdType: formData.photoIdType,
          selfieUrl,
          addressProofUrl,
          cacNumber: formData.cacNumber,
          cacForm7Url,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upgrade failed');
      }

      // Success
      router.push('/vendor/dashboard?upgraded=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upgrade failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Upgrade to Tier 2
        </h1>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">
            Tier 2 Benefits
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Higher transaction limits (₦200,000/day)</li>
            <li>• Access to premium auctions</li>
            <li>• Faster payment processing</li>
            <li>• Priority customer support</li>
          </ul>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
          {/* NIN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              National Identification Number (NIN) *
            </label>
            <input
              type="text"
              value={formData.nin}
              onChange={(e) => setFormData({ ...formData, nin: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="12345678901"
              maxLength={11}
              required
            />
          </div>

          {/* Photo ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Photo ID Type *
            </label>
            <select
              value={formData.photoIdType}
              onChange={(e) => setFormData({ ...formData, photoIdType: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="passport">International Passport</option>
              <option value="voters_card">Voter's Card</option>
              <option value="drivers_license">Driver's License</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Photo ID *
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) =>
                setFormData({ ...formData, photoIdFile: e.target.files?.[0] || null })
              }
              className="w-full"
              required
            />
          </div>

          {/* Selfie */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Selfie (for biometric verification) *
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setFormData({ ...formData, selfieFile: e.target.files?.[0] || null })
              }
              className="w-full"
              required
            />
          </div>

          {/* Address Proof */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Proof of Address (Utility Bill) *
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) =>
                setFormData({ ...formData, addressProofFile: e.target.files?.[0] || null })
              }
              className="w-full"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Must be within last 3 months
            </p>
          </div>

          {/* Business Documents (Optional) */}
          <div className="border-t pt-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              Business Documents (Optional)
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CAC Registration Number
                </label>
                <input
                  type="text"
                  value={formData.cacNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, cacNumber: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="RC123456"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CAC Form CO7 (Directors List)
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) =>
                    setFormData({ ...formData, cacForm7File: e.target.files?.[0] || null })
                  }
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={uploading}
            className="w-full bg-burgundy-900 text-white py-3 px-6 rounded-lg font-semibold hover:bg-burgundy-800 disabled:opacity-50"
          >
            {uploading ? 'Verifying...' : 'Submit for Verification'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

---

## 📊 WHAT YOU'RE VERIFYING (SUMMARY)

### For Individual Vendors (Tier 2)
1. ✅ BVN (already have)
2. ✅ NIN (NEW - add this)
3. ✅ Photo ID (Passport/Voter's Card/Driver's License) (NEW)
4. ✅ Selfie + Biometric Match (NEW)
5. ✅ Address Proof (Utility Bill) (NEW)
6. ✅ AML Screening (NEW)

### For Business Vendors (Tier 2)
1. ✅ All individual requirements above
2. ✅ CAC Certificate (already have)
3. ✅ CAC Form CO7 (NEW - directors list)
4. ✅ TIN (already have)
5. ✅ Business Address Proof (NEW)

---

## 💰 DOJAH PRICING (Estimate)

Based on typical pricing:
- BVN Verification: ₦50-100 per check
- NIN Verification: ₦100-150 per check
- Document Verification: ₦100-200 per check
- Biometric Match: ₦150-250 per check
- Address Verification: ₦100-150 per check
- CAC Lookup: ₦200-300 per check
- AML Screening: ₦200-300 per check

**Total per Tier 2 upgrade**: ₦800-1,450 (~$1-2 USD)

---

## ⏱️ IMPLEMENTATION TIMELINE

### Phase 1: Database (2 hours)
- Add missing fields to vendors schema
- Create migration
- Run migration

### Phase 2: Dojah Service (3 hours)
- Create Dojah service class
- Test API calls
- Handle errors

### Phase 3: API Endpoint (2 hours)
- Create upgrade-tier2 endpoint
- Add validation
- Test flow

### Phase 4: UI (3 hours)
- Create upgrade page
- File upload handling
- Success/error states

### Phase 5: Testing (2 hours)
- Test with real Dojah API
- Test error scenarios
- UAT with NEM

**Total**: 12 hours

---

## ✅ REGULATORY COMPLIANCE CHECKLIST

### CBN Requirements
- ✅ BVN verification
- ✅ NIN verification (mandatory as of 2024)
- ✅ Face-to-face OR electronic verification
- ✅ Government database cross-check
- ✅ Biometric matching

### NAICOM Requirements (Insurance)
- ✅ NIN mandatory
- ✅ CAC for businesses
- ✅ Stricter KYC for insurance transactions

### AML/CFT Requirements
- ✅ PEP screening
- ✅ Sanctions list check
- ✅ Ongoing monitoring
- ✅ Suspicious activity reporting

---

## 🎯 NEXT STEPS

1. **Sign up for Dojah** - Get API keys
2. **Add database fields** - Run migration
3. **Implement Dojah service** - Create service class
4. **Build API endpoint** - Create upgrade-tier2 route
5. **Create UI** - Build upgrade page
6. **Test with real data** - Use Dojah sandbox
7. **Deploy to staging** - Test with NEM
8. **Go live** - Enable Tier 2 upgrades

---

## 📞 SUPPORT

- **Dojah Documentation**: https://docs.dojah.io
- **Dojah Support**: support@dojah.io
- **Dojah Slack**: Join their community

---

**Prepared by**: Kiro AI Assistant  
**Date**: January 24, 2026  
**Status**: READY TO IMPLEMENT

