'use client';

import { useState } from 'react';
import { useAppRouter } from '@/hooks/use-app-router';
import { VendorRegistrationForm } from '@/components/forms/vendor-registration-form';
import { type RegistrationInput } from '@/lib/utils/validation';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { getBrandGradient, usePublicBranding } from '@/hooks/use-public-branding';
import { getAuthSurfaceCopy, normalizeHomepageTemplate, resolveTemplateTheme } from '@/components/landing/template-config';

/**
 * Vendor Registration Page
 * Mobile-responsive registration page with standard and OAuth registration
 */
export default function RegisterPage() {
  const router = useAppRouter();
  const { branding } = usePublicBranding();
  const authCopy = getAuthSurfaceCopy(branding);
  const template = normalizeHomepageTemplate(branding.homepageTemplate);
  const theme = resolveTemplateTheme(branding);
  const isNight = theme === 'night' || template === 'nem_salvage';
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
        router.push(`/verify-otp?phone=${encodeURIComponent(data.phone)}&email=${encodeURIComponent(data.email)}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    }
  };

  return (
    <div
      className={`min-h-screen p-4 ${theme === 'night' ? 'bg-[var(--brand-primary)]' : 'bg-slate-50'}`}
      style={template === 'nem_salvage' ? { background: getBrandGradient(branding) } : undefined}
    >
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_480px]">
        <aside className={`hidden rounded-3xl border p-8 lg:block ${theme === 'night' ? 'border-white/10 bg-white/[0.04] text-white' : 'border-slate-200 bg-white text-slate-950'}`}>
          <p className="font-mono text-xs uppercase tracking-[0.22em]" style={{ color: branding.accentColor }}>{authCopy.tone}</p>
          <h2 className="mt-6 text-5xl font-black leading-none tracking-[-0.06em]">{authCopy.headline}</h2>
          <p className={`mt-5 max-w-md leading-8 ${theme === 'night' ? 'text-white/60' : 'text-slate-600'}`}>{authCopy.subtitle}</p>
          <div className="mt-10 grid gap-3">
            {['Vendor registration', 'Identity verification', 'Controlled bidding access'].map((item) => (
              <div key={item} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${theme === 'night' ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50'}`}>
                {item}
              </div>
            ))}
          </div>
        </aside>
        <div className="w-full max-w-md justify-self-center">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4">
            <svg
              className="w-10 h-10 text-[var(--brand-primary)]"
              style={{ color: branding.primaryColor }}
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
          <h1 className={`text-3xl font-bold mb-2 ${isNight ? 'text-white' : 'text-slate-950'}`}>Create Your Account</h1>
          <p className={isNight ? 'text-gray-200' : 'text-slate-600'}>
            Join {branding.brandName} as a verified vendor
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
          />
        </div>

        {/* Footer */}
        <div className={`mt-6 text-center text-sm ${isNight ? 'text-gray-200' : 'text-slate-600'}`}>
          <p>
            By creating an account, you agree to our{' '}
            <a href="/terms" className="underline hover:text-white">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="underline hover:text-white">
              Privacy Policy
            </a>
            ,{' '}
            <a href="/cookies" className="underline hover:text-white">
              Cookie Policy
            </a>
            , and{' '}
            <a href="/ndpr" className="underline hover:text-white">
              NDPR Notice
            </a>
          </p>
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center">
          <p className={`text-sm ${isNight ? 'text-gray-300' : 'text-slate-600'}`}>
            Need help?{' '}
            <a href="/contact" className="hover:underline" style={{ color: branding.accentColor }}>
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
    </div>
  );
}
