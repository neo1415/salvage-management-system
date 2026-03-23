/**
 * Feature Flags Settings Page
 * 
 * Allows users to view and control feature flags for gradual rollout
 */

import { FeatureFlagSettings } from '@/components/ui/feature-flag-settings';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function FeatureFlagsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[#800020] hover:text-[#600018] mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </Link>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <FeatureFlagSettings />
        </div>
      </div>
    </div>
  );
}
