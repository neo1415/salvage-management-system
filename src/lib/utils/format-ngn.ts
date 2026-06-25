/**
 * Consistent Nigerian Naira formatting for UI and exports.
 * Uses "NGN" prefix to avoid font/encoding issues with the ₦ symbol.
 */
export function formatNgnAmount(
  amount: number | string | null | undefined,
  options?: { decimals?: number; empty?: string }
): string {
  const empty = options?.empty ?? 'NGN 0';
  const decimals = options?.decimals ?? 2;

  if (amount === null || amount === undefined || amount === '') {
    return empty;
  }

  const numeric = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(numeric)) {
    return empty;
  }

  return `NGN ${numeric.toLocaleString('en-NG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatNgnAmountPlain(
  amount: number | string | null | undefined,
  options?: { decimals?: number }
): string {
  const formatted = formatNgnAmount(amount, { ...options, empty: '0' });
  return formatted.replace(/^NGN\s+/, '');
}
