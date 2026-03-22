/**
 * Ripple Button Component
 * 
 * Button with Material Design ripple effect for tactile feedback
 * Provides 100ms ripple animation on tap/click
 */

'use client';

import { ButtonHTMLAttributes, useRef, useState, MouseEvent, TouchEvent } from 'react';

interface RippleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

interface Ripple {
  x: number;
  y: number;
  size: number;
  id: number;
}

export function RippleButton({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  onClick,
  ...props
}: RippleButtonProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rippleIdRef = useRef(0);

  const createRipple = (clientX: number, clientY: number) => {
    if (!buttonRef.current) return;

    const button = buttonRef.current;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = clientX - rect.left - size / 2;
    const y = clientY - rect.top - size / 2;

    const newRipple: Ripple = {
      x,
      y,
      size,
      id: rippleIdRef.current++,
    };

    setRipples((prev) => [...prev, newRipple]);

    // Remove ripple after animation completes (100ms)
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 600);
  };

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    createRipple(e.clientX, e.clientY);
    onClick?.(e);
  };

  const handleTouchStart = (e: TouchEvent<HTMLButtonElement>) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      createRipple(touch.clientX, touch.clientY);
    }
  };

  // Variant styles
  const variantStyles = {
    primary: 'bg-[#800020] text-white hover:bg-[#600018] active:bg-[#500015]',
    secondary: 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 active:bg-gray-100',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200',
  };

  // Size styles (ensuring 44x44px minimum touch target)
  const sizeStyles = {
    sm: 'px-4 py-2.5 text-sm min-h-[44px]', // 44px minimum
    md: 'px-6 py-3 text-base min-h-[48px]', // 48px comfortable
    lg: 'px-8 py-4 text-lg min-h-[52px]', // 52px large
  };

  return (
    <button
      ref={buttonRef}
      className={`
        relative overflow-hidden rounded-lg font-semibold
        transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-[#800020] focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      {...props}
    >
      {/* Button content */}
      <span className="relative z-10">{children}</span>

      {/* Ripple effects */}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute rounded-full bg-white opacity-30 animate-ripple pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
          }}
        />
      ))}
    </button>
  );
}
