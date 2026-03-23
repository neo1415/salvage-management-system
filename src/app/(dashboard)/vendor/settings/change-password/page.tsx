'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ChangePasswordForm from '@/components/settings/change-password-form';

export default function VendorChangePasswordPage() {
  const router = useRouter();
  const [success, setSuccess] = useState(false);

  const handleSuccess = () => {
    setSuccess(true);
    setTimeout(() => {
      router.push('/vendor/dashboard');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Change Password
          </h1>
          <p className="text-gray-600">
            Update your password to keep your account secure
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="font-semibold text-green-900">Password changed successfully!</p>
                <p className="text-sm text-green-700">Redirecting to dashboard...</p>
              </div>
            </div>
          </div>
        )}

        {/* Change Password Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <ChangePasswordForm onSuccess={handleSuccess} />
        </div>

        {/* Security Tips */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Password Security Tips</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Use at least 8 characters</li>
            <li>• Include uppercase and lowercase letters</li>
            <li>• Add numbers and special characters</li>
            <li>• Avoid common words or personal information</li>
            <li>• Don't reuse passwords from other accounts</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
