# Vendor Management Page - Tier 0 Support Fix

## Problem Summary

The vendor management page at `/manager/vendors` was failing when trying to display Tier 0 vendors because:

1. **Database Schema Issue**: The `vendor_tier` enum only supported `['tier1_bvn', 'tier2_full']` but the frontend was sending `tier=tier0`
2. **Missing KYC Fields**: The frontend expected `kycStatus` and `kycRejectionReason` fields that didn't exist in the API response
3. **Missing Approval Endpoint**: The approval/rejection API endpoint didn't exist

## Changes Made

### 1. Database Migration

**File**: `src/lib/db/migrations/0031_add_tier0_to_vendor_tier_enum.sql`

Added `tier0` to the `vendor_tier` enum to support vendors without BVN verification.

```sql
ALTER TYPE vendor_tier ADD VALUE IF NOT EXISTS 'tier0';
```

### 2. Schema Update

**File**: `src/lib/db/schema/vendors.ts`

- Updated `vendorTierEnum` to include `'tier0'`
- Changed default tier from `'tier1_bvn'` to `'tier0'`

```typescript
export const vendorTierEnum = pgEnum('vendor_tier', ['tier0', 'tier1_bvn', 'tier2_full']);
```

### 3. API Route Update

**File**: `src/app/api/vendors/route.ts`

- Added tier mapping to handle `tier0` parameter
- Added `kycStatus` and `kycRejectionReason` fields to API response
- `kycStatus` is derived from `status` and `tier2RejectionReason` fields:
  - `'approved'` if `status === 'approved'`
  - `'rejected'` if `tier2RejectionReason` exists or `status === 'suspended'`
  - `'pending'` otherwise

### 4. TypeScript Interface Update

**File**: `src/hooks/queries/use-vendors.ts`

Added missing fields to the `Vendor` interface:
- `kycStatus: 'pending' | 'approved' | 'rejected'`
- `kycRejectionReason?: string`

### 5. Approval/Rejection Endpoint

**File**: `src/app/api/vendors/[id]/approve/route.ts`

Created new API endpoint for approving/rejecting vendors:
- **POST** `/api/vendors/[id]/approve`
- Requires `salvage_manager` role
- Accepts `{ action: 'approve' | 'reject', comment?: string }`
- Sends email and SMS notifications to vendors
- Updates vendor status and tier2 fields accordingly

**Approval Flow**:
- Sets `status = 'approved'`
- Sets `approvedBy` and `approvedAt`
- For Tier 2: Sets `tier2ApprovedAt`, `tier2ApprovedBy`, and `tier2ExpiresAt` (1 year)
- Clears any previous rejection reason

**Rejection Flow**:
- Sets `status = 'suspended'`
- Sets `tier2RejectionReason` with the provided comment
- Allows vendor to resubmit KYC

### 6. Migration Script

**File**: `scripts/run-tier0-migration.ts`

Created script to run the migration and verify enum values.

## How to Deploy

### Step 1: Run the Migration

```bash
npx tsx scripts/run-tier0-migration.ts
```

This will:
1. Add `tier0` to the `vendor_tier` enum
2. Verify the enum values

### Step 2: Restart the Development Server

```bash
npm run dev
```

### Step 3: Test the Vendor Management Page

1. Navigate to `/manager/vendors`
2. Click on the **Tier 0** tab
3. Verify that vendors without BVN can be displayed
4. Test the status filters: All, Pending, Approved, Rejected
5. Test approving a vendor
6. Test rejecting a vendor with a reason

## Tier Structure

### Tier 0 (No BVN)
- **Requirements**: None (basic registration only)
- **Verification**: No BVN verification required
- **Use Case**: Vendors who want to browse auctions without full KYC

### Tier 1 (BVN Verified)
- **Requirements**: BVN verification
- **Verification**: BVN verified via Dojah
- **Use Case**: Individual vendors with basic identity verification

### Tier 2 (Full Business KYC)
- **Requirements**: BVN, NIN, Bank Account, CAC Certificate, Business Documents
- **Verification**: Full business KYC with document uploads
- **Use Case**: Business entities with complete verification
- **Expiry**: 12 months from approval date

## Status Flow

```
Tier 0 → Tier 1 → Tier 2
  ↓        ↓        ↓
Pending → Approved
  ↓
Rejected (can resubmit)
```

## Notifications

### Approval
- **Email**: Congratulations message with tier details
- **SMS**: "Your KYC application has been approved!"

### Rejection
- **Email**: Detailed rejection reason with next steps
- **SMS**: Brief rejection reason (truncated to 100 chars)

## Frontend Features

### Tier Tabs
- **Tier 0**: No BVN verification required
- **Tier 1**: BVN verified
- **Tier 2**: Full business KYC

### Status Filters
- **All**: Show all vendors
- **Pending**: Show pending applications
- **Approved**: Show approved vendors
- **Rejected**: Show rejected applications

### Verification Badges
- **Tier 0**: No verification badges
- **Tier 1**: BVN badge
- **Tier 2**: BVN, NIN, Bank Account, CAC badges

### Review Modal
- View vendor details
- View business information (Tier 2 only)
- View uploaded documents (Tier 2 only)
- Approve or reject with optional comment
- Comment required for rejection

## Database Fields

### Vendor Status
- `status`: `'pending' | 'approved' | 'suspended'` (vendor_status enum)
- `tier`: `'tier0' | 'tier1_bvn' | 'tier2_full'` (vendor_tier enum)

### Approval Fields
- `approvedBy`: UUID of manager who approved
- `approvedAt`: Timestamp of approval
- `tier2ApprovedAt`: Timestamp of Tier 2 approval
- `tier2ApprovedBy`: UUID of manager who approved Tier 2
- `tier2ExpiresAt`: Expiry date (approval + 12 months)

### Rejection Fields
- `tier2RejectionReason`: Text reason for rejection

## API Endpoints

### GET /api/vendors
Query parameters:
- `tier`: `'tier0' | 'tier1_bvn' | 'tier2_full'`
- `status`: `'pending' | 'approved' | 'suspended'`
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 50)

Response:
```json
{
  "success": true,
  "vendors": [...],
  "count": 10,
  "hasMore": false,
  "page": 1,
  "pageSize": 50
}
```

### POST /api/vendors/[id]/approve
Request body:
```json
{
  "action": "approve" | "reject",
  "comment": "Optional comment for approval, required for rejection"
}
```

Response:
```json
{
  "success": true,
  "message": "Vendor approved successfully",
  "vendor": {
    "id": "...",
    "status": "approved"
  }
}
```

## Testing Checklist

- [ ] Tier 0 tab displays vendors without BVN
- [ ] Tier 1 tab displays vendors with BVN verification
- [ ] Tier 2 tab displays vendors with full business KYC
- [ ] Status filters work correctly (All, Pending, Approved, Rejected)
- [ ] Search functionality works
- [ ] Verification filters work (Tier 1 and Tier 2 only)
- [ ] Approve vendor sends email and SMS
- [ ] Reject vendor sends email and SMS with reason
- [ ] Rejected vendors can resubmit KYC
- [ ] Approved vendors cannot see KYC page
- [ ] Review modal displays all vendor information
- [ ] Document previews work (Tier 2 only)

## Requirements Met

- **Requirement 7**: Vendor KYC management with tier-based tabs
- **NFR5.3**: Role-based access control (salvage_manager only)
- **Requirement 7.1**: Search and filter vendors
- **Requirement 7.4**: Email and SMS notifications on approval/rejection

## Next Steps

1. Test the migration in development
2. Test all tier tabs and status filters
3. Test approval and rejection flows
4. Verify email and SMS notifications
5. Deploy to staging for QA testing
6. Deploy to production after approval
