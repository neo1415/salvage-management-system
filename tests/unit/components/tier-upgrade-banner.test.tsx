import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TierUpgradeBanner } from '@/components/ui/tier-upgrade-banner';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('TierUpgradeBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should render banner when not dismissed', async () => {
    render(<TierUpgradeBanner />);
    
    await waitFor(() => {
      expect(
        screen.getByText(/Unlock Premium Auctions - Upgrade to Tier 2/)
      ).toBeInTheDocument();
    });
  });

  it('should display high-value auction count when provided', async () => {
    render(<TierUpgradeBanner highValueAuctionCount={5} />);
    
    await waitFor(() => {
      expect(screen.getByText(/5/)).toBeInTheDocument();
      expect(screen.getByText(/high-value auctions available/)).toBeInTheDocument();
    });
  });

  it('should display singular text for 1 auction', async () => {
    render(<TierUpgradeBanner highValueAuctionCount={1} />);
    
    await waitFor(() => {
      expect(screen.getByText(/1/)).toBeInTheDocument();
      expect(screen.getByText(/high-value auction available/)).toBeInTheDocument();
    });
  });

  it('should display default text when no auction count provided', async () => {
    render(<TierUpgradeBanner highValueAuctionCount={0} />);
    
    await waitFor(() => {
      expect(
        screen.getByText(/Get unlimited bidding on high-value auctions/)
      ).toBeInTheDocument();
    });
  });

  it('should hide banner when dismiss button is clicked', async () => {
    render(<TierUpgradeBanner />);
    
    await waitFor(() => {
      expect(
        screen.getByText(/Unlock Premium Auctions - Upgrade to Tier 2/)
      ).toBeInTheDocument();
    });
    
    const dismissButton = screen.getByLabelText('Dismiss banner');
    fireEvent.click(dismissButton);
    
    await waitFor(() => {
      expect(
        screen.queryByText(/Unlock Premium Auctions - Upgrade to Tier 2/)
      ).not.toBeInTheDocument();
    });
  });

  it('should store dismiss timestamp in localStorage', async () => {
    render(<TierUpgradeBanner />);
    
    await waitFor(() => {
      expect(
        screen.getByText(/Unlock Premium Auctions - Upgrade to Tier 2/)
      ).toBeInTheDocument();
    });
    
    const dismissButton = screen.getByLabelText('Dismiss banner');
    fireEvent.click(dismissButton);
    
    const dismissedAt = localStorage.getItem('tier-upgrade-banner-dismissed');
    expect(dismissedAt).toBeTruthy();
    expect(parseInt(dismissedAt!, 10)).toBeGreaterThan(0);
  });

  it('should not render if dismissed within 3 days', async () => {
    // Set dismiss timestamp to 1 day ago
    const oneDayAgo = Date.now() - (1 * 24 * 60 * 60 * 1000);
    localStorage.setItem('tier-upgrade-banner-dismissed', oneDayAgo.toString());
    
    const { container } = render(<TierUpgradeBanner />);
    
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('should render again after 3 days have passed', async () => {
    // Set dismiss timestamp to 4 days ago
    const fourDaysAgo = Date.now() - (4 * 24 * 60 * 60 * 1000);
    localStorage.setItem('tier-upgrade-banner-dismissed', fourDaysAgo.toString());
    
    render(<TierUpgradeBanner />);
    
    await waitFor(() => {
      expect(
        screen.getByText(/Unlock Premium Auctions - Upgrade to Tier 2/)
      ).toBeInTheDocument();
    });
  });

  it('should navigate to tier 2 KYC page when "Upgrade Now" is clicked', async () => {
    render(<TierUpgradeBanner />);
    
    await waitFor(() => {
      expect(
        screen.getByText(/Unlock Premium Auctions - Upgrade to Tier 2/)
      ).toBeInTheDocument();
    });
    
    const upgradeButton = screen.getByText('Upgrade Now');
    fireEvent.click(upgradeButton);
    
    expect(mockPush).toHaveBeenCalledWith('/vendor/kyc/tier2');
  });

  it('should have proper accessibility attributes', async () => {
    render(<TierUpgradeBanner />);
    
    await waitFor(() => {
      const dismissButton = screen.getByLabelText('Dismiss banner');
      expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss banner');
    });
  });
});
