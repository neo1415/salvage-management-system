'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { useVoiceAccessibility } from '../../hooks/use-voice-accessibility';
import { getFocusRingStyles, prefersReducedMotion } from '../../lib/accessibility/voice-accessibility';

interface VoiceControlsProps {
  isRecording: boolean;
  isPaused?: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPauseRecording?: () => void;
  onResumeRecording?: () => void;
  audioLevel?: number;
  duration?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * ModernVoiceControls Component
 * 
 * Mobile-first voice recording interface with enhanced visual feedback,
 * real-time audio visualization, and modern 2026 design patterns.
 * 
 * Features:
 * - Circular recording button with pulsing animation
 * - Real-time audio level visualization
 * - Recording duration display with modern typography
 * - Pause/resume functionality with clear visual states
 * - Touch-optimized controls for mobile devices
 * - Accessibility support with ARIA labels and announcements
 */
export const ModernVoiceControls: React.FC<VoiceControlsProps> = ({
  isRecording,
  isPaused = false,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
  audioLevel = 0,
  duration = 0,
  disabled = false,
  className,
}) => {
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = prefersReducedMotion();

  // Enhanced accessibility support
  const recordButtonAccessibility = useVoiceAccessibility({
    componentType: 'recordButton',
    autoInitialize: true,
    announceStateChanges: true,
  });

  // Update accessibility state when props change
  useEffect(() => {
    recordButtonAccessibility.updateState({
      isRecording,
      isPaused,
      duration,
      error: disabled ? 'Voice recording disabled' : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, isPaused, duration, disabled]); // Removed recordButtonAccessibility to prevent infinite loop

  /**
   * Format duration in MM:SS format
   */
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Handle button click - mobile-first approach without keyboard shortcuts
   */
  const handleButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    // CRITICAL: Prevent form submission when inside a form
    event.preventDefault();
    event.stopPropagation();
    
    if (isRecording) {
      onStopRecording();
    } else {
      onStartRecording();
    }
  };

  /**
   * Handle pause/resume functionality for mobile users
   */
  const handlePauseResumeClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    // CRITICAL: Prevent form submission when inside a form
    event.preventDefault();
    event.stopPropagation();
    
    if (isPaused && onResumeRecording) {
      onResumeRecording();
    } else if (!isPaused && onPauseRecording) {
      onPauseRecording();
    }
  };

  /**
   * Get button content based on state
   */
  const getButtonContent = () => {
    if (isRecording && isPaused) {
      return (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      );
    }
    
    if (isRecording) {
      return (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      );
    }
    
    return (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
        <path d="M12 18v4" />
        <path d="M8 22h8" />
      </svg>
    );
  };

  return (
    <div className={cn('modern-voice-controls flex flex-col items-center space-y-4', className)}>
      {/* Enhanced recording duration display with modern typography */}
      {(isRecording || duration > 0) && (
        <div className="flex items-center justify-center space-x-4 px-6 py-3 bg-gradient-to-r from-gray-50/80 to-white/80 dark:from-gray-800/80 dark:to-gray-700/80 rounded-2xl backdrop-blur-sm border border-gray-200/50 dark:border-gray-600/50 shadow-lg">
          <div className="text-3xl font-mono font-black tracking-wider text-gray-900 dark:text-gray-100 tabular-nums">
            {formatDuration(duration)}
          </div>
          {isRecording && (
            <div className="flex items-center space-x-2">
              <div className={cn(
                "w-3 h-3 rounded-full transition-all duration-300",
                isPaused ? "bg-yellow-500 animate-pulse" : "bg-red-500 animate-pulse shadow-lg shadow-red-500/50"
              )} />
              <span className={cn(
                "text-sm font-bold tracking-wide uppercase",
                isPaused ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"
              )}>
                {isPaused ? 'PAUSED' : 'RECORDING'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Enhanced audio level visualization with modern design */}
      {isRecording && !isPaused && (
        <div 
          className="audio-visualizer flex items-center justify-center space-x-1 h-10 px-4 py-2 bg-black/5 dark:bg-white/5 rounded-2xl backdrop-blur-sm"
          {...recordButtonAccessibility.accessibilityProps}
          role="img"
          aria-label="Audio level indicator"
          aria-describedby="audio-visualizer-description"
        >
          {Array.from({ length: 16 }, (_, i) => (
            <div
              key={i}
              className="audio-bar bg-gradient-to-t from-[#800020] via-red-400 to-pink-300 rounded-full transition-all duration-75 ease-out shadow-sm"
              style={{
                width: '2.5px',
                height: `${Math.max(3, Math.min(36, (audioLevel * 40 * (1 + Math.sin(i * 0.4 + Date.now() * 0.001) * 0.4))))}px`,
                opacity: audioLevel > 0.05 ? Math.max(0.4, audioLevel) : 0.2,
                transform: `scaleY(${Math.max(0.3, audioLevel * (1 + Math.sin(i * 0.3) * 0.2))})`,
              }}
            />
          ))}
        </div>
      )}

      {/* Main recording button */}
      <div className="relative">
        <button
          type="button"
          ref={buttonRef}
          onClick={handleButtonClick}
          onFocus={() => setKeyboardFocused(true)}
          onBlur={() => setKeyboardFocused(false)}
          disabled={disabled}
          {...recordButtonAccessibility.accessibilityProps}
          className={cn(
            // Enhanced button styles with modern 2026 design
            'relative flex items-center justify-center',
            'w-20 h-20 rounded-full border-none cursor-pointer',
            'transition-all duration-300 ease-out transform-gpu',
            getFocusRingStyles(),
            'backdrop-blur-sm',
            
            // Enhanced background gradient and shadow
            'bg-gradient-to-br shadow-2xl',
            
            // State-specific styling with enhanced effects
            isRecording ? [
              'from-red-500 via-red-600 to-red-700 text-white',
              'shadow-red-500/40 hover:shadow-red-500/60',
              !reducedMotion && 'animate-pulse scale-110',
              'ring-4 ring-red-400/30',
            ] : [
              'from-[#800020] via-[#a0002a] to-[#c0003a] text-white',
              'shadow-[#800020]/40 hover:shadow-[#800020]/60',
              !reducedMotion && 'hover:scale-110 active:scale-105',
              !reducedMotion && 'hover:rotate-3 active:rotate-1',
            ],
            
            // Disabled state
            disabled && [
              'opacity-50 cursor-not-allowed',
              'hover:scale-100 active:scale-100 hover:rotate-0',
            ],
            
            // Enhanced keyboard focus state with better visibility
            (keyboardFocused || recordButtonAccessibility.isFocused) && [
              'ring-4 ring-[#800020]/50 ring-offset-4 ring-offset-white dark:ring-offset-gray-900',
              'shadow-2xl shadow-[#800020]/30',
              'scale-105'
            ],
          )}
        >
          <div className="relative z-10">
            {getButtonContent()}
          </div>
          
          {/* Enhanced ripple effect on click */}
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-white/30 rounded-full scale-0 animate-ping opacity-75" />
          </div>
          
          {/* Glassmorphism overlay */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-white/10 to-white/20" />
        </button>

        {/* Enhanced recording state indicator ring */}
        {isRecording && (
          <>
            <div className="absolute inset-0 rounded-full border-4 border-red-400/60 animate-ping" />
            <div className="absolute -inset-2 rounded-full border-2 border-red-300/40 animate-pulse" />
          </>
        )}
      </div>

      {/* Pause/Resume button for mobile-first design */}
      {isRecording && (
        <button
          type="button"
          onClick={handlePauseResumeClick}
          disabled={disabled || (!onPauseRecording && !onResumeRecording)}
          className={cn(
            'flex items-center justify-center',
            'w-16 h-16 rounded-full border-2 transition-all duration-300 ease-out',
            'backdrop-blur-sm shadow-lg hover:shadow-xl',
            getFocusRingStyles(),
            
            // Enhanced styling based on state
            isPaused ? [
              'border-green-400 bg-gradient-to-br from-green-50 to-green-100',
              'text-green-700 hover:from-green-100 hover:to-green-200',
              'hover:scale-110 hover:border-green-500',
            ] : [
              'border-yellow-400 bg-gradient-to-br from-yellow-50 to-yellow-100',
              'text-yellow-700 hover:from-yellow-100 hover:to-yellow-200',
              'hover:scale-110 hover:border-yellow-500',
            ],
            
            disabled && 'opacity-50 cursor-not-allowed hover:scale-100'
          )}
          aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
        >
          {isPaused ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          )}
        </button>
      )}

      {/* Screen reader announcements - Enhanced with live region for mobile */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="voice-status-live-region"
      >
        {isRecording && !isPaused && `Recording in progress. Duration: ${formatDuration(duration)}. Tap stop button to finish.`}
        {isRecording && isPaused && 'Recording paused. Tap resume button to continue or stop button to finish.'}
        {!isRecording && duration > 0 && 'Recording stopped. Tap record button to start new recording.'}
        {!isRecording && duration === 0 && (keyboardFocused || recordButtonAccessibility.isFocused) && 'Voice recording ready. Tap record button to start recording.'}
      </div>

      {/* Hidden descriptions for screen readers */}
      <div id="audio-visualizer-description" className="sr-only">
        Visual representation of current audio input level during recording
      </div>
    </div>
  );
};

export default ModernVoiceControls;