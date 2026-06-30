'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { getBrandGradient, usePublicBranding } from '@/hooks/use-public-branding';
import { getAuthSurfaceCopy, normalizeHomepageTemplate, resolveTemplateTheme } from '@/components/landing/template-config';
import { getOfflineUnlockGrant, refreshOfflineUnlockGrantFromSession } from '@/lib/auth/offline-unlock';

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
  const authCopy = getAuthSurfaceCopy(branding);
  const template = normalizeHomepageTemplate(branding.homepageTemplate);
  const theme = resolveTemplateTheme(branding);
  const isNight = theme === 'night' || template === 'nem_salvage';
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaDestination, setMfaDestination] = useState<string | null>(null);
  const [canUseOfflineFieldMode, setCanUseOfflineFieldMode] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

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

  const formatLoginError = (rawError: string | null | undefined): string => {
    const normalized = (rawError || '').toLowerCase();

    if (!rawError) {
      return 'Login could not be completed. Please try again.';
    }

    if (rawError === 'MFA_UNAVAILABLE') {
      return 'We could not send your verification code. Please try again or contact support.';
    }

    if (rawError === 'MFA_REQUIRED') {
      return 'Enter the verification code sent to your account.';
    }

    if (
      normalized.includes('configuration') ||
      normalized.includes('callbackrouteerror') ||
      normalized.includes('credentialssignin') ||
      normalized.includes('accessdenied')
    ) {
      return mfaRequired
        ? 'The verification code could not be confirmed. Check the 6-digit code or request a new one.'
        : 'Email/phone or password is incorrect, or this account cannot sign in with password.';
    }

    if (normalized.includes('invalid credentials')) {
      return 'Email/phone or password is incorrect. Please check your details and try again.';
    }

    return rawError;
  };

  const buildPostLoginRedirect = (): string => {
    const safe = getSafeCallbackUrl(callbackUrl);
    if (safe) {
      return `/api/auth/after-login?callbackUrl=${encodeURIComponent(safe)}`;
    }
    return '/api/auth/after-login';
  };

  useEffect(() => {
    const updateOfflineState = () => {
      const offline = !navigator.onLine;
      setIsOffline(offline);
      setCanUseOfflineFieldMode(offline && Boolean(getOfflineUnlockGrant()));
    };

    updateOfflineState();
    window.addEventListener('online', updateOfflineState);
    window.addEventListener('offline', updateOfflineState);

    return () => {
      window.removeEventListener('online', updateOfflineState);
      window.removeEventListener('offline', updateOfflineState);
    };
  }, []);

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

        if (!mfaResponse.ok) {
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
        setError(formatLoginError(result.error));
        setIsSubmitting(false);
        return;
      }

      await refreshOfflineUnlockGrantFromSession();
      window.location.assign(result?.url || buildPostLoginRedirect());
    } catch (err) {
      setError(formatLoginError(err instanceof Error ? err.message : null));
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`min-h-screen p-4 ${theme === 'night' ? 'bg-[var(--brand-primary)]' : 'bg-slate-50'}`}
      style={template === 'nem_salvage' ? { background: getBrandGradient(branding) } : undefined}
    >
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_440px]">
        <aside className={`hidden rounded-3xl border p-8 lg:block ${theme === 'night' ? 'border-white/10 bg-white/[0.04] text-white' : 'border-slate-200 bg-white text-slate-950'}`}>
          <p className="font-mono text-xs uppercase tracking-[0.22em]" style={{ color: branding.accentColor }}>{authCopy.tone}</p>
          <h2 className="mt-6 text-5xl font-black leading-none tracking-[-0.06em]">{authCopy.headline}</h2>
          <p className={`mt-5 max-w-md leading-8 ${theme === 'night' ? 'text-white/60' : 'text-slate-600'}`}>{authCopy.subtitle}</p>
          <div className="mt-10 grid gap-3">
            {['Secure access', 'Policy-driven onboarding', 'Auditable recovery workflows'].map((item) => (
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
            <Lock className="w-8 h-8" style={{ color: branding.primaryColor }} />
          </div>
          <h1 className={`text-3xl font-bold mb-2 ${isNight ? 'text-white' : 'text-slate-950'}`}>Welcome Back</h1>
          <p className={isNight ? 'text-gray-200' : 'text-slate-600'}>
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
                    : 'border-gray-300 focus:ring-[var(--brand-primary)]'
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
                      : 'border-gray-300 focus:ring-[var(--brand-primary)]'
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
                  className="w-full px-4 py-3 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] bg-white"
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
                className="w-4 h-4 border-gray-300 rounded focus:ring-[var(--brand-primary)]"
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
              style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-foreground)' }}
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

            {isOffline && canUseOfflineFieldMode && (
              <button
                type="button"
                onClick={() => window.location.assign('/adjuster/cases/new?offline=1')}
                className="w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950 transition-colors hover:bg-amber-100"
              >
                Open offline field mode
              </button>
            )}

            {isOffline && !canUseOfflineFieldMode && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Offline field mode is available after a claims adjuster signs in online on this device.
              </p>
            )}
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
          <p className={`text-sm ${isNight ? 'text-gray-300' : 'text-slate-600'}`}>
            Need help?{' '}
            <a href="/contact" className="hover:underline" style={{ color: branding.accentColor }}>
              Contact Support
            </a>
          </p>
          <div className={`mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs ${isNight ? 'text-gray-300' : 'text-slate-500'}`}>
            <a href="/privacy" className="hover:underline">Privacy</a>
            <a href="/cookies" className="hover:underline">Cookies</a>
            <a href="/terms" className="hover:underline">Terms</a>
            <a href="/ndpr" className="hover:underline">NDPR</a>
          </div>
        </div>
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--brand-primary)' }}>
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-primary-foreground)]" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
