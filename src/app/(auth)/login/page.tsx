'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { getBrandGradient, usePublicBranding } from '@/hooks/use-public-branding';

/**
 * Login validation schema
 * Supports email OR phone number
 */
const loginSchema = z.object({
  emailOrPhone: z
    .string()
    .min(1, 'Email or phone number is required'),
  password: z
    .string()
    .min(1, 'Password is required'),
  mfaCode: z.string().optional(),
  rememberMe: z.boolean().optional(),
});

type LoginInput = z.infer<typeof loginSchema>;

/**
 * Login Form Component
 * Separated to use useSearchParams with Suspense boundary
 */
function LoginForm() {
  const searchParams = useSearchParams();
  const { branding } = usePublicBranding();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaDestination, setMfaDestination] = useState<string | null>(null);

  // Don't set a default callbackUrl - let the middleware handle role-based redirect
  const callbackUrl = searchParams.get('callbackUrl') || null;
  const successMessage = searchParams.get('message') || null;
  const emailParam = searchParams.get('email') || '';

  const BLOCKED_CALLBACK_PATHS = new Set(['/', '/login', '/launch', '/register']);

  const getSafeCallbackUrl = (url: string | null): string | null => {
    if (!url) return null;
    if (!url.startsWith('/') || url.startsWith('//')) return null;
    const base = url.split('?')[0];
    if (BLOCKED_CALLBACK_PATHS.has(base)) return null;
    return url;
  };

  const buildPostLoginRedirect = (): string => {
    const safe = getSafeCallbackUrl(callbackUrl);
    if (safe) {
      return `/api/auth/after-login?callbackUrl=${encodeURIComponent(safe)}`;
    }
    return '/api/auth/after-login';
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      emailOrPhone: emailParam,
      rememberMe: false,
    },
  });

  const handleLogin = async (data: LoginInput) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const userAgent = navigator.userAgent;

      if (!mfaRequired) {
        const mfaResponse = await fetch('/api/auth/mfa/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emailOrPhone: data.emailOrPhone,
            password: data.password,
          }),
        });

        const mfaJson = await mfaResponse.json().catch(() => ({}));
        if (mfaResponse.ok && mfaJson.required) {
          setMfaRequired(true);
          setMfaDestination(mfaJson.destination || null);
          setError(null);
          setIsSubmitting(false);
          return;
        }

        if (!mfaResponse.ok && mfaJson.required) {
          setError(mfaJson.error || 'Verification code could not be sent. Please try again.');
          setIsSubmitting(false);
          return;
        }
      }

      if (mfaRequired && (!data.mfaCode || data.mfaCode.length !== 6)) {
        setError('Enter the 6-digit verification code.');
        setIsSubmitting(false);
        return;
      }

      // Let Auth.js set the session cookie, then server redirect via /api/auth/after-login
      const result = await signIn('credentials', {
        emailOrPhone: data.emailOrPhone,
        password: data.password,
        mfaCode: data.mfaCode,
        userAgent,
        callbackUrl: buildPostLoginRedirect(),
        redirect: false,
      });

      if (result?.error) {
        if (result.error === 'MFA_REQUIRED') {
          setMfaRequired(true);
          setError(null);
          setIsSubmitting(false);
          return;
        }
        setError(result.error);
        setIsSubmitting(false);
        return;
      }

      window.location.assign(result?.url || buildPostLoginRedirect());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: getBrandGradient(branding) }}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4">
            <Lock className="w-8 h-8" style={{ color: branding.primaryColor }} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-gray-200">
            Sign in to access your {branding.brandName} account
          </p>
        </div>

        {/* Login Form Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="font-semibold text-green-900">Success</h3>
                <p className="text-sm text-green-700 mt-1">{successMessage}</p>
              </div>
            </div>
          )}
          
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Login Failed</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit(handleLogin)} className="space-y-4">
            {/* Email or Phone */}
            <div>
              <label htmlFor="emailOrPhone" className="block text-sm font-medium text-gray-700 mb-1">
                Email or Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                {...register('emailOrPhone')}
                type="text"
                id="emailOrPhone"
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  errors.emailOrPhone
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-[#800020]'
                }`}
                placeholder="your.email@example.com or +234XXXXXXXXXX"
              />
              {errors.emailOrPhone && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.emailOrPhone.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  className={`w-full px-4 py-3 pr-12 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                    errors.password
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-[#800020]'
                  }`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {mfaRequired && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <label htmlFor="mfaCode" className="block text-sm font-medium text-amber-950 mb-1">
                  Verification code <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('mfaCode')}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  id="mfaCode"
                  className="w-full px-4 py-3 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020] bg-white"
                  placeholder="Enter 6-digit code"
                />
                <p className="mt-2 text-sm text-amber-900">
                  We sent a login code{mfaDestination ? ` to ${mfaDestination}` : ''}.
                </p>
              </div>
            )}

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
              <input
                {...register('rememberMe')}
                type="checkbox"
                className="w-4 h-4 border-gray-300 rounded focus:ring-[#800020]"
                style={{ accentColor: branding.primaryColor }}
              />
                <span className="text-sm text-gray-700">Remember me</span>
              </label>
              <a
                href="/forgot-password"
                className="text-sm hover:underline font-medium"
                style={{ color: branding.primaryColor }}
              >
                Forgot password?
              </a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:opacity-90"
              style={{ backgroundColor: branding.accentColor, color: branding.primaryColor }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Register Link */}
          <p className="mt-6 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <a href="/register" className="font-medium hover:underline" style={{ color: branding.primaryColor }}>
              Sign up
            </a>
          </p>
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-300">
            Need help?{' '}
            <a href="/contact" className="hover:underline" style={{ color: branding.accentColor }}>
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Login Page
 * Mobile-responsive login page with email/phone + password and OAuth options
 */
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#800020] to-[#600018] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
