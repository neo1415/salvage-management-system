/**
 * Admin-created vendors receive a provisional phone (+8{uuid}) until they add a real number.
 */
export function isProvisionalVendorPhone(phone: string | null | undefined): boolean {
  const trimmed = phone?.trim() ?? '';
  if (!trimmed) return true;
  const normalized = trimmed.replace(/\s/g, '');
  // Admin placeholder uses +8 + UUID fragment (hex digits, not only 0-9)
  if (/^\+8[0-9a-f]{10,}$/i.test(normalized)) return true;
  return false;
}

export function hasRealVendorPhone(phone: string | null | undefined): boolean {
  return !isProvisionalVendorPhone(phone);
}
