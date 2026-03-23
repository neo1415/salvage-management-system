# Admin Pickup Confirmations Page

## Overview

The Admin Pickup Confirmations page displays a list of auctions where vendors have confirmed pickup but admin has not yet confirmed. This page allows admins and managers to review and confirm vendor pickups, completing the transaction workflow.

## Requirements

- **Requirement 5**: Pickup Confirmation Workflow
- **Requirement 5.6**: Admin/Manager views pickup confirmations
- **Requirement 5.7**: Admin/Manager confirms pickup

## Features

### Display List of Pending Pickup Confirmations
- Shows all auctions where vendor confirmed pickup but admin has not
- Displays auction details (claim reference, asset, amount, closed date)
- Shows vendor information (name, business, contact details)
- Displays confirmation status for both vendor and admin
- Shows payment information when available

### Filtering and Sorting
- **Status Filter**: Toggle between "Pending Only" and "All Pickups"
- **Sort Options**: Sort by confirmation date, amount, or claim reference
- **Sort Order**: Toggle between ascending and descending order
- **Search**: Filter by claim reference, vendor name, business name, or asset

### Admin Confirmation
- Opens AdminPickupConfirmation modal for each pending pickup
- Allows admin to add notes about the pickup
- Confirms pickup and marks transaction as complete
- Updates case status to "completed"
- Refreshes list after confirmation

### Responsive Design
- Mobile-first responsive layout
- Grid layout adapts to screen size
- Modal overlay for confirmation component
- Touch-friendly buttons and controls

## API Endpoints

### GET /api/admin/pickups
Fetches list of pickup confirmations with filtering and sorting.

**Query Parameters:**
- `status`: 'pending' | 'all' (default: 'pending')
- `sortBy`: 'confirmedAt' | 'amount' | 'claimRef' (default: 'confirmedAt')
- `sortOrder`: 'asc' | 'desc' (default: 'desc')

**Response:**
```json
{
  "success": true,
  "pickups": [
    {
      "auctionId": "uuid",
      "claimReference": "CLM-2024-001",
      "assetType": "vehicle",
      "assetDetails": { "year": "2020", "make": "Toyota", "model": "Camry" },
      "amount": "500000",
      "vendor": {
        "id": "uuid",
        "businessName": "ABC Motors",
        "fullName": "John Doe",
        "email": "john@abcmotors.com",
        "phone": "+2348012345678"
      },
      "vendorConfirmation": {
        "confirmed": true,
        "confirmedAt": "2024-01-15T10:00:00Z"
      },
      "adminConfirmation": {
        "confirmed": false,
        "confirmedAt": null,
        "confirmedBy": null
      },
      "payment": {
        "id": "uuid",
        "amount": "500000",
        "status": "verified",
        "paymentMethod": "escrow_wallet"
      },
      "auctionStatus": "closed",
      "caseStatus": "sold",
      "auctionEndTime": "2024-01-10T15:00:00Z"
    }
  ],
  "count": 1
}
```

### POST /api/admin/auctions/[id]/confirm-pickup
Confirms vendor pickup for an auction.

**Request Body:**
```json
{
  "adminId": "uuid",
  "notes": "Item collected in good condition"
}
```

**Response:**
```json
{
  "success": true,
  "auction": {
    "id": "uuid",
    "pickupConfirmedAdmin": true,
    "pickupConfirmedAdminAt": "2024-01-15T11:00:00Z",
    "pickupConfirmedAdminBy": "uuid"
  },
  "message": "Pickup confirmed successfully",
  "notes": "Item collected in good condition"
}
```

## Components Used

### AdminPickupConfirmation
Modal component for confirming vendor pickup. Located at `src/components/admin/admin-pickup-confirmation.tsx`.

**Props:**
- `auctionId`: Auction ID
- `adminId`: Admin user ID
- `vendorPickupStatus`: Vendor confirmation status and timestamp
- `onConfirm`: Callback function for confirmation

## User Flow

1. Admin navigates to `/admin/pickups`
2. Page displays list of pending pickup confirmations
3. Admin can filter by status, sort by various fields, and search
4. Admin clicks "Confirm Pickup" button for a pending pickup
5. Modal opens with AdminPickupConfirmation component
6. Admin reviews vendor confirmation details
7. Admin optionally adds notes about the pickup
8. Admin clicks "Confirm Pickup" in the modal
9. System updates auction and case status
10. Modal closes and list refreshes
11. Confirmed pickup is removed from pending list (if filtered)

## Access Control

- **Allowed Roles**: admin, salvage_manager, system_admin
- **Unauthorized Access**: Redirects to dashboard
- **API Authentication**: Requires valid session with allowed role

## Testing

Integration tests are located at `tests/integration/admin/admin-pickups-page.test.ts`.

**Test Coverage:**
- Fetch and display pending pickup confirmations
- Filter pickups by status
- Sort pickups by amount, date, and claim reference
- Confirm pickup via admin API
- Handle errors (vendor not confirmed, already confirmed)
- Refresh list after confirmation
- Handle unauthorized access
- Display empty state
- Format asset names correctly
- Include payment information

## Future Enhancements

- Export pickup confirmations to CSV/Excel
- Bulk confirmation for multiple pickups
- Pickup confirmation history and audit trail
- Email notifications to vendors after admin confirmation
- Integration with vendor rating system
- Analytics dashboard for pickup completion rates

## Related Files

- Page: `src/app/(dashboard)/admin/pickups/page.tsx`
- API Routes:
  - `src/app/api/admin/pickups/route.ts`
  - `src/app/api/admin/auctions/[id]/confirm-pickup/route.ts`
- Component: `src/components/admin/admin-pickup-confirmation.tsx`
- Tests: `tests/integration/admin/admin-pickups-page.test.ts`
- Schema: `src/lib/db/schema/auctions.ts`
