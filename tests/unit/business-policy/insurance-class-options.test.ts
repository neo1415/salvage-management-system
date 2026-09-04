import { describe, expect, it } from 'vitest';
import {
  getEnabledInsuranceClassOptions,
  insuranceClassKeyFromLabel,
  normalizeInsuranceClassLabel,
} from '@/features/business-policy/insurance-class-options';

describe('insurance class options', () => {
  it('normalizes whitespace and produces stable keys', () => {
    expect(normalizeInsuranceClassLabel('  Oil   and Gas  ')).toBe('Oil and Gas');
    expect(insuranceClassKeyFromLabel('Oil & Gas / Offshore')).toBe('oil_gas_offshore');
  });

  it('rejects punctuation-only labels by producing an empty key', () => {
    expect(insuranceClassKeyFromLabel('--- / ---')).toBe('');
  });

  it('returns only enabled classes and keeps Other last', () => {
    expect(getEnabledInsuranceClassOptions({
      other: { enabled: true, label: 'Other', defaultAssetTypes: ['other'] },
      motor: { enabled: true, label: 'Motor', defaultAssetTypes: ['vehicle'] },
      hidden: { enabled: false, label: 'Hidden', defaultAssetTypes: ['other'] },
      agriculture: { enabled: true, label: 'Agriculture', defaultAssetTypes: ['agriculture'] },
    })).toEqual([
      { value: 'agriculture', label: 'Agriculture' },
      { value: 'motor', label: 'Motor' },
      { value: 'other', label: 'Other' },
    ]);
  });
});
