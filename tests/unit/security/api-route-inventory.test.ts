import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const apiRoot = join(root, 'src', 'app', 'api');

const INTENTIONALLY_PUBLIC_OR_PRE_AUTH = new Set([
  'src/app/api/auth/[...nextauth]/route.ts',
  'src/app/api/auth/clear-session/route.ts',
  'src/app/api/auth/forgot-password/route.ts',
  'src/app/api/auth/login/route.ts',
  'src/app/api/auth/logout/route.ts',
  'src/app/api/auth/mfa/start/route.ts',
  'src/app/api/auth/oauth/complete/route.ts',
  'src/app/api/auth/register/route.ts',
  'src/app/api/auth/resend-otp/route.ts',
  'src/app/api/auth/reset-password/route.ts',
  'src/app/api/auth/validate-reset-token/route.ts',
  'src/app/api/auctions/[id]/watching-count/route.ts',
  'src/app/api/business-policy/public/route.ts',
  'src/app/api/config/system/route.ts',
  'src/app/api/contact/route.ts',
  'src/app/api/health/kyc/route.ts',
  'src/app/api/intelligence/health/route.ts',
  'src/app/api/locations/autocomplete/route.ts',
  'src/app/api/otp/resend/route.ts',
  'src/app/api/otp/verify/route.ts',
  'src/app/api/socket/route.ts',
  'src/app/api/valuations/makes/route.ts',
  'src/app/api/valuations/models/route.ts',
  'src/app/api/valuations/years/route.ts',
  'src/app/api/vendor/settings/profile/route.ts',
  'src/app/api/vendors/leaderboard/route.ts',
  'src/app/api/webhooks/dojah/route.ts',
  'src/app/api/webhooks/flutterwave/route.ts',
  'src/app/api/webhooks/paystack/route.ts',
  'src/app/api/webhooks/paystack-auction/route.ts',
]);

function walkRoutes(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return walkRoutes(fullPath);
    if (entry.name === 'route.ts') return [fullPath];
    return [];
  });
}

function normalize(fullPath: string) {
  return relative(root, fullPath).replace(/\\/g, '/');
}

function hasUserAuth(source: string) {
  return /\bauth\s*\(|getServerSession|requireAuth|withAuth|session\?\.user|session\.user/.test(source);
}

function hasCronSecret(source: string) {
  return /process\.env\.CRON_SECRET|CRON_SECRET/.test(source)
    && /authorization|Authorization|Bearer/.test(source);
}

function hasWebhookSignature(source: string) {
  return /signature|verif-hash|x-paystack-signature|x-dojah-signature|x-signature/.test(source)
    && /timingSafeEqual|createHmac|processFlutterwaveWebhook|verifyWebhookSecret|verifySignature/.test(source);
}

function hasServerSideGate(source: string) {
  return hasUserAuth(source) || hasCronSecret(source) || hasWebhookSignature(source);
}

function isDocumentedPublicRoute(routePath: string) {
  return INTENTIONALLY_PUBLIC_OR_PRE_AUTH.has(routePath);
}

describe('API route authorization inventory', () => {
  const routes = walkRoutes(apiRoot).map((fullPath) => ({
    path: normalize(fullPath),
    source: readFileSync(fullPath, 'utf8'),
  }));

  it('keeps every API route either authenticated or explicitly documented as public/pre-auth', () => {
    const unclassified = routes
      .filter((route) => !hasServerSideGate(route.source))
      .filter((route) => !isDocumentedPublicRoute(route.path))
      .map((route) => route.path);

    expect(unclassified).toEqual([]);
  });

  it('keeps the public/pre-auth allowlist honest', () => {
    const existingRoutes = new Set(routes.map((route) => route.path));
    const staleAllowlistEntries = [...INTENTIONALLY_PUBLIC_OR_PRE_AUTH].filter(
      (routePath) => !existingRoutes.has(routePath)
    );

    expect(staleAllowlistEntries).toEqual([]);
  });
});
