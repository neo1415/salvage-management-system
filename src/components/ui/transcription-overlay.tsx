'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { useVoiceAccessibility, useTranscriptionAccessibility } from '../../hooks/use-voice-accessibility';
import { prefersReducedMotion } from '../../lib/accessibility/voice-accessibility';

interface TranscriptionOverlayProps {
  interimText: string;
  finalText: string;
  confidence: number;
  isVisible: boolean;
  position?: 'top' | 'bottom' | 'floating';
  className?: string;
  onClose?: () => void;
}

/**
 * TranscriptionOverlay Component
 * 
 * Real-time transcription feedback with modern glassmorphism design.
 * Shows live transcription with confidence indicators and smooth animations.
 * 
 * Features:
 * - Glassmorphism effect with backdrop blur
 * - Real-time text updates with smooth transitions
 * - Confidence indicators with color coding
 * - Auto-hide functionality after completion
 * - Accessibility support with screen reader announcements
 * - Reduced motion support for accessibility
 */
export const TranscriptionOverlay: React.FC<TranscriptionOverlayProps> = ({
  interimText,
  finalText,
  confidence,
  isVisible,
  position = 'floating',
  className,
  onClose,
}) => {
  const [shouldShow, setShouldShow] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reducedMotion = prefersReducedMotion();

  // Enhanced accessibility support
  const transcriptionAccessibility = useVoiceAccessibility({
    componentType: 'transcriptionOverlay',
    autoInitialize: false,
    announceStateChanges: false,
  });

  // Transcription accessibility announcements
  useTranscriptionAccessibility(
    interimText || finalText,
    confidence,
    isVisible && shouldShow
  );

  /**
   * Handle visibility changes with smooth animations
   */
  useEffect(() => {
    if (isVisible && (interimText || finalText)) {
      setShouldShow(true);
      setIsAnimating(true);
      
      // Clear any existing hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    } else if (!isVisible || (!interimText && !finalText)) {
      // Auto-hide after final text is complete
      if (finalText && !interimText) {
        hideTimeoutRef.current = setTimeout(() => {
          setIsAnimating(false);
          setTimeout(() => {
            setShouldShow(false);
            onClose?.();
          }, reducedMotion ? 0 : 300);
        }, 2000); // Show final text for 2 seconds
      } else {
        setIsAnimating(false);
        setTimeout(() => {
          setShouldShow(false);
        }, reducedMotion ? 0 : 300);
      }
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isVisible, interimText, finalText, onClose, reducedMotion]);

  /**
   * Get confidence color based on confidence level
   */
  const getConfidenceColor = (conf: number): string => {
    if (conf >= 0.8) return 'text-green-600 dark:text-green-400';
    if (conf >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
    if (conf >= 0.4) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  /**
   * Get confidence indicator
   */
  const getConfidenceIndicator = (conf: number): string => {
    if (conf >= 0.8) return '●●●●';
    if (conf >= 0.6) return '●●●○';
    if (conf >= 0.4) return '●●○○';
    return '●○○○';
  };

  /**
   * Get position-specific styles
   */
  const getPositionStyles = () => {
    switch (position) {
      case 'top':
        return 'top-4 left-1/2 transform -translate-x-1/2';
      case 'bottom':
        return 'bottom-4 left-1/2 transform -translate-x-1/2';
      case 'floating':
      default:
        return 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2';
    }
  };

  if (!shouldShow) return null;

  const displayText = interimText || finalText;
  const isInterim = !!interimText;

  return (
    <div
      className={cn(
        // Base positioning
        'fixed z-50 pointer-events-none',
        getPositionStyles(),
        
        // Animation and transition
        'transition-all duration-300 ease-out',
        isAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
        
        // Reduced motion support
        reducedMotion && 'transition-none',
        
        className
      )}
      {...transcriptionAccessibility.accessibilityProps}
    >
      <div
        className={cn(
          // Glassmorphism container
          'relative max-w-md mx-auto p-6 rounded-2xl',
          'bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl',
          'border border-white/20 dark:border-gray-700/20',
          'shadow-2xl shadow-black/10 dark:shadow-black/30',
          
          // Enhanced visual effects
          'ring-1 ring-black/5 dark:ring-white/5',
          
          // Subtle animation for interim text
          isInterim && !reducedMotion && 'animate-pulse',
        )}
      >
        {/* Confidence indicator */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              {isInterim ? 'Listening...' : 'Complete'}
            </span>
          </div>
          
          {/* Confidence level indicator */}
          <div className="flex items-center space-x-2">
            <span 
              className={cn(
                'text-xs font-mono',
                getConfidenceColor(confidence)
              )}
              title={`Confidence: ${Math.round(confidence * 100)}%`}
            >
              {getConfidenceIndicator(confidence)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {Math.round(confidence * 100)}%
            </span>
          </div>
        </div>

        {/* Transcription text */}
        <div className="relative">
          <p 
            className={cn(
              'text-base leading-relaxed',
              'text-gray-900 dark:text-gray-100',
              
              // Interim text styling
              isInterim && [
                'text-gray-700 dark:text-gray-300',
                'italic',
              ],
              
              // Final text styling
              !isInterim && [
                'font-medium',
              ],
              
              // Empty state
              !displayText && 'text-gray-500 dark:text-gray-400'
            )}
          >
            {displayText || 'Listening for speech...'}
          </p>
          
          {/* Typing indicator for interim text */}
          {isInterim && displayText && !reducedMotion && (
            <div className="absolute -bottom-1 right-0">
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          )}
        </div>

        {/* Word count and character info */}
        {displayText && (
          <div className="mt-4 pt-3 border-t border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                {displayText.split(' ').filter(word => word.length > 0).length} words
              </span>
              <span>
                {displayText.length} characters
              </span>
            </div>
          </div>
        )}

        {/* Close button for manual dismissal */}
        {onClose && (
          <button
            onClick={onClose}
            className={cn(
              'absolute -top-2 -right-2 w-6 h-6 rounded-full',
              'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600',
              'flex items-center justify-center transition-colors duration-200',
              'pointer-events-auto',
              'focus:outline-none focus:ring-2 focus:ring-[#800020]/30'
            )}
            aria-label="Close transcription overlay"
          >
            <svg className="w-3 h-3 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}

        {/* Glassmorphism overlay effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
      </div>

      {/* Hidden description for screen readers */}
      <div id="transcription-overlay-description" className="sr-only">
        Real-time transcription of your voice recording. Confidence level indicates accuracy of the transcription.
      </div>
    </div>
  );
};

export default TranscriptionOverlay;