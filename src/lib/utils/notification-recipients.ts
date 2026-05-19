/**
 * Filters test / placeholder accounts from outbound notifications.
 */

export function isTestOrPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return true;

  const lower = email.trim().toLowerCase();

  return (
    lower.endsWith('@test.com') ||
    lower.endsWith('@example.com') ||
    lower.endsWith('@mailinator.com') ||
    lower.startsWith('test@') ||
    lower.includes('+test@') ||
    lower.includes('test.user@') ||
    lower.includes('e2e+') ||
    lower.includes('playwright+')
  );
}
