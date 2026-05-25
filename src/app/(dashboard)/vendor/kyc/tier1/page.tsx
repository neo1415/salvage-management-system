'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { CheckCircle2, Loader2, Shield, Lock } from 'lucide-react';
import { isKycTestingModeClient } from '@/lib/kyc/kyc-testing-mode';
import { GENERIC_NAME_BVN_ORDER_EXAMPLE, resolveTier1VerificationError } from '@/lib/kyc/kyc-user-messages';
import type { ResolvedVerificationError } from '@/lib/kyc/kyc-user-messages';
import {
  VerificationErrorAlert,
  VerificationErrorDialog,
} from '@/components/kyc/verification-error-dialog';

/**
 * Tier 1 — BVN identity verification (required before platform access).
 */
export default function Tier1KYCPage() {
  const router = useRouter();
  const { status, data: session, update } = useSession();

  const [bvn, setBvn] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<ResolvedVerificationError | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [verificationDetails, setVerificationDetails] = useState<{
    matchScore?: number;
    mismatches?: string[];
  } | null>(null);
  const [userProfile, setUserProfile] = useState<{
    fullName: string;
    dateOfBirth: string;
    phone: string;
  } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    if (status !== 'authenticated') return;

    fetch('/api/settings/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setUserProfile({
            fullName: data.fullName || session?.user?.name || '',
            dateOfBirth: data.dateOfBirth || session?.user?.dateOfBirth || '',
            phone: data.phone || session?.user?.phone || '',
          });
        } else if (session?.user) {
          setUserProfile({
            fullName: session.user.name || '',
            dateOfBirth: session.user.dateOfBirth || '',
            phone: session.user.phone || '',
          });
        }
      })
      .catch(() => {
        if (session?.user) {
          setUserProfile({
            fullName: session.user.name || '',
            dateOfBirth: session.user.dateOfBirth || '',
            phone: session.user.phone || '',
          });
        }
      });
  }, [status, session, router]);

  const handleBvnChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length <= 11) {
      setBvn(digitsOnly);
      setVerificationError(null);
      setErrorDialogOpen(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bvn || bvn.length !== 11) {
      const validationError = resolveTier1VerificationError({
        error: 'Invalid BVN format. BVN must be exactly 11 digits.',
      });
      setVerificationError(validationError);
      setErrorDialogOpen(true);
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);
    setErrorDialogOpen(false);
    setVerificationDetails(null);

    try {
      const response = await fetch('/api/vendors/verify-bvn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bvn }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.mismatches?.length > 0) {
          setVerificationDetails({
            matchScore: result.matchScore,
            mismatches: result.mismatches,
          });
        }
        const resolved = resolveTier1VerificationError({
          error: result.error,
          message: result.message,
          errorSource: result.errorSource,
          mismatches: result.mismatches,
        });
        setVerificationError(resolved);
        setErrorDialogOpen(true);
        return;
      }

      sessionStorage.setItem('bvn_verification_success', '1');
      setSuccess(true);
      setIsVerifying(false);

      await new Promise((resolve) => setTimeout(resolve, 2800));

      if (result.refreshSession) {
        await update();
      }

      sessionStorage.removeItem('bvn_verification_success');
      window.location.href = '/vendor/kyc/tier2';
      return;
    } catch {
      const resolved = resolveTier1VerificationError({
        error: 'network_error',
        message: 'Network error. Check your connection and try again.',
        errorSource: 'network',
      });
      setVerificationError(resolved);
      setErrorDialogOpen(true);
    } finally {
      setIsVerifying(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#800020] animate-spin" />
      </div>
    );
  }

  return (
    <>
      <VerificationErrorDialog
        open={errorDialogOpen}
        onOpenChange={setErrorDialogOpen}
        error={verificationError}
      />
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#800020]/10 rounded-full mb-4">
            <Shield className="w-7 h-7 text-[#800020]" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Identity verification</h1>
          <p className="text-sm text-gray-600 mt-2">
            Complete BVN verification to access your vendor account.
          </p>
          {isKycTestingModeClient() && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4">
              KYC testing mode is on — you can submit the same BVN again for this account.
            </p>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {success ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Verification complete</h2>
              <p className="text-sm text-gray-600">Redirecting to Tier 2 verification…</p>
            </div>
          ) : (
            <div className="p-6 sm:p-8">
              {verificationError && (
                <VerificationErrorAlert error={verificationError} className="mb-6" />
              )}

              {userProfile && (
                <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm space-y-2">
                  <p className="text-gray-600 font-medium mb-2">Profile used for verification</p>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Name (registered)</span>
                    <span className="text-gray-900 text-right">{userProfile.fullName}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    We match this against your BVN as first, middle (if any), and surname — plus date of birth and
                    BVN-linked phone. Use BVN order when you registered (e.g. {GENERIC_NAME_BVN_ORDER_EXAMPLE}).
                  </p>
                  {userProfile.dateOfBirth && (
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-500">Date of birth</span>
                      <span className="text-gray-900 text-right">
                        {(() => {
                          try {
                            const date = new Date(userProfile.dateOfBirth);
                            return isNaN(date.getTime())
                              ? userProfile.dateOfBirth
                              : date.toLocaleDateString('en-GB', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                });
                          } catch {
                            return userProfile.dateOfBirth;
                          }
                        })()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Phone</span>
                    <span className="text-gray-900 text-right">{userProfile.phone}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="bvn" className="block text-sm font-medium text-gray-700 mb-2">
                    Bank Verification Number (BVN)
                  </label>
                  <input
                    type="text"
                    id="bvn"
                    value={bvn}
                    onChange={(e) => handleBvnChange(e.target.value)}
                    disabled={isVerifying}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020] focus:border-transparent text-lg tracking-wider disabled:opacity-50"
                    placeholder="11 digits"
                    maxLength={11}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                  <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" />
                    Encrypted in transit and at rest.
                  </p>
                </div>

                {isVerifying && (
                  <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                    <Loader2 className="w-5 h-5 animate-spin text-[#800020]" />
                    Verifying identity…
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isVerifying || bvn.length !== 11}
                  className="w-full bg-[#800020] text-white font-medium py-3 px-4 rounded-lg hover:bg-[#600018] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    'Verify identity'
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
