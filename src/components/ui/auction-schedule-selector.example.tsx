/**
 * AuctionScheduleSelector Usage Example
 * 
 * This file demonstrates how to use the AuctionScheduleSelector component
 * in the manager approval page or any other context.
 */

'use client';

import { useState } from 'react';
import { AuctionScheduleSelector, AuctionScheduleValue } from './auction-schedule-selector';

export function AuctionScheduleSelectorExample() {
  const [scheduleValue, setScheduleValue] = useState<AuctionScheduleValue>({
    mode: 'now',
  });

  const handleScheduleChange = (value: AuctionScheduleValue) => {
    setScheduleValue(value);
    console.log('Schedule changed:', value);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Auction Schedule Selector Example
      </h1>

      <div className="bg-white rounded-lg shadow-md p-6">
        <AuctionScheduleSelector
          value={scheduleValue}
          onChange={handleScheduleChange}
          minDate={new Date()}
        />

        {/* Display Current Value */}
        <div className="mt-6 p-4 bg-gray-100 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">Current Value:</h3>
          <pre className="text-sm text-gray-700 overflow-auto">
            {JSON.stringify(scheduleValue, null, 2)}
          </pre>
        </div>
      </div>

      {/* Integration Example */}
      <div className="mt-8 bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Integration Example
        </h2>
        <p className="text-gray-700 mb-4">
          Here's how to integrate this component into your approval flow:
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto text-sm">
{`// In your approval page component
const [scheduleValue, setScheduleValue] = useState<AuctionScheduleValue>({
  mode: 'now',
});

// In your form
<AuctionScheduleSelector
  value={scheduleValue}
  onChange={setScheduleValue}
  minDate={new Date()}
/>

// When submitting approval
const handleApprove = async () => {
  const response = await fetch('/api/cases/approve', {
    method: 'POST',
    body: JSON.stringify({
      caseId: selectedCase.id,
      scheduleValue: scheduleValue,
      // ... other approval data
    }),
  });
};`}
        </pre>
      </div>
    </div>
  );
}
