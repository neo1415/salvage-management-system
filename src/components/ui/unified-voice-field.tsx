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
 * Comprehensive filler words list for professional transcription cleanup
 * 
 * Based on research from professional transcription services and linguistic studies.
 * This list focuses on words that are ALWAYS fillers (hesitations, verbal tics, discourse markers)
 * and excludes words that can be meaningful in context (like "really", "totally" when used for emphasis).
 * 
 * Categories:
 * - Hesitation sounds (um, uh, er, ah, hmm) - ALWAYS remove
 * - Verbal tics (like, you know, i mean) - ALWAYS remove when used as fillers
 * - Discourse markers (okay, so, well) - ALWAYS remove when used as fillers
 * - Agreement sounds (yeah, yep, uh huh) - ALWAYS remove
 * - Thinking pauses (let me see, you see) - ALWAYS remove
 * - Vague expressions (or something, whatnot) - ALWAYS remove
 * 
 * Sources: FluentU, ResearchGate, Speechpad, professional transcription style guides
 */
const FILLER_WORDS = [
  // Hesitation sounds (most common) - ALWAYS fillers
  'um', 'uh', 'uhm', 'umm', 'er', 'erm', 'ah', 'ahh', 'hmm', 'hm', 'mhm',
  
  // Verbal tics and pause fillers - ALWAYS fillers
  'like', 'you know', 'i mean', 'you know what i mean', 'if you know what i mean',
  
  // Hedge words (uncertainty markers) - ALWAYS fillers
  'sort of', 'kind of', 'kinda', 'sorta', 'basically', 'more or less',
  
  // Discourse markers (conversation flow) - ALWAYS fillers
  'okay', 'ok', 'so', 'well', 'now', 'right', 'alright', 'all right',
  
  // Agreement and acknowledgment sounds - ALWAYS fillers
  'yeah', 'yep', 'yup', 'uh huh', 'mm hmm', 'mmm', 'mhmm',
  
  // Thinking and stalling phrases - ALWAYS fillers
  'let me see', 'let me think', 'lets see', 'you see', 'i guess', 'i suppose',
  
  // Vague expressions - ALWAYS fillers
  'or something', 'or something like that', 'and stuff', 'and things',
  'and all that', 'or whatever', 'whatnot', 'and so on', 'and so forth',
  'et cetera', 'etc',
  
  // Filler phrases (common in casual speech) - ALWAYS fillers
  'at the end of the day', 'believe me', 'trust me', 'to be honest',
  'to tell you the truth', 'as a matter of fact', 'the thing is',
  'the fact of the matter is', 'you know what', 'i mean to say',
  
  // Informal contractions (clean up to formal) - ALWAYS fillers
  'gonna', 'wanna', 'gotta', 'dunno', 'lemme', 'gimme',
  'coulda', 'shoulda', 'woulda', 'hafta', 'oughta',
  
  // Repetitive acknowledgments - ALWAYS fillers
  'oh well', 'oh yeah', 'oh okay', 'oh right', 'oh sure',
  
  // Sentence starters (often unnecessary) - ALWAYS fillers
  'look', 'listen', 'hey', 'man', 'dude', 'guys',
  
  // Thinking sounds - ALWAYS fillers
  'ehh', 'eeh',
  
  // False starts and corrections (common patterns) - ALWAYS fillers
  'i mean like', 'like i said', 'as i said', 'like i mean',
  'you know like', 'i mean you know',
  
  // Note: Words like "basically", "actually", "literally", "seriously", "honestly",
  // "clearly", "obviously", "definitely", "certainly", "absolutely", "really",
  // "very", "quite", "totally", "pretty much" are NOT included because they can
  // be meaningful in context (e.g., "really bad", "totally damaged", "very severe")
];

/**
 * Remove filler words from transcription text
 * 
 * This function removes common filler words and phrases to create
 * cleaner, more professional transcriptions. It handles:
 * - Single-word fillers (um, uh, like)
 * - Multi-word phrases (you know, i mean, sort of)
 * - Case-insensitive matching
 * - Proper cleanup of extra spaces and punctuation
 * - Sentence capitalization
 */
const removeFillerWords = (text: string): string => {
  let cleaned = text;
  
  // Sort filler words by length (longest first) to handle multi-word phrases correctly
  // This prevents "you know what i mean" from being partially matched as "you know"
  const sortedFillers = [...FILLER_WORDS].sort((a, b) => b.length - a.length);
  
  // Create regex pattern for each filler word (case-insensitive, word boundaries)
  sortedFillers.forEach(filler => {
    // Escape special regex characters in the filler word
    const escapedFiller = filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match the filler with optional surrounding punctuation and spaces
    const pattern = new RegExp(`[,\\s]*\\b${escapedFiller}\\b[,\\s]*`, 'gi');
    cleaned = cleaned.replace(pattern, ' ');
  });
  
  // Cleanup punctuation and spacing issues
  cleaned = cleaned
    .replace(/\s+/g, ' ') // Multiple spaces to single space
    .replace(/\s*,\s*,\s*/g, ' ') // Remove double commas with spaces
    .replace(/,\s*,/g, ' ') // Remove double commas
    .replace(/\s*,\s*/g, ' ') // Remove all commas (they're likely orphaned after filler removal)
    .replace(/\s+([.!?])/g, '$1') // Remove space before sentence-ending punctuation
    .replace(/([.!?])\s*([.!?])/g, '$1') // Remove duplicate punctuation
    .replace(/\s+$/gm, '') // Remove trailing spaces on each line
    .trim();
  
  // Capitalize first letter of each sentence
  cleaned = cleaned.replace(/(^|[.!?]\s+)([a-z])/g, (match, separator, letter) => {
    return separator + letter.toUpperCase();
  });
  
  // Capitalize the very first letter if it's lowercase
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  
  return cleaned;
};

/**
 * Hook for managing voice note content with unified field
 */
export const useUnifiedVoiceContent = (initialValue: string = '') => {
  const [content, setContent] = useState(initialValue);
  const [showTimestamps, setShowTimestamps] = useState(() => {
    // Load timestamp preference from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('voiceNoteTimestamps');
      return saved === 'true';
    }
    return false; // Default: timestamps OFF for cleaner reading
  });

  /**
   * Toggle timestamp display preference
   */
  const toggleTimestamps = useCallback(() => {
    setShowTimestamps(prev => {
      const newValue = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('voiceNoteTimestamps', String(newValue));
      }
      return newValue;
    });
  }, []);

  /**
   * Append new voice transcription to existing content
   * Returns the new content for immediate use
   */
  const appendVoiceNote = useCallback((transcription: string, addTimestamp?: boolean) => {
    const now = new Date();
    const useTimestamp = addTimestamp !== undefined ? addTimestamp : showTimestamps;
    const timestamp = useTimestamp ? now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    }) : '';
    
    let newContent = '';
    setContent(prev => {
      const delimiter = prev.trim() ? '\n\n' : '';
      const prefix = useTimestamp ? `[${timestamp}] ` : '';
      
      // Remove filler words for professional transcripts
      const cleanedTranscription = removeFillerWords(transcription.trim());
      
      // Ensure proper sentence capitalization
      const capitalizedTranscription = cleanedTranscription.charAt(0).toUpperCase() + cleanedTranscription.slice(1);
      
      newContent = `${prev}${delimiter}${prefix}${capitalizedTranscription}`;
      return newContent;
    });
    
    return newContent;
  }, [showTimestamps]);

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
    showTimestamps,
    toggleTimestamps,
    wordCount: content.trim().split(/\s+/).filter(word => word.length > 0).length,
    characterCount: content.length,
  };
};

export default UnifiedVoiceField;