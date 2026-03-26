'use client';

/**
 * Profile Settings Page
 * Displays user information, KYC status, and change password functionality
 * 
 * Features:
 * - Display user information (read-only)
 * - Display KYC status with tier badges
 * - Show non-sensitive KYC info
 * - Hide sensitive data (BVN, NIN, documents)
 * - Change password form
 * - Offline support with cached data
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ChangePasswordForm from '@/components/settings/change-password-form';
import { useCachedProfile } from '@/hooks/use-cached-profile';

interface ProfileData {
  user: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    createdAt: string;
    status: string;
  };
  vendor?: {
    businessName: string | null;
    bankAccountNumber: string | null;
    bankName: string | null;
    tier: string;
    status: string;
  };
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { profile, isLoading: loading, isOffline, lastCached, refresh, error: cacheError } = useCachedProfile();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const getTierBadge = (tier: string) => {
    const tierMap: Record<string, { label: string; color: string }> = {
      tier1_bvn: { label: 'Tier 1', color: 'bg-blue-100 text-blue-800' },
      tier2_full: { label: 'Tier 2', color: 'bg-green-100 text-green-800' },
    };

    const tierInfo = tierMap[tier] || { label: 'Tier 0', color: 'bg-gray-100 text-gray-800' };

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${tierInfo.color}`}>
        {tierInfo.label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      unverified_tier_0: { label: 'Unverified', color: 'bg-gray-100 text-gray-800' },
      phone_verified_tier_0: { label: 'Phone Verified', color: 'bg-yellow-100 text-yellow-800' },
      verified_tier_1: { label: 'Verified', color: 'bg-green-100 text-green-800' },
      verified_tier_2: { label: 'Fully Verified', color: 'bg-green-100 text-green-800' },
      suspended: { label: 'Suspended', color: 'bg-red-100 text-red-800' },
    };

    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  const maskBankAccount = (accountNumber: string | null) => {
    if (!accountNumber) return 'Not provided';
    const lastFour = accountNumber.slice(-4);
    return `****${lastFour}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || cacheError || !profile) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-red-600">{error || cacheError?.message || 'Failed to load profile data.'}</p>
        <button
          onClick={() => refresh()}
          className="mt-4 px-4 py-2 bg-[#800020] text-white rounded-lg hover:bg-[#600018] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Offline indicator banner */}
      {isOffline && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800">
                You are offline. Showing cached profile data.
              </p>
              {lastCached && (
                <p className="text-xs text-yellow-700 mt-1">
                  Last updated: {new Date(lastCached).toLocaleString('en-NG', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </p>
              )}
              <p className="text-xs text-yellow-700 mt-1">
                Profile editing is disabled while offline.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* User Information */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">User Information</h2>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                {profile.user.fullName}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                {profile.user.email}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                {profile.user.phone}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                {formatDate(profile.user.dateOfBirth)}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Status</label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg">
                {getStatusBadge(profile.user.status)}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Member Since</label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                {formatDate(profile.user.createdAt)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KYC Status */}
      {profile.vendor && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">KYC Status</h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">KYC Tier</label>
                <div className="px-4 py-3 bg-gray-50 rounded-lg">
                  {getTierBadge(profile.vendor.tier)}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Status</label>
                <div className="px-4 py-3 bg-gray-50 rounded-lg">
                  {getStatusBadge(profile.vendor.status)}
                </div>
              </div>

              {profile.vendor.businessName && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                  <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                    {profile.vendor.businessName}
                  </div>
                </div>
              )}

              {profile.vendor.bankAccountNumber && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account</label>
                    <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                      {maskBankAccount(profile.vendor.bankAccountNumber)}
                    </div>
                  </div>

                  {profile.vendor.bankName && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                      <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                        {profile.vendor.bankName}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex">
                <svg
                  className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Privacy Notice</p>
                  <p>
                    Sensitive information such as BVN, NIN, and document uploads are securely encrypted
                    and not displayed for security reasons. Only authorized personnel can access this data.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Password */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Change Password</h2>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
