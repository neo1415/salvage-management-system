/**
 * Example usage of PickupConfirmation component
 * 
 * This file demonstrates how to use the PickupConfirmation component
 * in a vendor dashboard or payment page.
 */

'use client';

import { useState } from 'react';
import { PickupConfirmation } from './pickup-confirmation';

export default function PickupConfirmationExample() {
  const [confirmationStatus, setConfirmationStatus] = useState<'pending' | 'confirmed'>('pending');

  // Mock auction and vendor data
  const auctionId = 'auction-123';
  const vendorId = 'vendor-456';

  // Mock API call to confirm pickup
  const handleConfirmPickup = async (pickupAuthCode: string) => {
    console.log('Confirming pickup with code:', pickupAuthCode);

    // Simulate API call
    const response = await fetch(`/api/auctions/${auctionId}/confirm-pickup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vendorId,
        pickupAuthCode,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to confirm pickup');
    }

    const data = await response.json();
    console.log('Pickup confirmed:', data);

    setConfirmationStatus('confirmed');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
          Pickup Confirmation Example
        </h1>

        {/* Example 1: Basic Usage */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Basic Usage</h2>
          <PickupConfirmation
            auctionId={auctionId}
            vendorId={vendorId}
            onConfirm={handleConfirmPickup}
          />
        </div>

        {/* Status Display */}
        {confirmationStatus === 'confirmed' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 font-semibold">
              ✓ Pickup has been confirmed! Admin will verify shortly.
            </p>
          </div>
        )}

        {/* Usage Instructions */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Usage Instructions</h2>
          <div className="space-y-4 text-sm text-gray-700">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Props:</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><code className="bg-gray-100 px-2 py-1 rounded">auctionId</code>: The ID of the auction</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">vendorId</code>: The ID of the vendor</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">onConfirm</code>: Async function called when pickup is confirmed</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Features:</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Pickup authorization code input with validation</li>
                <li>Automatic uppercase conversion</li>
                <li>Code format validation (alphanumeric, min 6 characters)</li>
                <li>Confirmation modal before submitting</li>
                <li>Loading state during API call</li>
                <li>Success and error message display</li>
                <li>Responsive design (mobile-first)</li>
                <li>Full accessibility support</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Code Validation Rules:</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Minimum 6 characters</li>
                <li>Only letters and numbers allowed</li>
                <li>Automatically converted to uppercase</li>
                <li>Leading/trailing spaces are trimmed</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Example Codes:</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Valid: <code className="bg-gray-100 px-2 py-1 rounded">ABC123XYZ</code></li>
                <li>Valid: <code className="bg-gray-100 px-2 py-1 rounded">123456</code></li>
                <li>Valid: <code className="bg-gray-100 px-2 py-1 rounded">ABCDEF</code></li>
                <li>Invalid: <code className="bg-gray-100 px-2 py-1 rounded">ABC-123</code> (contains hyphen)</li>
                <li>Invalid: <code className="bg-gray-100 px-2 py-1 rounded">ABC12</code> (too short)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
