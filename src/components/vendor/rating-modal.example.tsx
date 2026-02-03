'use client';

/**
 * Example usage of the RatingModal component
 * 
 * This file demonstrates how to integrate the RatingModal
 * into a pickup confirmation page or similar workflow.
 */

import { useState } from 'react';
import { RatingModal } from './rating-modal';
import { useSession } from 'next-auth/react';

/**
 * Example: Pickup Confirmation Page with Rating Modal
 * 
 * This component shows how to:
 * 1. Display the rating modal after pickup confirmation
 * 2. Handle the rating submission
 * 3. Show success/error messages
 * 4. Integrate with the API
 */
export function PickupConfirmationExample() {
  const { data: session } = useSession();
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Example auction data (would come from props or API in real usage)
  const auction = {
    id: 'auction-123',
    vendorId: 'vendor-456',
    vendorName: "John's Auto Parts",
    itemName: '2018 Toyota Camry',
    winningBid: 450000,
  };

  /**
   * Handle pickup confirmation
   * After confirming pickup, show the rating modal
   */
  const handleConfirmPickup = async () => {
    setIsConfirming(true);
    setMessage(null);

    try {
      // Call API to confirm pickup
      const response = await fetch(`/api/auctions/${auction.id}/confirm-pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to confirm pickup');
      }

      // Show success message
      setMessage({
        type: 'success',
        text: 'Pickup confirmed successfully!',
      });

      // Show rating modal after successful pickup confirmation
      setShowRatingModal(true);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to confirm pickup',
      });
    } finally {
      setIsConfirming(false);
    }
  };

  /**
   * Handle rating submission
   * Sends the rating data to the API
   */
  const handleRatingSubmit = async (data: {
    overallRating: number;
    categoryRatings: {
      paymentSpeed: number;
      communication: number;
      pickupPunctuality: number;
    };
    review?: string;
  }) => {
    try {
      // Call API to submit rating
      const response = await fetch(`/api/vendors/${auction.vendorId}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auctionId: auction.id,
          ...data,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit rating');
      }

      const result = await response.json();

      // Show success message
      setMessage({
        type: 'success',
        text: `Rating submitted successfully! Vendor's new average: ${result.newAverageRating.toFixed(1)} stars`,
      });
    } catch (error) {
      // Re-throw error to be handled by the modal
      throw error;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Pickup Confirmation</h1>

      {/* Auction Details */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Auction Details</h2>
        <div className="space-y-2">
          <p className="text-gray-700">
            <span className="font-medium">Item:</span> {auction.itemName}
          </p>
          <p className="text-gray-700">
            <span className="font-medium">Vendor:</span> {auction.vendorName}
          </p>
          <p className="text-gray-700">
            <span className="font-medium">Winning Bid:</span> ₦{auction.winningBid.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div
          className={`p-4 rounded-lg mb-6 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Confirm Pickup Button */}
      <button
        onClick={handleConfirmPickup}
        disabled={isConfirming}
        className="w-full px-6 py-3 bg-burgundy-900 text-white font-semibold rounded-lg hover:bg-burgundy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isConfirming ? 'Confirming...' : 'Confirm Pickup'}
      </button>

      {/* Rating Modal */}
      <RatingModal
        isOpen={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        vendorId={auction.vendorId}
        vendorName={auction.vendorName}
        auctionId={auction.id}
        onSubmit={handleRatingSubmit}
      />
    </div>
  );
}

/**
 * Example: Programmatic Rating Modal Trigger
 * 
 * This example shows how to trigger the rating modal
 * programmatically from anywhere in your application.
 */
export function ProgrammaticRatingExample() {
  const [showRatingModal, setShowRatingModal] = useState(false);

  const handleRatingSubmit = async (data: any) => {
    console.log('Rating submitted:', data);
    // Handle submission...
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Programmatic Rating</h2>
      
      <button
        onClick={() => setShowRatingModal(true)}
        className="px-6 py-3 bg-burgundy-900 text-white font-semibold rounded-lg hover:bg-burgundy-800 transition-colors"
      >
        Rate Vendor
      </button>

      <RatingModal
        isOpen={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        vendorId="vendor-123"
        vendorName="Example Vendor"
        auctionId="auction-456"
        onSubmit={handleRatingSubmit}
      />
    </div>
  );
}

/**
 * Example: Rating Modal with Custom Success Handler
 * 
 * This example shows how to handle successful rating submission
 * with custom logic (e.g., navigation, analytics, etc.)
 */
export function CustomSuccessHandlerExample() {
  const [showRatingModal, setShowRatingModal] = useState(false);

  const handleRatingSubmit = async (data: any) => {
    try {
      // Submit rating to API
      const response = await fetch('/api/vendors/vendor-123/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auctionId: 'auction-456',
          ...data,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit rating');
      }

      // Custom success handling
      console.log('Rating submitted successfully!');
      
      // Track analytics event
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'vendor_rated', {
          vendor_id: 'vendor-123',
          rating: data.overallRating,
        });
      }

      // Navigate to dashboard or show confirmation
      // router.push('/vendor/dashboard');
    } catch (error) {
      // Re-throw to let modal handle the error display
      throw error;
    }
  };

  return (
    <div className="p-6">
      <button
        onClick={() => setShowRatingModal(true)}
        className="px-6 py-3 bg-burgundy-900 text-white font-semibold rounded-lg hover:bg-burgundy-800 transition-colors"
      >
        Rate Vendor
      </button>

      <RatingModal
        isOpen={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        vendorId="vendor-123"
        vendorName="Example Vendor"
        auctionId="auction-456"
        onSubmit={handleRatingSubmit}
      />
    </div>
  );
}
