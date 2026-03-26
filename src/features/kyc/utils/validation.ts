/**
 * KYC validation utilities
 * Pure functions — no side effects, fully testable.
 */

/** Returns true iff value is exactly 11 decimal digits */
export function isValidNIN(value: string): boolean {
  return /^\d{11}$/.test(value);
}

/** Returns true iff value is exactly 11 decimal digits (BVN uses same format) */
export function isValidBVN(value: string): boolean {
  return /^\d{11}$/.test(value);
}

/**
 * Returns true if the document expiry date is in the past (expired).
 * @param expiryDate ISO 8601 date string (YYYY-MM-DD)
 */
export function isDocumentExpired(expiryDate: string): boolean {
  const expiry = new Date(expiryDate);
  if (isNaN(expiry.getTime())) return true; // treat unparseable as expired
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expiry < today;
}

/**
 * Returns true if the utility bill date is within the last 3 calendar months.
 * @param billDate ISO 8601 date string (YYYY-MM-DD)
 */
export function isUtilityBillRecent(billDate: string): boolean {
  const bill = new Date(billDate);
  if (isNaN(bill.getTime())) return false;
  const today = new Date();
  const threeMonthsAgo = new Date(today);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  threeMonthsAgo.setHours(0, 0, 0, 0);
  return bill >= threeMonthsAgo;
}

/**
 * Returns true if the file size is within the allowed limit.
 * @param bytes File size in bytes
 * @param limitMB Maximum allowed size in megabytes
 */
export function isFileSizeValid(bytes: number, limitMB: number): boolean {
  return bytes <= limitMB * 1024 * 1024;
}

/**
 * Returns the Cloudinary folder path for a KYC document.
 * Pattern: kyc-documents/{vendorId}/{documentType}
 */
export function getCloudinaryFolderPath(vendorId: string, documentType: string): string {
  return `kyc-documents/${vendorId}/${documentType}`;
}

/**
 * Fuzzy name match using Levenshtein-based similarity.
 * Returns true if similarity >= threshold (0–100).
 *
 * Uses a simple normalised edit-distance approach suitable for Nigerian names.
 */
export function fuzzyNameMatch(a: string, b: string, threshold: number): boolean {
  const score = nameSimilarity(a, b);
  return score >= threshold;
}

/** Returns similarity score 0–100 between two name strings */
export function nameSimilarity(a: string, b: string): number {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .trim()
      .replace(/\s+/g, ' ');

  const na = norm(a);
  const nb = norm(b);

  if (na === nb) return 100;
  if (!na || !nb) return 0;

  const maxLen = Math.max(na.length, nb.length);
  const dist = levenshtein(na, nb);
  return Math.round(((maxLen - dist) / maxLen) * 100);
}

/** Standard Levenshtein edit distance */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
