'use client';

import { useRouter } from 'next/navigation';
import { X, Crown, Zap, TrendingUp, Award } from 'lucide-react';

interface TierUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  auctionValue?: number;
}

export function TierUpgradeModal({ isOpen, onClose, auctionValue }: TierUpgradeModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleUpgradeClick = () => {
    router.push('/vendor/kyc/tier2');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-[#800020] to-[#FFD700] p-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <Crown className="w-8 h-8" />
            <h2 className="text-2xl font-bold">Upgrade to Tier 2</h2>
          </div>
          
          {auctionValue && (
            <p className="text-white/90 text-sm">
              This auction (₦{auctionValue.toLocaleString()}) requires Tier 2 verification
            </p>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Unlock Premium Benefits
            </h3>

            {/* Benefits list */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-10 h-10 bg-[#FFD700] rounded-full flex items-center justify-center">
                  <Zap className="w-5 h-5 text-[#800020]" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Unlimited Bidding</h4>
                  <p className="text-sm text-gray-600">
                    Bid on high-value auctions above ₦500,000 with no limits
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-10 h-10 bg-[#FFD700] rounded-full flex items-center justify-center">
                  <Award className="w-5 h-5 text-[#800020]" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Priority Support</h4>
                  <p className="text-sm text-gray-600">
                    Get dedicated support and faster response times
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-10 h-10 bg-[#FFD700] rounded-full flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-[#800020]" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Leaderboard Eligibility</h4>
                  <p className="text-sm text-gray-600">
                    Compete for top positions and earn recognition
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Requirements preview */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">What You'll Need:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• CAC Registration Certificate</li>
              <li>• Bank Statement (Last 3 months)</li>
              <li>• Valid ID (NIN Card/Driver's License/Passport)</li>
              <li>• Bank Account Details</li>
            </ul>
            <p className="text-xs text-blue-700 mt-2">
              Verification typically completed within 24 hours
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Maybe Later
            </button>
            <button
              onClick={handleUpgradeClick}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-[#800020] to-[#FFD700] text-white font-bold rounded-lg hover:shadow-lg transition-all transform hover:scale-105"
            >
              Upgrade Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
