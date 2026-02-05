'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Shield, 
  ArrowLeft,
  Info,
  Award,
  TrendingUp,
  Lock
} from 'lucide-react';

/**
 * Tier 1 KYC Verification Page
 * 
 * Allows vendors to complete Tier 1 KYC verification using BVN
 * Features:
 * - BVN input field (11 digits)
 * - Date of birth confirmation
 * - Verification progress indicator
 * - Success message with Tier 1 badge
 * - Specific error messages for mismatches
 * 
 * Requirements: 4, NFR5.3
 */
export default function Tier1KYCPage() {
  const router = useRouter();
  const { status, data: session } = useSession();

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

  // Redirect if not authenticated and fetch user profile
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && session?.user) {
      // Set user profile from session
      setUserProfile({
        fullName: session.user.name || '',
        dateOfBirth: session.user.dateOfBirth || '',
        phone: session.user.phone || '',
      });
    }
  }, [status, session, router]);

  // Handle BVN input (only allow digits, max 11)
  const handleBvnChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length <= 11) {
      setBvn(digitsOnly);
      setError(null);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    if (!bvn || bvn.length !== 11) {
      setError('Please enter a valid 11-digit BVN');
      return;
    }

    setIsVerifying(true);
    setError(null);
    setVerificationDetails(null);

    try {
      const response = await fetch('/api/vendors/verify-bvn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bvn,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('[BVN Verification] API error:', {
          status: response.status,
          result,
        });
        
        // Handle specific error cases
        if (result.mismatches && result.mismatches.length > 0) {
          setVerificationDetails({
            matchScore: result.matchScore,
            mismatches: result.mismatches,
          });
        }
        throw new Error(result.message || result.error || 'Verification failed');
      }

      // Show success
      setSuccess(true);

      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        router.push('/vendor/dashboard');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#800020] to-[#600018] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#800020] to-[#600018] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-white hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4">
            <Shield className="w-8 h-8 text-[#800020]" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Tier 1 Verification</h1>
          <p className="text-gray-200">
            Verify your identity with BVN to start bidding
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Success State */}
          {success ? (
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                🎉 Verification Complete!
              </h2>
              
              <div className="inline-block bg-[#FFD700] text-[#800020] px-6 py-2 rounded-full font-bold mb-6">
                <Award className="w-5 h-5 inline-block mr-2" />
                Tier 1 Verified
              </div>
              
              <p className="text-gray-700 mb-6">
                Congratulations! Your BVN has been successfully verified. You can now bid up to <strong>₦500,000</strong> on salvage items.
              </p>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-green-900 mb-2">What You Can Do Now:</h3>
                <ul className="text-sm text-green-700 space-y-2 text-left">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Browse all available salvage auctions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Place bids up to ₦500,000</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Win auctions and pay instantly via Paystack</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Build your vendor reputation</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Want to Bid Higher?
                </h3>
                <p className="text-sm text-yellow-700 mb-3">
                  Upgrade to <strong>Tier 2</strong> to unlock unlimited bidding on high-value items above ₦500,000.
                </p>
                <button
                  onClick={() => router.push('/vendor/kyc/tier2')}
                  className="text-sm text-[#800020] font-semibold hover:underline"
                >
                  Learn about Tier 2 →
                </button>
              </div>
              
              <p className="text-sm text-gray-500 mb-6">
                Redirecting you to dashboard in a moment...
              </p>
              
              <button
                onClick={() => router.push('/vendor/dashboard')}
                className="w-full bg-[#FFD700] text-[#800020] font-bold py-3 px-4 rounded-lg hover:bg-[#FFC700] transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            <>
              {/* Benefits Section */}
              <div className="bg-gradient-to-r from-[#800020] to-[#600018] p-6 text-white">
                <h2 className="text-xl font-bold mb-4">Tier 1 Benefits</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-[#FFD700] rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-[#800020]" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Instant Approval</h3>
                      <p className="text-sm text-gray-200">Get verified in minutes</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-[#FFD700] rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-[#800020]" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Bid up to ₦500k</h3>
                      <p className="text-sm text-gray-200">Access most auctions</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-[#FFD700] rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-[#800020]" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Secure & Private</h3>
                      <p className="text-sm text-gray-200">BVN encrypted with AES-256</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-[#FFD700] rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-[#800020]" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Build Reputation</h3>
                      <p className="text-sm text-gray-200">Start earning trust badges</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Section */}
              <div className="p-6 sm:p-8">
                {/* Error Message */}
                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-red-900">Verification Failed</h3>
                        <p className="text-sm text-red-700 mt-1">{error}</p>
                        
                        {/* Show mismatch details if available */}
                        {verificationDetails && verificationDetails.mismatches && (
                          <div className="mt-3 p-3 bg-red-100 rounded border border-red-300">
                            <p className="text-sm font-semibold text-red-900 mb-2">
                              Match Score: {verificationDetails.matchScore}%
                            </p>
                            <p className="text-sm text-red-800 mb-2">Details that don't match:</p>
                            <ul className="text-sm text-red-700 space-y-1">
                              {verificationDetails.mismatches.map((mismatch, index) => (
                                <li key={index} className="flex items-start gap-2">
                                  <span className="text-red-500">•</span>
                                  <span>{mismatch}</span>
                                </li>
                              ))}
                            </ul>
                            <p className="text-sm text-red-800 mt-3">
                              Please ensure your name, date of birth, and phone number match your BVN records exactly.
                            </p>
                          </div>
                        )}
                        
                        {/* Troubleshooting tips */}
                        {!verificationDetails && (
                          <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-300">
                            <p className="text-sm font-semibold text-yellow-900 mb-2">Troubleshooting Tips:</p>
                            <ul className="text-sm text-yellow-800 space-y-1">
                              <li className="flex items-start gap-2">
                                <span>•</span>
                                <span>Ensure you entered the correct 11-digit BVN</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span>•</span>
                                <span>Check that your date of birth matches your BVN registration</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span>•</span>
                                <span>Verify your internet connection is stable</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span>•</span>
                                <span>If the issue persists, contact support for assistance</span>
                              </li>
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* User Profile Confirmation */}
                {userProfile && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3 mb-3">
                      <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-blue-900">We'll verify your BVN against your profile</h3>
                        <p className="text-sm text-blue-700 mt-1">
                          Your BVN will be matched with the information you provided during registration.
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Full Name:</span>
                        <span className="font-medium text-gray-900">{userProfile.fullName}</span>
                      </div>
                      {userProfile.dateOfBirth && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Date of Birth:</span>
                          <span className="font-medium text-gray-900">
                            {(() => {
                              try {
                                const date = new Date(userProfile.dateOfBirth);
                                if (isNaN(date.getTime())) {
                                  return userProfile.dateOfBirth;
                                }
                                return date.toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                });
                              } catch {
                                return userProfile.dateOfBirth;
                              }
                            })()}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Phone:</span>
                        <span className="font-medium text-gray-900">{userProfile.phone}</span>
                      </div>
                    </div>
                    <p className="text-xs text-blue-600 mt-3">
                      ℹ️ If any of this information is incorrect, please contact support before proceeding.
                    </p>
                  </div>
                )}

                {/* Verification Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* BVN Input */}
                  <div>
                    <label htmlFor="bvn" className="block text-sm font-medium text-gray-700 mb-2">
                      Bank Verification Number (BVN) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="bvn"
                        value={bvn}
                        onChange={(e) => handleBvnChange(e.target.value)}
                        disabled={isVerifying}
                        className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-colors text-lg tracking-wider ${
                          error && !verificationDetails
                            ? 'border-red-500 focus:ring-red-500'
                            : bvn.length === 11
                            ? 'border-green-500 focus:ring-green-500'
                            : 'border-gray-300 focus:ring-[#800020]'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        placeholder="Enter 11-digit BVN"
                        maxLength={11}
                        inputMode="numeric"
                      />
                      {bvn.length === 11 && !error && (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 text-green-500" />
                      )}
                      <div className="absolute right-3 bottom-full mb-1 text-xs text-gray-500">
                        {bvn.length}/11
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-600 flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Your BVN is encrypted with AES-256 and stored securely
                    </p>
                  </div>

                  {/* Progress Indicator */}
                  {isVerifying && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                        <span className="font-semibold text-blue-900">Verifying your BVN...</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-blue-700">
                          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                          <span>Connecting to Paystack Identity API</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-blue-700">
                          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                          <span>Verifying BVN details</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-blue-700">
                          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                          <span>Matching with your registration information</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isVerifying || bvn.length !== 11}
                    className="w-full bg-[#FFD700] text-[#800020] font-bold py-4 px-4 rounded-lg hover:bg-[#FFC700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        Verifying BVN...
                      </>
                    ) : (
                      <>
                        <Shield className="w-6 h-6" />
                        Verify My Identity
                      </>
                    )}
                  </button>
                </form>

                {/* Security Notice */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-start gap-3 text-sm text-gray-600">
                    <Lock className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-700 mb-1">Your data is secure</p>
                      <p>
                        We use bank-grade encryption (AES-256) to protect your BVN. Your information is never shared with third parties and complies with NDPR regulations.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Help */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-300">
            Need help with verification?{' '}
            <a href="/contact" className="text-[#FFD700] hover:underline">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
