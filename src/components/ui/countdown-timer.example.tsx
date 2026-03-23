/**
 * Example Usage of Countdown Timer Component
 * 
 * This file demonstrates how to use the countdown timer component
 * in different scenarios.
 */

'use client';

import { CountdownTimer, CountdownTimerCard, InlineCountdownTimer } from './countdown-timer';

/**
 * Example 1: Basic Countdown Timer
 */
export function BasicCountdownExample() {
  const auctionEndTime = new Date(Date.now() + 5 * 60 * 60 * 1000); // 5 hours from now

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-2">Auction Ends In:</h3>
      <CountdownTimer endTime={auctionEndTime} />
    </div>
  );
}

/**
 * Example 2: Countdown Timer with Callbacks
 */
export function CountdownWithCallbacksExample() {
  const paymentDeadline = new Date(Date.now() + 45 * 60 * 1000); // 45 minutes from now

  const handleComplete = () => {
    console.log('Payment deadline reached!');
    // Show modal or redirect
  };

  const handleOneHourRemaining = () => {
    console.log('1 hour remaining - sending push notification');
    // Send push notification
  };

  const handleThirtyMinutesRemaining = () => {
    console.log('30 minutes remaining - sending SMS');
    // Send SMS notification
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-2">Payment Deadline:</h3>
      <CountdownTimer
        endTime={paymentDeadline}
        onComplete={handleComplete}
        onOneHourRemaining={handleOneHourRemaining}
        onThirtyMinutesRemaining={handleThirtyMinutesRemaining}
      />
    </div>
  );
}

/**
 * Example 3: Countdown Timer Card
 */
export function CountdownCardExample() {
  const auctionEndTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days from now

  return (
    <div className="p-4 max-w-sm">
      <CountdownTimerCard
        endTime={auctionEndTime}
        label="Auction Ends In"
        showIcon={true}
      />
    </div>
  );
}

/**
 * Example 4: Inline Countdown Timer (for lists/cards)
 */
export function InlineCountdownExample() {
  const auctionEndTime = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 hours from now

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold">Toyota Camry 2020</h4>
          <p className="text-sm text-gray-600">Current Bid: ₦450,000</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 mb-1">Ends in</p>
          <InlineCountdownTimer endTime={auctionEndTime} />
        </div>
      </div>
    </div>
  );
}

/**
 * Example 5: Countdown with Server Time Sync
 */
export function CountdownWithServerSyncExample() {
  // In a real app, you would fetch server time and calculate offset
  const serverTimeOffset = 0; // milliseconds difference between server and client
  const auctionEndTime = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour from now

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-2">Auction Ends In (Server Synced):</h3>
      <CountdownTimer
        endTime={auctionEndTime}
        serverTimeOffset={serverTimeOffset}
      />
    </div>
  );
}

/**
 * Example 6: Multiple Countdown Timers in a Grid
 */
export function MultipleCountdownsExample() {
  const auctions = [
    {
      id: 1,
      name: 'Toyota Camry 2020',
      endTime: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      currentBid: 450000,
    },
    {
      id: 2,
      name: 'Honda Accord 2019',
      endTime: new Date(Date.now() + 5 * 60 * 60 * 1000), // 5 hours
      currentBid: 380000,
    },
    {
      id: 3,
      name: 'Nissan Altima 2021',
      endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
      currentBid: 520000,
    },
  ];

  return (
    <div className="p-4">
      <h3 className="text-xl font-bold mb-4">Active Auctions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {auctions.map((auction) => (
          <div key={auction.id} className="bg-white rounded-lg shadow-md p-4">
            <h4 className="font-semibold mb-2">{auction.name}</h4>
            <p className="text-sm text-gray-600 mb-3">
              Current Bid: ₦{auction.currentBid.toLocaleString()}
            </p>
            <div className="border-t pt-3">
              <p className="text-xs text-gray-500 mb-1">Time Remaining</p>
              <CountdownTimer endTime={auction.endTime} className="text-2xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Example 7: Compact Format for Mobile
 */
export function CompactCountdownExample() {
  const auctionEndTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days from now

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-2">Compact Format:</h3>
      <CountdownTimer endTime={auctionEndTime} compact={true} />
    </div>
  );
}
