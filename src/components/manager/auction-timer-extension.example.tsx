/**
 * AuctionTimerExtension Component - Usage Examples
 * 
 * This file demonstrates how to use the AuctionTimerExtension component
 * in different scenarios.
 */

'use client';

import { useState } from 'react';
import { AuctionTimerExtension } from './auction-timer-extension';

/**
 * Example 1: Basic Usage in Auction Detail Page
 */
export function BasicUsageExample() {
  const [isLoading, setIsLoading] = useState(false);

  const handleExtend = async (auctionId: string, extensionMinutes: number) => {
    setIsLoading(true);
    
    try {
      // Call your API endpoint
      const response = await fetch(`/api/auctions/${auctionId}/extend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ extensionMinutes }),
      });

      if (!response.ok) {
        throw new Error('Failed to extend auction');
      }

      // Show success message
      alert('Auction extended successfully!');
      
      // Optionally refresh the page or update state
      window.location.reload();
    } catch (error) {
      console.error('Extension failed:', error);
      throw error; // Re-throw to let component handle error display
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Extend Auction</h2>
      <AuctionTimerExtension
        auctionId="auction-123"
        currentEndTime={new Date('2024-12-31T23:59:59')}
        onExtend={handleExtend}
        isLoading={isLoading}
      />
    </div>
  );
}

/**
 * Example 2: Embedded in Auction Card
 */
export function AuctionCardWithExtension() {
  const auction = {
    id: 'auction-456',
    title: '2020 Toyota Camry',
    currentBid: 5000000,
    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
  };

  const handleExtend = async (auctionId: string, extensionMinutes: number) => {
    console.log(`Extending auction ${auctionId} by ${extensionMinutes} minutes`);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    alert(`Auction extended by ${extensionMinutes} minutes!`);
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Auction Details */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {auction.title}
          </h3>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600">Current Bid</p>
              <p className="text-2xl font-bold text-[#800020]">
                ₦{auction.currentBid.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Ends At</p>
              <p className="text-sm font-semibold text-gray-900">
                {auction.endTime.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Extension Component */}
        <div className="p-6 bg-gray-50">
          <AuctionTimerExtension
            auctionId={auction.id}
            currentEndTime={auction.endTime}
            onExtend={handleExtend}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Example 3: With Custom Success Handler
 */
export function WithCustomSuccessHandler() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleExtend = async (auctionId: string, extensionMinutes: number) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Calculate hours/days for user-friendly message
    const hours = Math.floor(extensionMinutes / 60);
    const days = Math.floor(hours / 24);
    
    let message = '';
    if (days > 0) {
      message = `Auction extended by ${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      message = `Auction extended by ${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      message = `Auction extended by ${extensionMinutes} minute${extensionMinutes > 1 ? 's' : ''}`;
    }

    setSuccessMessage(message);

    // Clear message after 5 seconds
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  return (
    <div className="max-w-md mx-auto p-4">
      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm font-medium text-green-800">
              {successMessage}
            </p>
          </div>
        </div>
      )}

      <AuctionTimerExtension
        auctionId="auction-789"
        currentEndTime={new Date(Date.now() + 24 * 60 * 60 * 1000)}
        onExtend={handleExtend}
      />
    </div>
  );
}

/**
 * Example 4: Multiple Auctions Management
 */
export function MultipleAuctionsExample() {
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);

  const auctions = [
    {
      id: 'auction-001',
      title: '2019 Honda Accord',
      endTime: new Date(Date.now() + 1 * 60 * 60 * 1000),
    },
    {
      id: 'auction-002',
      title: '2021 Toyota Corolla',
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
    },
    {
      id: 'auction-003',
      title: '2020 Nissan Altima',
      endTime: new Date(Date.now() + 5 * 60 * 60 * 1000),
    },
  ];

  const handleExtend = async (auctionId: string, extensionMinutes: number) => {
    console.log(`Extending ${auctionId} by ${extensionMinutes} minutes`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSelectedAuctionId(null); // Close extension panel
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-6">Active Auctions</h2>
      
      <div className="space-y-4">
        {auctions.map((auction) => (
          <div
            key={auction.id}
            className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
          >
            <div className="p-4 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-gray-900">{auction.title}</h3>
                <p className="text-sm text-gray-600">
                  Ends: {auction.endTime.toLocaleString()}
                </p>
              </div>
              <button
                onClick={() =>
                  setSelectedAuctionId(
                    selectedAuctionId === auction.id ? null : auction.id
                  )
                }
                className="px-4 py-2 bg-[#800020] text-white rounded-lg hover:bg-[#600018] transition-colors"
              >
                {selectedAuctionId === auction.id ? 'Cancel' : 'Extend'}
              </button>
            </div>

            {/* Show extension panel when selected */}
            {selectedAuctionId === auction.id && (
              <div className="p-4 bg-gray-50 border-t border-gray-200">
                <AuctionTimerExtension
                  auctionId={auction.id}
                  currentEndTime={auction.endTime}
                  onExtend={handleExtend}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Example 5: With Permission Check
 */
export function WithPermissionCheck() {
  const [userRole, setUserRole] = useState<'manager' | 'viewer'>('viewer');

  const handleExtend = async (auctionId: string, extensionMinutes: number) => {
    // This should never be called if user is not a manager
    // but adding check for safety
    if (userRole !== 'manager') {
      throw new Error('Unauthorized: Only managers can extend auctions');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    alert('Auction extended!');
  };

  return (
    <div className="max-w-md mx-auto p-4">
      {/* Role Switcher (for demo purposes) */}
      <div className="mb-4 p-4 bg-gray-100 rounded-lg">
        <p className="text-sm font-medium mb-2">Demo: Switch Role</p>
        <div className="flex gap-2">
          <button
            onClick={() => setUserRole('manager')}
            className={`px-4 py-2 rounded ${
              userRole === 'manager'
                ? 'bg-[#800020] text-white'
                : 'bg-white text-gray-700'
            }`}
          >
            Manager
          </button>
          <button
            onClick={() => setUserRole('viewer')}
            className={`px-4 py-2 rounded ${
              userRole === 'viewer'
                ? 'bg-[#800020] text-white'
                : 'bg-white text-gray-700'
            }`}
          >
            Viewer
          </button>
        </div>
      </div>

      {/* Conditional Rendering */}
      {userRole === 'manager' ? (
        <AuctionTimerExtension
          auctionId="auction-secure"
          currentEndTime={new Date(Date.now() + 12 * 60 * 60 * 1000)}
          onExtend={handleExtend}
        />
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            You do not have permission to extend auctions. Only salvage managers
            can perform this action.
          </p>
        </div>
      )}
    </div>
  );
}

export default BasicUsageExample;
