/**
 * Search Progress Indicator Component
 * 
 * Displays progress indicators and loading states for internet search operations
 * during case creation. Shows different states for market price searches,
 * AI assessment processing, and part price searches for salvage calculations.
 */

'use client';

import { useState, useEffect } from 'react';

export interface SearchProgress {
  stage: 'idle' | 'market_search' | 'ai_processing' | 'part_search' | 'complete' | 'error';
  message: string;
  progress?: number; // 0-100
  confidence?: number; // 0-100
  dataSource?: 'internet' | 'database' | 'cache';
  searchQuery?: string;
  timeElapsed?: number;
  estimatedTimeRemaining?: number;
  error?: string;
}

interface SearchProgressIndicatorProps {
  progress: SearchProgress;
  onCancel?: () => void;
  onRetry?: () => void;
  className?: string;
}

export function SearchProgressIndicator({
  progress,
  onCancel,
  onRetry,
  className = '',
}: SearchProgressIndicatorProps) {
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Track elapsed time during active searches
  useEffect(() => {
    if (progress.stage !== 'idle' && progress.stage !== 'complete' && progress.stage !== 'error') {
      if (!startTime) {
        setStartTime(Date.now());
      }
      
      const interval = setInterval(() => {
        if (startTime) {
          setTimeElapsed(Math.floor((Date.now() - startTime) / 1000));
        }
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setStartTime(null);
      setTimeElapsed(0);
    }
  }, [progress.stage, startTime]);

  // Don't render if idle
  if (progress.stage === 'idle') {
    return null;
  }

  const getStageIcon = () => {
    switch (progress.stage) {
      case 'market_search':
        return (
          <svg className="w-5 h-5 animate-spin text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        );
      case 'ai_processing':
        return (
          <svg className="w-5 h-5 animate-spin text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        );
      case 'part_search':
        return (
          <svg className="w-5 h-5 animate-spin text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          </svg>
        );
      case 'complete':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getStageColor = () => {
    switch (progress.stage) {
      case 'market_search':
        return 'border-blue-200 bg-blue-50';
      case 'ai_processing':
        return 'border-purple-200 bg-purple-50';
      case 'part_search':
        return 'border-orange-200 bg-orange-50';
      case 'complete':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getProgressBarColor = () => {
    switch (progress.stage) {
      case 'market_search':
        return 'bg-blue-600';
      case 'ai_processing':
        return 'bg-purple-600';
      case 'part_search':
        return 'bg-orange-600';
      case 'complete':
        return 'bg-green-600';
      default:
        return 'bg-gray-600';
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className={`border-2 rounded-lg p-4 shadow-sm ${getStageColor()} ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        {getStageIcon()}
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">{progress.message}</h3>
            {timeElapsed > 0 && (
              <span className="text-xs text-gray-500">{formatTime(timeElapsed)}</span>
            )}
          </div>
          
          {progress.searchQuery && (
            <p className="text-xs text-gray-600 mt-1">
              Searching: "{progress.searchQuery}"
            </p>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {progress.progress !== undefined && progress.stage !== 'complete' && progress.stage !== 'error' && (
        <div className="mb-3">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
              style={{ width: `${Math.min(100, Math.max(0, progress.progress))}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>{progress.progress}% complete</span>
            {progress.estimatedTimeRemaining && (
              <span>~{formatTime(progress.estimatedTimeRemaining)} remaining</span>
            )}
          </div>
        </div>
      )}

      {/* Data Source & Confidence */}
      {(progress.dataSource || progress.confidence !== undefined) && (
        <div className="flex items-center justify-between text-xs text-gray-600 mb-3">
          {progress.dataSource && (
            <div className="flex items-center gap-1">
              <span className="font-medium">Source:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                progress.dataSource === 'internet' ? 'bg-blue-100 text-blue-800' :
                progress.dataSource === 'database' ? 'bg-green-100 text-green-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {progress.dataSource === 'internet' ? '🌐 Internet' :
                 progress.dataSource === 'database' ? '💾 Database' :
                 '⚡ Cache'}
              </span>
            </div>
          )}
          
          {progress.confidence !== undefined && (
            <div className="flex items-center gap-1">
              <span className="font-medium">Confidence:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                progress.confidence >= 80 ? 'bg-green-100 text-green-800' :
                progress.confidence >= 60 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {progress.confidence}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {progress.stage === 'error' && progress.error && (
        <div className="mb-3 p-3 bg-red-100 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{progress.error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {progress.stage === 'market_search' && '🔍 Searching Google for market prices...'}
          {progress.stage === 'ai_processing' && '🤖 AI analyzing photos with market data...'}
          {progress.stage === 'part_search' && '🔧 Finding part prices for salvage calculation...'}
          {progress.stage === 'complete' && '✅ Search completed successfully'}
          {progress.stage === 'error' && '❌ Search failed - using fallback data'}
        </div>
        
        <div className="flex items-center gap-2">
          {progress.stage !== 'complete' && progress.stage !== 'error' && onCancel && (
            <button
              onClick={onCancel}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          )}
          
          {progress.stage === 'error' && onRetry && (
            <button
              onClick={onRetry}
              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-100 transition-colors font-medium"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Timeout Warning */}
      {timeElapsed > 10 && progress.stage !== 'complete' && progress.stage !== 'error' && (
        <div className="mt-3 p-2 bg-yellow-100 border border-yellow-200 rounded text-xs text-yellow-800">
          ⚠️ Search is taking longer than expected. This may be due to network conditions.
        </div>
      )}
    </div>
  );
}

/**
 * Hook for managing search progress state
 */
export function useSearchProgress() {
  const [progress, setProgress] = useState<SearchProgress>({
    stage: 'idle',
    message: '',
  });

  const updateProgress = (update: Partial<SearchProgress>) => {
    setProgress(prev => ({ ...prev, ...update }));
  };

  const startMarketSearch = (query: string) => {
    updateProgress({
      stage: 'market_search',
      message: 'Searching for market prices...',
      searchQuery: query,
      progress: 0,
    });
  };

  const startAIProcessing = () => {
    updateProgress({
      stage: 'ai_processing',
      message: 'AI analyzing photos with market data...',
      progress: 0,
    });
  };

  const startPartSearch = (partCount: number) => {
    updateProgress({
      stage: 'part_search',
      message: `Searching prices for ${partCount} damaged parts...`,
      progress: 0,
    });
  };

  const setComplete = (confidence?: number, dataSource?: 'internet' | 'database' | 'cache') => {
    updateProgress({
      stage: 'complete',
      message: 'Search completed successfully',
      progress: 100,
      confidence,
      dataSource,
    });
  };

  const setError = (error: string) => {
    updateProgress({
      stage: 'error',
      message: 'Search failed',
      error,
    });
  };

  const reset = () => {
    setProgress({
      stage: 'idle',
      message: '',
    });
  };

  return {
    progress,
    updateProgress,
    startMarketSearch,
    startAIProcessing,
    startPartSearch,
    setComplete,
    setError,
    reset,
  };
}