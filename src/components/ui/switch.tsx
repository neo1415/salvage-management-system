"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
    checked?: boolean;
    defaultChecked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }
>(({ className, checked, defaultChecked = false, onCheckedChange, disabled, ...props }, ref) => {
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked);
  const isChecked = checked ?? internalChecked;

  const toggle = () => {
    if (disabled) return;
    const nextChecked = !isChecked;
    setInternalChecked(nextChecked);
    onCheckedChange?.(nextChecked);
  };

  return (
  <button
    type="button"
    role="switch"
    aria-checked={isChecked}
    disabled={disabled}
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--brand-primary)] data-[state=unchecked]:bg-gray-200",
      isChecked ? "bg-[var(--brand-primary)]" : "bg-gray-200",
      className
    )}
    data-state={isChecked ? 'checked' : 'unchecked'}
    onClick={toggle}
    {...props}
    ref={ref}
  >
    <span
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
        isChecked ? "translate-x-5" : "translate-x-0"
      )}
    />
  </button>
  );
})
Switch.displayName = "Switch"

export { Switch }
