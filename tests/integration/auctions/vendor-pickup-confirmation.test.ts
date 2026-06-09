import { describe, expect, it } from 'vitest';
import {
  generatePickupAuthorizationCode,
  verifyPickupAuthorizationCode,
  derivePickupLifecycleStatus,
} from '@/features/pickups/services/pickup-confirmation.service';

describe('vendor pickup confirmation contract', () => {
  it('uses the same code generated for the pickup authorization document', () => {
    const auctionId = 'abcdef12-3456-7890-abcd-ef1234567890';
    const generatedCode = generatePickupAuthorizationCode(auctionId);

    expect(generatedCode).toBe('AUTH-ABCDEF12');
    expect(verifyPickupAuthorizationCode(generatedCode, 'auth abcdef12')).toBe(true);
    expect(verifyPickupAuthorizationCode(generatedCode, 'AUTH-ABCDEF13')).toBe(false);
  });

  it('does not mark an auction ready until payment and pickup authorization both exist', () => {
    expect(derivePickupLifecycleStatus({
      hasVerifiedPayment: true,
      hasPickupAuthorization: false,
    })).toBe('not_ready');

    expect(derivePickupLifecycleStatus({
      hasVerifiedPayment: false,
      hasPickupAuthorization: true,
    })).toBe('not_ready');

    expect(derivePickupLifecycleStatus({
      hasVerifiedPayment: true,
      hasPickupAuthorization: true,
    })).toBe('ready_for_pickup');
  });
});
