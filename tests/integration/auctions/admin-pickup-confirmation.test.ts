import { describe, expect, it, vi } from 'vitest';

const confirmPickupByStaffMock = vi.fn();

vi.mock('@/features/pickups/services/pickup-confirmation.service', () => ({
  confirmPickupByStaff: (...args: unknown[]) => confirmPickupByStaffMock(...args),
}));

vi.mock('@/lib/auth/next-auth.config', () => ({
  auth: vi.fn().mockResolvedValue({
    user: {
      id: 'manager-user',
      name: 'Manager User',
      role: 'salvage_manager',
    },
  }),
}));

vi.mock('@/lib/utils/audit-logger', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils/audit-logger')>('@/lib/utils/audit-logger');
  return {
    ...actual,
    getIpAddress: vi.fn(() => '127.0.0.1'),
    getDeviceTypeFromUserAgent: vi.fn(() => actual.DeviceType.DESKTOP),
  };
});

import { POST } from '@/app/api/admin/auctions/[id]/confirm-pickup/route';

describe('admin auction pickup confirmation route', () => {
  it('confirms an auction pickup through the shared staff service', async () => {
    confirmPickupByStaffMock.mockResolvedValueOnce({
      auctionId: 'auction-123',
      pickupConfirmedAdmin: true,
      pickupConfirmedAdminAt: '2026-06-09T10:00:00.000Z',
      pickupConfirmedAdminBy: 'manager-user',
    });

    const response = await POST(
      new Request('http://localhost/api/admin/auctions/auction-123/confirm-pickup', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
        body: JSON.stringify({ notes: 'Code and ID checked at pickup desk' }),
      }) as any,
      { params: Promise.resolve({ id: 'auction-123' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.auction.pickupConfirmedAdmin).toBe(true);
    expect(confirmPickupByStaffMock).toHaveBeenCalledWith(expect.objectContaining({
      auctionId: 'auction-123',
      notes: 'Code and ID checked at pickup desk',
      actor: expect.objectContaining({
        userId: 'manager-user',
        role: 'salvage_manager',
      }),
    }));
  });

  it('returns a business error when payment is not verified yet', async () => {
    confirmPickupByStaffMock.mockRejectedValueOnce(new Error('Pickup cannot be confirmed until payment is verified.'));

    const response = await POST(
      new Request('http://localhost/api/admin/auctions/auction-123/confirm-pickup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }) as any,
      { params: Promise.resolve({ id: 'auction-123' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('payment is verified');
  });
});
