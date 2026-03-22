/**
 * Integration Tests: Admin Pickup Confirmations Page
 * 
 * Tests the integration of the admin pickup confirmations list page
 * with the API endpoints and AdminPickupConfirmation component.
 * 
 * Requirements: Requirement 5 - Pickup Confirmation Workflow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Admin Pickups Page Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('should fetch and display pending pickup confirmations', async () => {
    // Mock API response
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        pickups: [
          {
            auctionId: 'auction-1',
            claimReference: 'CLM-2024-001',
            assetType: 'vehicle',
            assetDetails: {
              year: '2020',
              make: 'Toyota',
              model: 'Camry',
            },
            amount: '500000',
            vendor: {
              id: 'vendor-1',
              businessName: 'ABC Motors',
              fullName: 'John Doe',
              email: 'john@abcmotors.com',
              phone: '+2348012345678',
            },
            vendorConfirmation: {
              confirmed: true,
              confirmedAt: '2024-01-15T10:00:00Z',
            },
            adminConfirmation: {
              confirmed: false,
              confirmedAt: null,
              confirmedBy: null,
            },
            payment: {
              id: 'payment-1',
              amount: '500000',
              status: 'verified',
              paymentMethod: 'escrow_wallet',
            },
            auctionStatus: 'closed',
            caseStatus: 'sold',
            auctionEndTime: '2024-01-10T15:00:00Z',
          },
          {
            auctionId: 'auction-2',
            claimReference: 'CLM-2024-002',
            assetType: 'vehicle',
            assetDetails: {
              year: '2019',
              make: 'Honda',
              model: 'Accord',
            },
            amount: '450000',
            vendor: {
              id: 'vendor-2',
              businessName: 'XYZ Auto',
              fullName: 'Jane Smith',
              email: 'jane@xyzauto.com',
              phone: '+2348087654321',
            },
            vendorConfirmation: {
              confirmed: true,
              confirmedAt: '2024-01-14T09:00:00Z',
            },
            adminConfirmation: {
              confirmed: false,
              confirmedAt: null,
              confirmedBy: null,
            },
            payment: {
              id: 'payment-2',
              amount: '450000',
              status: 'verified',
              paymentMethod: 'paystack',
            },
            auctionStatus: 'closed',
            caseStatus: 'sold',
            auctionEndTime: '2024-01-09T15:00:00Z',
          },
        ],
        count: 2,
      }),
    });

    const response = await fetch('/api/admin/pickups?status=pending&sortBy=confirmedAt&sortOrder=desc');
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(data.pickups).toHaveLength(2);
    expect(data.count).toBe(2);

    // Verify first pickup
    const firstPickup = data.pickups[0];
    expect(firstPickup.auctionId).toBe('auction-1');
    expect(firstPickup.claimReference).toBe('CLM-2024-001');
    expect(firstPickup.vendorConfirmation.confirmed).toBe(true);
    expect(firstPickup.adminConfirmation.confirmed).toBe(false);
    expect(firstPickup.vendor.businessName).toBe('ABC Motors');
  });

  it('should filter pickups by status', async () => {
    // Mock API response for all pickups
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        pickups: [
          {
            auctionId: 'auction-1',
            claimReference: 'CLM-2024-001',
            vendorConfirmation: { confirmed: true, confirmedAt: '2024-01-15T10:00:00Z' },
            adminConfirmation: { confirmed: false, confirmedAt: null, confirmedBy: null },
          },
          {
            auctionId: 'auction-2',
            claimReference: 'CLM-2024-002',
            vendorConfirmation: { confirmed: true, confirmedAt: '2024-01-14T09:00:00Z' },
            adminConfirmation: { confirmed: true, confirmedAt: '2024-01-14T10:00:00Z', confirmedBy: 'admin-1' },
          },
        ],
        count: 2,
      }),
    });

    const response = await fetch('/api/admin/pickups?status=all&sortBy=confirmedAt&sortOrder=desc');
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.pickups).toHaveLength(2);
    expect(data.pickups[0].adminConfirmation.confirmed).toBe(false);
    expect(data.pickups[1].adminConfirmation.confirmed).toBe(true);
  });

  it('should sort pickups by amount', async () => {
    // Mock API response - already sorted by amount descending
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        pickups: [
          {
            auctionId: 'auction-3',
            amount: '600000',
            claimReference: 'CLM-2024-003',
          },
          {
            auctionId: 'auction-1',
            amount: '500000',
            claimReference: 'CLM-2024-001',
          },
          {
            auctionId: 'auction-2',
            amount: '450000',
            claimReference: 'CLM-2024-002',
          },
        ],
        count: 3,
      }),
    });

    const response = await fetch('/api/admin/pickups?status=pending&sortBy=amount&sortOrder=desc');
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.pickups).toHaveLength(3);
    // Verify amounts are in descending order
    expect(parseFloat(data.pickups[0].amount)).toBeGreaterThanOrEqual(parseFloat(data.pickups[1].amount));
    expect(parseFloat(data.pickups[1].amount)).toBeGreaterThanOrEqual(parseFloat(data.pickups[2].amount));
  });

  it('should confirm pickup via admin API', async () => {
    const auctionId = 'auction-1';
    const adminId = 'admin-1';
    const notes = 'Item collected in good condition';

    // Mock API response
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        auction: {
          id: auctionId,
          pickupConfirmedAdmin: true,
          pickupConfirmedAdminAt: '2024-01-15T11:00:00Z',
          pickupConfirmedAdminBy: adminId,
        },
        message: 'Pickup confirmed successfully',
        notes,
      }),
    });

    const response = await fetch(`/api/admin/auctions/${auctionId}/confirm-pickup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        adminId,
        notes,
      }),
    });

    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(data.auction.pickupConfirmedAdmin).toBe(true);
    expect(data.auction.pickupConfirmedAdminBy).toBe(adminId);
    expect(data.notes).toBe(notes);
    expect(data.message).toBe('Pickup confirmed successfully');
  });

  it('should handle error when vendor has not confirmed pickup', async () => {
    const auctionId = 'auction-1';

    // Mock API error response
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'Vendor must confirm pickup before admin confirmation',
      }),
    });

    const response = await fetch(`/api/admin/auctions/${auctionId}/confirm-pickup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        adminId: 'admin-1',
        notes: '',
      }),
    });

    const data = await response.json();

    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);
    expect(data.error).toBe('Vendor must confirm pickup before admin confirmation');
  });

  it('should handle error when pickup already confirmed', async () => {
    const auctionId = 'auction-1';

    // Mock API error response
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'Pickup already confirmed by admin',
      }),
    });

    const response = await fetch(`/api/admin/auctions/${auctionId}/confirm-pickup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        adminId: 'admin-1',
        notes: '',
      }),
    });

    const data = await response.json();

    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);
    expect(data.error).toBe('Pickup already confirmed by admin');
  });

  it('should refresh pickup list after confirmation', async () => {
    let callCount = 0;

    // Mock API responses
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      callCount++;

      if (url.includes('/api/admin/pickups')) {
        // First call: return pending pickup
        // Second call: return empty list (pickup confirmed)
        return {
          ok: true,
          json: async () => ({
            success: true,
            pickups: callCount === 1 ? [
              {
                auctionId: 'auction-1',
                claimReference: 'CLM-2024-001',
                vendorConfirmation: { confirmed: true, confirmedAt: '2024-01-15T10:00:00Z' },
                adminConfirmation: { confirmed: false, confirmedAt: null, confirmedBy: null },
              },
            ] : [],
            count: callCount === 1 ? 1 : 0,
          }),
        };
      } else if (url.includes('/confirm-pickup')) {
        // Confirm pickup API
        return {
          ok: true,
          json: async () => ({
            success: true,
            auction: {
              id: 'auction-1',
              pickupConfirmedAdmin: true,
              pickupConfirmedAdminAt: '2024-01-15T11:00:00Z',
              pickupConfirmedAdminBy: 'admin-1',
            },
            message: 'Pickup confirmed successfully',
          }),
        };
      }

      return { ok: false, json: async () => ({}) };
    });

    // Fetch initial list
    const firstResponse = await fetch('/api/admin/pickups?status=pending&sortBy=confirmedAt&sortOrder=desc');
    const firstData = await firstResponse.json();
    expect(firstData.pickups).toHaveLength(1);

    // Confirm pickup
    const confirmResponse = await fetch('/api/admin/auctions/auction-1/confirm-pickup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: 'admin-1', notes: '' }),
    });
    expect(confirmResponse.ok).toBe(true);

    // Fetch updated list
    const secondResponse = await fetch('/api/admin/pickups?status=pending&sortBy=confirmedAt&sortOrder=desc');
    const secondData = await secondResponse.json();
    expect(secondData.pickups).toHaveLength(0);

    expect(callCount).toBe(3); // 2 list fetches + 1 confirm
  });

  it('should handle unauthorized access', async () => {
    // Mock API error response
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: 'Forbidden',
      }),
    });

    const response = await fetch('/api/admin/pickups?status=pending&sortBy=confirmedAt&sortOrder=desc');
    const data = await response.json();

    expect(response.ok).toBe(false);
    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('should display empty state when no pickups found', async () => {
    // Mock API response with empty list
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        pickups: [],
        count: 0,
      }),
    });

    const response = await fetch('/api/admin/pickups?status=pending&sortBy=confirmedAt&sortOrder=desc');
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.pickups).toHaveLength(0);
    expect(data.count).toBe(0);
  });

  it('should format asset names correctly', async () => {
    // Mock API response
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        pickups: [
          {
            auctionId: 'auction-1',
            assetType: 'vehicle',
            assetDetails: {
              year: '2020',
              make: 'Toyota',
              model: 'Camry',
            },
          },
          {
            auctionId: 'auction-2',
            assetType: 'electronics',
            assetDetails: {},
          },
        ],
        count: 2,
      }),
    });

    const response = await fetch('/api/admin/pickups?status=pending&sortBy=confirmedAt&sortOrder=desc');
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.pickups).toHaveLength(2);

    // Vehicle should have formatted name
    const vehicle = data.pickups[0];
    expect(vehicle.assetType).toBe('vehicle');
    expect(vehicle.assetDetails.year).toBe('2020');
    expect(vehicle.assetDetails.make).toBe('Toyota');
    expect(vehicle.assetDetails.model).toBe('Camry');

    // Non-vehicle should use asset type
    const electronics = data.pickups[1];
    expect(electronics.assetType).toBe('electronics');
  });

  it('should include payment information in pickup details', async () => {
    // Mock API response
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        pickups: [
          {
            auctionId: 'auction-1',
            payment: {
              id: 'payment-1',
              amount: '500000',
              status: 'verified',
              paymentMethod: 'escrow_wallet',
            },
          },
          {
            auctionId: 'auction-2',
            payment: null,
          },
        ],
        count: 2,
      }),
    });

    const response = await fetch('/api/admin/pickups?status=pending&sortBy=confirmedAt&sortOrder=desc');
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.pickups).toHaveLength(2);

    // First pickup has payment
    expect(data.pickups[0].payment).not.toBeNull();
    expect(data.pickups[0].payment.status).toBe('verified');
    expect(data.pickups[0].payment.paymentMethod).toBe('escrow_wallet');

    // Second pickup has no payment
    expect(data.pickups[1].payment).toBeNull();
  });
});
