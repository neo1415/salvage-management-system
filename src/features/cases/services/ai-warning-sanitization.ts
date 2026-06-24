const TECHNICAL_MESSAGE_PATTERNS = [
  /generativelanguage/i,
  /GoogleGenerativeAI/i,
  /anthropic/i,
  /web_search_/i,
  /web_fetch_/i,
  /quota exceeded/i,
  /Too Many Requests/i,
  /invalid_request_error/i,
  /HTTP\s*40\d/i,
  /adjudication unavailable/i,
  /QuotaFailure/i,
  /type\.googleapis\.com/i,
  /request_id/i,
  /retry in \d/i,
];

const INTERNAL_EVIDENCE_PATTERNS = [
  /^Only \d+ accepted market source/i,
  /^Only \d+ market source/i,
  /vary by \d+%/i,
  /above the \d+% limit/i,
  /not source-diverse/i,
  /met quality checks/i,
  /Photo integrity review/i,
  /Camera metadata was not embedded/i,
  /EXIF metadata/i,
  /No EXIF\/IPTC\/XMP metadata/i,
  /^Market search price ₦/i,
  /^Bulk\/cargo salvage uses recoverable/i,
  /verify visible quantity, safety, and resale legality before approval/i,
];

function isTechnicalMessage(value: string): boolean {
  return TECHNICAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(value));
}

function isInternalEvidenceMessage(value: string): boolean {
  return INTERNAL_EVIDENCE_PATTERNS.some((pattern) => pattern.test(value));
}

function isLuxurySpecialistReason(value: string): boolean {
  return /luxury|specialist appraisal|generic marketplace prices are not accepted|hallmark|serial verification|declared insured value|purchase receipt/i.test(
    value
  );
}

function isPartPriceFloorReason(value: string): boolean {
  return /No reliable part-price evidence was found/i.test(value);
}

function isActionableStaffNote(value: string): boolean {
  if (isTechnicalMessage(value) || isInternalEvidenceMessage(value)) return false;
  if (/Market confidence \d+% is below/i.test(value)) return false;
  if (/Damage is labelled severe but calculated at \d+%/i.test(value)) return false;
  return true;
}

export function formatStaffReviewNotes(
  reviewReasons: string[] | null | undefined,
  warnings: string[] | null | undefined,
  options?: {
    confidenceScore?: number;
    manualReviewRequired?: boolean;
  }
): string[] {
  const confidence = options?.confidenceScore ?? 0;
  const manualReviewRequired = options?.manualReviewRequired ?? false;

  const normalized = [...(reviewReasons || []), ...(warnings || [])]
    .filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.replace(/^Manual review:\s*/i, '').trim());

  const actionable = normalized.filter(isActionableStaffNote);
  const specialistNotes = actionable.filter(
    (entry) => isLuxurySpecialistReason(entry) || isPartPriceFloorReason(entry)
  );
  const quantityNotes = actionable.filter((entry) =>
    /approximate|policy schedule|confirm total units|stock count|visible count/i.test(entry)
  );

  const staffNotes: string[] = [];

  if (manualReviewRequired || confidence < 80 || actionable.length > 0) {
    if (confidence >= 80) {
      staffNotes.push('Review AI valuation and confirm market value before approval.');
    } else if (confidence >= 65) {
      staffNotes.push(
        'AI confidence is moderate — verify market value and salvage estimate against photos and policy schedule.'
      );
    } else {
      staffNotes.push(
        'AI confidence is low — manually verify market value and salvage estimate before approval.'
      );
    }
  }

  if (quantityNotes[0]) {
    staffNotes.push(quantityNotes[0]);
  }

  if (specialistNotes[0]) {
    staffNotes.push(specialistNotes[0]);
  }

  return Array.from(new Set(staffNotes)).slice(0, 2);
}

export function sanitizeAiAssessmentWarnings(
  warnings: string[] | null | undefined,
  reviewReasons: string[] | null | undefined = [],
  options?: {
    confidenceScore?: number;
    manualReviewRequired?: boolean;
  }
): string[] {
  return formatStaffReviewNotes(reviewReasons, warnings, options);
}
