import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as confirmPickup } from '@/app/api/pickups/confirm/route';
import { POST as lookupPickup } from '@/app/api/pickups/lookup/route';

const authMock = vi.fn();
const confirmPickupByStaffMock = vi.fn();
const getPickupContextByCodeMock = vi.fn();

vi.mock('@/lib/auth/next-auth.config', () => ({
  auth: () => authMock(),
}));

vi.mock('@/features/pickups/services/pickup-confirmation.service', async () => {
  const actual = await vi.importActual<typeof import('@/features/pickups/services/pickup-confirmation.service')>(
    '@/features/pickups/services/pickup-confirmation.service'
  );

  return {
    ...actual,
    confirmPickupByStaff: (...args: unknown[]) => confirmPickupByStaffMock(...args),
    getPickupContextByCode: (...args: unknown[]) => getPickupContextByCodeMock(...args),
  };
});

function jsonRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/pickups/confirm', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'vitest',
    },
    body: JSON.stringify(body),
  }) as any;
}

describe('pickup staff routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated staff confirmation requests', async () => {
    authMock.mockResolvedValue(null);

    const response = await confirmPickup(jsonRequest({ pickupAuthCode: 'AUTH-ABCDEF12' }));

    expect(response.status).toBe(401);
    expect(confirmPickupByStaffMock).not.toHaveBeenCalled();
  });

  it('forwards actor context and pickup code to the staff confirmation service', async () => {
    authMock.mockResolvedValue({
      user: {
        id: 'manager-user-id',
        name: 'Manager User',
        role: 'salvage_manager',
      },
    });
    confirmPickupByStaffMock.mockResolvedValue({
      auctionId: 'auction-id',
      pickupConfirmedAdmin: true,
      lifecycleStatus: 'staff_confirmed',
    });

    const response = await confirmPickup(jsonRequest({
      pickupAuthCode: 'AUTH-ABCDEF12',
      notes: 'ID checked at gate',
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(confirmPickupByStaffMock).toHaveBeenCalledWith(expect.objectContaining({
      pickupAuthCode: 'AUTH-ABCDEF12',
      notes: 'ID checked at gate',
      actor: expect.objectContaining({
        userId: 'manager-user-id',
        role: 'salvage_manager',
      }),
    }));
  });

  it('blocks pickup lookup for vendor users', async () => {
    authMock.mockResolvedValue({
      user: {
        id: 'vendor-user-id',
        role: 'vendor',
      },
    });

    const response = await lookupPickup(jsonRequest({ pickupAuthCode: 'AUTH-ABCDEF12' }));

    expect(response.status).toBe(403);
    expect(getPickupContextByCodeMock).not.toHaveBeenCalled();
  });
});
