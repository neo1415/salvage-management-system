'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { 
  VoiceError, 
  BrowserCompatibilityChecker, 
  PermissionManager,
  type VoiceErrorType 
} from '../../lib/voice/error-handling';

interface VoiceErrorRecoveryProps {
  error: VoiceError | null;
  onRetry?: () => void;
  onFallback?: () => void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * VoiceErrorRecovery Component
 * 
 * Contextual error messages with recovery actions for voice recognition failures.
 * Provides graceful degradation and user-friendly guidance for different error types.
 * 
 * Features:
 * - Contextual error messages based on error type
 * - Browser-specific guidance and recommendations
 * - Automatic retry mechanisms with exponential backoff
 * - Manual text input fallback options
 * - Permission request assistance
 * - Network status awareness
 */
export const VoiceErrorRecovery: React.FC<VoiceErrorRecoveryProps> = ({
  error,
  onRetry,
  onFallback,
  onDismiss,
  className,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionState>('prompt');

  /**
   * Check permission status on mount and when error changes
   */
  useEffect(() => {
    if (error?.type === 'permission-denied') {
      PermissionManager.checkMicrophonePermission().then(setPermissionStatus);
    }
  }, [error]);

  /**
   * Handle retry with loading state
   */
  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;
    
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  /**
   * Handle permission request
   */
  const handleRequestPermission = async () => {
    setIsRetrying(true);
    try {
      const granted = await PermissionManager.requestMicrophonePermission();
      if (granted) {
        setPermissionStatus('granted');
        await handleRetry();
      } else {
        setPermissionStatus('denied');
      }
    } finally {
      setIsRetrying(false);
    }
  };

  /**
   * Get error icon based on error type
   */
  const getErrorIcon = (errorType: VoiceErrorType) => {
    switch (errorType) {
      case 'permission-denied':
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z"/>
            <path d="M11.5 16.5L9 14l1.5-1.5L12 14l3.5-3.5L17 12l-5 5z"/>
          </svg>
        );
      case 'not-supported':
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        );
      case 'network-error':
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/>
          </svg>
        );
      case 'no-speech':
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        );
    }
  };

  /**
   * Get contextual help based on error type
   */
  const getContextualHelp = (errorType: VoiceErrorType) => {
    const browserInfo = BrowserCompatibilityChecker.getBrowserInfo();
    const permissionInstructions = PermissionManager.getPermissionInstructions();

    switch (errorType) {
      case 'permission-denied':
        return {
          title: 'Enable Microphone Access',
          steps: permissionInstructions[browserInfo.name.toLowerCase() as keyof typeof permissionInstructions] || permissionInstructions.general,
          tips: [
            'Make sure your microphone is connected and working',
            'Check if other applications are using your microphone',
            'Try refreshing the page after granting permission',
          ],
        };
      case 'not-supported':
        return {
          title: 'Browser Compatibility',
          steps: [
            'Use Google Chrome for best voice recognition support',
            'Update your browser to the latest version',
            'Enable JavaScript if disabled',
          ],
          tips: browserInfo.recommendations,
        };
      case 'network-error':
        return {
          title: 'Network Connection Required',
          steps: [
            'Check your internet connection',
            'Try switching to a different network',
            'Wait for connection to restore and try again',
          ],
          tips: [
            'Voice recognition requires an active internet connection',
            'Your voice notes will be saved locally and processed when online',
          ],
        };
      case 'no-speech':
        return {
          title: 'Improve Voice Recognition',
          steps: [
            'Speak clearly and at a normal pace',
            'Move closer to your microphone',
            'Reduce background noise',
          ],
          tips: [
            'Try speaking in shorter sentences',
            'Ensure your microphone is not muted',
            'Check microphone sensitivity settings',
          ],
        };
      default:
        return {
          title: 'Troubleshooting',
          steps: [
            'Try refreshing the page',
            'Check your browser settings',
            'Use manual text input as alternative',
          ],
          tips: [
            'Voice recognition may have temporary issues',
            'Manual text input is always available',
          ],
        };
    }
  };

  if (!error) return null;

  const contextualHelp = getContextualHelp(error.type);
  const isPermissionError = error.type === 'permission-denied';
  const canRetry = error.recoverable && onRetry;

  return (
    <div
      className={cn(
        'voice-error-recovery bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-w-md mx-auto',
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      {/* Error header */}
      <div className="flex items-start space-x-4 mb-4">
        <div className={cn(
          'flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center',
          error.type === 'permission-denied' && 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400',
          error.type === 'not-supported' && 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400',
          error.type === 'network-error' && 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
          error.type === 'no-speech' && 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
          !['permission-denied', 'not-supported', 'network-error', 'no-speech'].includes(error.type) && 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
        )}>
          {getErrorIcon(error.type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Voice Recording Issue
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {error.userMessage}
          </p>
        </div>

        {/* Dismiss button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors duration-200"
            aria-label="Dismiss error"
          >
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Permission request button for permission errors */}
        {isPermissionError && permissionStatus !== 'granted' && (
          <button
            onClick={handleRequestPermission}
            disabled={isRetrying}
            className={cn(
              'flex-1 px-4 py-2 rounded-xl font-medium transition-all duration-200',
              'bg-[#800020] text-white hover:bg-[#a0002a] focus:ring-4 focus:ring-[#800020]/30',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center space-x-2'
            )}
          >
            {isRetrying ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Requesting...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                <span>Enable Microphone</span>
              </>
            )}
          </button>
        )}

        {/* Retry button */}
        {canRetry && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className={cn(
              'flex-1 px-4 py-2 rounded-xl font-medium transition-all duration-200',
              'bg-blue-600 text-white hover:bg-blue-700 focus:ring-4 focus:ring-blue-600/30',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center space-x-2'
            )}
          >
            {isRetrying ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Retrying...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                <span>Try Again</span>
              </>
            )}
          </button>
        )}

        {/* Fallback button */}
        {onFallback && (
          <button
            onClick={onFallback}
            className={cn(
              'flex-1 px-4 py-2 rounded-xl font-medium transition-all duration-200',
              'bg-gray-600 text-white hover:bg-gray-700 focus:ring-4 focus:ring-gray-600/30',
              'flex items-center justify-center space-x-2'
            )}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span>Type Instead</span>
          </button>
        )}
      </div>

      {/* Expandable help section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors duration-200"
        >
          <span>{contextualHelp.title}</span>
          <svg
            className={cn(
              'w-4 h-4 transition-transform duration-200',
              showDetails && 'rotate-180'
            )}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {showDetails && (
          <div className="mt-3 space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Steps to resolve:</h4>
              <ol className="list-decimal list-inside space-y-1">
                {contextualHelp.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>

            {contextualHelp.tips.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Tips:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {contextualHelp.tips.map((tip, index) => (
                    <li key={index}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error metadata for debugging (only in development) */}
      {process.env.NODE_ENV === 'development' && error.metadata && (
        <details className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          <summary className="cursor-pointer">Debug Info</summary>
          <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-auto">
            {JSON.stringify(error.metadata, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
};

export default VoiceErrorRecovery;