/**
 * AI Analysis Status Badge Component
 * 
 * Shows the current state of AI analysis for a case.
 * Displays different states: required, processing, complete, or error.
 */

'use client';

import { CheckCircle, AlertCircle, Loader2, XCircle } from 'lucide-react';

export interface AIAnalysisStatusBadgeProps {
  hasAnalysis: boolean;
  isProcessing?: boolean;
  marketValue?: number;
  confidenceScore?: number;
  error?: string | null;
  className?: string;
}

export function AIAnalysisStatusBadge({
  hasAnalysis,
  isProcessing = false,
  marketValue,
  confidenceScore,
  error,
  className = '',
}: AIAnalysisStatusBadgeProps) {
  // Processing state
  if (isProcessing) {
    return (
      <div className={`inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg ${className}`}>
        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-blue-900">AI Analysis in Progress</span>
          <span className="text-xs text-blue-700">Please wait...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <XCircle className="w-4 h-4 text-red-600" />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-red-900">AI Analysis Failed</span>
          <span className="text-xs text-red-700">{error}</span>
        </div>
      </div>
    );
  }

  // Complete state
  if (hasAnalysis && marketValue) {
    const confidenceColor = confidenceScore 
      ? confidenceScore >= 80 
        ? 'text-green-700' 
        : confidenceScore >= 70 
        ? 'text-yellow-700' 
        : 'text-orange-700'
      : 'text-gray-700';

    return (
      <div className={`inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg ${className}`}>
        <CheckCircle className="w-4 h-4 text-green-600" />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-green-900">AI Analysis Complete</span>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-green-700">
              Market Value: ₦{marketValue.toLocaleString()}
            </span>
            {confidenceScore && (
              <span className={`font-medium ${confidenceColor}`}>
                ({confidenceScore}% confidence)
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Required state (default)
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg ${className}`}>
      <AlertCircle className="w-4 h-4 text-amber-600" />
      <div className="flex flex-col">
        <span className="text-sm font-medium text-amber-900">AI Analysis Required</span>
        <span className="text-xs text-amber-700">Click "Analyze Photos" to continue</span>
      </div>
    </div>
  );
}
