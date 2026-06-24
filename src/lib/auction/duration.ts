export type AuctionDurationUnit = 'minutes' | 'hours' | 'days' | 'weeks';

const MAX_DURATION_HOURS = 720;
const MIN_DURATION_HOURS = 1 / 4; // 15 minutes

export function durationToHours(value: number, unit: AuctionDurationUnit): number {
  switch (unit) {
    case 'minutes':
      return value / 60;
    case 'hours':
      return value;
    case 'days':
      return value * 24;
    case 'weeks':
      return value * 24 * 7;
    default:
      return value;
  }
}

export function hoursToDisplayParts(hours: number): { value: number; unit: AuctionDurationUnit } {
  const safeHours = Math.max(MIN_DURATION_HOURS, hours);
  if (safeHours < 1) {
    return { value: Math.max(1, Math.round(safeHours * 60)), unit: 'minutes' };
  }
  if (safeHours >= 168) {
    return { value: Math.max(1, Math.floor(safeHours / 168)), unit: 'weeks' };
  }
  if (safeHours >= 24) {
    return { value: Math.max(1, Math.floor(safeHours / 24)), unit: 'days' };
  }
  return { value: Math.max(1, Math.round(safeHours)), unit: 'hours' };
}

export function clampDurationHours(hours: number): number {
  if (!Number.isFinite(hours)) return 120;
  return Math.min(MAX_DURATION_HOURS, Math.max(MIN_DURATION_HOURS, hours));
}

export function validateDurationInput(value: number, unit: AuctionDurationUnit): string | null {
  const hours = durationToHours(value, unit);
  if (hours < MIN_DURATION_HOURS) {
    return 'Duration must be at least 15 minutes';
  }
  if (hours > MAX_DURATION_HOURS) {
    return 'Duration cannot exceed 30 days (720 hours)';
  }
  return null;
}

export function getDurationInputMax(unit: AuctionDurationUnit): number {
  switch (unit) {
    case 'minutes':
      return MAX_DURATION_HOURS * 60;
    case 'hours':
      return MAX_DURATION_HOURS;
    case 'days':
      return 30;
    case 'weeks':
      return 4;
    default:
      return MAX_DURATION_HOURS;
  }
}
