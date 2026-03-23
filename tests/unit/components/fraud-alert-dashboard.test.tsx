/**
 * Fraud Alert Dashboard Component Tests
 * Tests for admin fraud alert dashboard UI
 * 
 * Requirements:
 * - Requirement 35: Fraud Alert Review
 * - NFR5.3: User Experience
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FraudAlertDashboard from '@/app/(dashboard)/admin/fraud/page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock fetch
global.fetch = vi.fn();

describe('FraudAlertDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    (global.fetch as any).mockImplementation(() => new Promise(() => {}));
    
    render(<FraudAlertDashboard />);
    
    expect(screen.getByText('Fraud Alert Dashboard')).toBeInTheDocument();
    // Check for the loading spinner
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should display fraud alerts when data is loaded', async () => {
    const mockFraudAlerts = [
      {
        id: '1',
        auctionId: 'auction-123',
        vendorId: 'vendor-456',
        bidAmount: '500000',
        patterns: ['Suspicious - Same IP'],
        details: [
          {
            pattern: 'Same IP Address',
            evidence: 'IP: 192.168.1.1 used for multiple bids',
          },
        ],
        flaggedAt: new Date().toISOString(),
        auction: {
          id: 'auction-123',
          status: 'active',
          currentBid: '500000',
          endTime: new Date(Date.now() + 86400000).toISOString(),
          case: {
            id: 'case-789',
            assetType: 'vehicle',
            marketValue: '1000000',
            claimReference: 'CLM-2024-001',
          },
        },
        vendor: {
          id: 'vendor-456',
          businessName: 'Test Business',
          tier: 'tier1_bvn',
          status: 'approved',
          performanceStats: {
            totalBids: 10,
            totalWins: 5,
            winRate: 50,
            fraudFlags: 1,
          },
          rating: 4.5,
          user: {
            id: 'user-789',
            fullName: 'John Doe',
            email: 'john@example.com',
            phone: '+2348012345678',
          },
        },
        bidHistory: [
          {
            id: 'bid-1',
            vendorId: 'vendor-456',
            amount: '500000',
            ipAddress: '192.168.1.1',
            deviceType: 'mobile',
            createdAt: new Date().toISOString(),
          },
        ],
      },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        fraudAlerts: mockFraudAlerts,
        total: 1,
      }),
    });

    render(<FraudAlertDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Fraud Alert - Auction/)).toBeInTheDocument();
    });

    expect(screen.getByText('Suspicious - Same IP')).toBeInTheDocument();
    expect(screen.getByText('CLM-2024-001')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should display empty state when no fraud alerts', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        fraudAlerts: [],
        total: 0,
      }),
    });

    render(<FraudAlertDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No Fraud Alerts')).toBeInTheDocument();
    });

    expect(screen.getByText(/All auctions are running smoothly/)).toBeInTheDocument();
  });

  it('should display error state when fetch fails', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Failed to fetch fraud alerts',
      }),
    });

    render(<FraudAlertDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch fraud alerts')).toBeInTheDocument();
    });

    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('should open dismiss modal when dismiss button is clicked', async () => {
    const mockFraudAlerts = [
      {
        id: '1',
        auctionId: 'auction-123',
        vendorId: 'vendor-456',
        bidAmount: '500000',
        patterns: ['Suspicious - Same IP'],
        details: [
          {
            pattern: 'Same IP Address',
            evidence: 'IP: 192.168.1.1',
          },
        ],
        flaggedAt: new Date().toISOString(),
        auction: {
          id: 'auction-123',
          status: 'active',
          currentBid: '500000',
          endTime: new Date(Date.now() + 86400000).toISOString(),
          case: {
            id: 'case-789',
            assetType: 'vehicle',
            marketValue: '1000000',
            claimReference: 'CLM-2024-001',
          },
        },
        vendor: {
          id: 'vendor-456',
          businessName: 'Test Business',
          tier: 'tier1_bvn',
          status: 'approved',
          performanceStats: {
            totalBids: 10,
            totalWins: 5,
            winRate: 50,
            fraudFlags: 1,
          },
          rating: 4.5,
          user: {
            id: 'user-789',
            fullName: 'John Doe',
            email: 'john@example.com',
            phone: '+2348012345678',
          },
        },
        bidHistory: [],
      },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        fraudAlerts: mockFraudAlerts,
        total: 1,
      }),
    });

    const user = userEvent.setup();
    render(<FraudAlertDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Fraud Alert - Auction/)).toBeInTheDocument();
    });

    const dismissButton = screen.getByText('Dismiss Flag (False Positive)');
    await user.click(dismissButton);

    await waitFor(() => {
      expect(screen.getByText('Dismiss Fraud Flag')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText(/Explain why this is a false positive/)).toBeInTheDocument();
  });

  it('should open suspend modal when suspend button is clicked', async () => {
    const mockFraudAlerts = [
      {
        id: '1',
        auctionId: 'auction-123',
        vendorId: 'vendor-456',
        bidAmount: '500000',
        patterns: ['Suspicious - Same IP'],
        details: [
          {
            pattern: 'Same IP Address',
            evidence: 'IP: 192.168.1.1',
          },
        ],
        flaggedAt: new Date().toISOString(),
        auction: {
          id: 'auction-123',
          status: 'active',
          currentBid: '500000',
          endTime: new Date(Date.now() + 86400000).toISOString(),
          case: null,
        },
        vendor: {
          id: 'vendor-456',
          businessName: 'Test Business',
          tier: 'tier1_bvn',
          status: 'approved',
          performanceStats: {
            totalBids: 10,
            totalWins: 5,
            winRate: 50,
            fraudFlags: 1,
          },
          rating: 4.5,
          user: {
            id: 'user-789',
            fullName: 'John Doe',
            email: 'john@example.com',
            phone: '+2348012345678',
          },
        },
        bidHistory: [],
      },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        fraudAlerts: mockFraudAlerts,
        total: 1,
      }),
    });

    const user = userEvent.setup();
    render(<FraudAlertDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Fraud Alert - Auction/)).toBeInTheDocument();
    });

    const suspendButton = screen.getByText('Suspend Vendor');
    await user.click(suspendButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Suspend Vendor' })).toBeInTheDocument();
    });

    expect(screen.getByText('Suspension Duration')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Explain the reason for suspension/)).toBeInTheDocument();
  });

  it('should display stats correctly', async () => {
    const mockFraudAlerts = [
      {
        id: '1',
        auctionId: 'auction-123',
        vendorId: 'vendor-456',
        bidAmount: '500000',
        patterns: ['Suspicious - Same IP'],
        details: [],
        flaggedAt: new Date().toISOString(),
        auction: {
          id: 'auction-123',
          status: 'active',
          currentBid: '500000',
          endTime: new Date(Date.now() + 86400000).toISOString(),
          case: null,
        },
        vendor: null,
        bidHistory: [],
      },
      {
        id: '2',
        auctionId: 'auction-456',
        vendorId: 'vendor-789',
        bidAmount: '300000',
        patterns: ['Unusual bid pattern'],
        details: [],
        flaggedAt: new Date().toISOString(),
        auction: {
          id: 'auction-456',
          status: 'closed',
          currentBid: '300000',
          endTime: new Date(Date.now() - 86400000).toISOString(),
          case: null,
        },
        vendor: null,
        bidHistory: [],
      },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        fraudAlerts: mockFraudAlerts,
        total: 2,
      }),
    });

    render(<FraudAlertDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Alerts')).toBeInTheDocument();
    });

    // Check stats using more specific queries
    const statsSection = screen.getByText('Total Alerts').closest('.bg-white');
    expect(statsSection).toHaveTextContent('2');

    const activeAuctionsSection = screen.getByText('Active Auctions').closest('.bg-white');
    expect(activeAuctionsSection).toHaveTextContent('1');

    const uniqueVendorsSection = screen.getByText('Unique Vendors').closest('.bg-white');
    expect(uniqueVendorsSection).toHaveTextContent('2');
  });
});
