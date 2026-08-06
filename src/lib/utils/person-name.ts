import { splitFullNameForBvn, type BvnNameParts } from '@/lib/utils/bvn-name-match';

export type ParsedLegalName = BvnNameParts & { middleName?: string };

/**
 * Split a single full name typed in BVN order: First [Middle…] Surname.
 * e.g. "Chidi Emeka Nwosu" → Chidi / Emeka / Nwosu
 */
export function parseFullNameBvnOrder(fullName: string): ParsedLegalName {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { firstName: '', lastName: '' };
  if (words.length === 1) return { firstName: words[0], lastName: words[0] };
  if (words.length === 2) {
    return { firstName: words[0], lastName: words[1] };
  }
  return {
    firstName: words[0],
    middleName: words.slice(1, -1).join(' '),
    lastName: words[words.length - 1],
  };
}

export function buildFullName(
  firstName: string,
  lastName: string,
  middleName?: string | null
): string {
  return [firstName, middleName?.trim(), lastName]
    .filter((p) => p && String(p).trim())
    .join(' ')
    .trim();
}

export type UserLegalNameSource = {
  fullName: string;
};

/** Derive first/middle/last from full_name (BVN order) for Dojah; retry swapped order for 2-word names. */
export function resolveUserLegalNamesForBvn(user: UserLegalNameSource): {
  primary: BvnNameParts & { middleName?: string };
  alternateAttempts: ParsedLegalName[];
} {
  const primary = parseFullNameBvnOrder(user.fullName);
  const words = user.fullName.trim().split(/\s+/).filter(Boolean);
  const { attempts } = splitFullNameForBvn(user.fullName);
  const candidates: ParsedLegalName[] = [...attempts];

  if (words.length > 2) {
    candidates.push({
      firstName: words[1],
      middleName: words.slice(2).join(' '),
      lastName: words[0],
    });
    candidates.push({
      firstName: words[words.length - 1],
      middleName: words.slice(1, -1).join(' '),
      lastName: words[0],
    });
  }

  const primaryKey = legalNameKey(primary);
  const seen = new Set([primaryKey]);
  const alternateAttempts = candidates.filter((attempt) => {
    const key = legalNameKey(attempt);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { primary, alternateAttempts };
}

function legalNameKey(name: ParsedLegalName): string {
  return `${name.firstName}|${name.middleName ?? ''}|${name.lastName}`.toLowerCase();
}
