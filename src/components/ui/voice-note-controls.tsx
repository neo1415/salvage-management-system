'use client';

import React, { useState } from 'react';
import { cn } from '../../lib/utils';

interface VoiceNoteControlsProps {
  content: string;
  onContentUpdate: (newContent: string) => void;
  showTimestamps: boolean;
  onToggleTimestamps: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * VoiceNoteControls Component
 * 
 * Provides controls for voice note management:
 * - Timestamp toggle
 * - AI cleanup button (post-processing with Gemini)
 */
export const VoiceNoteControls: React.FC<VoiceNoteControlsProps> = ({
  content,
  onContentUpdate,
  showTimestamps,
  onToggleTimestamps,
  disabled = false,
  className,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Clean up text using Gemini AI
   * - Adds proper punctuation
   * - Fixes capitalization
   * - Removes filler words
   * - Improves readability
   */
  const handleAICleanup = async () => {
    if (!content.trim()) {
      setError('No content to clean up');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/voice-notes/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: content }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clean up text');
      }

      const data = await response.json();
      onContentUpdate(data.cleanedText);
    } catch (err) {
      console.error('AI cleanup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to clean up text');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={cn('flex items-center gap-3 flex-wrap', className)}>
      {/* Timestamp Toggle */}
      <button
        type="button"
        onClick={onToggleTimestamps}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
          'border-2 focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:ring-offset-2',
          showTimestamps
            ? 'bg-[#800020] text-white border-[#800020] hover:bg-[#600018]'
            : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        aria-pressed={showTimestamps}
        aria-label={showTimestamps ? 'Hide timestamps' : 'Show timestamps'}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{showTimestamps ? 'Hide' : 'Show'} Timestamps</span>
      </button>

      {/* AI Cleanup Button */}
      <button
        type="button"
        onClick={handleAICleanup}
        disabled={disabled || isProcessing || !content.trim()}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
          'bg-gradient-to-r from-purple-600 to-blue-600 text-white',
          'border-2 border-transparent hover:from-purple-700 hover:to-blue-700',
          'focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:ring-offset-2',
          'shadow-md hover:shadow-lg transform hover:-translate-y-0.5',
          (disabled || isProcessing || !content.trim()) && 'opacity-50 cursor-not-allowed transform-none'
        )}
        aria-label="Clean up text with AI"
        aria-busy={isProcessing}
      >
        {isProcessing ? (
          <>
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Processing...</span>
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <span>Clean up with AI</span>
          </>
        )}
      </button>

      {/* Error Message */}
      {error && (
        <div className="w-full px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Help Text */}
      <div className="w-full text-xs text-gray-500">
        <span className="font-medium">Tip:</span> AI cleanup adds punctuation, fixes capitalization, and improves readability.
      </div>
    </div>
  );
};

export default VoiceNoteControls;
