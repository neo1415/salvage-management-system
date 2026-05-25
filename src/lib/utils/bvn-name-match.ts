/**
 * Split registration fullName for Dojah BVN checks (first_name / last_name params).
 * Nigerian IDs often use surname-first in daily life but BVN stores official first/last.
 */
export type BvnNameParts = { firstName: string; lastName: string };

export function splitFullNameForBvn(fullName: string): {
  attempts: BvnNameParts[];
} {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return { attempts: [{ firstName: '', lastName: '' }] };
  }
  if (words.length === 1) {
    return { attempts: [{ firstName: words[0], lastName: words[0] }] };
  }

  const western: BvnNameParts = {
    firstName: words[0],
    lastName: words.slice(1).join(' '),
  };

  if (words.length === 2) {
    const swapped: BvnNameParts = {
      firstName: words[1],
      lastName: words[0],
    };
    return { attempts: uniqueAttempts([western, swapped]) };
  }

  const surnameLast: BvnNameParts = {
    firstName: words.slice(0, -1).join(' '),
    lastName: words[words.length - 1],
  };

  const surnameFirst: BvnNameParts = {
    firstName: words[1],
    lastName: [words[0], ...words.slice(2)].join(' '),
  };

  return { attempts: uniqueAttempts([western, surnameLast, surnameFirst]) };
}

function uniqueAttempts(list: BvnNameParts[]): BvnNameParts[] {
  const seen = new Set<string>();
  const out: BvnNameParts[] = [];
  for (const p of list) {
    const key = `${p.firstName.toLowerCase()}|${p.lastName.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}
