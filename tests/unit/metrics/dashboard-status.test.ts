import { describe, expect, it } from 'vitest';
import { formatDurationHours, formatRatingLabel } from '@/lib/metrics/dashboard-status';

describe('dashboard status metrics', () => {
  describe('formatRatingLabel', () => {
    it('uses stored ratings first', () => {
      expect(formatRatingLabel('4.25', 3.8, 1)).toEqual({
        value: 4.25,
        label: '4.3',
        source: 'stored',
      });
    });

    it('uses automatic ratings after the first real activity event', () => {
      expect(formatRatingLabel('0', 3.6, 1)).toEqual({
        value: 3.6,
        label: '3.6',
        source: 'auto',
      });
    });

    it('keeps a numeric empty-state label for vendors with no activity', () => {
      expect(formatRatingLabel('0', 0, 0)).toEqual({
        value: 0,
        label: '0.0',
        source: 'insufficient',
      });
    });
  });

  describe('formatDurationHours', () => {
    it('uses a numeric zero for missing or invalid dashboard durations', () => {
      expect(formatDurationHours(null)).toBe('0h');
      expect(formatDurationHours(undefined)).toBe('0h');
      expect(formatDurationHours(Number.NaN)).toBe('0h');
      expect(formatDurationHours(-2)).toBe('0h');
    });

    it('formats short, hourly, and multi-day dashboard durations', () => {
      expect(formatDurationHours(0.5)).toBe('<1h');
      expect(formatDurationHours(4.4)).toBe('4h');
      expect(formatDurationHours(30)).toBe('1.3d');
    });
  });
});
