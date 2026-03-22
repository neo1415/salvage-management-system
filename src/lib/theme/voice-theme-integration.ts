/**
 * Voice Theme Integration Utilities
 * 
 * Helper functions to integrate the modern theme system with voice components
 * Provides theme-aware styling and CSS variable integration
 */

import { ModernTheme, generateCSSVariables, getTheme, type ThemeMode } from './modern-theme';

/**
 * Voice-specific theme utilities
 */
export class VoiceThemeIntegration {
  private theme: ModernTheme;
  private cssVariables: Record<string, string>;

  constructor(mode: ThemeMode = 'auto') {
    this.theme = getTheme(mode);
    this.cssVariables = generateCSSVariables(this.theme);
  }

  /**
   * Get voice-specific color values
   */
  getVoiceColors() {
    return {
      recording: this.theme.colors.voice.recording,
      processing: this.theme.colors.voice.processing,
      success: this.theme.colors.voice.success,
      error: this.theme.colors.voice.error,
      idle: this.theme.colors.voice.idle,
      primary: this.theme.colors.primary,
      primaryHover: this.theme.colors.primaryHover,
      primaryActive: this.theme.colors.primaryActive,
    };
  }

  /**
   * Get voice component styling
   */
  getVoiceStyles() {
    return {
      // Recording button styles
      recordingButton: {
        backgroundColor: `var(--color-voice-recording, ${this.theme.colors.voice.recording})`,
        borderRadius: `var(--border-radius-full, ${this.theme.borderRadius.full})`,
        boxShadow: `var(--shadow-lg, ${this.theme.shadows.lg})`,
        transition: `all var(--animation-duration-normal, ${this.theme.animations.duration.normal}) var(--animation-easing-ease, ${this.theme.animations.easing.ease})`,
      },
      
      // Processing state styles
      processingButton: {
        backgroundColor: `var(--color-voice-processing, ${this.theme.colors.voice.processing})`,
        animation: `pulse var(--animation-duration-slow, ${this.theme.animations.duration.slow}) infinite`,
      },
      
      // Success state styles
      successButton: {
        backgroundColor: `var(--color-voice-success, ${this.theme.colors.voice.success})`,
      },
      
      // Error state styles
      errorButton: {
        backgroundColor: `var(--color-voice-error, ${this.theme.colors.voice.error})`,
      },
      
      // Idle state styles
      idleButton: {
        backgroundColor: `var(--color-voice-idle, ${this.theme.colors.voice.idle})`,
        color: `var(--color-text-primary, ${this.theme.colors.text.primary})`,
      },
      
      // Text styles
      duration: {
        fontFamily: `var(--font-family-mono, ${this.theme.typography.fontFamily.mono})`,
        fontSize: `var(--font-size-sm, ${this.theme.typography.fontSize.sm})`,
        fontWeight: `var(--font-weight-medium, ${this.theme.typography.fontWeight.medium})`,
        color: `var(--color-text-secondary, ${this.theme.colors.text.secondary})`,
      },
      
      // Container styles
      container: {
        padding: `var(--spacing-4, ${this.theme.spacing.scale[4]})`,
        borderRadius: `var(--border-radius-lg, ${this.theme.borderRadius.lg})`,
        backgroundColor: `var(--color-surface, ${this.theme.colors.surface})`,
        border: `1px solid var(--color-border-default, ${this.theme.colors.border.default})`,
      },
    };
  }

  /**
   * Generate CSS custom properties for voice components
   */
  generateVoiceCSSVariables(): string {
    const vars = Object.entries(this.cssVariables)
      .map(([key, value]) => `${key}: ${value};`)
      .join('\n  ');
    
    return `:root {\n  ${vars}\n}`;
  }

  /**
   * Apply theme to voice components
   */
  applyVoiceTheme(element: HTMLElement) {
    const styles = this.getVoiceStyles();
    
    // Apply CSS variables to the element
    Object.entries(this.cssVariables).forEach(([property, value]) => {
      element.style.setProperty(property, value);
    });
  }
}

/**
 * Hook for voice theme integration
 */
export function useVoiceTheme(mode: ThemeMode = 'auto') {
  return new VoiceThemeIntegration(mode);
}

/**
 * CSS-in-JS helper for voice components
 */
export function getVoiceThemeStyles(mode: ThemeMode = 'auto') {
  const integration = new VoiceThemeIntegration(mode);
  return integration.getVoiceStyles();
}

/**
 * Tailwind CSS classes for voice components using theme variables
 */
export const voiceThemeClasses = {
  // Recording button
  recordingButton: 'bg-[var(--color-voice-recording)] hover:bg-[var(--color-voice-recording)]/90 rounded-[var(--border-radius-full)] shadow-[var(--shadow-lg)] transition-all duration-[var(--animation-duration-normal)]',
  
  // Processing state
  processingButton: 'bg-[var(--color-voice-processing)] animate-pulse',
  
  // Success state
  successButton: 'bg-[var(--color-voice-success)]',
  
  // Error state
  errorButton: 'bg-[var(--color-voice-error)]',
  
  // Idle state
  idleButton: 'bg-[var(--color-voice-idle)] text-[var(--color-text-primary)]',
  
  // Text styles
  duration: 'font-[var(--font-family-mono)] text-[var(--font-size-sm)] font-[var(--font-weight-medium)] text-[var(--color-text-secondary)]',
  
  // Container
  container: 'p-[var(--spacing-4)] rounded-[var(--border-radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border-default)]',
};

/**
 * Default export for convenience
 */
export default VoiceThemeIntegration;