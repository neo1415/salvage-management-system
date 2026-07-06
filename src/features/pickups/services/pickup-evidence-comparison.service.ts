import {
  getGeminiModel,
  isGeminiEnabled,
} from '@/lib/integrations/gemini-damage-detection';
import type { Part, Schema } from '@google/generative-ai';
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages/messages';
import {
  getClaudeClient,
  getClaudeModelName,
  isClaudeEnabled,
} from '@/lib/integrations/claude-damage-detection';
import { isClaudePickupFallbackEnabled } from '@/lib/ai/provider-cost-controls';
import type { PickupEvidenceComparison } from '@/lib/db/schema/pickup-evidence';

type ComparisonStatus = PickupEvidenceComparison['status'];
type UnknownRecord = Record<string, unknown>;
type ClaudeImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

let pickupGeminiDisabledForProcess = false;

interface PickupEvidenceComparisonInput {
  originalPhotoUrls: string[];
  pickupPhotoUrls: string[];
  assetType: string;
  assetDetails?: Record<string, unknown> | null;
  aiAssessment?: Record<string, unknown> | null;
}

const PICKUP_COMPARISON_SCHEMA = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['matches_expected', 'review_needed', 'material_discrepancy'],
    },
    confidenceScore: {
      type: 'number',
      description: '0-100 confidence in the comparison result',
    },
    overallMatchScore: {
      type: 'number',
      description: '0-100 score for how closely pickup evidence matches the original inspection',
    },
    assetIdentityScore: {
      type: 'number',
      description: '0-100 score for whether the same asset or stock appears present',
    },
    quantityMatchScore: {
      type: 'number',
      description: '0-100 score for visible quantity or major component completeness',
    },
    conditionMatchScore: {
      type: 'number',
      description: '0-100 score for whether visible condition has not materially worsened',
    },
    reviewBand: {
      type: 'string',
      enum: ['acceptable', 'minor_review', 'major_review', 'material_discrepancy'],
    },
    identityFinding: {
      type: 'string',
      description: 'Specific asset identity finding with the visible distinguishing evidence compared',
    },
    quantityFinding: {
      type: 'string',
      description: 'Specific count, stock quantity, or major-component completeness finding',
    },
    conditionFinding: {
      type: 'string',
      description: 'Specific visible condition comparison, including named damage where supported',
    },
    coverageFinding: {
      type: 'string',
      description: 'Specific evidence coverage or uncertainty finding for staff review',
    },
    findings: {
      type: 'array',
      items: { type: 'string' },
      minItems: 4,
      maxItems: 8,
      description: 'Four to eight specific staff-facing findings covering identity, quantity or components, condition, and evidence coverage',
    },
    observedDifferences: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8,
      description: 'Visible differences between original inspection photos and pickup photos',
    },
    recommendedStaffAction: {
      type: 'string',
      description: 'Specific next action for staff',
    },
  },
  required: [
    'status',
    'confidenceScore',
    'overallMatchScore',
    'assetIdentityScore',
    'quantityMatchScore',
    'conditionMatchScore',
    'reviewBand',
    'identityFinding',
    'quantityFinding',
    'conditionFinding',
    'coverageFinding',
    'findings',
    'observedDifferences',
    'recommendedStaffAction',
  ],
};

function clampScore(value: unknown, fallback = 70): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeStatus(status: unknown): ComparisonStatus {
  if (status === 'matches_expected' || status === 'review_needed' || status === 'material_discrepancy') {
    return status;
  }

  return 'review_needed';
}

function normalizeTextArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;

  const normalized = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);

  return normalized.length > 0 ? normalized : fallback;
}

function normalizeReviewBand(value: unknown, status: ComparisonStatus): NonNullable<PickupEvidenceComparison['reviewBand']> {
  if (
    value === 'acceptable' ||
    value === 'minor_review' ||
    value === 'major_review' ||
    value === 'material_discrepancy'
  ) {
    return value;
  }

  if (status === 'matches_expected') return 'acceptable';
  if (status === 'material_discrepancy') return 'material_discrepancy';
  return 'major_review';
}

export function derivePickupComparisonStatusFromScores(parsedStatus: ComparisonStatus, scores: {
  identity: number;
  quantity: number;
  condition: number;
  overall: number;
}): ComparisonStatus {
  if (scores.identity < 60 || scores.quantity < 55 || scores.condition < 50) {
    return 'material_discrepancy';
  }

  if (scores.identity < 78 || scores.quantity < 75 || scores.condition < 72 || scores.overall < 75) {
    return 'review_needed';
  }

  if (parsedStatus === 'material_discrepancy' && scores.overall >= 75) {
    return 'review_needed';
  }

  return parsedStatus === 'review_needed' ? 'review_needed' : 'matches_expected';
}

function mimeTypeFromUrl(url: string): string {
  const cleanUrl = url.split('?')[0]?.toLowerCase() || '';
  if (cleanUrl.endsWith('.png')) return 'image/png';
  if (cleanUrl.endsWith('.webp')) return 'image/webp';
  if (cleanUrl.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function normalizeImageMediaType(value: string | null, url: string): ClaudeImageMediaType {
  const candidate = value?.split(';')[0]?.trim().toLowerCase();
  if (candidate === 'image/png' || candidate === 'image/gif' || candidate === 'image/webp') {
    return candidate;
  }
  return mimeTypeFromUrl(url) as ClaudeImageMediaType;
}

async function imageUrlToBase64(url: string): Promise<{ mimeType: ClaudeImageMediaType; data: string }> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`Could not fetch pickup comparison image (${response.status})`);
  }

  const mimeType = normalizeImageMediaType(response.headers.get('content-type'), url);
  const data = Buffer.from(await response.arrayBuffer()).toString('base64');

  return { mimeType, data };
}

async function imageUrlToInlinePart(url: string): Promise<{ inlineData: { mimeType: string; data: string } }> {
  const image = await imageUrlToBase64(url);

  return {
    inlineData: {
      mimeType: image.mimeType,
      data: image.data,
    },
  };
}

function formatAsset(assetType: string, assetDetails?: Record<string, unknown> | null): string {
  const details = assetDetails || {};
  const parts = [
    details.make,
    details.brand,
    details.model,
    details.year,
    details.propertyType,
    details.category,
  ]
    .filter((part) => part !== undefined && part !== null && String(part).trim().length > 0)
    .map(String);

  return `${parts.join(' ') || assetType} (${assetType})`;
}

export function buildPickupComparisonPrompt(input: PickupEvidenceComparisonInput): string {
  return [
    'You are comparing insurance salvage pickup evidence.',
    'Original photos show the asset during adjuster inspection. Pickup photos show the asset when the winning buyer arrived for handoff.',
    'Your job is to identify whether the pickup photos materially match the original inspection asset, quantity, and visible condition.',
    'Do not estimate price. Do not mention hidden damage you cannot see.',
    'Different camera, lens, lighting, distance, rotation, and photo angles are expected. Do not flag a discrepancy for angle, lighting, background, or photo-count differences alone.',
    'Compare stable visible evidence: same asset identity, same major components, same count/quantity range, same visible damage class, no obvious new damage, no removed valuable parts, no materially reduced stock.',
    'For vehicles/equipment, focus on missing major components, different item identity, removed parts, and clearly worse condition.',
    'For stock, goods-in-transit, fire, property, furniture, agriculture, or bulk materials, focus on quantity/count, package condition, visible contamination, burn/water damage, broken seals, missing units, and whether the same goods appear present.',
    'Flag material_discrepancy only for clear visible problems such as missing major components, substantially fewer quantity items, different asset, or obviously worse condition.',
    'Use review_needed when photo angles are insufficient, image quality is poor, or differences are possible but not certain.',
    'Score assetIdentityScore, quantityMatchScore, conditionMatchScore, and overallMatchScore from 0-100.',
    'Threshold guide: 85-100 acceptable, 75-84 minor_review, 60-74 major_review, below 60 material_discrepancy. Use status material_discrepancy only when a material issue is clearly visible.',
    'Write 4-8 non-repetitive findings. Each finding must state what was actually compared and the visible evidence supporting it.',
    'The findings must collectively cover: (1) asset identity and distinguishing cues, (2) visible item count, stock quantity, or major-component completeness, (3) visible condition and whether prior damage is consistent, worsened, or improved, and (4) photo coverage or any uncertainty that staff must review.',
    'Populate identityFinding, quantityFinding, conditionFinding, and coverageFinding with those four evidence-specific conclusions, then use findings for any additional non-repetitive observations.',
    'Name separately visible items, packages, components, or damage zones when the photos support it. For a furniture set, for example, address each visible sofa, chair, table, or cabinet rather than calling everything furniture.',
    'When the sets match, explain the affirmative matching evidence in detail. Do not collapse a high match into one generic sentence.',
    'Put only genuine visible differences in observedDifferences. Return an empty array when no difference is visible; never invent a discrepancy to fill the array.',
    'recommendedStaffAction must be a specific, complete instruction based on the scores, findings, differences, and evidence limitations.',
    `Asset: ${formatAsset(input.assetType, input.assetDetails)}`,
    `Declared asset details: ${JSON.stringify(input.assetDetails || {}).slice(0, 2500)}`,
    `Original AI assessment and damage record: ${JSON.stringify(input.aiAssessment || {}).slice(0, 6000)}`,
    `Original photo count: ${input.originalPhotoUrls.length}. Pickup photo count: ${input.pickupPhotoUrls.length}.`,
    'Return detailed but direct JSON for an insurance salvage manager. Do not include prose outside the JSON object.',
  ].join('\n');
}

function normalizeAiComparison(
  parsed: unknown,
  input: PickupEvidenceComparisonInput,
  baseComparison: PickupEvidenceComparison,
  method: 'gemini_ai' | 'claude_ai',
  provider: 'gemini' | 'claude'
): PickupEvidenceComparison {
  const result: UnknownRecord = typeof parsed === 'object' && parsed !== null
    ? parsed as UnknownRecord
    : {};
  const status = normalizeStatus(result.status);
  const assetIdentityScore = clampScore(result.assetIdentityScore, status === 'matches_expected' ? 86 : 70);
  const quantityMatchScore = clampScore(result.quantityMatchScore, status === 'matches_expected' ? 86 : 70);
  const conditionMatchScore = clampScore(result.conditionMatchScore, status === 'matches_expected' ? 86 : 70);
  const overallMatchScore = clampScore(
    result.overallMatchScore,
    Math.round((assetIdentityScore * 0.4) + (quantityMatchScore * 0.35) + (conditionMatchScore * 0.25))
  );
  const scoreAdjustedStatus = derivePickupComparisonStatusFromScores(status, {
    identity: assetIdentityScore,
    quantity: quantityMatchScore,
    condition: conditionMatchScore,
    overall: overallMatchScore,
  });
  const structuredFindings = [
    result.identityFinding,
    result.quantityFinding,
    result.conditionFinding,
    result.coverageFinding,
  ].filter((finding): finding is string => typeof finding === 'string' && finding.trim().length > 0);
  const additionalFindings = Array.isArray(result.findings) ? result.findings : [];
  const findings = normalizeTextArray(
    [...structuredFindings, ...additionalFindings],
    baseComparison.findings
  );
  const observedDifferences = normalizeTextArray(result.observedDifferences, []);
  const confidenceScore = Math.min(
    clampScore(result.confidenceScore, baseComparison.confidenceScore),
    input.pickupPhotoUrls.length < 3 ? 80 : 95
  );

  return {
    status: scoreAdjustedStatus,
    confidenceScore,
    overallMatchScore,
    assetIdentityScore,
    quantityMatchScore,
    conditionMatchScore,
    reviewBand: normalizeReviewBand(result.reviewBand, scoreAdjustedStatus),
    findings,
    observedDifferences,
    recommendedStaffAction:
      typeof result.recommendedStaffAction === 'string' && result.recommendedStaffAction.trim()
        ? result.recommendedStaffAction.trim()
        : baseComparison.recommendedStaffAction,
    originalPhotoCount: input.originalPhotoUrls.length,
    pickupPhotoCount: input.pickupPhotoUrls.length,
    comparedAt: new Date().toISOString(),
    method,
    provider,
  };
}

function parseClaudeJson(responseText: string): unknown {
  const cleaned = responseText
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned || '{}');
}

async function compareWithGemini(
  input: PickupEvidenceComparisonInput,
  baseComparison: PickupEvidenceComparison
): Promise<PickupEvidenceComparison | null> {
  if (pickupGeminiDisabledForProcess) return null;
  if (!isGeminiEnabled()) return null;

  const model = getGeminiModel();
  if (!model) return null;

  const originalPhotos = input.originalPhotoUrls.slice(0, 5);
  const pickupPhotos = input.pickupPhotoUrls.slice(0, 5);
  const originalParts = await Promise.all(originalPhotos.map(imageUrlToInlinePart));
  const pickupParts = await Promise.all(pickupPhotos.map(imageUrlToInlinePart));

  const contentParts: Part[] = [{ text: buildPickupComparisonPrompt(input) }];
  originalParts.forEach((part, index) => {
    contentParts.push({ text: `Original inspection photo ${index + 1}` }, part);
  });
  pickupParts.forEach((part, index) => {
    contentParts.push({ text: `Pickup evidence photo ${index + 1}` }, part);
  });

  let result;
  try {
    result = await model.generateContent({
      contents: [{ role: 'user', parts: contentParts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: PICKUP_COMPARISON_SCHEMA as Schema,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/api key was reported as leaked|403|forbidden|api[_\s-]?key/i.test(message)) {
      pickupGeminiDisabledForProcess = true;
      console.warn('[Pickup Evidence] Gemini disabled for this process after authentication failure. Rotate GEMINI_API_KEY to re-enable.');
      return null;
    }
    throw error;
  }

  const response = await result.response;
  const parsed = JSON.parse(response.text() || '{}');
  return normalizeAiComparison(parsed, input, baseComparison, 'gemini_ai', 'gemini');
}

async function compareWithClaude(
  input: PickupEvidenceComparisonInput,
  baseComparison: PickupEvidenceComparison
): Promise<PickupEvidenceComparison | null> {
  if (!isClaudePickupFallbackEnabled()) return null;
  if (!isClaudeEnabled()) return null;

  const client = getClaudeClient();
  if (!client) return null;

  const originalPhotos = input.originalPhotoUrls.slice(0, 5);
  const pickupPhotos = input.pickupPhotoUrls.slice(0, 5);
  const originalParts = await Promise.all(originalPhotos.map(imageUrlToBase64));
  const pickupParts = await Promise.all(pickupPhotos.map(imageUrlToBase64));

  const content: ContentBlockParam[] = [{ type: 'text', text: buildPickupComparisonPrompt(input) }];
  originalParts.forEach((photo, index) => {
    content.push({ type: 'text', text: `Original inspection photo ${index + 1}` });
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: photo.mimeType,
        data: photo.data,
      },
    });
  });
  pickupParts.forEach((photo, index) => {
    content.push({ type: 'text', text: `Pickup evidence photo ${index + 1}` });
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: photo.mimeType,
        data: photo.data,
      },
    });
  });

  const response = await client.messages.create({
    model: getClaudeModelName(),
    max_tokens: 1400,
    messages: [{ role: 'user', content }],
    system:
      'You are an insurance salvage evidence reviewer. Return ONLY valid JSON with status, confidenceScore, overallMatchScore, assetIdentityScore, quantityMatchScore, conditionMatchScore, reviewBand, identityFinding, quantityFinding, conditionFinding, coverageFinding, findings, observedDifferences, and recommendedStaffAction.',
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('Claude pickup comparison returned no text content.');
  }

  const parsed = parseClaudeJson(textContent.text);
  return normalizeAiComparison(parsed, input, baseComparison, 'claude_ai', 'claude');
}

export function buildRuleBasedPickupComparison(input: {
  originalPhotoCount: number;
  pickupPhotoCount: number;
  hasAiAssessment: boolean;
  method?: PickupEvidenceComparison['method'];
  extraFindings?: string[];
}): PickupEvidenceComparison {
  const findings: string[] = [...(input.extraFindings || [])];
  let status: ComparisonStatus = 'matches_expected';
  let confidenceScore = 70;

  if (!input.hasAiAssessment) {
    findings.push('Original AI assessment is unavailable, so staff should manually compare the evidence.');
    status = 'review_needed';
    confidenceScore -= 15;
  }

  if (input.pickupPhotoCount < 3) {
    findings.push('Vendor submitted fewer than 3 pickup photos.');
    status = 'review_needed';
    confidenceScore -= 20;
  }

  if (input.originalPhotoCount >= 5 && input.pickupPhotoCount <= 1) {
    findings.push('Pickup evidence has materially fewer photos than the original inspection set.');
    status = 'material_discrepancy';
    confidenceScore -= 25;
  } else if (input.originalPhotoCount > 0 && input.pickupPhotoCount < Math.ceil(input.originalPhotoCount / 2)) {
    findings.push('Pickup evidence covers less than half of the original photo count.');
    status = 'review_needed';
    confidenceScore -= 15;
  }

  if (findings.length === 0) {
    findings.push('Pickup evidence volume is reasonable against the original inspection record.');
  }

  return {
    status,
    confidenceScore: Math.max(0, Math.min(100, confidenceScore)),
    overallMatchScore: Math.max(0, Math.min(100, confidenceScore)),
    assetIdentityScore: status === 'matches_expected' ? 80 : 65,
    quantityMatchScore: status === 'matches_expected' ? 80 : 60,
    conditionMatchScore: status === 'matches_expected' ? 80 : 60,
    reviewBand:
      status === 'matches_expected'
        ? 'acceptable'
        : status === 'material_discrepancy'
          ? 'material_discrepancy'
          : 'major_review',
    findings,
    observedDifferences: [],
    recommendedStaffAction:
      status === 'matches_expected'
        ? 'Review the pickup photos during normal staff confirmation.'
        : 'Open the pickup evidence photos and compare them against the original inspection before confirming release.',
    originalPhotoCount: input.originalPhotoCount,
    pickupPhotoCount: input.pickupPhotoCount,
    comparedAt: new Date().toISOString(),
    method: input.method || 'rule_based',
  };
}

export async function comparePickupEvidence(
  input: PickupEvidenceComparisonInput
): Promise<PickupEvidenceComparison> {
  const originalPhotoUrls = input.originalPhotoUrls || [];
  const pickupPhotoUrls = input.pickupPhotoUrls || [];
  const baseComparison = buildRuleBasedPickupComparison({
    originalPhotoCount: originalPhotoUrls.length,
    pickupPhotoCount: pickupPhotoUrls.length,
    hasAiAssessment: !!input.aiAssessment,
  });

  const aiComparisonEnabled = process.env.PICKUP_EVIDENCE_AI_COMPARE_ENABLED !== 'false';
  if (!aiComparisonEnabled || originalPhotoUrls.length === 0 || pickupPhotoUrls.length === 0) {
    return baseComparison;
  }

  try {
    const geminiComparison = await compareWithGemini(input, baseComparison);
    if (geminiComparison) return geminiComparison;

    const claudeComparison = await compareWithClaude(input, baseComparison);
    if (claudeComparison) return claudeComparison;

    return baseComparison;
  } catch (error) {
    console.warn('[Pickup Evidence] Primary AI comparison failed. Trying Claude fallback.', error);
    try {
      const claudeComparison = await compareWithClaude(input, baseComparison);
      if (claudeComparison) return claudeComparison;
    } catch (claudeError) {
      console.warn('[Pickup Evidence] Claude fallback comparison failed; falling back to rule-based review.', claudeError);
    }
  }

  return buildRuleBasedPickupComparison({
    originalPhotoCount: originalPhotoUrls.length,
    pickupPhotoCount: pickupPhotoUrls.length,
    hasAiAssessment: !!input.aiAssessment,
    method: 'ai_failed_fallback',
    extraFindings: ['AI visual comparison was unavailable, so staff should manually compare original and pickup evidence.'],
  });
}
