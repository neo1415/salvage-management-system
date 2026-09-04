import { describe, expect, it } from 'vitest';
import {
  CASE_IDENTIFIER_LIMITS,
  validateCaseIdentifiers,
} from '@/features/cases/validation/case-identifiers';

describe('validateCaseIdentifiers', () => {
  it('trims valid policy and branch values', () => {
    expect(validateCaseIdentifiers({
      policyNumber: '  POL-2026-001  ',
      branchName: '  Lagos Main  ',
    })).toEqual({
      policyNumber: 'POL-2026-001',
      branchName: 'Lagos Main',
      errors: [],
    });
  });

  it.each([
    [{}, ['Policy number is required', 'Branch is required']],
    [{ policyNumber: 123, branchName: [] }, ['Policy number is required', 'Branch is required']],
    [{ policyNumber: '   ', branchName: '\t' }, ['Policy number is required', 'Branch is required']],
  ])('rejects missing, non-string, and whitespace-only values', (input, expectedErrors) => {
    expect(validateCaseIdentifiers(input).errors).toEqual(expectedErrors);
  });

  it('accepts exact limits and rejects values one character over', () => {
    expect(validateCaseIdentifiers({
      policyNumber: 'P'.repeat(CASE_IDENTIFIER_LIMITS.policyNumber),
      branchName: 'B'.repeat(CASE_IDENTIFIER_LIMITS.branchName),
    }).errors).toEqual([]);

    expect(validateCaseIdentifiers({
      policyNumber: 'P'.repeat(CASE_IDENTIFIER_LIMITS.policyNumber + 1),
      branchName: 'B'.repeat(CASE_IDENTIFIER_LIMITS.branchName + 1),
    }).errors).toEqual([
      'Policy number must be 120 characters or less',
      'Branch must be 150 characters or less',
    ]);
  });
});
