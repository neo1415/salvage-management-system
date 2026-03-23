'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { useVoicePerformance } from '../../hooks/use-voice-performance';

/**
 * ProgressiveDisclosure Component
 * 
 * Modern progressive disclosure pattern for complex form sections
 * Reveals content progressively based on user interaction or form state
 */
interface ProgressiveDisclosureProps {
  children: React.ReactNode;
  trigger: React.ReactNode;
  title?: string;
  description?: string;
  defaultOpen?: boolean;
  disabled?: boolean;
  className?: string;
  onToggle?: (isOpen: boolean) => void;
}

export const ProgressiveDisclosure: React.FC<ProgressiveDisclosureProps> = ({
  children,
  trigger,
  title,
  description,
  defaultOpen = false,
  disabled = false,
  className,
  onToggle,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const { throttledCallback } = useVoicePerformance();

  const handleToggle = throttledCallback(() => {
    if (disabled) return;
    
    const newState = !isOpen;
    setIsOpen(newState);
    onToggle?.(newState);
  }, 100);

  return (
    <div className={cn('progressive-disclosure', className)}>
      {/* Trigger */}
      <div
        onClick={handleToggle}
        className={cn(
          'disclosure-trigger cursor-pointer select-none',
          'p-4 rounded-xl transition-all duration-200',
          'hover:bg-gray-50 dark:hover:bg-gray-800',
          'focus:outline-none focus:ring-2 focus:ring-[#800020]/30',
          disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent',
        )}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={isOpen}
        aria-disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {title && (
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {description}
              </p>
            )}
            {trigger}
          </div>
          
          {/* Chevron indicator */}
          <div className="ml-4">
            <svg
              className={cn(
                'w-5 h-5 text-gray-400 transition-transform duration-200',
                isOpen && 'rotate-180'
              )}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        className={cn(
          'disclosure-content overflow-hidden transition-all duration-300 ease-out',
          isOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
        )}
        aria-hidden={!isOpen}
      >
        <div className="p-4 pt-0">
          {children}
        </div>
      </div>
    </div>
  );
};

/**
 * LoadingState Component
 * 
 * Modern loading states with skeleton screens and micro-interactions
 */
interface LoadingStateProps {
  variant?: 'spinner' | 'skeleton' | 'pulse' | 'dots';
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  variant = 'spinner',
  size = 'md',
  text,
  className,
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const renderSpinner = () => (
    <svg
      className={cn('animate-spin', sizeClasses[size])}
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
  );

  const renderSkeleton = () => (
    <div className="animate-pulse space-y-3">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
    </div>
  );

  const renderPulse = () => (
    <div className={cn('animate-pulse bg-gray-200 dark:bg-gray-700 rounded', sizeClasses[size])} />
  );

  const renderDots = () => (
    <div className="flex space-x-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            'bg-current rounded-full animate-bounce',
            size === 'sm' && 'w-1 h-1',
            size === 'md' && 'w-2 h-2',
            size === 'lg' && 'w-3 h-3'
          )}
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );

  const renderVariant = () => {
    switch (variant) {
      case 'skeleton':
        return renderSkeleton();
      case 'pulse':
        return renderPulse();
      case 'dots':
        return renderDots();
      case 'spinner':
      default:
        return renderSpinner();
    }
  };

  return (
    <div
      className={cn(
        'loading-state flex items-center justify-center',
        text && 'space-x-3',
        className
      )}
      role="status"
      aria-live="polite"
    >
      {renderVariant()}
      {text && (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {text}
        </span>
      )}
    </div>
  );
};

/**
 * ValidationFeedback Component
 * 
 * Modern validation feedback with clear visual indicators
 */
interface ValidationFeedbackProps {
  state: 'idle' | 'validating' | 'valid' | 'invalid';
  message?: string;
  className?: string;
}

export const ValidationFeedback: React.FC<ValidationFeedbackProps> = ({
  state,
  message,
  className,
}) => {
  const getIcon = () => {
    switch (state) {
      case 'validating':
        return (
          <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        );
      case 'valid':
        return (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'invalid':
        return (
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getTextColor = () => {
    switch (state) {
      case 'validating':
        return 'text-blue-600 dark:text-blue-400';
      case 'valid':
        return 'text-green-600 dark:text-green-400';
      case 'invalid':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  if (state === 'idle' && !message) return null;

  return (
    <div
      className={cn(
        'validation-feedback flex items-center space-x-2 text-sm transition-all duration-200',
        getTextColor(),
        className
      )}
      role={state === 'invalid' ? 'alert' : 'status'}
      aria-live="polite"
    >
      {getIcon()}
      {message && <span>{message}</span>}
    </div>
  );
};

/**
 * MicroInteraction Component
 * 
 * Subtle micro-interactions for enhanced user feedback
 */
interface MicroInteractionProps {
  children: React.ReactNode;
  type?: 'hover-lift' | 'hover-scale' | 'click-bounce' | 'focus-glow';
  disabled?: boolean;
  className?: string;
}

export const MicroInteraction: React.FC<MicroInteractionProps> = ({
  children,
  type = 'hover-lift',
  disabled = false,
  className,
}) => {
  const getInteractionClasses = () => {
    if (disabled) return '';

    switch (type) {
      case 'hover-lift':
        return 'hover:-translate-y-1 hover:shadow-lg transition-all duration-200';
      case 'hover-scale':
        return 'hover:scale-105 transition-transform duration-200';
      case 'click-bounce':
        return 'active:scale-95 transition-transform duration-100';
      case 'focus-glow':
        return 'focus-within:ring-4 focus-within:ring-[#800020]/20 transition-all duration-200';
      default:
        return '';
    }
  };

  return (
    <div className={cn('micro-interaction', getInteractionClasses(), className)}>
      {children}
    </div>
  );
};

/**
 * FormProgress Component
 * 
 * Visual progress indicator for multi-step forms
 */
interface FormProgressProps {
  steps: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
  currentStep: string;
  completedSteps: string[];
  className?: string;
}

export const FormProgress: React.FC<FormProgressProps> = ({
  steps,
  currentStep,
  completedSteps,
  className,
}) => {
  const currentIndex = steps.findIndex(step => step.id === currentStep);
  const progressPercentage = ((currentIndex + 1) / steps.length) * 100;

  return (
    <div className={cn('form-progress', className)}>
      {/* Progress bar */}
      <div className="relative mb-8">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#800020] to-[#a0002a] transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        
        {/* Step indicators */}
        <div className="absolute top-0 left-0 w-full flex justify-between transform -translate-y-1/2">
          {steps.map((step, index) => {
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = step.id === currentStep;
            const isPast = index < currentIndex;

            return (
              <div
                key={step.id}
                className={cn(
                  'w-4 h-4 rounded-full border-2 transition-all duration-300',
                  isCompleted || isPast
                    ? 'bg-[#800020] border-[#800020]'
                    : isCurrent
                    ? 'bg-white border-[#800020] ring-4 ring-[#800020]/20'
                    : 'bg-white border-gray-300'
                )}
              />
            );
          })}
        </div>
      </div>

      {/* Step labels */}
      <div className="flex justify-between text-sm">
        {steps.map((step, index) => {
          const isCurrent = step.id === currentStep;
          const isCompleted = completedSteps.includes(step.id);
          const isPast = index < currentIndex;

          return (
            <div
              key={step.id}
              className={cn(
                'text-center max-w-[100px]',
                isCurrent
                  ? 'text-[#800020] font-semibold'
                  : isCompleted || isPast
                  ? 'text-gray-700 dark:text-gray-300'
                  : 'text-gray-400 dark:text-gray-500'
              )}
            >
              <div className="font-medium">{step.title}</div>
              {step.description && (
                <div className="text-xs mt-1 opacity-75">{step.description}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * SmartTooltip Component
 * 
 * Context-aware tooltip with modern styling
 */
interface SmartTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'click' | 'focus';
  className?: string;
}

export const SmartTooltip: React.FC<SmartTooltipProps> = ({
  children,
  content,
  position = 'top',
  trigger = 'hover',
  className,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => setIsVisible(true);
  const hideTooltip = () => setIsVisible(false);

  // Auto-adjust position based on viewport
  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      let newPosition = position;

      // Check if tooltip would overflow and adjust position
      if (position === 'top' && triggerRect.top - tooltipRect.height < 0) {
        newPosition = 'bottom';
      } else if (position === 'bottom' && triggerRect.bottom + tooltipRect.height > viewport.height) {
        newPosition = 'top';
      } else if (position === 'left' && triggerRect.left - tooltipRect.width < 0) {
        newPosition = 'right';
      } else if (position === 'right' && triggerRect.right + tooltipRect.width > viewport.width) {
        newPosition = 'left';
      }

      setActualPosition(newPosition);
    }
  }, [isVisible, position]);

  const getPositionClasses = () => {
    switch (actualPosition) {
      case 'top':
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 transform -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 transform -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 transform -translate-y-1/2 ml-2';
      default:
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
    }
  };

  const triggerProps = {
    ...(trigger === 'hover' && {
      onMouseEnter: showTooltip,
      onMouseLeave: hideTooltip,
    }),
    ...(trigger === 'click' && {
      onClick: () => setIsVisible(!isVisible),
    }),
    ...(trigger === 'focus' && {
      onFocus: showTooltip,
      onBlur: hideTooltip,
    }),
  };

  return (
    <div className={cn('smart-tooltip relative inline-block', className)}>
      <div ref={triggerRef} {...triggerProps}>
        {children}
      </div>
      
      {isVisible && (
        <div
          ref={tooltipRef}
          className={cn(
            'absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg',
            'dark:bg-gray-700 dark:text-gray-200',
            'animate-in fade-in-0 zoom-in-95 duration-200',
            getPositionClasses()
          )}
          role="tooltip"
        >
          {content}
          
          {/* Arrow */}
          <div
            className={cn(
              'absolute w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45',
              actualPosition === 'top' && 'top-full left-1/2 transform -translate-x-1/2 -translate-y-1/2',
              actualPosition === 'bottom' && 'bottom-full left-1/2 transform -translate-x-1/2 translate-y-1/2',
              actualPosition === 'left' && 'left-full top-1/2 transform -translate-x-1/2 -translate-y-1/2',
              actualPosition === 'right' && 'right-full top-1/2 transform translate-x-1/2 -translate-y-1/2'
            )}
          />
        </div>
      )}
    </div>
  );
};

export {
  ProgressiveDisclosure,
  LoadingState,
  ValidationFeedback,
  MicroInteraction,
  FormProgress,
  SmartTooltip,
};