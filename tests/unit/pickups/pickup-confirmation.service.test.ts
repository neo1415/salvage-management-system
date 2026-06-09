import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/drizzle', () => ({
  db: {},
}));

vi.mock('@/features/notifications/services/notification.service', () => ({
  createNotification: vi.fn(),
}));

vi.mock('@/lib/utils/audit-logger', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils/audit-logger')>('@/lib/utils/audit-logger');
  return {
    ...actual,
    logAction: vi.fn(),
  };
});

vi.mock('@/lib/redis/client', () => ({
  cache: {
    del: vi.fn(),
  },
}));

describe('pickup confirmation helpers', () => {
  it('generates one deterministic authorization code per auction', async () => {
    const { generatePickupAuthorizationCode } = await import('@/features/pickups/services/pickup-confirmation.service');

    expect(generatePickupAuthorizationCode('abcdef12-3456-7890-abcd-ef1234567890')).toBe('AUTH-ABCDEF12');
  });

  it('normalizes pickup codes before comparison', async () => {
    const {
      normalizePickupCode,
      verifyPickupAuthorizationCode,
    } = await import('@/features/pickups/services/pickup-confirmation.service');

    expect(normalizePickupCode(' auth-abc 123 ')).toBe('AUTHABC123');
    expect(verifyPickupAuthorizationCode('AUTH-ABC123', ' auth abc-123 ')).toBe(true);
    expect(verifyPickupAuthorizationCode('AUTH-ABC123', 'AUTH-ABC124')).toBe(false);
  });

  it('derives lifecycle status from payment, authorization, and confirmation state', async () => {
    const { derivePickupLifecycleStatus } = await import('@/features/pickups/services/pickup-confirmation.service');

    expect(derivePickupLifecycleStatus({
      hasVerifiedPayment: false,
      hasPickupAuthorization: false,
    })).toBe('not_ready');

    expect(derivePickupLifecycleStatus({
      hasVerifiedPayment: true,
      hasPickupAuthorization: true,
    })).toBe('ready_for_pickup');

    expect(derivePickupLifecycleStatus({
      hasVerifiedPayment: true,
      hasPickupAuthorization: true,
      pickupConfirmedVendor: true,
    })).toBe('vendor_confirmed');

    expect(derivePickupLifecycleStatus({
      hasVerifiedPayment: true,
      hasPickupAuthorization: true,
      pickupConfirmedVendor: true,
      pickupConfirmedAdmin: true,
    })).toBe('staff_confirmed');
  });
});
