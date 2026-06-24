'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppRouter } from '@/hooks/use-app-router';
import { Loader2 } from 'lucide-react';

/**
 * Auth Error Handler Component
 * Separated to use useSearchParams with Suspense boundary
 */
function AuthErrorHandler() {
  const router = useAppRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  useEffect(() => {
    // Check if this is an OAuth registration error with email
    if (error && error.startsWith('OAuthRegistration:')) {
      const email = error.replace('OAuthRegistration:', '');
      router.push(`/complete-oauth?email=${encodeURIComponent(email)}`);
    } else if (error === 'AccessDenied') {
      // Generic access denied - redirect to complete-oauth
      router.push('/complete-oauth');
    } else {
      // For other errors, redirect to login with error message
      router.push(`/login?error=${error || 'unknown'}`);
    }
  }, [error, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
        <p className="mt-4 text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}

/**
 * Auth Error Page
 * Handles OAuth and authentication errors with proper redirects
 */
export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AuthErrorHandler />
    </Suspense>
  );
}
