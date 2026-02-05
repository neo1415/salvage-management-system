'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AuthErrorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  useEffect(() => {
    // Check if this is an OAuth registration error with email
    if (error && error.startsWith('OAuthRegistration:')) {
      const email = error.replace('OAuthRegistration:', '');
      router.push(`/auth/complete-oauth?email=${encodeURIComponent(email)}`);
    } else if (error === 'AccessDenied') {
      // Generic access denied - redirect to complete-oauth
      router.push('/auth/complete-oauth');
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
