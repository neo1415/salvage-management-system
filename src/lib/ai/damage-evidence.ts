export interface DamageEvidence {
  part: string;
  damageType?: string;
  description?: string;
  severity: 'minor' | 'moderate' | 'severe';
  confidence: number;
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
  return { ...input, part: canonicalPart, damageType, description };
}
