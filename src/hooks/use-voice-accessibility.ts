/**
 * Voice Accessibility Hook
 * 
 * Comprehensive accessibility support for voice note components
 * Manages ARIA attributes, screen reader announcements, and keyboard navigation
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  voiceAnnouncementManager,
  announceVoiceStateChange,
  getVoiceAccessibilityProps,
  initializeVoiceAccessibility,
  cleanupVoiceAccessibility,
  type VoiceAccessibilityState,
} from '../lib/accessibility/voice-accessibility';

interface UseVoiceAccessibilityOptions {
  componentType: 'recordButton' | 'pauseButton' | 'textArea' | 'transcriptionOverlay' | 'audioVisualizer';
  autoInitialize?: boolean;
  announceStateChanges?: boolean;
}

interface UseVoiceAccessibilityReturn {
  // Accessibility props to spread on component
  accessibilityProps: Record<string, any>;
  
  // State management
  updateState: (newState: Partial<VoiceAccessibilityState>) => void;
  
  // Manual announcement methods
  announce: (message: string, priority?: 'polite' | 'assertive', delay?: number) => void;
  
  // Keyboard event handlers
  handleKeyDown: (event: React.KeyboardEvent) => boolean; // Returns true if event was handled
  
  // Focus management
  focusElement: () => void;
  isFocused: boolean;
}

/**
 * Hook for managing voice component accessibility
 */
export function useVoiceAccessibility(
  options: UseVoiceAccessibilityOptions
): UseVoiceAccessibilityReturn {
  const { componentType, autoInitialize = true, announceStateChanges = true } = options;
  
  const elementRef = useRef<HTMLElement>(null);
  const [currentState, setCurrentState] = useState<Partial<VoiceAccessibilityState>>({});
  const [isFocused, setIsFocused] = useState(false);
  const previousStateRef = useRef<Partial<VoiceAccessibilityState>>({});

  /**
   * Initialize accessibility system
   */
  useEffect(() => {
    if (autoInitialize) {
      initializeVoiceAccessibility();
    }

    return () => {
      if (autoInitialize) {
        cleanupVoiceAccessibility();
      }
    };
  }, [autoInitialize]);

  /**
   * Update accessibility state and announce changes
   */
  const updateState = useCallback((newState: Partial<VoiceAccessibilityState>) => {
    setCurrentState(prevState => {
      const updatedState = { ...prevState, ...newState };
      
      // Announce state changes if enabled (using ref to avoid dependency)
      if (announceStateChanges) {
        announceVoiceStateChange(previousStateRef.current, updatedState);
      }
      
      // Update previous state reference
      previousStateRef.current = updatedState;
      
      return updatedState;
    });
  }, []); // Remove announceStateChanges from dependencies to prevent infinite loop

  /**
   * Manual announcement method
   */
  const announce = useCallback((
    message: string, 
    priority: 'polite' | 'assertive' = 'polite', 
    delay: number = 0
  ) => {
    voiceAnnouncementManager.announce(message, priority, delay);
  }, []);

  /**
   * Handle keyboard events for accessibility
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent): boolean => {
    const { key, code, ctrlKey, metaKey, shiftKey, altKey } = event;
    
    // Handle component-specific keyboard shortcuts
    switch (componentType) {
      case 'recordButton':
        // Space key to start/stop recording
        if (code === 'Space' && !ctrlKey && !metaKey && !shiftKey && !altKey) {
          event.preventDefault();
          return true; // Indicate that the event was handled
        }
        
        // Enter key to start/stop recording
        if (code === 'Enter' && !ctrlKey && !metaKey && !shiftKey && !altKey) {
          event.preventDefault();
          return true;
        }
        
        // Ctrl+Enter for new recording
        if (code === 'Enter' && (ctrlKey || metaKey) && !shiftKey && !altKey) {
          event.preventDefault();
          return true;
        }
        break;

      case 'pauseButton':
        // Space or Enter to pause/resume
        if ((code === 'Space' || code === 'Enter') && !ctrlKey && !metaKey && !shiftKey && !altKey) {
          event.preventDefault();
          return true;
        }
        break;

      case 'textArea':
        // Ctrl+Enter for new recording from text area
        if (code === 'Enter' && (ctrlKey || metaKey) && !shiftKey && !altKey) {
          event.preventDefault();
          return true;
        }
        break;
    }

    // Global shortcuts (handled regardless of component type)
    
    // Escape to stop recording (global when recording)
    if (code === 'Escape' && currentState.isRecording) {
      event.preventDefault();
      return true;
    }

    return false; // Event was not handled
  }, [componentType, currentState.isRecording]);

  /**
   * Focus management
   */
  const focusElement = useCallback(() => {
    if (elementRef.current) {
      elementRef.current.focus();
    }
  }, []);

  /**
   * Handle focus events
   */
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  /**
   * Generate accessibility props based on current state
   */
  const accessibilityProps = {
    ...getVoiceAccessibilityProps(componentType, currentState),
    ref: elementRef,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
  };

  return {
    accessibilityProps,
    updateState,
    announce,
    handleKeyDown,
    focusElement,
    isFocused,
  };
}

/**
 * Hook for managing global voice accessibility shortcuts
 */
export function useGlobalVoiceShortcuts(handlers: {
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onPauseRecording?: () => void;
  onResumeRecording?: () => void;
}) {
  const { onStartRecording, onStopRecording, onPauseRecording, onResumeRecording } = handlers;
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const { code, ctrlKey, metaKey, shiftKey, altKey } = event;

      // Escape to stop recording (global when recording)
      if (code === 'Escape' && isRecording && onStopRecording) {
        event.preventDefault();
        onStopRecording();
        return;
      }

      // Ctrl+Enter for new recording (global)
      if (code === 'Enter' && (ctrlKey || metaKey) && !shiftKey && !altKey && onStartRecording) {
        event.preventDefault();
        if (!isRecording) {
          onStartRecording();
        }
        return;
      }

      // Ctrl+Space to pause/resume (global when recording)
      if (code === 'Space' && (ctrlKey || metaKey) && !shiftKey && !altKey && isRecording) {
        event.preventDefault();
        if (isPaused && onResumeRecording) {
          onResumeRecording();
        } else if (!isPaused && onPauseRecording) {
          onPauseRecording();
        }
        return;
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isRecording, isPaused, onStartRecording, onStopRecording, onPauseRecording, onResumeRecording]);

  return {
    setIsRecording,
    setIsPaused,
  };
}

/**
 * Hook for managing character count accessibility announcements
 */
export function useCharacterCountAccessibility(
  characterCount: number,
  maxLength: number,
  enabled: boolean = true
) {
  const previousCountRef = useRef(characterCount);
  const hasAnnouncedWarning = useRef(false);
  const hasAnnouncedLimit = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const previousCount = previousCountRef.current;
    const isNearLimit = characterCount > maxLength * 0.8;
    const isAtLimit = characterCount >= maxLength;

    // Announce when approaching limit (only once)
    if (isNearLimit && !isAtLimit && !hasAnnouncedWarning.current) {
      voiceAnnouncementManager.announce(
        `Approaching character limit. ${maxLength - characterCount} characters remaining.`,
        'polite'
      );
      hasAnnouncedWarning.current = true;
    }

    // Announce when limit is reached (only once)
    if (isAtLimit && !hasAnnouncedLimit.current) {
      voiceAnnouncementManager.announce(
        'Character limit reached. Cannot add more text.',
        'assertive'
      );
      hasAnnouncedLimit.current = true;
    }

    // Reset flags when count decreases significantly
    if (characterCount < maxLength * 0.7) {
      hasAnnouncedWarning.current = false;
      hasAnnouncedLimit.current = false;
    }

    previousCountRef.current = characterCount;
  }, [characterCount, maxLength, enabled]);
}

/**
 * Hook for managing transcription accessibility
 */
export function useTranscriptionAccessibility(
  transcriptionText: string,
  confidence: number,
  isVisible: boolean
) {
  const previousTextRef = useRef('');
  const previousConfidenceRef = useRef(0);

  useEffect(() => {
    if (!isVisible) return;

    const previousText = previousTextRef.current;
    const previousConfidence = previousConfidenceRef.current;

    // Announce new transcription text (debounced)
    if (transcriptionText && transcriptionText !== previousText) {
      const timeoutId = setTimeout(() => {
        if (transcriptionText.length > 10) { // Only announce substantial text
          voiceAnnouncementManager.announce(
            `Transcribing: ${transcriptionText}`,
            'polite'
          );
        }
      }, 1000); // Debounce to avoid too many announcements

      return () => clearTimeout(timeoutId);
    }

    // Announce low confidence warnings
    if (confidence < 0.5 && confidence !== previousConfidence && transcriptionText) {
      voiceAnnouncementManager.announce(
        'Low transcription confidence. You may need to speak more clearly.',
        'polite'
      );
    }

    previousTextRef.current = transcriptionText;
    previousConfidenceRef.current = confidence;
  }, [transcriptionText, confidence, isVisible]);
}