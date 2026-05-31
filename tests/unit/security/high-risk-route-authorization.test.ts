import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function readRoute(relativePath: string) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('high-risk API route authorization guardrails', () => {
  const routesThatMustAuthenticate = [
    'src/app/api/payments/[id]/verify/route.ts',
    'src/app/api/payments/[id]/upload-proof/route.ts',
    'src/app/api/auctions/[id]/confirm-pickup/route.ts',
    'src/app/api/auctions/check-expired/route.ts',
    'src/app/api/auctions/check-and-activate-scheduled/route.ts',
    'src/app/api/auctions/scheduled-status/route.ts',
    'src/app/api/admin/cache/refresh/route.ts',
    'src/app/api/reports/operational/auction-performance/route.ts',
    'src/app/api/settings/privacy/route.ts',
  ];

  it.each(routesThatMustAuthenticate)('%s requires an authenticated session', (routePath) => {
    const source = readRoute(routePath);

    expect(source).toContain("auth } from '@/lib/auth/next-auth.config'");
    expect(source).toMatch(/await auth\(\)/);
    expect(source).toMatch(/Unauthorized/);
  });

  it('finance payment verification uses the signed-in finance officer, not a browser-supplied id', () => {
    const source = readRoute('src/app/api/payments/[id]/verify/route.ts');

    expect(source).toContain('const financeOfficerId = session.user.id');
    expect(source).not.toContain('financeOfficerId, action, comment');
  });

  it('payment proof upload checks payment ownership before accepting files', () => {
    const source = readRoute('src/app/api/payments/[id]/upload-proof/route.ts');

    expect(source).toContain('vendor.userId !== session.user.id');
    expect(source).toContain('Only the payment owner can upload proof');
  });

  it('pickup confirmation checks the winning vendor session before confirming pickup', () => {
    const source = readRoute('src/app/api/auctions/[id]/confirm-pickup/route.ts');

    expect(source).toContain('auction.currentBidder !== vendorId');
    expect(source).toContain('vendor.userId !== session.user.id');
  });
});
