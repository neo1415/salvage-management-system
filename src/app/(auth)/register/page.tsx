'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { VendorRegistrationForm } from '@/components/forms/vendor-registration-form';
import { type RegistrationInput } from '@/lib/utils/validation';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * Vendor Registration Page
 * Mobile-responsive registration page with standard and OAuth registration
 */
export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegistration = async (data: RegistrationInput) => {
    setError(null);
    setSuccess(false);

    try {
      // Call registration API
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed');
      }

      // Show success message
      setSuccess(true);

      // Redirect to OTP verification page after 2 seconds
      setTimeout(() => {
        router.push(`/verify-otp?phone=${encodeURIComponent(data.phone)}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'facebook') => {
    try {
      // Trigger OAuth sign-in with NextAuth
      await signIn(provider, {
        callbackUrl: '/verify-otp',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#800020] to-[#600018] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4">
            <svg
              className="w-10 h-10 text-[#800020]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Create Your Account</h1>
          <p className="text-gray-200">
            Join 500+ vendors earning more from salvage
          </p>
        </div>

        {/* Registration Form Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-900">Account Created Successfully!</h3>
                <p className="text-sm text-green-700 mt-1">
                  Redirecting you to verify your phone number...
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Registration Failed</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Registration Form */}
          <VendorRegistrationForm
            onSubmit={handleRegistration}
            onOAuthLogin={handleOAuthLogin}
          />
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-200">
          <p>
            By creating an account, you agree to our{' '}
            <a href="/terms" className="underline hover:text-white">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="underline hover:text-white">
              Privacy Policy
            </a>
          </p>
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-300">
            Need help?{' '}
            <a href="/contact" className="text-[#FFD700] hover:underline">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
