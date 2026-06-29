import { describe, expect, it } from 'vitest';
import { formatDamageEvidence, normalizeDamageEvidence } from '@/lib/ai/damage-evidence';

describe('damage evidence', () => {
  it('keeps canonical part identity separate from the observed damage', () => {
    expect(normalizeDamageEvidence({
      part: 'shattered front windscreen',
      severity: 'severe',
      confidence: 94,
    })).toEqual({
      part: 'front windscreen',
      damageType: 'shattered',
      description: 'shattered front windscreen',
      severity: 'severe',
      confidence: 94,
    });
  });

  it('renders descriptive evidence for non-vehicle assets', () => {
    expect(formatDamageEvidence({
      part: 'maize bags',
      damageType: 'water-contaminated',
    })).toBe('water-contaminated maize bags');
  });

  it('preserves a provider description when supplied', () => {
    expect(formatDamageEvidence({
      part: 'left front door',
      damageType: 'dented',
      description: 'deeply dented left front passenger door',
    })).toBe('deeply dented left front passenger door');
  });

  it('normalizes compound non-vehicle damage descriptions', () => {
    expect(normalizeDamageEvidence({
      part: 'smoke-contaminated sealed cartons',
      severity: 'severe',
      confidence: 91,
    })).toMatchObject({
      part: 'sealed cartons',
      damageType: 'smoke-contaminated',
      description: 'smoke-contaminated sealed cartons',
    });
  });

  it('normalizes the repair disposition independently from damage confidence', () => {
    expect(normalizeDamageEvidence({
      part: 'left front door',
      damageType: 'dented',
      recommendedAction: 'repair',
      actionConfidence: 82,
      severity: 'moderate',
      confidence: 96,
    })).toMatchObject({
      recommendedAction: 'repair',
      actionConfidence: 82,
      confidence: 96,
    });
  });
});
