export type DamageAction =
  | 'repair'
  | 'replace'
  | 'clean_or_restore'
  | 'sort_or_recover'
  | 'dispose'
  | 'specialist_review';

export interface DamageEvidence {
  part: string;
  damageType?: string;
  description?: string;
  recommendedAction?: DamageAction;
  actionConfidence?: number;
  severity: 'minor' | 'moderate' | 'severe';
  confidence: number;
}

const DAMAGE_ACTIONS = new Set<DamageAction>([
  'repair',
  'replace',
  'clean_or_restore',
  'sort_or_recover',
  'dispose',
  'specialist_review',
]);

export function normalizeDamageAction(value: unknown): DamageAction {
  return typeof value === 'string' && DAMAGE_ACTIONS.has(value as DamageAction)
    ? value as DamageAction
    : 'specialist_review';
}

export function formatDamageAction(action?: DamageAction): string | null {
  if (!action) return null;
  const labels: Record<DamageAction, string> = {
    repair: 'Repair',
    replace: 'Replace',
    clean_or_restore: 'Clean / restore',
    sort_or_recover: 'Sort / recover',
    dispose: 'Dispose',
    specialist_review: 'Specialist review',
  };
  return labels[action];
}

const LEADING_DAMAGE_PATTERN = /^(shattered|cracked|broken|(?:deeply\s+)?dented|smashed|crushed|bent|buckled|twisted|torn|burnt|burned|charred|melted|scorched|deployed|collapsed|(?:water|fire|smoke|heat|impact)[- ]damaged|(?:water|smoke|fluid|oil|mold|mould)[- ]contaminated|heat[- ]warped|water[- ]swollen|waterlogged|soaked|flooded|contaminated|corroded|rusted|warped|swollen|mouldy|moldy|spoiled|rotted|missing|detached|punctured|scratched)\b[\s:-]*/i;

export function formatDamageEvidence(evidence: Pick<DamageEvidence, 'part' | 'damageType' | 'description'>): string {
  const description = evidence.description?.trim();
  if (description) return description;
  const part = evidence.part.trim();
  const damageType = evidence.damageType?.trim();
  if (damageType && !part.toLowerCase().startsWith(damageType.toLowerCase())) {
    return `${damageType} ${part}`;
  }
  return part;
}

export function normalizeDamageEvidence(input: DamageEvidence): DamageEvidence {
  const rawPart = input.part.trim() || 'affected item';
  const inferred = rawPart.match(LEADING_DAMAGE_PATTERN)?.[1]?.toLowerCase();
  const canonicalPart = inferred ? rawPart.replace(LEADING_DAMAGE_PATTERN, '').trim() || rawPart : rawPart;
  const damageType = input.damageType?.trim().toLowerCase() || inferred;
  const description = formatDamageEvidence({
    part: canonicalPart,
    damageType,
    description: input.description,
  });
  const normalized = { ...input, part: canonicalPart, damageType, description };
  if (input.recommendedAction !== undefined || input.actionConfidence !== undefined) {
    const recommendedAction = normalizeDamageAction(input.recommendedAction);
    const rawActionConfidence = Number(input.actionConfidence);
    const actionConfidence = Number.isFinite(rawActionConfidence)
      ? Math.min(100, Math.max(0, rawActionConfidence))
      : 0;
    return { ...normalized, recommendedAction, actionConfidence };
  }
  return normalized;
}
