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
  alternateAttempts: BvnNameParts[];
} {
  const primary = parseFullNameBvnOrder(user.fullName);
  const { attempts } = splitFullNameForBvn(user.fullName);
  const primaryKey = `${primary.firstName}|${primary.lastName}`.toLowerCase();
  const alternateAttempts = attempts.filter(
    (a) => `${a.firstName}|${a.lastName}`.toLowerCase() !== primaryKey
  );
  return { primary, alternateAttempts };
}
