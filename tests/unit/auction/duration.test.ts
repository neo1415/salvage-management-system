import { describe, expect, it } from 'vitest';
import {
  clampDurationHours,
  durationToHours,
  getDurationInputMax,
  hoursToDisplayParts,
  validateDurationInput,
} from '@/lib/auction/duration';

describe('durationToHours', () => {
  it('converts minutes, hours, days, and weeks', () => {
    expect(durationToHours(30, 'minutes')).toBe(0.5);
    expect(durationToHours(2, 'hours')).toBe(2);
    expect(durationToHours(3, 'days')).toBe(72);
    expect(durationToHours(2, 'weeks')).toBe(336);
  });
});

describe('hoursToDisplayParts', () => {
  it('prefers minutes below one hour', () => {
    expect(hoursToDisplayParts(0.5)).toEqual({ value: 30, unit: 'minutes' });
  });

  it('prefers days between 24h and one week', () => {
    expect(hoursToDisplayParts(120)).toEqual({ value: 5, unit: 'days' });
  });

  it('prefers weeks at or above one week', () => {
    expect(hoursToDisplayParts(168)).toEqual({ value: 1, unit: 'weeks' });
  });
});

describe('clampDurationHours', () => {
  it('clamps to min 15 minutes and max 720 hours', () => {
    expect(clampDurationHours(0.1)).toBe(0.25);
    expect(clampDurationHours(1000)).toBe(720);
    expect(clampDurationHours(NaN)).toBe(120);
  });
});

describe('validateDurationInput', () => {
  it('rejects durations below 15 minutes', () => {
    expect(validateDurationInput(10, 'minutes')).toBe('Duration must be at least 15 minutes');
  });

  it('rejects durations above 30 days', () => {
    expect(validateDurationInput(31, 'days')).toBe('Duration cannot exceed 30 days (720 hours)');
  });

  it('accepts valid durations', () => {
    expect(validateDurationInput(15, 'minutes')).toBeNull();
    expect(validateDurationInput(120, 'hours')).toBeNull();
  });
});

describe('getDurationInputMax', () => {
  it('returns unit-specific max values', () => {
    expect(getDurationInputMax('minutes')).toBe(43200);
    expect(getDurationInputMax('hours')).toBe(720);
    expect(getDurationInputMax('days')).toBe(30);
    expect(getDurationInputMax('weeks')).toBe(4);
  });
});
