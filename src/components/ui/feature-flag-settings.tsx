/**
 * Feature Flag Settings Component
 * 
 * Allows users to view and control feature flags
 * Provides opt-in/opt-out functionality for gradual rollout
 */

'use client';

import { useState } from 'react';
import { 
  getAllFeatureFlagConfigs,
  type FeatureFlagName 
} from '@/lib/feature-flags';
import { useFeatureFlag } from '@/hooks/use-feature-flag';
import { Check, X, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface FeatureFlagItemProps {
  flag: FeatureFlagName;
  userId?: string;
}

function FeatureFlagItem({ flag, userId }: FeatureFlagItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { enabled, hasOverride, overrideValue, optIn, optOut, clearOverride } = useFeatureFlag(flag, userId);
  const configs = getAllFeatureFlagConfigs();
  const config = configs.find(c => c.name === flag);

  if (!config) return null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
          <div className="text-left">
            <div className="font-medium text-gray-900">{config.description}</div>
            <div className="text-sm text-gray-500">
              {hasOverride ? (
                <span className="text-[#800020] font-medium">
                  User override: {overrideValue ? 'Enabled' : 'Disabled'}
                </span>
              ) : (
                <span>
                  Rollout: {config.rolloutPercentage}%
                </span>
              )}
            </div>
          </div>
        </div>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {isExpanded && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              <div className="mb-2">
                <span className="font-medium">Status:</span>{' '}
                {enabled ? (
                  <span className="text-green-600">Enabled</span>
                ) : (
                  <span className="text-gray-500">Disabled</span>
                )}
              </div>
              <div className="mb-2">
                <span className="font-medium">Rollout Percentage:</span> {config.rolloutPercentage}%
              </div>
              {hasOverride && (
                <div className="mb-2">
                  <span className="font-medium">Override:</span>{' '}
                  <span className="text-[#800020]">
                    {overrideValue ? 'Opted In' : 'Opted Out'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={optIn}
                disabled={enabled && hasOverride && overrideValue === true}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Check size={16} />
                <span>Opt In</span>
              </button>

              <button
                onClick={optOut}
                disabled={!enabled && hasOverride && overrideValue === false}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <X size={16} />
                <span>Opt Out</span>
              </button>

              {hasOverride && (
                <button
                  onClick={clearOverride}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  title="Clear override and use default rollout"
                >
                  <RotateCcw size={16} />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface FeatureFlagSettingsProps {
  userId?: string;
  className?: string;
}

/**
 * Feature Flag Settings Panel
 * 
 * Displays all available feature flags and allows users to control them
 */
export function FeatureFlagSettings({ userId, className = '' }: FeatureFlagSettingsProps) {
  const configs = getAllFeatureFlagConfigs();

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Feature Flags</h2>
        <p className="text-sm text-gray-600">
          Control which new features you want to use. You can opt-in to try new features early or opt-out if you prefer the classic experience.
        </p>
      </div>

      <div className="space-y-3">
        {configs.map((config) => (
          <FeatureFlagItem
            key={config.name}
            flag={config.name}
            userId={userId}
          />
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">About Feature Flags</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Opt In:</strong> Enable a feature even if it's not fully rolled out</li>
          <li>• <strong>Opt Out:</strong> Disable a feature even if it's enabled for you</li>
          <li>• <strong>Reset:</strong> Remove your preference and use the default rollout</li>
          <li>• Your preferences are saved locally and persist across sessions</li>
        </ul>
      </div>
    </div>
  );
}
