/**
 * Filter Chip Component
 * 
 * Displays an active filter as a chip with remove button
 * Uses burgundy brand color (#800020)
 */

'use client';

import { X } from 'lucide-react';

interface FilterChipProps {
  label: string;
  onRemove: () => void;
  className?: string;
}

export function FilterChip({ label, onRemove, className = '' }: FilterChipProps) {
  return (
    <div 
      className={`inline-flex items-center gap-1 px-3 py-1 bg-[#800020] text-white rounded-full text-sm ${className}`}
      role="status"
      aria-label={`Active filter: ${label}`}
    >
      <span>{label}</span>
      <button
        onClick={onRemove}
        className="hover:bg-white/20 rounded-full p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#800020]"
        aria-label={`Remove ${label} filter`}
        type="button"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
