'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppRouter } from '@/hooks/use-app-router';
import { RegistrationFeeModal } from '@/components/vendor/registration-fee-modal';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { resolveVendorTier2Path } from '@/lib/kyc/tier2-kyc-provider';

function resolvePostPaymentPath(onboardingMode?: string): string {
  if (onboardingMode === 'fee_before_tier1') {
    return '/vendor/kyc/tier1';
  }
  return resolveVendorTier2Path();
}

function RegistrationFeePageContent() {
  const router = useAppRouter();
  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get('payment');
  const [onboardingMode, setOnboardingMode] = useState<string | undefined>();

  const [status, setStatus] = useState<'loading' | 'paid' | 'unpaid' | 'success' | 'failed'>('loading');
  const [error, setError] = useState<string | null>(null);

  const goToNextStep = () => {
    router.push(resolvePostPaymentPath(onboardingMode));
  };

  useEffect(() => {
    fetch('/api/vendor/onboarding-status', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (payload?.data?.onboardingMode) {
          setOnboardingMode(payload.data.onboardingMode);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (paymentStatus === 'success') {
      setStatus('success');
      setTimeout(() => goToNextStep(), 3000);
      return;
    }

    if (paymentStatus === 'failed') {
      setStatus('failed');
      return;
    }

    checkPaymentStatus();
  }, [paymentStatus, onboardingMode]);

  const checkPaymentStatus = async () => {
    try {
      const response = await fetch('/api/vendors/registration-fee/status');
      const result = await response.json();

      if (!result.data?.required) {
        goToNextStep();
        return;
      }

      if (result.data?.paid) {
        setStatus('paid');
        setTimeout(() => goToNextStep(), 2000);
      } else {
        setStatus('unpaid');
      }
    } catch (err) {
      console.error('Failed to check payment status:', err);
      setError(err instanceof Error ? err.message : 'Failed to check payment status');
      setStatus('unpaid');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-hover)] flex items-center justify-center p-4">
        <div className="text-center text-white">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p className="text-lg">Checking payment status...</p>
        </div>
      </div>
    );
  }

  if (status === 'success' || status === 'paid') {
    const nextLabel =
      onboardingMode === 'fee_before_tier1' ? 'Continue to identity verification' : 'Continue verification';

    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-hover)] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Payment Confirmed!</h1>
          <p className="text-gray-700 mb-6">
            Your registration fee has been successfully processed.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">Redirecting you to the next step...</p>
          </div>
          <button
            onClick={goToNextStep}
            className="w-full px-6 py-3 bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-accent)] text-white font-bold rounded-lg hover:shadow-lg transition-all"
          >
            {nextLabel}
          </button>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-hover)] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-12 h-12 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Payment Failed</h1>
          <p className="text-gray-700 mb-6">Your payment could not be processed. Please try again.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setStatus('unpaid')}
              className="flex-1 px-6 py-3 bg-[var(--brand-primary)] text-white font-bold rounded-lg hover:shadow-lg transition-all"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push('/vendor/dashboard')}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-all"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-hover)] flex items-center justify-center p-4">
      <RegistrationFeeModal onClose={() => router.push('/vendor/dashboard')} showCloseButton={false} />
    </div>
  );
}

export default function RegistrationFeePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-primary)]" />
        </div>
      }
    >
      <RegistrationFeePageContent />
    </Suspense>
  );
}
