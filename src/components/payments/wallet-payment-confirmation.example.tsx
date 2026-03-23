/**
 * Example usage of WalletPaymentConfirmation component
 * 
 * This file demonstrates how to use the WalletPaymentConfirmation component
 * in a real application scenario.
 */

'use client';

import { useState } from 'react';
import { WalletPaymentConfirmation } from './wallet-payment-confirmation';

export function WalletPaymentConfirmationExample() {
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Example payment data
  const payment = {
    id: 'payment-123',
    amount: 400000,
    escrowStatus: 'frozen' as const,
  };

  const walletBalance = {
    frozenAmount: 400000,
    availableBalance: 100000,
  };

  // Simulate API call to confirm wallet payment
  const handleConfirm = async () => {
    // In a real application, this would call the API endpoint:
    // POST /api/payments/[id]/confirm-wallet
    
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        // Simulate success
        setIsConfirmed(true);
        resolve();
        
        // To simulate error, uncomment:
        // reject(new Error('Insufficient funds'));
      }, 1000);
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Payment Confirmation Example
        </h1>

        <WalletPaymentConfirmation
          payment={payment}
          walletBalance={walletBalance}
          onConfirm={handleConfirm}
        />

        {isConfirmed && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-800 mb-2">Next Steps:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li>Sign the Bill of Sale document</li>
              <li>Sign the Liability Waiver document</li>
              <li>Sign the Pickup Authorization document</li>
              <li>Wait for automatic fund release</li>
              <li>Receive pickup authorization code</li>
            </ol>
          </div>
        )}

        {/* Mobile Preview */}
        <div className="mt-8 p-4 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Mobile Preview (375px width)
          </h2>
          <div className="border-2 border-gray-300 rounded-lg overflow-hidden" style={{ width: '375px', margin: '0 auto' }}>
            <div className="bg-gray-50 p-4">
              <WalletPaymentConfirmation
                payment={payment}
                walletBalance={walletBalance}
                onConfirm={handleConfirm}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Integration Example
 * 
 * Here's how to integrate this component in a payment page:
 * 
 * ```tsx
 * // src/app/(dashboard)/vendor/payments/[id]/page.tsx
 * 
 * import { WalletPaymentConfirmation } from '@/components/payments/wallet-payment-confirmation';
 * import { useRouter } from 'next/navigation';
 * 
 * export default function PaymentPage({ params }: { params: { id: string } }) {
 *   const router = useRouter();
 *   const [payment, setPayment] = useState(null);
 *   const [wallet, setWallet] = useState(null);
 * 
 *   useEffect(() => {
 *     // Fetch payment and wallet data
 *     fetchPaymentData(params.id);
 *   }, [params.id]);
 * 
 *   const handleConfirm = async () => {
 *     const response = await fetch(`/api/payments/${params.id}/confirm-wallet`, {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify({ vendorId: session.user.vendorId }),
 *     });
 * 
 *     if (!response.ok) {
 *       const error = await response.json();
 *       throw new Error(error.error || 'Failed to confirm payment');
 *     }
 * 
 *     const data = await response.json();
 *     
 *     // Redirect to documents page
 *     router.push(data.documentsUrl);
 *   };
 * 
 *   if (payment?.paymentMethod === 'escrow_wallet') {
 *     return (
 *       <WalletPaymentConfirmation
 *         payment={payment}
 *         walletBalance={wallet}
 *         onConfirm={handleConfirm}
 *       />
 *     );
 *   }
 * 
 *   // Show other payment methods (Paystack, Bank Transfer)
 *   return <OtherPaymentMethods />;
 * }
 * ```
 */
