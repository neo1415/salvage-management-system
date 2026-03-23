/**
 * Example usage of DocumentSigningProgress component
 * 
 * This file demonstrates how to use the DocumentSigningProgress component
 * in a real application scenario with various progress states.
 */

'use client';

import { useState } from 'react';
import { DocumentSigningProgress } from './document-signing-progress';

export function DocumentSigningProgressExample() {
  const [progressState, setProgressState] = useState<'0/3' | '1/3' | '2/3' | '3/3'>('1/3');

  // Example document data for different states
  const getDocumentsForState = (state: typeof progressState) => {
    const baseDocuments = [
      {
        id: 'doc-1',
        type: 'bill_of_sale' as const,
        status: 'pending' as const,
        title: 'Bill of Sale',
        signedAt: null,
      },
      {
        id: 'doc-2',
        type: 'liability_waiver' as const,
        status: 'pending' as const,
        title: 'Liability Waiver',
        signedAt: null,
      },
      {
        id: 'doc-3',
        type: 'pickup_authorization' as const,
        status: 'pending' as const,
        title: 'Pickup Authorization',
        signedAt: null,
      },
    ];

    switch (state) {
      case '0/3':
        return baseDocuments;
      case '1/3':
        return [
          { ...baseDocuments[0], status: 'signed' as const, signedAt: '2024-01-15T10:00:00Z' },
          baseDocuments[1],
          baseDocuments[2],
        ];
      case '2/3':
        return [
          { ...baseDocuments[0], status: 'signed' as const, signedAt: '2024-01-15T10:00:00Z' },
          { ...baseDocuments[1], status: 'signed' as const, signedAt: '2024-01-15T10:30:00Z' },
          baseDocuments[2],
        ];
      case '3/3':
        return [
          { ...baseDocuments[0], status: 'signed' as const, signedAt: '2024-01-15T10:00:00Z' },
          { ...baseDocuments[1], status: 'signed' as const, signedAt: '2024-01-15T10:30:00Z' },
          { ...baseDocuments[2], status: 'signed' as const, signedAt: '2024-01-15T11:00:00Z' },
        ];
    }
  };

  const getProgressForState = (state: typeof progressState) => {
    switch (state) {
      case '0/3':
        return { totalDocuments: 3, signedDocuments: 0, progress: 0, allSigned: false };
      case '1/3':
        return { totalDocuments: 3, signedDocuments: 1, progress: 33, allSigned: false };
      case '2/3':
        return { totalDocuments: 3, signedDocuments: 2, progress: 67, allSigned: false };
      case '3/3':
        return { totalDocuments: 3, signedDocuments: 3, progress: 100, allSigned: true };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Document Signing Progress Examples
        </h1>

        {/* State Selector */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Progress State:</h2>
          <div className="flex flex-wrap gap-2">
            {(['0/3', '1/3', '2/3', '3/3'] as const).map((state) => (
              <button
                key={state}
                onClick={() => setProgressState(state)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  progressState === state
                    ? 'bg-burgundy-900 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {state} Documents Signed
              </button>
            ))}
          </div>
        </div>

        {/* Component Demo */}
        <DocumentSigningProgress
          progress={getProgressForState(progressState)}
          documents={getDocumentsForState(progressState)}
        />

        {/* Mobile Preview */}
        <div className="mt-8 p-4 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Mobile Preview (375px width)
          </h2>
          <div className="border-2 border-gray-300 rounded-lg overflow-hidden" style={{ width: '375px', margin: '0 auto' }}>
            <div className="bg-gray-50 p-4">
              <DocumentSigningProgress
                progress={getProgressForState(progressState)}
                documents={getDocumentsForState(progressState)}
              />
            </div>
          </div>
        </div>

        {/* Voided Document Example */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Example with Voided Document
          </h2>
          <DocumentSigningProgress
            progress={{ totalDocuments: 3, signedDocuments: 1, progress: 33, allSigned: false }}
            documents={[
              {
                id: 'doc-1',
                type: 'bill_of_sale' as const,
                status: 'signed' as const,
                title: 'Bill of Sale',
                signedAt: '2024-01-15T10:00:00Z',
              },
              {
                id: 'doc-2',
                type: 'liability_waiver' as const,
                status: 'voided' as const,
                title: 'Liability Waiver',
                signedAt: null,
              },
              {
                id: 'doc-3',
                type: 'pickup_authorization' as const,
                status: 'pending' as const,
                title: 'Pickup Authorization',
                signedAt: null,
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Integration Example
 * 
 * To integrate this component in a documents page:
 * 
 * 1. Import the component
 * 2. Fetch document progress from API endpoint: GET /api/auctions/[id]/documents/progress
 * 3. Map the API response to the component props
 * 4. Pass progress and documents data to the component
 * 
 * The API should return:
 * - totalDocuments: number (always 3)
 * - signedDocuments: number (0-3)
 * - progress: number (0-100)
 * - allSigned: boolean
 * - documents: array of document objects with id, type, status, signedAt
 * 
 * Document types: bill_of_sale, liability_waiver, pickup_authorization
 * Document statuses: pending, signed, voided
 */
