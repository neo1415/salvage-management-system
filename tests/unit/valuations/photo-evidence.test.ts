import { describe, expect, it } from 'vitest';
import { reviewPhotoEvidence, type DamageEvidence } from '@/lib/ai/damage-evidence';
const visible: DamageEvidence = { part: 'front bumper', description: 'Crushed bumper cover', evidenceStatus: 'observed', photoIndices: [3,5], severity: 'severe', confidence: 95 };
describe('photo evidence before scoring and pricing', () => {
  it('does not turn a false deployment boolean into proof of intact airbags', () => {
    const result = reviewPhotoEvidence({ damagedParts: [visible], airbagDeployed: false, summary: 'Bumper crushed. No airbag deployment was observed from the provided photos. Repairable.' }, 5);
    expect(result.summary).toContain('Airbag status cannot be confirmed');
    expect(result.summary).not.toContain('No airbag deployment');
  });
  it('keeps direct damage and moves inferred damage out of repair scope and summary', () => {
    const result = reviewPhotoEvidence({ damagedParts: [visible, { ...visible, part: 'frame', description: 'Possible frame deformation; inspection required', evidenceStatus: 'suspected' }], summary: 'Severe frame damage' }, 5);
    expect(result.damagedParts).toEqual([visible]);
    expect(result.summary).not.toContain('Severe frame damage');
    expect(result.summary).toContain('frame: not confirmed');
  });
  it.each(['suspension', 'electronic circuit', 'roof beam', 'machine gearbox', 'stock contents'])('requires direct photo evidence for %s', part => {
    const result = reviewPhotoEvidence({ damagedParts: [{ ...visible, part, evidenceStatus: 'suspected' }], summary: 'Damage' }, 5);
    expect(result.damagedParts).toHaveLength(0);
  });
  it('rejects absent and out-of-range photo references', () => {
    for (const photoIndices of [undefined, [], [0,6]]) {
      expect(reviewPhotoEvidence({ damagedParts: [{ ...visible, photoIndices }], summary: '' }, 5).damagedParts).toHaveLength(0);
    }
  });
  it('does not price an inference merely because the model labelled it observed', () => {
    expect(reviewPhotoEvidence({ damagedParts: [{ ...visible, description: 'Wheel position indicates possible suspension failure' }], summary: '' }, 5).damagedParts).toHaveLength(0);
  });
  it('counts repeated views of the same component once', () => {
    expect(reviewPhotoEvidence({ damagedParts: [visible, { ...visible, photoIndices: [2], confidence: 80 }], summary: '' }, 5).damagedParts).toHaveLength(1);
  });
});
