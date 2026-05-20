/**
 * Nigerian phone normalization and lookup variants (DB stores +234…).
 */

export function normalizeNigerianPhone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed || trimmed.includes('@')) {
    return trimmed;
  }

  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    if (digits.startsWith('234')) return `+${digits}`;
    if (digits.length === 10) return `+234${digits}`;
    return `+${digits}`;
  }

  const digits = trimmed.replace(/\D/g, '');

  if (digits.startsWith('234')) {
    return `+${digits}`;
  }
  if (digits.startsWith('0')) {
    return `+234${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+234${digits}`;
  }

  return `+${digits}`;
}

/** All common stored/input formats for the same Nigerian mobile number. */
export function nigerianPhoneLookupVariants(phone: string): string[] {
  const normalized = normalizeNigerianPhone(phone);
  const digits = normalized.replace(/\D/g, '');
  const variants = new Set<string>();

  variants.add(phone.trim());
  variants.add(normalized);

  if (digits.startsWith('234') && digits.length >= 13) {
    const local = digits.slice(3);
    variants.add(`0${local}`);
    variants.add(digits);
    variants.add(`+${digits}`);
  }

  return [...variants].filter(Boolean);
}

export function looksLikeEmail(value: string): boolean {
  return value.includes('@');
}
