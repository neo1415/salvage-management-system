/**
 * Admin-created vendors receive a provisional phone (+8{uuid}) until they add a real number.
 */
export function isProvisionalVendorPhone(phone: string | null | undefined): boolean {
  const trimmed = phone?.trim() ?? '';
  if (!trimmed) return true;
  return /^\+8\d{10,}$/.test(trimmed.replace(/\s/g, ''));
}

export function hasRealVendorPhone(phone: string | null | undefined): boolean {
  return !isProvisionalVendorPhone(phone);
}
