/**
 * Example usage of EscrowPaymentDetails component
 * 
 * This file demonstrates various states and use cases for the component.
 */

import { EscrowPaymentDetails } from './escrow-payment-details';

// Example 1: All documents signed, ready for manual release
export function ReadyForReleaseExample() {
  const handleManualRelease = async () => {
    console.log('Releasing funds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Funds released successfully');
  };

  return (
    <EscrowPaymentDetails
      payment={{
        id: 'payment-123',
        amount: 500000,
        escrowStatus: 'frozen',
        status: 'pending',
      }}
      documentProgress={{
        signedDocuments: 3,
        totalDocuments: 3,
      }}
      walletBalance={{
        balance: 900000,
        frozenAmount: 500000,
      }}
      onManualRelease={handleManualRelease}
    />
  );
}

// Example 2: Documents not all signed yet
export function DocumentsNotSignedExample() {
  const handleManualRelease = async () => {
    console.log('Releasing funds...');
  };

  return (
    <EscrowPaymentDetails
      payment={{
        id: 'payment-456',
        amount: 750000,
        escrowStatus: 'frozen',
        status: 'pending',
      }}
      documentProgress={{
        signedDocuments: 2,
        totalDocuments: 3,
      }}
      walletBalance={{
        balance: 1200000,
        frozenAmount: 750000,
      }}
      onManualRelease={handleManualRelease}
    />
  );
}

// Example 3: Funds already released
export function FundsReleasedExample() {
  const handleManualRelease = async () => {
    console.log('Releasing funds...');
  };

  return (
    <EscrowPaymentDetails
      payment={{
        id: 'payment-789',
        amount: 300000,
        escrowStatus: 'released',
        status: 'verified',
      }}
      documentProgress={{
        signedDocuments: 3,
        totalDocuments: 3,
      }}
      walletBalance={{
        balance: 600000,
        frozenAmount: 0,
      }}
      onManualRelease={handleManualRelease}
    />
  );
}

// Example 4: Automatic release failed
export function ReleasedFailedExample() {
  const handleManualRelease = async () => {
    console.log('Retrying fund release...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Funds released successfully');
  };

  return (
    <EscrowPaymentDetails
      payment={{
        id: 'payment-999',
        amount: 450000,
        escrowStatus: 'failed',
        status: 'pending',
      }}
      documentProgress={{
        signedDocuments: 3,
        totalDocuments: 3,
      }}
      walletBalance={{
        balance: 800000,
        frozenAmount: 450000,
      }}
      onManualRelease={handleManualRelease}
    />
  );
}

// Example 5: Large amounts
export function LargeAmountExample() {
  const handleManualRelease = async () => {
    console.log('Releasing large amount...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Funds released successfully');
  };

  return (
    <EscrowPaymentDetails
      payment={{
        id: 'payment-large',
        amount: 5000000,
        escrowStatus: 'frozen',
        status: 'pending',
      }}
      documentProgress={{
        signedDocuments: 3,
        totalDocuments: 3,
      }}
      walletBalance={{
        balance: 10000000,
        frozenAmount: 5000000,
      }}
      onManualRelease={handleManualRelease}
    />
  );
}

// Example 6: With error handling
export function WithErrorExample() {
  const handleManualRelease = async () => {
    console.log('Attempting to release funds...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    throw new Error('Paystack transfer failed: Insufficient balance');
  };

  return (
    <EscrowPaymentDetails
      payment={{
        id: 'payment-error',
        amount: 600000,
        escrowStatus: 'frozen',
        status: 'pending',
      }}
      documentProgress={{
        signedDocuments: 3,
        totalDocuments: 3,
      }}
      walletBalance={{
        balance: 1000000,
        frozenAmount: 600000,
      }}
      onManualRelease={handleManualRelease}
    />
  );
}
