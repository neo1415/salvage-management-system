'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { useVoiceAccessibility, useCharacterCountAccessibility } from '../../hooks/use-voice-accessibility';
import { getFocusRingStyles } from '../../lib/accessibility/voice-accessibility';

interface UnifiedVoiceFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  showCharacterCount?: boolean;
  autoResize?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

/**
 * UnifiedVoiceField Component
 * 
 * A modern, auto-expanding textarea that consolidates all voice transcriptions
 * into a single unified text field with contemporary styling and UX.
 * 
 * Features:
 * - Auto-expanding height based on content
 * - Character count with visual indicators
 * - Modern 2026 design with glassmorphism effects
 * - Smooth animations and transitions
 * - Full accessibility support
 * - Mobile-first responsive design
 */
export const UnifiedVoiceField: React.FC<UnifiedVoiceFieldProps> = ({
  value = '',
  onChange,
  placeholder = 'Voice notes will appear here...',
  disabled = false,
  maxLength = 5000,
  showCharacterCount = true,
  autoResize = true,
  className,
  'aria-label': ariaLabel = 'Voice notes text area',
  'aria-describedby': ariaDescribedBy,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  
  // Character count calculations
  const characterCount = value.length;
  const isNearLimit = characterCount > maxLength * 0.8;
  const isAtLimit = characterCount >= maxLength;

  // Enhanced accessibility support
  const textAreaAccessibility = useVoiceAccessibility({
    componentType: 'textArea',
    autoInitialize: false,
    announceStateChanges: false,
  });

  // Character count accessibility announcements
  useCharacterCountAccessibility(characterCount, maxLength, showCharacterCount);

  /**
   * Auto-resize textarea based on content
   */
  const adjustHeight = useCallback(() => {
    if (!autoResize || !textareaRef.current) return;
    
    const textarea = textareaRef.current;
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set height to scrollHeight with min/max constraints
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 120), 300);
    textarea.style.height = `${newHeight}px`;
  }, [autoResize]);

  /**
   * Handle text change with character limit enforcement
   */
  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.target.value;
    
    // Enforce character limit
    if (newValue.length <= maxLength) {
      onChange(newValue);
    }
  };

  /**
   * Handle focus events for visual feedback
   */
  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  /**
   * Handle keyboard events for accessibility
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const wasHandled = textAreaAccessibility.handleKeyDown(event);
    
    if (wasHandled && event.code === 'Enter' && (event.ctrlKey || event.metaKey)) {
      // Ctrl+Enter was pressed - this could trigger voice recording
      // The parent component should handle this
    }
  };

  /**
   * Auto-resize on value change
   */
  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  /**
   * Initial height adjustment on mount
   */
  useEffect(() => {
    adjustHeight();
  }, [adjustHeight]);

  return (
    <div className={cn('unified-voice-field-container', className)}>
      {/* Main textarea container with modern styling */}
      <div
        className={cn(
          // Base container styles with glassmorphism
          'relative overflow-hidden rounded-2xl transition-all duration-300 ease-out',
          'bg-gradient-to-br from-white/90 to-gray-50/90 backdrop-blur-sm',
          'border-2 border-transparent shadow-lg',
          
          // Focus state with brand color and enhanced shadow
          isFocused && [
            'border-[#800020]/30 shadow-xl shadow-[#800020]/10',
            'transform -translate-y-1 scale-[1.01]'
          ],
          
          // Disabled state
          disabled && 'opacity-60 cursor-not-allowed',
          
          // Dark mode support
          'dark:from-gray-800/90 dark:to-gray-900/90 dark:border-gray-600'
        )}
      >
        {/* Textarea element */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          {...textAreaAccessibility.accessibilityProps}
          aria-label={ariaLabel}
          aria-describedby={`${ariaDescribedBy || ''} voice-textarea-description character-count-status`.trim()}
          className={cn(
            // Base textarea styles
            'w-full resize-none border-none outline-none bg-transparent',
            'px-6 py-5 text-base leading-relaxed',
            
            // Typography with modern font stack
            'font-sans text-gray-900 placeholder-gray-500',
            
            // Smooth scrolling
            'overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent',
            
            // Minimum height
            autoResize ? 'min-h-[120px]' : 'h-32',
            
            // Disabled state
            disabled && 'cursor-not-allowed',
            
            // Dark mode text colors
            'dark:text-gray-100 dark:placeholder-gray-400'
          )}
          style={{
            // Ensure smooth resizing
            transition: autoResize ? 'height 0.2s ease-out' : undefined,
          }}
        />

        {/* Character count indicator */}
        {showCharacterCount && (
          <div className="absolute bottom-3 right-4 flex items-center space-x-2">
            <div
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200',
                'bg-white/80 backdrop-blur-sm border',
                
                // Color coding based on character count
                isAtLimit && 'border-red-300 text-red-700 bg-red-50/80',
                isNearLimit && !isAtLimit && 'border-yellow-300 text-yellow-700 bg-yellow-50/80',
                !isNearLimit && 'border-gray-300 text-gray-600 bg-gray-50/80'
              )}
            >
              {characterCount.toLocaleString()}/{maxLength.toLocaleString()}
            </div>
            
            {/* Visual indicator for character limit */}
            <div className="w-2 h-2 rounded-full transition-colors duration-200">
              <div
                className={cn(
                  'w-full h-full rounded-full transition-all duration-300',
                  isAtLimit && 'bg-red-500 animate-pulse',
                  isNearLimit && !isAtLimit && 'bg-yellow-500',
                  !isNearLimit && 'bg-green-500'
                )}
              />
            </div>
          </div>
        )}

        {/* Focus ring effect */}
        <div
          className={cn(
            'absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-300',
            'ring-2 ring-[#800020]/20 ring-offset-2 ring-offset-transparent',
            getFocusRingStyles().replace('focus:', ''),
            (isFocused || textAreaAccessibility.isFocused) ? 'opacity-100' : 'opacity-0'
          )}
        />
      </div>

      {/* Enhanced accessibility live regions */}
      <div
        id="voice-textarea-description"
        className="sr-only"
      >
        Combined text from all voice recordings. You can edit this text directly or add new recordings using the voice controls. Press Ctrl+Enter to start a new voice recording.
      </div>

      <div
        id="character-count-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {isAtLimit && 'Character limit reached. Cannot add more text.'}
        {isNearLimit && !isAtLimit && `Approaching character limit. ${maxLength - characterCount} characters remaining.`}
      </div>
    </div>
  );
};

/**
 * Hook for managing voice note content with unified field
 */
export const useUnifiedVoiceContent = (initialValue: string = '') => {
  const [content, setContent] = useState(initialValue);

  /**
   * Append new voice transcription to existing content
   * Returns the new content for immediate use
   */
  const appendVoiceNote = useCallback((transcription: string, addTimestamp: boolean = true) => {
    const now = new Date();
    const timestamp = addTimestamp ? now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    }) : '';
    
    let newContent = '';
    setContent(prev => {
      const delimiter = prev.trim() ? '\n\n' : '';
      const prefix = addTimestamp ? `[${timestamp}] ` : '';
      const cleanTranscription = transcription.trim();
      
      // Ensure proper sentence capitalization
      const capitalizedTranscription = cleanTranscription.charAt(0).toUpperCase() + cleanTranscription.slice(1);
      
      newContent = `${prev}${delimiter}${prefix}${capitalizedTranscription}`;
      return newContent;
    });
    
    return newContent;
  }, []);

  /**
   * Clear all voice content
   */
  const clearContent = useCallback(() => {
    setContent('');
  }, []);

  /**
   * Update content directly (for manual editing)
   */
  const updateContent = useCallback((newContent: string) => {
    setContent(newContent);
  }, []);

  return {
    content,
    appendVoiceNote,
    clearContent,
    updateContent,
    wordCount: content.trim().split(/\s+/).filter(word => word.length > 0).length,
    characterCount: content.length,
  };
};

export default UnifiedVoiceField;