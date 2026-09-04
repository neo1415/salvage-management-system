import { normalizeNigerianPhone } from './phone';

export function getTelephoneHref(phone?: string | null): string | null {
  if (typeof phone !== 'string') return null;
  const trimmed = phone.trim();
  if (!trimmed || trimmed.includes('@') || /[a-z]/i.test(trimmed)) return null;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;

  const normalized = digits.startsWith('234') || digits.length === 10 || /^0\d{10}$/.test(digits)
    ? normalizeNigerianPhone(trimmed)
    : `+${digits}`;
  const normalizedDigits = normalized.replace(/\D/g, '');
  return normalizedDigits.length >= 10 && normalizedDigits.length <= 15
    ? `tel:${normalized}`
    : null;
}
