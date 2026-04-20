'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RegistrationFeeModal } from '@/components/vendor/registration-fee-modal';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

function RegistrationFeePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get('payment');
  
  const [status, setStatus] = useState<'loading' | 'paid' | 'unpaid' | 'success' | 'failed'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If coming back from Paystack with success
    if (paymentStatus === 'success') {
      setStatus('success');
      // Redirect to Tier 2 KYC after 3 seconds
      setTimeout(() => {
        router.push('/vendor/kyc/tier2');
      }, 3000);
      return;
    }

    // If payment failed
    if (paymentStatus === 'failed') {
      setStatus('failed');
      return;
    }

    // Otherwise check payment status
    checkPaymentStatus();
  }, [paymentStatus]);

  const checkPaymentStatus = async () => {
    try {
      const response = await fetch('/api/vendors/registration-fee/status');
      const result = await response.json();
      
      if (result.data?.paid) {
        setStatus('paid');
        // Redirect to Tier 2 KYC after 2 seconds
        setTimeout(() => {
          router.push('/vendor/kyc/tier2');
        }, 2000);
      } else {
        setStatus('unpaid');
      }
    } catch (err) {
      console.error('Failed to check payment status:', err);
      setError(err instanceof Error ? err.message : 'Failed to check payment status');
      setStatus('unpaid');
    }
  };

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#800020] to-[#600018] flex items-center justify-center p-4">
        <div className="text-center text-white">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p className="text-lg">Checking payment status...</p>
        </div>
      </div>
    );
  }

  // Payment success state
  if (status === 'success' || status === 'paid') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#800020] to-[#600018] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Payment Confirmed!
          </h1>
          <p className="text-gray-700 mb-6">
            Your registration fee has been successfully processed. You can now access Tier 2 KYC verification.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              Redirecting you to Tier 2 KYC verification...
            </p>
          </div>
          <button
            onClick={() => router.push('/vendor/kyc/tier2')}
            className="w-full px-6 py-3 bg-gradient-to-r from-[#800020] to-[#FFD700] text-white font-bold rounded-lg hover:shadow-lg transition-all"
          >
            Continue to Tier 2 KYC
          </button>
        </div>
      </div>
    );
  }

  // Payment failed state
  if (status === 'failed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#800020] to-[#600018] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-12 h-12 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Payment Failed
          </h1>
          <p className="text-gray-700 mb-6">
            Your payment could not be processed. Please try again.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/vendor/dashboard')}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => setStatus('unpaid')}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-[#800020] to-[#FFD700] text-white font-bold rounded-lg hover:shadow-lg transition-all"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Unpaid state - show modal
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#800020] to-[#600018] flex items-center justify-center p-4">
      {error && (
        <div className="absolute top-4 left-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 max-w-md mx-auto">
          {error}
        </div>
      )}
      <RegistrationFeeModal 
        onClose={() => router.push('/vendor/dashboard')} 
        showCloseButton={true}
      />
    </div>
  );
}

export default function RegistrationFeePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#800020] to-[#600018] flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-white" />
      </div>
    }>
      <RegistrationFeePageContent />
    </Suspense>
  );
}
