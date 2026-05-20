'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AlertCircle, CheckCircle2, Loader2, Shield, Lock } from 'lucide-react';

/**
 * Tier 1 — BVN identity verification (required before platform access).
 */
export default function Tier1KYCPage() {
  const router = useRouter();
  const { status, data: session, update } = useSession();

  const [bvn, setBvn] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    } else if (status === 'authenticated' && session?.user) {
      setUserProfile({
        fullName: session.user.name || '',
        dateOfBirth: session.user.dateOfBirth || '',
        phone: session.user.phone || '',
      });
    }
  }, [status, session, router]);

  const handleBvnChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length <= 11) {
      setBvn(digitsOnly);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bvn || bvn.length !== 11) {
      setError('Enter a valid 11-digit BVN.');
      return;
    }

    setIsVerifying(true);
    setError(null);
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
        throw new Error(result.message || result.error || 'Verification failed.');
      }

      setSuccess(true);

      if (result.refreshSession) {
        await update();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      setTimeout(() => {
        window.location.href = '/vendor/dashboard';
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
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
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {success ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Verification complete</h2>
              <p className="text-sm text-gray-600">Redirecting to your dashboard…</p>
            </div>
          ) : (
            <div className="p-6 sm:p-8">
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 text-sm">
                      <p className="font-medium text-red-900">{error}</p>
                      {verificationDetails?.mismatches && (
                        <ul className="mt-2 text-red-700 space-y-1 list-disc list-inside">
                          {verificationDetails.mismatches.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {userProfile && (
                <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm space-y-2">
                  <p className="text-gray-600 font-medium mb-2">Profile used for verification</p>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Name</span>
                    <span className="text-gray-900 text-right">{userProfile.fullName}</span>
                  </div>
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
  );
}
