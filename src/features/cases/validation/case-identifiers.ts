export const CASE_IDENTIFIER_LIMITS = {
  policyNumber: 120,
  branchName: 150,
} as const;

export function validateCaseIdentifiers(input: {
  policyNumber?: unknown;
  branchName?: unknown;
}): {
  policyNumber: string;
  branchName: string;
  errors: string[];
} {
  const errors: string[] = [];
  const policyNumber = typeof input.policyNumber === 'string' ? input.policyNumber.trim() : '';
  const branchName = typeof input.branchName === 'string' ? input.branchName.trim() : '';

  if (!policyNumber) {
    errors.push('Policy number is required');
  } else if (policyNumber.length > CASE_IDENTIFIER_LIMITS.policyNumber) {
    errors.push(`Policy number must be ${CASE_IDENTIFIER_LIMITS.policyNumber} characters or less`);
  }

  if (!branchName) {
    errors.push('Branch is required');
  } else if (branchName.length > CASE_IDENTIFIER_LIMITS.branchName) {
    errors.push(`Branch must be ${CASE_IDENTIFIER_LIMITS.branchName} characters or less`);
  }

  return { policyNumber, branchName, errors };
}
