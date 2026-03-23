import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TierUpgradeModal } from '@/components/ui/tier-upgrade-modal';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('TierUpgradeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(
      <TierUpgradeModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render when isOpen is true', () => {
    render(<TierUpgradeModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Upgrade to Tier 2')).toBeInTheDocument();
  });

  it('should display auction value when provided', () => {
    render(
      <TierUpgradeModal
        isOpen={true}
        onClose={vi.fn()}
        auctionValue={750000}
      />
    );
    expect(
      screen.getByText(/This auction \(₦750,000\) requires Tier 2 verification/)
    ).toBeInTheDocument();
  });

  it('should display all tier 2 benefits', () => {
    render(<TierUpgradeModal isOpen={true} onClose={vi.fn()} />);
    
    expect(screen.getByText('Unlimited Bidding')).toBeInTheDocument();
    expect(
      screen.getByText(/Bid on high-value auctions above ₦500,000/)
    ).toBeInTheDocument();
    
    expect(screen.getByText('Priority Support')).toBeInTheDocument();
    expect(
      screen.getByText(/Get dedicated support and faster response times/)
    ).toBeInTheDocument();
    
    expect(screen.getByText('Leaderboard Eligibility')).toBeInTheDocument();
    expect(
      screen.getByText(/Compete for top positions and earn recognition/)
    ).toBeInTheDocument();
  });

  it('should display required documents', () => {
    render(<TierUpgradeModal isOpen={true} onClose={vi.fn()} />);
    
    expect(screen.getByText("What You'll Need:")).toBeInTheDocument();
    expect(screen.getByText(/CAC Registration Certificate/)).toBeInTheDocument();
    expect(screen.getByText(/Bank Statement \(Last 3 months\)/)).toBeInTheDocument();
    expect(screen.getByText(/Valid ID/)).toBeInTheDocument();
    expect(screen.getByText(/Bank Account Details/)).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<TierUpgradeModal isOpen={true} onClose={onClose} />);
    
    const closeButton = screen.getByLabelText('Close modal');
    fireEvent.click(closeButton);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when "Maybe Later" button is clicked', () => {
    const onClose = vi.fn();
    render(<TierUpgradeModal isOpen={true} onClose={onClose} />);
    
    const maybeLaterButton = screen.getByText('Maybe Later');
    fireEvent.click(maybeLaterButton);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should navigate to tier 2 KYC page when "Upgrade Now" is clicked', () => {
    const onClose = vi.fn();
    render(<TierUpgradeModal isOpen={true} onClose={onClose} />);
    
    const upgradeButton = screen.getByText('Upgrade Now');
    fireEvent.click(upgradeButton);
    
    expect(mockPush).toHaveBeenCalledWith('/vendor/kyc/tier2');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should have proper accessibility attributes', () => {
    render(<TierUpgradeModal isOpen={true} onClose={vi.fn()} />);
    
    const closeButton = screen.getByLabelText('Close modal');
    expect(closeButton).toHaveAttribute('aria-label', 'Close modal');
  });
});
