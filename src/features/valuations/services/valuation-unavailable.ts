/** Research failures must not be saved as zero or invented valuations. */
export class ValuationUnavailableError extends Error {
  readonly code = 'VALUATION_REVIEW_REQUIRED';
  partialAssessment?: Record<string, unknown> & { marketValue: number; damageSeverity: 'minor' | 'moderate' | 'severe'; labels: string[]; confidenceScore: number; damagePercentage: number; processedAt: Date };

  constructor(message = 'No matching market listing with an attributable price was found. Retry research, add more exact asset details, or obtain a documented manual appraisal. No new valuation was saved.') {
    super(message);
    this.name = 'ValuationUnavailableError';
  }
}

/** Missing repair costs require an explicit manual valuation; zero remains valid under existing policy. */
export function canApprovePendingRepair(assessment: unknown, salvageOverride: unknown): boolean {
  const pending = assessment && typeof assessment === 'object' && 'valuationStatus' in assessment
    && assessment.valuationStatus === 'repair_pricing_pending';
  return !pending || (typeof salvageOverride === 'number' && Number.isFinite(salvageOverride) && salvageOverride >= 0);
}
