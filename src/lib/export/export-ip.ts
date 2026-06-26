/**
 * IP address visibility for CSV/exports.
 * Full IP is shown only to system_admin; all other roles get a redacted value.
 */
export function formatExportIpAddress(
  ip: string | null | undefined,
  viewerRole: string | undefined
): string {
  if (viewerRole === 'system_admin') {
    return ip?.trim() || 'unknown';
  }
  return 'redacted';
}
