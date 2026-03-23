/**
 * AdminPickupConfirmation Component Examples
 * 
 * This file demonstrates various usage scenarios for the AdminPickupConfirmation component.
 */

'use client';

import { AdminPickupConfirmation } from './admin-pickup-confirmation';

export function AdminPickupConfirmationExamples() {
  // Mock handler
  const handleConfirm = async (notes: string) => {
    console.log('Confirming pickup with notes:', notes);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  return (
    <div className="space-y-8 p-8 bg-gray-50">
      <h1 className="text-2xl font-bold text-gray-900">AdminPickupConfirmation Examples</h1>

      {/* Example 1: Vendor Not Confirmed */}
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          1. Vendor Not Confirmed (Pending)
        </h2>
        <div className="max-w-2xl">
          <AdminPickupConfirmation
            auctionId="auction-123"
            adminId="admin-456"
            vendorPickupStatus={{
              confirmed: false,
              confirmedAt: null,
            }}
            onConfirm={handleConfirm}
          />
        </div>
      </div>

      {/* Example 2: Vendor Confirmed - Ready for Admin */}
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          2. Vendor Confirmed - Ready for Admin Confirmation
        </h2>
        <div className="max-w-2xl">
          <AdminPickupConfirmation
            auctionId="auction-789"
            adminId="admin-456"
            vendorPickupStatus={{
              confirmed: true,
              confirmedAt: new Date().toISOString(),
            }}
            onConfirm={handleConfirm}
          />
        </div>
      </div>

      {/* Example 3: Vendor Confirmed Yesterday */}
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          3. Vendor Confirmed Yesterday
        </h2>
        <div className="max-w-2xl">
          <AdminPickupConfirmation
            auctionId="auction-101"
            adminId="admin-456"
            vendorPickupStatus={{
              confirmed: true,
              confirmedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            }}
            onConfirm={handleConfirm}
          />
        </div>
      </div>

      {/* Example 4: With Error Handling */}
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          4. With Error Handling
        </h2>
        <div className="max-w-2xl">
          <AdminPickupConfirmation
            auctionId="auction-error"
            adminId="admin-456"
            vendorPickupStatus={{
              confirmed: true,
              confirmedAt: new Date().toISOString(),
            }}
            onConfirm={async () => {
              throw new Error('Network error: Failed to confirm pickup');
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default AdminPickupConfirmationExamples;
