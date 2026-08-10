const INTERNAL_CASE_FIELDS = new Set([
  'marketValue',
  'estimatedSalvageValue',
  'reservePrice',
  'aiEstimates',
  'managerOverrides',
  'claimReference',
  'policyNumber',
]);

const PUBLIC_ITEM_DETAIL_FIELDS = new Set([
  'detectedMake',
  'detectedModel',
  'detectedYear',
  'color',
  'trim',
  'bodyStyle',
  'storage',
  'overallCondition',
  'notes',
]);

const PUBLIC_DAMAGE_ACTIONS = new Set([
  'repair',
  'replace',
  'clean_or_restore',
  'sort_or_recover',
  'dispose',
  'specialist_review',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeItemDetails(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;

  const details: Record<string, string> = {};
  for (const [key, detail] of Object.entries(value)) {
    if (PUBLIC_ITEM_DETAIL_FIELDS.has(key) && typeof detail === 'string') {
      details[key] = detail;
    }
  }

  return Object.keys(details).length > 0 ? details : undefined;
}

function sanitizeDamagedParts(value: unknown): Array<Record<string, unknown>> | undefined {
  if (!Array.isArray(value)) return undefined;

  const parts = value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.part !== 'string') return [];
    if (!['minor', 'moderate', 'severe'].includes(String(entry.severity))) return [];

    const part: Record<string, unknown> = {
      part: entry.part,
      severity: entry.severity,
      confidence: typeof entry.confidence === 'number' ? entry.confidence : 0,
    };

    if (typeof entry.damageType === 'string') part.damageType = entry.damageType;
    if (typeof entry.description === 'string') part.description = entry.description;
    if (
      typeof entry.recommendedAction === 'string' &&
      PUBLIC_DAMAGE_ACTIONS.has(entry.recommendedAction)
    ) {
      part.recommendedAction = entry.recommendedAction;
    }
    if (typeof entry.actionConfidence === 'number') part.actionConfidence = entry.actionConfidence;

    return [part];
  });

  return parts.length > 0 ? parts : undefined;
}

function sanitizePublicDamageAssessment(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;

  const assessment: Record<string, unknown> = {};
  if (Array.isArray(value.labels)) {
    assessment.labels = value.labels.filter((label): label is string => typeof label === 'string');
  }
  if (typeof value.confidenceScore === 'number') assessment.confidenceScore = value.confidenceScore;
  if (typeof value.damagePercentage === 'number') assessment.damagePercentage = value.damagePercentage;
  if (typeof value.recommendation === 'string') assessment.recommendation = value.recommendation;
  if (typeof value.summary === 'string') assessment.summary = value.summary;

  const itemDetails = sanitizeItemDetails(value.itemDetails);
  if (itemDetails) assessment.itemDetails = itemDetails;

  const damagedParts = sanitizeDamagedParts(value.damagedParts);
  if (damagedParts) assessment.damagedParts = damagedParts;

  return Object.keys(assessment).length > 0 ? assessment : undefined;
}

export function sanitizeAuctionCaseForViewer(
  caseRecord: Record<string, unknown> | null,
  canViewInternalCaseData: boolean
): Record<string, unknown> | null {
  if (!caseRecord || canViewInternalCaseData) {
    return caseRecord;
  }

  const publicCase = Object.fromEntries(
    Object.entries(caseRecord).filter(([key]) => !INTERNAL_CASE_FIELDS.has(key))
  );

  const publicAssessment = sanitizePublicDamageAssessment(caseRecord.aiAssessment);
  if (publicAssessment) {
    publicCase.aiAssessment = publicAssessment;
  } else {
    delete publicCase.aiAssessment;
  }

  return publicCase;
}
