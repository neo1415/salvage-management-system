'use client';

import React from 'react';
import { cn } from '../../lib/utils';

interface ResponsiveFormLayoutProps {
  children: React.ReactNode;
  variant?: 'mobile' | 'tablet' | 'desktop' | 'auto';
  spacing?: 'compact' | 'comfortable' | 'spacious';
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
  voiceButtonPosition?: 'sticky' | 'floating' | 'inline';
  enableVoiceOptimization?: boolean;
}

/**
 * ResponsiveFormLayout Component
 * 
 * Modern form layout system optimized for all device sizes with 2026 design standards.
 * Implements mobile-first responsive design with enhanced desktop experience.
 * 
 * Features:
 * - Mobile-first responsive breakpoints (320px-767px, 768px-1023px, 1024px+)
 * - Modern spacing and layout grid systems
 * - Contemporary visual hierarchy
 * - Automatic theme detection
 * - Smooth transitions between layouts
 * - Voice button positioning consistency across all screen sizes
 * - Enhanced touch targets for mobile devices
 */
export const ResponsiveFormLayout: React.FC<ResponsiveFormLayoutProps> = ({
  children,
  variant = 'auto',
  spacing = 'comfortable',
  theme = 'auto',
  className,
  voiceButtonPosition = 'sticky',
  enableVoiceOptimization = true,
}) => {
  // Spacing configurations with enhanced mobile-first approach
  const spacingConfig = {
    compact: {
      container: 'p-3 space-y-4',
      section: 'space-y-3',
      field: 'space-y-2',
      voiceArea: 'p-3',
    },
    comfortable: {
      container: 'p-4 space-y-6',
      section: 'space-y-4',
      field: 'space-y-3',
      voiceArea: 'p-4',
    },
    spacious: {
      container: 'p-6 space-y-8',
      section: 'space-y-6',
      field: 'space-y-4',
      voiceArea: 'p-6',
    },
  };

  const currentSpacing = spacingConfig[spacing];

  // Voice button positioning styles
  const voicePositionStyles = {
    sticky: {
      mobile: 'sticky bottom-4 z-20',
      tablet: 'sticky top-6 z-20',
      desktop: 'sticky top-8 z-20',
    },
    floating: {
      mobile: 'fixed bottom-6 right-6 z-30',
      tablet: 'fixed bottom-8 right-8 z-30',
      desktop: 'fixed bottom-10 right-10 z-30',
    },
    inline: {
      mobile: 'relative',
      tablet: 'relative',
      desktop: 'relative',
    },
  };

  return (
    <div
      className={cn(
        // Base container styles - FORCE WHITE background (override dark mode)
        'responsive-form-layout min-h-screen',
        '!bg-white',
        
        // CRITICAL: Prevent horizontal overflow on mobile
        'overflow-x-hidden',
        
        // Mobile-first layout (320px - 767px) - PERFECTLY CENTERED with max-width constraint
        'w-full max-w-full',
        'px-4', // Consistent horizontal padding on mobile
        currentSpacing.container.replace('p-4', 'py-4').replace('p-3', 'py-3').replace('p-6', 'py-6'),
        
        // Enhanced mobile touch optimization
        'touch-manipulation',
        
        // Tablet layout (768px - 1023px)
        'md:max-w-4xl md:mx-auto md:px-6',
        spacing === 'spacious' && 'md:py-8',
        
        // Desktop layout (1024px+)
        'lg:max-w-6xl lg:px-8',
        spacing === 'spacious' && 'lg:py-12',
        
        // Auto variant responsive behavior with enhanced breakpoints
        variant === 'auto' && [
          // Mobile optimizations (320px+)
          'sm:px-4',
          // Tablet optimizations (768px+)
          'md:px-6 md:space-y-8',
          // Desktop optimizations (1024px+)
          'lg:px-8 lg:space-y-10',
          // Large desktop optimizations (1440px+)
          'xl:max-w-7xl xl:px-12 xl:space-y-12',
        ],
        
        // Explicit variant overrides with improved constraints
        variant === 'mobile' && 'max-w-md mx-auto',
        variant === 'tablet' && 'max-w-2xl mx-auto md:max-w-4xl',
        variant === 'desktop' && 'max-w-4xl mx-auto lg:max-w-6xl',
        
        // Voice optimization styles
        enableVoiceOptimization && [
          // Ensure proper spacing for voice controls
          'pb-24 md:pb-8 lg:pb-8',
          // Smooth scrolling for voice interaction
          'scroll-smooth',
        ],
        
        className
      )}
      // Add data attributes for responsive testing
      data-responsive-variant={variant}
      data-spacing={spacing}
      data-voice-position={voiceButtonPosition}
    >
      {children}
      
      {/* Voice button positioning helper - invisible but ensures proper layout */}
      {enableVoiceOptimization && (
        <div 
          className={cn(
            'voice-button-anchor',
            // Mobile positioning
            voicePositionStyles[voiceButtonPosition].mobile,
            // Tablet positioning
            `md:${voicePositionStyles[voiceButtonPosition].tablet.replace('sticky ', '').replace('fixed ', '').replace('relative', '')}`,
            // Desktop positioning
            `lg:${voicePositionStyles[voiceButtonPosition].desktop.replace('sticky ', '').replace('fixed ', '').replace('relative', '')}`,
            // Ensure proper z-index layering
            'pointer-events-none',
          )}
          data-voice-anchor="true"
        />
      )}
    </div>
  );
};

/**
 * VoiceOptimizedSection Component
 * 
 * Specialized section for voice-enabled forms with consistent button positioning
 */
interface VoiceOptimizedSectionProps {
  children: React.ReactNode;
  voiceControls?: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

export const VoiceOptimizedSection: React.FC<VoiceOptimizedSectionProps> = ({
  children,
  voiceControls,
  title,
  description,
  className,
}) => {
  return (
    <section
      className={cn(
        'voice-optimized-section relative',
        
        // Mobile layout (320px - 767px)
        'flex flex-col space-y-4',
        
        // Tablet layout (768px - 1023px)
        'md:grid md:grid-cols-3 md:gap-6 md:space-y-0',
        
        // Desktop layout (1024px+)
        'lg:grid-cols-4 lg:gap-8',
        
        className
      )}
    >
      {/* Content area */}
      <div className="content-area md:col-span-2 lg:col-span-3">
        {/* Section header */}
        {(title || description) && (
          <div className="section-header space-y-2 mb-4">
            {title && (
              <h3 className="text-lg font-semibold text-gray-900">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-sm text-gray-600">
                {description}
              </p>
            )}
          </div>
        )}
        
        {/* Main content */}
        <div className="section-content space-y-4">
          {children}
        </div>
      </div>
      
      {/* Voice controls area */}
      {voiceControls && (
        <div className={cn(
          'voice-controls-area',
          
          // Mobile: sticky at bottom - FORCE WHITE BACKGROUND
          'sticky bottom-4 z-20 mt-4',
          '!bg-white/95 backdrop-blur-sm rounded-2xl p-4',
          'border border-gray-200/50 shadow-lg shadow-gray-900/5',
          
          // Tablet: sidebar positioning
          'md:col-span-1 md:sticky md:top-6 md:h-fit',
          'md:mt-0 md:bg-transparent md:backdrop-blur-none',
          'md:border-none md:shadow-none md:p-0',
          
          // Desktop: enhanced sidebar
          'lg:col-span-1',
        )}>
          {voiceControls}
        </div>
      )}
    </section>
  );
};

/**
 * FormSection Component
 * 
 * Styled section container for grouping related form fields
 */
interface FormSectionProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  variant?: 'default' | 'highlighted' | 'card';
  className?: string;
}

export const FormSection: React.FC<FormSectionProps> = ({
  children,
  title,
  description,
  variant = 'default',
  className,
}) => {
  return (
    <section
      className={cn(
        'form-section',
        
        // Base section styles
        variant === 'default' && 'space-y-4',
        
        // Highlighted section with background - Mobile responsive padding - FORCE WHITE BACKGROUND
        variant === 'highlighted' && [
          'p-4 sm:p-6 space-y-4 rounded-2xl',
          '!bg-white w-full max-w-full mx-0', // Remove mx-auto, let parent handle centering
          'border border-gray-200/30',
        ],
        
        // Card section with elevation - Mobile responsive padding - FORCE WHITE BACKGROUND
        variant === 'card' && [
          'p-4 sm:p-6 space-y-4 rounded-2xl',
          '!bg-white w-full max-w-full mx-0', // Remove mx-auto, let parent handle centering
          'border border-gray-200/50 shadow-lg shadow-gray-900/5',
        ],
        
        className
      )}
    >
      {/* Section header */}
      {(title || description) && (
        <div className="section-header space-y-2">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-sm text-gray-600">
              {description}
            </p>
          )}
        </div>
      )}
      
      {/* Section content */}
      <div className="section-content space-y-4">
        {children}
      </div>
    </section>
  );
};

/**
 * FormField Component
 * 
 * Modern form field wrapper with consistent styling and voice optimization
 */
interface FormFieldProps {
  children: React.ReactNode;
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  voiceEnabled?: boolean;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  children,
  label,
  description,
  error,
  required = false,
  voiceEnabled = false,
  className,
}) => {
  return (
    <div className={cn(
      'form-field space-y-2',
      // Voice-enabled fields get enhanced touch targets
      voiceEnabled && [
        'voice-enabled-field',
        // Larger touch targets on mobile
        'touch-manipulation',
        // Enhanced focus visibility
        'focus-within:ring-2 focus-within:ring-[#800020]/20 focus-within:ring-offset-2',
        'rounded-lg transition-all duration-200',
      ],
      className
    )}>
      {/* Field label */}
      {label && (
        <label className={cn(
          'block font-medium text-gray-700',
          // Responsive text sizing
          'text-sm md:text-base',
          // Enhanced spacing for voice fields
          voiceEnabled && 'mb-3',
        )}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      {/* Field description */}
      {description && (
        <p className={cn(
          'text-gray-500',
          // Responsive text sizing
          'text-xs md:text-sm',
          // Enhanced spacing for voice fields
          voiceEnabled && 'mb-2',
        )}>
          {description}
        </p>
      )}
      
      {/* Field input */}
      <div className={cn(
        'field-input',
        // Voice-enabled fields get enhanced styling
        voiceEnabled && [
          'relative',
          // Ensure proper z-index for voice controls
          'z-10',
        ],
      )}>
        {children}
      </div>
      
      {/* Field error */}
      {error && (
        <p className="text-sm text-red-600 flex items-center space-x-1">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};

/**
 * ModernInput Component
 * 
 * Styled input component with modern 2026 design and responsive optimization
 */
interface ModernInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  variant?: 'default' | 'filled' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
  responsive?: boolean;
}

export const ModernInput: React.FC<ModernInputProps> = ({
  variant = 'default',
  size = 'md',
  responsive = true,
  className,
  ...props
}) => {
  return (
    <input
      className={cn(
        // Base input styles with modern design
        'w-full border rounded-xl transition-all duration-200 ease-out',
        'focus:outline-none focus:ring-2 focus:ring-[#800020]/30',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        
        // Enhanced mobile touch optimization
        'touch-manipulation',
        
        // Size variants with responsive scaling
        size === 'sm' && [
          responsive ? 'px-3 py-2 text-sm md:px-4 md:py-2.5 md:text-base' : 'px-3 py-2 text-sm'
        ],
        size === 'md' && [
          responsive ? 'px-4 py-3 text-base md:px-5 md:py-3.5 lg:px-6 lg:py-4' : 'px-4 py-3 text-base'
        ],
        size === 'lg' && [
          responsive ? 'px-5 py-4 text-lg md:px-6 md:py-5 lg:px-7 lg:py-6' : 'px-5 py-4 text-lg'
        ],
        
        // Style variants with enhanced modern design - FORCE LIGHT MODE
        variant === 'default' && [
          'border-gray-300 !bg-white !text-gray-900',
          'hover:border-gray-400 focus:border-[#800020]',
          'placeholder:text-gray-500',
        ],
        
        variant === 'filled' && [
          'border-transparent !bg-gray-100 !text-gray-900',
          'hover:bg-gray-200 focus:bg-white focus:border-[#800020]',
          'placeholder:text-gray-600',
        ],
        
        variant === 'outlined' && [
          'border-2 border-gray-300 !bg-transparent !text-gray-900',
          'hover:border-gray-400 focus:border-[#800020]',
          'placeholder:text-gray-500',
        ],
        
        className
      )}
      {...props}
    />
  );
};

/**
 * ModernButton Component
 * 
 * Styled button component with modern design, animations, and responsive optimization
 */
interface ModernButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  responsive?: boolean;
  fullWidth?: boolean;
}

export const ModernButton: React.FC<ModernButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  responsive = true,
  fullWidth = false,
  children,
  className,
  disabled,
  ...props
}) => {
  return (
    <button
      className={cn(
        // Base button styles with modern design
        'inline-flex items-center justify-center font-medium rounded-xl',
        'transition-all duration-200 ease-out',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        
        // Enhanced mobile touch optimization
        'touch-manipulation',
        // Minimum touch target size (44px)
        'min-h-[44px]',
        
        // Full width option
        fullWidth && 'w-full',
        
        // Size variants with responsive scaling
        size === 'sm' && [
          responsive ? 'px-3 py-2 text-sm md:px-4 md:py-2.5 md:text-base' : 'px-3 py-2 text-sm'
        ],
        size === 'md' && [
          responsive ? 'px-4 py-3 text-base md:px-6 md:py-3.5 lg:px-8 lg:py-4' : 'px-4 py-3 text-base'
        ],
        size === 'lg' && [
          responsive ? 'px-6 py-4 text-lg md:px-8 md:py-5 lg:px-10 lg:py-6' : 'px-6 py-4 text-lg'
        ],
        
        // Style variants with enhanced modern design
        variant === 'primary' && [
          'bg-gradient-to-r from-[#800020] to-[#a0002a] text-white',
          'hover:from-[#600018] hover:to-[#800020] hover:shadow-lg hover:shadow-[#800020]/25',
          'focus:ring-[#800020]/30 active:scale-95',
          'shadow-md shadow-[#800020]/20',
        ],
        
        variant === 'secondary' && [
          '!bg-gray-200 !text-gray-900 hover:bg-gray-300',
          'focus:ring-gray-300 active:scale-95',
          'shadow-md shadow-gray-900/10',
        ],
        
        variant === 'outline' && [
          'border-2 border-[#800020] text-[#800020] bg-transparent',
          'hover:bg-[#800020] hover:text-white hover:shadow-lg hover:shadow-[#800020]/25',
          'focus:ring-[#800020]/30 active:scale-95',
        ],
        
        variant === 'ghost' && [
          '!text-gray-700 hover:bg-gray-100 hover:text-gray-900',
          'focus:ring-gray-300 active:scale-95',
        ],
        
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
};

export default ResponsiveFormLayout;