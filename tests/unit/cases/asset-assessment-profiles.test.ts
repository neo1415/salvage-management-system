import { describe, expect, it } from 'vitest';
import {
  ASSET_ASSESSMENT_PROFILES,
  SUPPORTED_ASSET_TYPES,
  getAssetAssessmentProfile,
} from '@/features/cases/asset-assessment-profiles';
import {
  buildUniversalSearchIdentifier,
  type UniversalItemInfo,
} from '@/features/cases/services/ai-assessment-enhanced.service';
import { constructDamageAssessmentPrompt } from '@/lib/integrations/gemini-damage-detection';

function sampleItem(type: UniversalItemInfo['type']): UniversalItemInfo {
  const base: UniversalItemInfo = {
    type,
    condition: 'Nigerian Used',
    brand: 'Sample Brand',
    model: 'Sample Model',
    description: 'Sample insured asset',
    quantity: '10',
    unitOfMeasure: 'units',
  };
  if (type === 'vehicle') return { ...base, make: 'Toyota', model: 'Camry', year: 2018 };
  if (type === 'property') return { ...base, propertyType: 'warehouse fixtures', location: 'Lagos' };
  if (type === 'machinery') return { ...base, machineryType: 'industrial generator' };
  if (type === 'furniture') return { ...base, material: 'wood and leather', size: '3 seater set' };
  if (type === 'jewelry') return { ...base, material: 'gold-tone metal' };
  return base;
}

describe('asset assessment profiles', () => {
  it('defines a complete, asset-specific profile for every catalog asset type', () => {
    expect(Object.keys(ASSET_ASSESSMENT_PROFILES).sort()).toEqual([...SUPPORTED_ASSET_TYPES].sort());
    for (const type of SUPPORTED_ASSET_TYPES) {
      const profile = getAssetAssessmentProfile(type);
      expect(profile.promptGuidance.length, type).toBeGreaterThan(0);
      expect(profile.evidenceExamples.length, type).toBeGreaterThanOrEqual(3);
      expect(profile.evidenceTitle, type).not.toBe('');
      expect(profile.valueLabel, type).not.toBe('');
    }
  });

  it.each(SUPPORTED_ASSET_TYPES)('%s has market-search and descriptive prompt context', (type) => {
    const item = sampleItem(type);
    expect(buildUniversalSearchIdentifier(item), `${type} search identifier`).not.toBeNull();

    const prompt = constructDamageAssessmentPrompt({
      make: item.make || item.brand || type,
      model: item.model || item.description || type,
      year: item.year,
      itemType: type,
    });
    expect(prompt).toContain('MANDATORY DESCRIPTIVE EVIDENCE CONTRACT');
    expect(prompt).toContain(getAssetAssessmentProfile(type).evidenceExamples[0]);
    expect(prompt).toContain('damageType');
    expect(prompt).toContain('description');
  });
});
