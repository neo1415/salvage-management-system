# Paystack BVN Verification, Profile Picture Upload & AML Screening Analysis

## Table of Contents
1. [Paystack BVN Verification API Research](#1-paystack-bvn-verification-api-research)
2. [Profile Picture Upload Implementation](#2-profile-picture-upload-implementation)
3. [AML Screening for Salvage Auction Platform](#3-aml-screening-for-salvage-auction-platform)

---

## 1. Paystack BVN Verification API Research

### API Endpoint & Pricing

**Endpoint:** `GET https://api.paystack.co/bank/resolve_bvn/{bvn}`

**Pricing:** ₦10-15 per API call (PAID SERVICE)
- **BVN Resolve API:** ₦10 per call
- **BVN Match API:** ₦15 per call

**Source:** [Quora - Payment Gateway Comparison](https://www.quora.com/What-is-the-best-payment-gateway-for-an-ecommerce-website-in-nigeria)

### Important Notes

1. **NOT FREE** - Unlike the account number resolution endpoint which is free, BVN verification is a paid service
2. **Regulatory Status** - In 2021, CBN temporarily restricted non-bank institutions from providing BVN validation services. This has since been resolved for licensed payment processors like Paystack
3. **Test Mode** - Test BVN `12345678901` works in test mode without charges
4. **Production Requirements** - Requires production Paystack secret key (starts with `sk_live_`)

### Current Implementation Status

✅ **ALREADY IMPLEMENTED** in your codebase at:
- `src/features/vendors/services/bvn-verification.service.ts`

**Features:**
- ✅ Paystack BVN verification integration
- ✅ Fuzzy name matching for Nigerian names
- ✅ Phone number normalization
- ✅ Date of birth validation
- ✅ BVN encryption/decryption (AES-256)
- ✅ BVN masking for security
- ✅ Test mode support
- ✅ Comprehensive error handling
- ✅ Match scoring (0-100)

**Cost Analysis:**
```
Verification Cost: ₦10-15 per vendor
Expected Volume: ~100 vendors/month
Monthly Cost: ₦1,000 - ₦1,500 (~$1-2 USD)
Annual Cost: ₦12,000 - ₦18,000 (~$15-25 USD)
```

**Recommendation:** ✅ **USE IT** - The cost is negligible compared to the fraud prevention benefits.

---

## 2. Profile Picture Upload Implementation

### Database Schema Changes


#### Step 1: Add profilePictureUrl to Users Schema

**File:** `src/lib/db/schema/users.ts`

```typescript
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull(),
  status: userStatusEnum('status').notNull().default('unverified_tier_0'),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  dateOfBirth: timestamp('date_of_birth').notNull(),
  
  // NEW: Profile picture URL
  profilePictureUrl: varchar('profile_picture_url', { length: 500 }),
  
  requirePasswordChange: varchar('require_password_change', { length: 10 }).default('false'),
  notificationPreferences: jsonb('notification_preferences')
    .notNull()
    .$type<NotificationPreferences>()
    .default({
      pushEnabled: true,
      smsEnabled: true,
      emailEnabled: true,
      bidAlerts: true,
      auctionEnding: true,
      paymentReminders: true,
      leaderboardUpdates: true,
    }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
  loginDeviceType: deviceTypeEnum('login_device_type'),
});
```

#### Step 2: Create Migration

**File:** `drizzle/migrations/add-profile-picture-url.sql`

```sql
-- Add profile picture URL column to users table
ALTER TABLE users ADD COLUMN profile_picture_url VARCHAR(500);

-- Add index for faster queries
CREATE INDEX idx_users_profile_picture ON users(profile_picture_url) WHERE profile_picture_url IS NOT NULL;

-- Add comment
COMMENT ON COLUMN users.profile_picture_url IS 'Cloudinary URL for user profile picture';
```

### Cloudinary Configuration

**Folder Structure:**
```
profile-pictures/
  ├── vendors/
  │   ├── {userId}/
  │   │   └── avatar.jpg
  ├── adjusters/
  ├── managers/
  ├── finance/
  └── admins/
```

**Update:** `src/lib/storage/cloudinary.ts`

```typescript
export const CLOUDINARY_FOLDERS = {
  SALVAGE_CASES: 'salvage-cases',
  KYC_DOCUMENTS: 'kyc-documents',
  PROFILE_PICTURES: 'profile-pictures', // NEW
} as const;

/**
 * Transformation presets for profile pictures
 */
export const PROFILE_PICTURE_PRESETS = {
  // Avatar for sidebar/header (80x80, circular crop)
  AVATAR: {
    width: 80,
    height: 80,
    crop: 'fill',
    gravity: 'face',
    quality: 'auto:good',
    fetch_format: 'auto',
    radius: 'max', // Circular
  },
  // Medium for profile page (200x200)
  MEDIUM: {
    width: 200,
    height: 200,
    crop: 'fill',
    gravity: 'face',
    quality: 'auto:good',
    fetch_format: 'auto',
  },
  // Large for full view (800x800)
  LARGE: {
    width: 800,
    height: 800,
    crop: 'fit',
    quality: 'auto:best',
    fetch_format: 'auto',
  },
} as const;

/**
 * Helper function to build folder path for profile pictures
 */
export function getProfilePictureFolder(userId: string, role: string): string {
  const roleFolder = role.replace('_', '-'); // e.g., 'claims_adjuster' -> 'claims-adjuster'
  return `${CLOUDINARY_FOLDERS.PROFILE_PICTURES}/${roleFolder}s/${userId}`;
}
```

### API Endpoints

#### Upload Profile Picture API

**File:** `src/app/api/users/profile-picture/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { 
  uploadFile, 
  deleteFile, 
  getProfilePictureFolder,
  PROFILE_PICTURE_PRESETS,
  validateFile 
} from '@/lib/storage/cloudinary';

/**
 * POST /api/users/profile-picture
 * Upload or update user profile picture
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file
    const validation = validateFile(
      { size: file.size, type: file.type },
      5, // 5MB max
      ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
    );

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Get current user data
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete old profile picture if exists
    if (currentUser.profilePictureUrl) {
      try {
        // Extract public ID from URL
        const urlParts = currentUser.profilePictureUrl.split('/');
        const publicIdWithExt = urlParts.slice(-3).join('/'); // folder/userId/filename.ext
        const publicId = publicIdWithExt.replace(/\.[^/.]+$/, ''); // Remove extension
        
        await deleteFile(publicId, 'image');
      } catch (error) {
        console.error('Failed to delete old profile picture:', error);
        // Continue with upload even if deletion fails
      }
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary
    const folder = getProfilePictureFolder(session.user.id, currentUser.role);
    const uploadResult = await uploadFile(buffer, {
      folder,
      publicId: 'avatar',
      resourceType: 'image',
      transformation: PROFILE_PICTURE_PRESETS.MEDIUM,
      tags: ['profile-picture', currentUser.role],
      compress: true,
      compressionPreset: 'MOBILE',
    });

    // Update user record
    await db
      .update(users)
      .set({
        profilePictureUrl: uploadResult.secureUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    return NextResponse.json({
      success: true,
      url: uploadResult.secureUrl,
      message: 'Profile picture uploaded successfully',
    });
  } catch (error) {
    console.error('Profile picture upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload profile picture' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/profile-picture
 * Remove user profile picture
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get current user data
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser || !currentUser.profilePictureUrl) {
      return NextResponse.json(
        { error: 'No profile picture to delete' },
        { status: 404 }
      );
    }

    // Delete from Cloudinary
    try {
      const urlParts = currentUser.profilePictureUrl.split('/');
      const publicIdWithExt = urlParts.slice(-3).join('/');
      const publicId = publicIdWithExt.replace(/\.[^/.]+$/, '');
      
      await deleteFile(publicId, 'image');
    } catch (error) {
      console.error('Failed to delete from Cloudinary:', error);
    }

    // Update user record
    await db
      .update(users)
      .set({
        profilePictureUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    return NextResponse.json({
      success: true,
      message: 'Profile picture deleted successfully',
    });
  } catch (error) {
    console.error('Profile picture deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete profile picture' },
      { status: 500 }
    );
  }
}
```

### Profile Settings Page

**File:** `src/app/(dashboard)/vendor/settings/profile-picture/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Camera, Trash2, Upload, X } from 'lucide-react';
import Image from 'next/image';

export default function ProfilePicturePage() {
  const { data: session, update: updateSession } = useSession();
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFullImage, setShowFullImage] = useState(false);

  const currentProfilePicture = session?.user?.profilePictureUrl;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, or WebP)');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setError(null);
    setSelectedFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/users/profile-picture', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      // Update session with new profile picture
      await updateSession({
        ...session,
        user: {
          ...session?.user,
          profilePictureUrl: data.url,
        },
      });

      // Clear preview
      setPreviewUrl(null);
      setSelectedFile(null);

      // Show success message
      alert('Profile picture updated successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to remove your profile picture?')) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch('/api/users/profile-picture', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Deletion failed');
      }

      // Update session
      await updateSession({
        ...session,
        user: {
          ...session?.user,
          profilePictureUrl: null,
        },
      });

      alert('Profile picture removed successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deletion failed');
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelPreview = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    setError(null);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Profile Picture
        </h1>

        {/* Current Profile Picture */}
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            Current Picture
          </h2>
          <div className="flex items-center gap-4">
            <div 
              className="relative w-32 h-32 rounded-full overflow-hidden bg-gray-100 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => currentProfilePicture && setShowFullImage(true)}
            >
              {currentProfilePicture ? (
                <Image
                  src={currentProfilePicture}
                  alt="Profile"
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Camera className="w-12 h-12 text-gray-400" />
                </div>
              )}
            </div>
            
            {currentProfilePicture && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? 'Removing...' : 'Remove'}
              </button>
            )}
          </div>
        </div>

        {/* Upload New Picture */}
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            Upload New Picture
          </h2>

          {previewUrl ? (
            <div className="space-y-4">
              <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gray-100">
                <Image
                  src={previewUrl}
                  alt="Preview"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="px-4 py-2 bg-[#800020] text-white rounded-lg hover:bg-[#600018] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {isUploading ? 'Uploading...' : 'Upload'}
                </button>

                <button
                  onClick={cancelPreview}
                  disabled={isUploading}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-[#800020] transition-colors">
                  <Camera className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 mb-1">
                    Click to select an image
                  </p>
                  <p className="text-xs text-gray-500">
                    JPEG, PNG, or WebP (max 5MB)
                  </p>
                </div>
              </label>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Guidelines */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-medium text-blue-900 mb-2">
            Guidelines
          </h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Use a clear, professional photo</li>
            <li>• Face should be clearly visible</li>
            <li>• Maximum file size: 5MB</li>
            <li>• Supported formats: JPEG, PNG, WebP</li>
          </ul>
        </div>
      </div>

      {/* Full Image Modal */}
      {showFullImage && currentProfilePicture && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => setShowFullImage(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setShowFullImage(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300"
            >
              <X className="w-8 h-8" />
            </button>
            <Image
              src={currentProfilePicture}
              alt="Profile"
              width={800}
              height={800}
              className="rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

### Update Sidebar Component

**File:** `src/components/layout/dashboard-sidebar.tsx`

Add profile picture display:

```typescript
// Add this import
import Image from 'next/image';
import { User } from 'lucide-react';

// Update the sidebar header section (both mobile and desktop):

{/* Desktop Sidebar - Update the header */}
<div className="p-6 border-b border-gray-200">
  <div className="flex items-start gap-3">
    {/* Profile Picture */}
    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
      {session?.user?.profilePictureUrl ? (
        <Image
          src={session.user.profilePictureUrl}
          alt={session.user.name || 'User'}
          fill
          className="object-cover cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => window.location.href = '/vendor/settings/profile-picture'}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <User className="w-6 h-6 text-gray-400" />
        </div>
      )}
    </div>
    
    <div className="flex-1 min-w-0">
      <h2 className="text-2xl font-bold text-[#800020]">NEM Salvage</h2>
      <p className="text-sm text-gray-600 mt-2 truncate">
        {session?.user?.name || 'User'}
      </p>
      <p className="text-xs text-gray-500 capitalize mt-1">
        {userRole.replace('_', ' ')}
      </p>
    </div>
    
    {/* Notification Bell */}
    <NotificationBell />
  </div>
</div>
```

### Update Settings Navigation

**File:** `src/app/(dashboard)/vendor/settings/layout.tsx`

Add profile picture link:

```typescript
const settingsNavItems = [
  {
    name: 'Profile',
    href: '/vendor/settings/profile',
    icon: User,
  },
  {
    name: 'Profile Picture', // NEW
    href: '/vendor/settings/profile-picture',
    icon: Camera,
  },
  {
    name: 'Notifications',
    href: '/vendor/settings/notifications',
    icon: Bell,
  },
  {
    name: 'Change Password',
    href: '/vendor/settings/change-password',
    icon: Lock,
  },
];
```

### Update Admin Users List

**File:** `src/app/(dashboard)/admin/users/page.tsx`

Add profile picture column:

```typescript
// In the users table, add a column:
<td className="px-6 py-4 whitespace-nowrap">
  <div className="flex items-center gap-3">
    <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
      {user.profilePictureUrl ? (
        <Image
          src={user.profilePictureUrl}
          alt={user.fullName}
          fill
          className="object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <User className="w-5 h-5 text-gray-400" />
        </div>
      )}
    </div>
    <div>
      <div className="text-sm font-medium text-gray-900">
        {user.fullName}
      </div>
      <div className="text-sm text-gray-500">
        {user.email}
      </div>
    </div>
  </div>
</td>
```

### Update NextAuth Session Type

**File:** `src/types/next-auth.d.ts`

```typescript
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      profilePictureUrl?: string | null; // NEW
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    profilePictureUrl?: string | null; // NEW
  }
}
```

---


## 3. AML Screening for Salvage Auction Platform

### Executive Summary

**Context:** NEM Insurance operates a salvage auction platform where vendors bid on insurance salvage items (damaged vehicles, machinery, etc.) after insurance claims are settled.

**Key Finding:** AML screening is **MODERATELY NECESSARY** but not as critical as for traditional financial institutions. The platform has inherent risk mitigation factors but should implement basic AML controls.

---

### What is AML Screening?

**Anti-Money Laundering (AML) screening** is the process of checking individuals and businesses against:

1. **PEP Lists** - Politically Exposed Persons (government officials, politicians, judges, military leaders)
2. **Sanctions Lists** - Individuals/entities banned from financial transactions (UN, OFAC, EU sanctions)
3. **Watchlists** - Known criminals, terrorists, fraudsters
4. **Adverse Media** - Negative news about corruption, bribery, financial crimes

**Purpose:** Prevent criminals from using legitimate businesses to "clean" dirty money by making it appear to come from legal sources.

---

### AML Risks in Salvage Auction Context

#### 1. Trade-Based Money Laundering (TBML) Risk

**How it works:**
- Criminal buys salvage vehicle for ₦500,000 using illicit funds
- Repairs it for ₦200,000
- Sells it for ₦1,200,000 as "legitimate business income"
- The ₦500,000 profit appears clean

**Risk Level:** 🟡 **MODERATE**

**Why it's moderate (not high):**
- ✅ Salvage items have **transparent market values** (insurance assessments, AI valuations)
- ✅ **Low profit margins** - salvage typically sells at 30-50% of market value
- ✅ **Physical goods** - harder to manipulate than invoices or services
- ✅ **Insurance documentation** - clear provenance and damage history
- ✅ **Escrow system** - funds are tracked and monitored

**Comparison to high-risk scenarios:**
- ❌ Art auctions: Subjective valuations, easy to inflate prices
- ❌ Cryptocurrency: Anonymous, instant, cross-border
- ❌ Real estate: Large sums, complex ownership structures
- ✅ Salvage auctions: Objective valuations, physical inspection, documented damage

#### 2. Sanctioned Person Risk

**Scenario:** A sanctioned individual (e.g., on UN sanctions list) uses the platform to:
- Purchase salvage vehicles
- Generate income through resale
- Move funds through the financial system

**Risk Level:** 🟡 **MODERATE**

**What happens if a sanctioned person uses the platform:**

1. **Legal Consequences for NEM Insurance:**
   - ⚠️ Regulatory fines from CBN/NFIU (₦1M - ₦10M+)
   - ⚠️ Reputational damage
   - ⚠️ Potential license suspension
   - ⚠️ International banking restrictions

2. **Operational Impact:**
   - 🔴 Frozen transactions
   - 🔴 Account seizures
   - 🔴 Mandatory reporting to authorities
   - 🔴 Enhanced scrutiny on all operations

3. **Real Example:**
   ```
   Scenario: A vendor named "John Doe" wins a ₦2M salvage vehicle auction
   
   Without AML Screening:
   - Payment processed normally
   - Vehicle released
   - Later discovered: John Doe is on OFAC sanctions list
   - Result: NEM faces ₦5M fine, transaction reversed, vehicle seized
   
   With AML Screening:
   - Registration blocked during KYC
   - Bid rejected automatically
   - Authorities notified
   - Result: NEM protected, compliance maintained
   ```

#### 3. PEP (Politically Exposed Person) Risk

**Scenario:** A government minister or their family member uses the platform to:
- Purchase undervalued salvage items
- Benefit from insider information
- Launder corruption proceeds

**Risk Level:** 🟢 **LOW-MODERATE**

**Why it's lower risk:**
- ✅ Transparent auction process (public bidding)
- ✅ No insider advantage (AI-based valuations)
- ✅ Competitive bidding prevents undervaluation
- ✅ Small transaction sizes (typically ₦100K - ₦5M)

**However, PEPs still require Enhanced Due Diligence (EDD):**
- 📋 Source of funds verification
- 📋 Purpose of purchase documentation
- 📋 Ongoing transaction monitoring
- 📋 Senior management approval

---

### Real-World Protection Examples

#### Example 1: Preventing Corruption

**Scenario:**
```
A state governor's son registers as a vendor
Without AML: Wins multiple auctions, potentially using embezzled funds
With AML: 
  - Flagged as PEP (family member)
  - Enhanced due diligence triggered
  - Source of funds verified
  - Transactions monitored
  - Suspicious patterns detected and reported
```

**Protection for NEM:**
- ✅ Avoids facilitating corruption
- ✅ Maintains regulatory compliance
- ✅ Protects brand reputation
- ✅ Demonstrates good governance

#### Example 2: Sanctions Compliance

**Scenario:**
```
A vendor is on the UN sanctions list for terrorism financing
Without AML: Participates in auctions, generates income
With AML:
  - Blocked during registration
  - Existing accounts frozen
  - Authorities notified
  - Platform protected
```

**Protection for NEM:**
- ✅ Avoids legal penalties
- ✅ Maintains international banking relationships
- ✅ Protects payment processor accounts (Paystack)
- ✅ Demonstrates security to partners

#### Example 3: Fraud Ring Detection

**Scenario:**
```
Multiple vendors with similar patterns:
- Same IP addresses
- Rapid succession bids
- Unusual payment methods
- Linked to adverse media (fraud cases)
```

**Without AML:**
- Fraud ring operates undetected
- Manipulates auctions
- Damages platform integrity

**With AML:**
- Adverse media screening flags individuals
- Pattern analysis detects connections
- Accounts suspended
- Investigation initiated

---

### Is AML Screening Necessary for Salvage Auctions?

#### ✅ YES - Here's Why:

1. **Regulatory Compliance**
   - CBN requires AML controls for financial platforms
   - Money Laundering (Prevention and Prohibition) Act, 2022
   - NFIU guidelines for reporting entities
   - **Penalty for non-compliance:** ₦1M - ₦10M+ fines

2. **Payment Processor Requirements**
   - Paystack requires AML compliance for high-value transactions
   - Risk of account suspension without proper controls
   - International payment processing depends on AML compliance

3. **Reputational Protection**
   - Insurance industry is highly regulated
   - Association with sanctioned persons damages brand
   - Corporate clients (insurance companies) require AML compliance

4. **Risk Mitigation**
   - Prevents platform abuse
   - Protects legitimate vendors
   - Maintains auction integrity

#### 🟡 BUT - It's Not as Critical as Banking

**Differences from traditional financial institutions:**

| Factor | Banks | Salvage Auctions |
|--------|-------|------------------|
| Transaction Volume | Thousands/day | Dozens/day |
| Transaction Size | ₦1M - ₦1B+ | ₦100K - ₦5M |
| Anonymity | High (wire transfers) | Low (physical goods) |
| Cross-border | Common | Rare |
| Regulatory Scrutiny | Extreme | Moderate |
| AML Investment | ₦50M - ₦500M | ₦500K - ₦5M |

---

### Recommended AML Implementation

#### Phase 1: Basic Screening (IMPLEMENT NOW)

**Cost:** ₦500K - ₦1M/year

**Components:**

1. **PEP & Sanctions Screening at Registration**
   - Screen all new vendors against:
     - UN Sanctions List
     - OFAC SDN List
     - EU Sanctions List
     - Nigerian PEP Database
   - **Provider:** Dojah, Smile Identity, or Youverify
   - **Cost:** ₦50-100 per check
   - **Frequency:** At registration + annual re-screening

2. **Transaction Monitoring**
   - Flag transactions over ₦5M
   - Monitor rapid succession wins
   - Track payment patterns
   - **Implementation:** Custom rules in existing system
   - **Cost:** Development time only

3. **Record Keeping**
   - Maintain KYC documents for 5 years
   - Log all screening results
   - Document suspicious activity
   - **Implementation:** Database + secure storage
   - **Cost:** Minimal (existing infrastructure)

4. **Suspicious Activity Reporting (SAR)**
   - Designate compliance officer
   - Establish reporting procedures
   - File SARs with NFIU when required
   - **Cost:** Staff time only

#### Phase 2: Enhanced Monitoring (6-12 MONTHS)

**Cost:** ₦2M - ₦5M/year

**Components:**

1. **Adverse Media Screening**
   - Check vendors against negative news
   - Monitor for fraud, corruption, financial crimes
   - **Provider:** World-Check, Dow Jones, or ComplyAdvantage
   - **Cost:** ₦200-500 per check

2. **Enhanced Due Diligence (EDD) for High-Risk**
   - PEPs require additional verification
   - Source of funds documentation
   - Senior management approval
   - **Implementation:** Manual process + workflow
   - **Cost:** Staff time

3. **Automated Risk Scoring**
   - Assign risk scores to vendors
   - Trigger enhanced checks automatically
   - Monitor behavioral changes
   - **Implementation:** Custom algorithm
   - **Cost:** ₦1M - ₦2M development

#### Phase 3: Advanced Compliance (12+ MONTHS)

**Cost:** ₦5M - ₦10M/year

**Components:**

1. **Real-time Sanctions Screening**
   - Check against updated lists daily
   - Automatic account suspension
   - API integration with screening providers

2. **AI-Powered Transaction Monitoring**
   - Machine learning for pattern detection
   - Anomaly detection
   - Predictive risk scoring

3. **Blockchain Audit Trail**
   - Immutable transaction records
   - Enhanced transparency
   - Regulatory reporting automation

---

### Cost-Benefit Analysis

#### Costs

**Year 1:**
- Basic screening setup: ₦500K
- Per-vendor screening: ₦100 × 500 vendors = ₦50K
- Compliance officer (part-time): ₦1.2M
- **Total: ₦1.75M**

**Ongoing (Annual):**
- Screening service: ₦500K
- Per-vendor checks: ₦50K
- Compliance staff: ₦1.2M
- **Total: ₦1.75M/year**

#### Benefits

**Risk Mitigation:**
- Avoid regulatory fines: ₦1M - ₦10M+
- Prevent account suspension: Priceless
- Protect brand reputation: Priceless

**Competitive Advantage:**
- Demonstrate compliance to corporate clients
- Attract international partners
- Build trust with regulators

**ROI Calculation:**
```
Cost: ₦1.75M/year
Potential Fine Avoided: ₦5M (conservative)
Reputation Protection: Invaluable
ROI: 186% (financial only)
```

---

### Practical Implementation Guide

#### Step 1: Choose AML Provider

**Recommended Providers (Nigeria):**

1. **Dojah** (Recommended)
   - Nigerian-focused
   - PEP + Sanctions screening
   - BVN verification integration
   - Cost: ₦50-100/check
   - API: Easy integration

2. **Youverify**
   - Comprehensive KYC + AML
   - Local + international lists
   - Cost: ₦100-150/check

3. **Smile Identity**
   - Pan-African coverage
   - Real-time screening
   - Cost: ₦75-125/check

#### Step 2: Integration Points

**Registration Flow:**
```typescript
// src/features/vendors/services/aml-screening.service.ts

export async function screenVendor(vendorData: {
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  bvn?: string;
}) {
  // 1. PEP Screening
  const pepResult = await checkPEPStatus(vendorData);
  
  // 2. Sanctions Screening
  const sanctionsResult = await checkSanctionsList(vendorData);
  
  // 3. Adverse Media (optional)
  const adverseMediaResult = await checkAdverseMedia(vendorData);
  
  // 4. Calculate Risk Score
  const riskScore = calculateRiskScore({
    isPEP: pepResult.isPEP,
    isSanctioned: sanctionsResult.isSanctioned,
    hasAdverseMedia: adverseMediaResult.hasAdverseMedia,
  });
  
  // 5. Determine Action
  if (sanctionsResult.isSanctioned) {
    return {
      approved: false,
      reason: 'Sanctioned individual',
      action: 'BLOCK_AND_REPORT',
    };
  }
  
  if (pepResult.isPEP) {
    return {
      approved: true,
      reason: 'PEP detected',
      action: 'ENHANCED_DUE_DILIGENCE',
      requiresApproval: true,
    };
  }
  
  if (riskScore > 70) {
    return {
      approved: true,
      reason: 'High risk score',
      action: 'ADDITIONAL_VERIFICATION',
    };
  }
  
  return {
    approved: true,
    reason: 'Low risk',
    action: 'STANDARD_MONITORING',
  };
}
```

#### Step 3: Database Schema

```sql
-- Add AML screening fields to vendors table
ALTER TABLE vendors ADD COLUMN aml_screening_status VARCHAR(50);
ALTER TABLE vendors ADD COLUMN aml_risk_score INTEGER;
ALTER TABLE vendors ADD COLUMN is_pep BOOLEAN DEFAULT FALSE;
ALTER TABLE vendors ADD COLUMN is_sanctioned BOOLEAN DEFAULT FALSE;
ALTER TABLE vendors ADD COLUMN last_aml_check_date TIMESTAMP;
ALTER TABLE vendors ADD COLUMN aml_screening_provider VARCHAR(100);
ALTER TABLE vendors ADD COLUMN aml_screening_reference VARCHAR(255);

-- Create AML screening logs table
CREATE TABLE aml_screening_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id),
  screening_date TIMESTAMP NOT NULL DEFAULT NOW(),
  screening_type VARCHAR(50) NOT NULL, -- 'PEP', 'SANCTIONS', 'ADVERSE_MEDIA'
  result JSONB NOT NULL,
  risk_score INTEGER,
  action_taken VARCHAR(100),
  screened_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create suspicious activity reports table
CREATE TABLE suspicious_activity_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id),
  report_date TIMESTAMP NOT NULL DEFAULT NOW(),
  report_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  evidence JSONB,
  status VARCHAR(50) NOT NULL, -- 'PENDING', 'FILED', 'RESOLVED'
  filed_with VARCHAR(100), -- 'NFIU', 'EFCC', etc.
  filed_date TIMESTAMP,
  filed_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### Step 4: Compliance Dashboard

Create admin dashboard at `/admin/compliance` showing:
- ✅ Total vendors screened
- ⚠️ PEPs requiring EDD
- 🔴 Sanctioned individuals blocked
- 📊 Risk score distribution
- 📋 Pending SARs
- 📈 Screening coverage %

---

### Conclusion

**Is AML screening necessary for NEM Salvage Auction Platform?**

✅ **YES** - But implement it pragmatically:

1. **Start with Phase 1** (Basic Screening)
   - Cost: ₦1.75M/year
   - Covers 80% of risk
   - Meets regulatory requirements

2. **Monitor and Adjust**
   - Track screening results
   - Measure false positives
   - Refine risk scoring

3. **Scale as Needed**
   - Add enhanced features based on actual risk
   - Don't over-invest in unnecessary controls
   - Focus on high-impact, low-cost measures

**Key Takeaway:**
AML screening protects NEM Insurance from regulatory penalties, reputational damage, and platform abuse. The cost (₦1.75M/year) is minimal compared to potential fines (₦5M+) and the value of maintaining a trusted, compliant platform.

**Recommendation:** ✅ **IMPLEMENT PHASE 1 NOW**

---

### Additional Resources

**Nigerian Regulations:**
- Money Laundering (Prevention and Prohibition) Act, 2022
- CBN AML/CFT Regulations
- NFIU Guidelines for Reporting Entities

**International Standards:**
- FATF Recommendations
- UN Sanctions Lists
- OFAC SDN List

**AML Providers:**
- Dojah: https://dojah.io
- Youverify: https://youverify.co
- Smile Identity: https://smileidentity.com

---

## Implementation Checklist

### Paystack BVN Verification
- [x] Already implemented in codebase
- [ ] Verify production Paystack keys configured
- [ ] Test with real BVN in production
- [ ] Monitor costs (₦10-15 per verification)

### Profile Picture Upload
- [ ] Run database migration (add profilePictureUrl column)
- [ ] Update Cloudinary folder structure
- [ ] Create profile picture upload API
- [ ] Build profile settings page
- [ ] Update sidebar with profile pictures
- [ ] Add profile pictures to admin users list
- [ ] Update NextAuth session type
- [ ] Test upload/delete functionality
- [ ] Test mobile responsiveness

### AML Screening
- [ ] Choose AML provider (Dojah recommended)
- [ ] Sign up and get API credentials
- [ ] Run database migrations (AML fields)
- [ ] Implement screening service
- [ ] Integrate into registration flow
- [ ] Create compliance dashboard
- [ ] Designate compliance officer
- [ ] Establish SAR procedures
- [ ] Train staff on AML requirements
- [ ] Document compliance procedures

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-20  
**Author:** Kiro AI Assistant  
**Status:** Ready for Implementation
