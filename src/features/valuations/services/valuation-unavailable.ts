/** Research failures must not be saved as zero or invented valuations. */
export class ValuationUnavailableError extends Error {
  readonly code = 'VALUATION_REVIEW_REQUIRED';

  constructor(message = 'Matching market evidence is insufficient. No new valuation was saved. Retry market research or obtain a documented manual appraisal.') {
    super(message);
    this.name = 'ValuationUnavailableError';
  }
}
