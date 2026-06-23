import { describe, expect, it } from 'vitest';
import {
  CASE_ASSET_TYPE_CATALOG,
  CASE_ASSET_TYPE_KEYS,
  getEnabledCaseAssetTypeOptions,
  getOrderedAssetTypeKeys,
} from '@/features/business-policy/case-asset-type-options';
import { DEFAULT_BUSINESS_POLICY } from '@/features/business-policy/default-policy';

describe('getEnabledCaseAssetTypeOptions', () => {
  it('returns only policy-enabled asset types with policy labels', () => {
    const options = getEnabledCaseAssetTypeOptions(DEFAULT_BUSINESS_POLICY.cases.enabledAssetTypes);
    const values = options.map((o) => o.value);

    expect(values).toContain('vehicle');
    expect(values).toContain('electronics');
    expect(values).not.toContain('jewelry');
    expect(values).not.toContain('appliance');

    const vehicle = options.find((o) => o.value === 'vehicle');
    expect(vehicle?.label).toBe('Vehicle');
  });

  it('falls back to full catalog when policy is missing', () => {
    const options = getEnabledCaseAssetTypeOptions(undefined);
    expect(options.length).toBe(CASE_ASSET_TYPE_CATALOG.length);
  });

  it('returns empty when all types are disabled', () => {
    const disabled = Object.fromEntries(
      Object.entries(DEFAULT_BUSINESS_POLICY.cases.enabledAssetTypes).map(([key, config]) => [
        key,
        { ...config, enabled: false },
      ])
    );
    expect(getEnabledCaseAssetTypeOptions(disabled)).toEqual([]);
  });

  it('orders asset type keys by catalog with custom types last', () => {
    const keys = getOrderedAssetTypeKeys({
      ...DEFAULT_BUSINESS_POLICY.cases.enabledAssetTypes,
      boats: {
        enabled: true,
        label: 'Boats',
        promptProfile: 'general_asset',
        requiredFields: [],
        requiresAiAnalysis: true,
        requiresMarketValue: true,
        requiresInspectionLocation: true,
      },
    });

    expect(keys[0]).toBe('vehicle');
    expect(keys).toEqual([...CASE_ASSET_TYPE_KEYS, 'boats']);
    expect(keys.length).toBe(CASE_ASSET_TYPE_KEYS.length + 1);
  });
});
