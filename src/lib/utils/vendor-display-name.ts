export type VendorDisplayNameSource = {
  businessName?: string | null;
  fullName?: string | null;
  email?: string | null;
};

/**
 * Prefer registered business name; fall back to vendor user full name when Tier 2
 * business details are incomplete or missing.
 */
export function formatVendorDisplayName(
  vendor: VendorDisplayNameSource | null | undefined,
  fallback = 'Individual vendor'
): string {
  const business = vendor?.businessName?.trim();
  if (business) return business;

  const fullName = vendor?.fullName?.trim();
  if (fullName) return fullName;

  const email = vendor?.email?.trim();
  if (email) return email;

  return fallback;
}
