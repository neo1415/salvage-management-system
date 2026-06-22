function isLegacyProcessedMetadataWarning(warning: string): boolean {
  return /No EXIF\/IPTC\/XMP metadata was found/i.test(warning);
}

function isGenericMarketEvidenceWarning(warning: string): boolean {
  return (
    /Market confidence \d+% is below/i.test(warning) ||
    /Only \d+ market source\(s\) met quality checks/i.test(warning) ||
    /Market evidence is not source-diverse/i.test(warning)
  );
}

function isSeverityPercentageMismatchWarning(warning: string): boolean {
  return /Damage is labelled severe but calculated at \d+%/i.test(warning);
}

function isLuxurySpecialistReason(value: string): boolean {
  return /luxury|specialist appraisal|generic marketplace prices are not accepted|hallmark|serial verification|declared insured value|purchase receipt/i.test(
    value
  );
}

function isPartPriceFloorReason(value: string): boolean {
  return /No reliable part-price evidence was found/i.test(value);
}

function hasSpecialistAppraisalReason(values: string[]): boolean {
  return values.some(
    (value) =>
      isLuxurySpecialistReason(value) ||
      isPartPriceFloorReason(value) ||
      /Rolex|Cartier|diamond|gold|mixed jewelry/i.test(value)
  );
}

function collapseMetadataWarnings(warnings: string[]): string[] {
  const metadataCount = warnings.filter(isLegacyProcessedMetadataWarning).length;
  const withoutMetadata = warnings.filter((warning) => !isLegacyProcessedMetadataWarning(warning));

  if (metadataCount > 0) {
    withoutMetadata.push(
      `${metadataCount} photo(s): Camera metadata was not embedded (common after compression or cloud uploads). Staff should rely on visual review.`
    );
  }

  return withoutMetadata;
}

function buildSpecialistChecklist(reasons: string[]): string[] {
  const checklist: string[] = [];

  if (reasons.some(isLuxurySpecialistReason)) {
    checklist.push(
      'Luxury or multi-item jewelry/watch lot: confirm declared insured value, purchase receipt, hallmark/serial verification, and specialist appraisal before approval.'
    );
  }

  if (reasons.some(isPartPriceFloorReason)) {
    checklist.push(
      'Market evidence was thin for repair deductions; review photos and specialist evidence before approving salvage value (salvage floor may apply).'
    );
  }

  const hasLowConfidence = reasons.some((reason) =>
    /Market confidence \d+% is below/i.test(reason)
  );
  if (hasLowConfidence) {
    checklist.push(
      'Online market confidence was low for this asset class; specialist valuation should take priority over generic listings.'
    );
  }

  return checklist;
}

export function sanitizeAiAssessmentWarnings(
  warnings: string[] | null | undefined,
  reviewReasons: string[] | null | undefined = []
): string[] {
  const inputWarnings = Array.isArray(warnings) ? warnings : [];
  const inputReviewReasons = Array.isArray(reviewReasons) ? reviewReasons : [];
  const specialistContext = hasSpecialistAppraisalReason([...inputWarnings, ...inputReviewReasons]);

  const normalizedWarnings = inputWarnings
    .filter((warning) => typeof warning === 'string' && warning.trim().length > 0)
    .map((warning) => warning.replace(/^Manual review:\s*/i, '').trim());

  const collapsedMetadata = collapseMetadataWarnings(normalizedWarnings);

  const filtered = collapsedMetadata
    .filter((warning) => !(specialistContext && isGenericMarketEvidenceWarning(warning)))
    .filter((warning) => !(specialistContext && isSeverityPercentageMismatchWarning(warning)));

  const specialistChecklist = specialistContext
    ? buildSpecialistChecklist([...filtered, ...inputReviewReasons])
    : [];

  const merged = [...specialistChecklist, ...filtered];

  return Array.from(new Set(merged));
}
