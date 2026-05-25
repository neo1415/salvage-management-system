import { describe, expect, it } from 'vitest';
import {
  isDojahWidgetFinalSuccess,
  isDojahWidgetIntermediateStep,
} from '@/lib/kyc/dojah-widget-completion';

describe('dojah-widget-completion', () => {
  it('treats liveness-only callback as intermediate', () => {
    const response = {
      reference_id: 'DJ-TEST-123',
      status: true,
      data: { selfie: { score: 90 } },
    };
    expect(isDojahWidgetFinalSuccess(response)).toBe(false);
    expect(isDojahWidgetIntermediateStep(response)).toBe(true);
  });

  it('treats completed verification_status as final', () => {
    const response = {
      reference_id: 'DJ-TEST-456',
      verification_status: 'Completed',
      status: true,
    };
    expect(isDojahWidgetFinalSuccess(response)).toBe(true);
    expect(isDojahWidgetIntermediateStep(response)).toBe(false);
  });
});
