/**
 * Preview Impact Comparison Component
 * Task 11.4.3
 * 
 * Shows comparison between current and proposed algorithm configuration
 */

'use client';

import { AlgorithmConfig } from './algorithm-config-content';

interface PreviewImpactComparisonProps {
  currentConfig: AlgorithmConfig;
  proposedConfig: AlgorithmConfig;
}

export function PreviewImpactComparison({
  currentConfig,
  proposedConfig,
}: PreviewImpactComparisonProps) {
  const calculateDifference = (current: number, proposed: number) => {
    const diff = ((proposed - current) / current) * 100;
    return {
      value: Math.abs(diff).toFixed(1),
      isIncrease: diff > 0,
      isDecrease: diff < 0,
    };
  };

  const configFields = [
    { key: 'similarityThreshold', label: 'Similarity Threshold', format: (v: number) => `${(v * 100).toFixed(0)}%` },
    { key: 'timeDecayFactor', label: 'Time Decay Factor', format: (v: number) => v.toFixed(2) },
    { key: 'competitionWeight', label: 'Competition Weight', format: (v: number) => v.toFixed(2) },
    { key: 'trendWeight', label: 'Trend Weight', format: (v: number) => v.toFixed(2) },
    { key: 'seasonalWeight', label: 'Seasonal Weight', format: (v: number) => v.toFixed(2) },
    { key: 'collaborativeWeight', label: 'Collaborative Weight', format: (v: number) => v.toFixed(2) },
    { key: 'contentBasedWeight', label: 'Content-Based Weight', format: (v: number) => v.toFixed(2) },
    { key: 'minSampleSize', label: 'Min Sample Size', format: (v: number) => v.toString() },
    { key: 'confidenceThreshold', label: 'Confidence Threshold', format: (v: number) => `${(v * 100).toFixed(0)}%` },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-3">
          Configuration Comparison
        </h3>
        <div className="space-y-3">
          {configFields.map((field) => {
            const currentValue = currentConfig[field.key as keyof AlgorithmConfig] as number;
            const proposedValue = proposedConfig[field.key as keyof AlgorithmConfig] as number;
            const diff = calculateDifference(currentValue, proposedValue);
            const hasChange = currentValue !== proposedValue;

            return (
              <div key={field.key} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 font-medium">{field.label}:</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-600">{field.format(currentValue)}</span>
                  <span className="text-gray-400">→</span>
                  <span className={hasChange ? 'font-semibold text-blue-600' : 'text-gray-600'}>
                    {field.format(proposedValue)}
                  </span>
                  {hasChange && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        diff.isIncrease
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {diff.isIncrease ? '+' : '-'}{diff.value}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-yellow-900 mb-2">
          Expected Impact
        </h4>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• Changes will affect all future predictions and recommendations</li>
          <li>• Existing cached predictions will be invalidated</li>
          <li>• New predictions may take 1-2 minutes to generate</li>
          <li>• Historical accuracy metrics will be recalculated</li>
        </ul>
      </div>
    </div>
  );
}
