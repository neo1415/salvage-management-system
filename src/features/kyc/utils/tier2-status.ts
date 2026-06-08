export type Tier2StatusLike = {
  status?: string | null;
  submittedAt?: string | Date | null;
  approvedAt?: string | Date | null;
};

export function isPendingTier2Review(status: Tier2StatusLike | null | undefined): boolean {
  if (!status) return false;
  const normalizedStatus = String(status.status ?? '').toLowerCase();

  if (normalizedStatus === 'pending_review') return true;

  return Boolean(
    status.submittedAt &&
      !status.approvedAt &&
      !['approved', 'rejected', 'expired'].includes(normalizedStatus)
  );
}
