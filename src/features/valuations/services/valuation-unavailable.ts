/** Research failures must not be saved as zero or invented valuations. */
export class ValuationUnavailableError extends Error {
  readonly code = 'VALUATION_REVIEW_REQUIRED';

  constructor(message = 'No matching market listing with an attributable price was found. Retry research, add more exact asset details, or obtain a documented manual appraisal. No new valuation was saved.') {
    super(message);
    this.name = 'ValuationUnavailableError';
  }
}
