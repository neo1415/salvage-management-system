/**
 * Manager rejection = salvage manager returned case to adjuster (audit: case_rejected).
 * Cancelled = adjuster/system set status to cancelled (separate tab).
 */
export function isManagerRejectedCase(caseRow: {
  rejectionReason?: string | null;
  approvedBy?: string | null;
  wasRejected?: boolean;
  status?: string;
}): boolean {
  if (caseRow.approvedBy) return false;
  if (caseRow.wasRejected) return true;
  return Boolean(caseRow.rejectionReason?.trim());
}

/**
 * My Cases → Rejected tab: manager returns and adjuster-cancelled cases.
 * (Adjusters often refer to both as "rejected"; Cancelled tab still lists cancelled only.)
 */
export function isRejectedTabCase(
  caseRow: Parameters<typeof isManagerRejectedCase>[0] & { status?: string }
): boolean {
  if (caseRow.status === 'cancelled') return true;
  return isManagerRejectedCase(caseRow);
}
