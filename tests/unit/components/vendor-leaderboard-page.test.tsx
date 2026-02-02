import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import VendorLeaderboardPage from '@/app/(dashboard)/vendor/leaderboard/page';

// Mock Next.js router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock auth hook
const mockUseAuth = vi.fn();
vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('VendorLeaderboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    mockFetch.mockClear();
  });

  it('should show loading state initially', () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'vendor' },
      isAuthenticated: true,
      isLoading: true,
    });

    render(<VendorLeaderboardPage />);
    
    expect(screen.getByText('Loading leaderboard...')).toBeInTheDocument();
  });

  it('should redirect to login if not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });

    render(<VendorLeaderboardPage />);
    
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('should show error if user is not a vendor', async () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'manager' },
      isAuthenticated: true,
      isLoading: false,
    });

    render(<VendorLeaderboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Access denied. Vendor role required.')).toBeInTheDocument();
    });
  });

  it('should display leaderboard data when loaded', async () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'vendor' },
      isAuthenticated: true,
      isLoading: false,
    });

    const mockLeaderboardData = {
      leaderboard: [
        {
          rank: 1,
          vendorId: 'vendor-1',
          vendorName: 'John Doe',
          businessName: 'Doe Enterprises',
          tier: 'tier2_full',
          totalBids: 50,
          wins: 25,
          totalSpent: '5000000',
          onTimePickupRate: 95,
          rating: '4.8',
        },
        {
          rank: 2,
          vendorId: 'vendor-2',
          vendorName: 'Jane Smith',
          businessName: null,
          tier: 'tier1_bvn',
          totalBids: 40,
          wins: 20,
          totalSpent: '3000000',
          onTimePickupRate: 90,
          rating: '4.5',
        },
      ],
      lastUpdated: '2024-01-15T10:00:00Z',
      nextUpdate: '2024-01-22T00:00:00Z',
    };

    // Mock both fetch calls
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockLeaderboardData,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ vendorId: 'vendor-1' }),
      });

    render(<VendorLeaderboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Vendor Leaderboard')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Use getAllByText since name appears in both desktop and mobile views
    const johnDoeElements = screen.getAllByText('John Doe');
    expect(johnDoeElements.length).toBeGreaterThan(0);
    
    const janeSmithElements = screen.getAllByText('Jane Smith');
    expect(janeSmithElements.length).toBeGreaterThan(0);
  });

  it('should highlight current vendor in leaderboard', async () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'vendor' },
      isAuthenticated: true,
      isLoading: false,
    });

    const mockLeaderboardData = {
      leaderboard: [
        {
          rank: 1,
          vendorId: 'current-vendor',
          vendorName: 'Current User',
          businessName: 'My Business',
          tier: 'tier2_full',
          totalBids: 50,
          wins: 25,
          totalSpent: '5000000',
          onTimePickupRate: 95,
          rating: '4.8',
        },
      ],
      lastUpdated: '2024-01-15T10:00:00Z',
      nextUpdate: '2024-01-22T00:00:00Z',
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockLeaderboardData,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ vendorId: 'current-vendor' }),
      });

    render(<VendorLeaderboardPage />);
    
    await waitFor(() => {
      expect(screen.getAllByText('You').length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('should display trophy icons for top 3', async () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'vendor' },
      isAuthenticated: true,
      isLoading: false,
    });

    const mockLeaderboardData = {
      leaderboard: [
        {
          rank: 1,
          vendorId: 'vendor-1',
          vendorName: 'First Place',
          businessName: null,
          tier: 'tier2_full',
          totalBids: 50,
          wins: 25,
          totalSpent: '5000000',
          onTimePickupRate: 95,
          rating: '4.8',
        },
        {
          rank: 2,
          vendorId: 'vendor-2',
          vendorName: 'Second Place',
          businessName: null,
          tier: 'tier1_bvn',
          totalBids: 40,
          wins: 20,
          totalSpent: '3000000',
          onTimePickupRate: 90,
          rating: '4.5',
        },
        {
          rank: 3,
          vendorId: 'vendor-3',
          vendorName: 'Third Place',
          businessName: null,
          tier: 'tier1_bvn',
          totalBids: 30,
          wins: 15,
          totalSpent: '2000000',
          onTimePickupRate: 85,
          rating: '4.3',
        },
      ],
      lastUpdated: '2024-01-15T10:00:00Z',
      nextUpdate: '2024-01-22T00:00:00Z',
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockLeaderboardData,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ vendorId: 'other-vendor' }),
      });

    render(<VendorLeaderboardPage />);
    
    await waitFor(() => {
      const firstPlaceElements = screen.getAllByText('First Place');
      expect(firstPlaceElements.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
    
    const secondPlaceElements = screen.getAllByText('Second Place');
    expect(secondPlaceElements.length).toBeGreaterThan(0);
    
    const thirdPlaceElements = screen.getAllByText('Third Place');
    expect(thirdPlaceElements.length).toBeGreaterThan(0);
    
    // Trophy emojis should be present
    expect(screen.getAllByText('🏆').length).toBeGreaterThan(0);
    expect(screen.getAllByText('🥈').length).toBeGreaterThan(0);
    expect(screen.getAllByText('🥉').length).toBeGreaterThan(0);
  });

  it('should show empty state when no leaderboard data', async () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'vendor' },
      isAuthenticated: true,
      isLoading: false,
    });

    const mockLeaderboardData = {
      leaderboard: [],
      lastUpdated: '2024-01-15T10:00:00Z',
      nextUpdate: '2024-01-22T00:00:00Z',
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockLeaderboardData,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ vendorId: 'vendor-1' }),
      });

    render(<VendorLeaderboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('No Leaderboard Data Yet')).toBeInTheDocument();
      expect(screen.getByText('Start bidding on auctions to appear on the leaderboard!')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should handle API errors gracefully', async () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'vendor' },
      isAuthenticated: true,
      isLoading: false,
    });

    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<VendorLeaderboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load leaderboard. Please try again.')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should format currency correctly', async () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'vendor' },
      isAuthenticated: true,
      isLoading: false,
    });

    const mockLeaderboardData = {
      leaderboard: [
        {
          rank: 1,
          vendorId: 'vendor-1',
          vendorName: 'Big Spender',
          businessName: null,
          tier: 'tier2_full',
          totalBids: 50,
          wins: 25,
          totalSpent: '5000000', // Should display as ₦5.0M
          onTimePickupRate: 95,
          rating: '4.8',
        },
      ],
      lastUpdated: '2024-01-15T10:00:00Z',
      nextUpdate: '2024-01-22T00:00:00Z',
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockLeaderboardData,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ vendorId: 'other-vendor' }),
      });

    render(<VendorLeaderboardPage />);
    
    await waitFor(() => {
      expect(screen.getAllByText('₦5.0M').length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });
});
