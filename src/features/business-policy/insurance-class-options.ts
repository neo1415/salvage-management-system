import type { InsuranceClassPolicy } from './types';

export const MAX_INSURANCE_CLASS_LABEL_LENGTH = 120;

export function normalizeInsuranceClassLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_INSURANCE_CLASS_LABEL_LENGTH);
}

export function insuranceClassKeyFromLabel(value: string): string {
  return normalizeInsuranceClassLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

export function getEnabledInsuranceClassOptions(
  policy: Record<string, InsuranceClassPolicy> | null | undefined
): Array<{ value: string; label: string }> {
  if (!policy) return [];

  return Object.entries(policy)
    .filter(([, config]) => config.enabled && config.label.trim())
    .map(([value, config]) => ({ value, label: normalizeInsuranceClassLabel(config.label) }))
    .sort((left, right) => {
      if (left.value === 'other') return 1;
      if (right.value === 'other') return -1;
      return left.label.localeCompare(right.label);
    });
}
