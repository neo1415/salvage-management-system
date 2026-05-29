import type { CSSProperties } from 'react';
import type { BrandingPolicy } from '@/features/business-policy/types';

function clampColorChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function normalizeHexColor(hex: string | null | undefined, fallback = '#800020'): string {
  if (typeof hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return hex;
  }

  return fallback;
}

function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const normalized = normalizeHexColor(hex).slice(1);

  return {
    red: parseInt(normalized.slice(0, 2), 16),
    green: parseInt(normalized.slice(2, 4), 16),
    blue: parseInt(normalized.slice(4, 6), 16),
  };
}

export function shadeHexColor(hex: string, factor: number): string {
  const { red, green, blue } = hexToRgb(hex);

  return `#${[red, green, blue]
    .map((channel) => clampColorChannel(channel * factor).toString(16).padStart(2, '0'))
    .join('')}`;
}

export function tintHexColor(hex: string, factor: number): string {
  const { red, green, blue } = hexToRgb(hex);

  return `#${[red, green, blue]
    .map((channel) => clampColorChannel(channel + (255 - channel) * factor).toString(16).padStart(2, '0'))
    .join('')}`;
}

export function getReadableTextColor(hex: string): '#0F172A' | '#FFFFFF' {
  const { red, green, blue } = hexToRgb(hex);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;

  return luminance > 150 ? '#0F172A' : '#FFFFFF';
}

export function getBrandGradient(branding: BrandingPolicy): string {
  const primary = normalizeHexColor(branding.primaryColor);
  return `linear-gradient(135deg, ${primary}, ${shadeHexColor(primary, 0.75)})`;
}

export function getBrandCssVariables(branding: BrandingPolicy): CSSProperties {
  const primary = normalizeHexColor(branding.primaryColor);
  const accent = normalizeHexColor(branding.accentColor, '#D97706');
  const { red, green, blue } = hexToRgb(primary);

  return {
    '--brand-primary': primary,
    '--brand-primary-hover': shadeHexColor(primary, 0.74),
    '--brand-primary-active': shadeHexColor(primary, 0.62),
    '--brand-primary-surface': tintHexColor(primary, 0.93),
    '--brand-primary-muted': tintHexColor(primary, 0.82),
    '--brand-primary-border': tintHexColor(primary, 0.68),
    '--brand-primary-foreground': getReadableTextColor(primary),
    '--brand-accent': accent,
    '--brand-accent-hover': shadeHexColor(accent, 0.86),
    '--brand-accent-foreground': getReadableTextColor(accent),
    '--brand-focus-ring': `rgba(${red}, ${green}, ${blue}, 0.28)`,
    '--brand-shadow-color': `rgba(${red}, ${green}, ${blue}, 0.24)`,
  } as CSSProperties;
}
