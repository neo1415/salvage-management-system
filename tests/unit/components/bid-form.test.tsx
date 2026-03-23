/**
 * Bid Form Component Tests
 * 
 * Requirements:
 * - Requirement 18: Bid Placement with OTP
 * - NFR5.3: User Experience
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BidForm } from '@/components/auction/bid-form';
import { useSession } from 'next-auth/react';

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

describe('BidForm Component', () => {
  const mockSession = {
    data: {
      user: {
        id: 'user-1',
        email: 'vendor@example.com',
        name: 'Test Vendor',
        role: 'vendor',
        status: 'verified_tier_1',
        phone: '+2348012345678',
      },
      accessToken: 'test-token',
    },
    status: 'authenticated',
  };

  const defaultProps = {
    auctionId: 'auction-1',
    currentBid: 500000,
    minimumIncrement: 10000,
    assetName: 'Toyota Camry 2020',
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useSession as ReturnType<typeof vi.fn>).mockReturnValue(mockSession);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  it('should render bid form when open', () => {
    render(<BidForm {...defaultProps} />);

    expect(screen.getByText('Place Your Bid')).toBeInTheDocument();
    expect(screen.getByText('Toyota Camry 2020')).toBeInTheDocument();
    expect(screen.getByText('₦500,000')).toBeInTheDocument();
    expect(screen.getByText('₦510,000')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<BidForm {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Place Your Bid')).not.toBeInTheDocument();
  });

  it('should show real-time validation for bid amount', async () => {
    render(<BidForm {...defaultProps} />);

    const input = screen.getByPlaceholderText('510,000');
    
    // Enter amount below minimum
    fireEvent.change(input, { target: { value: '505000' } });

    await waitFor(() => {
      expect(screen.getByText('Minimum bid: ₦510,000')).toBeInTheDocument();
    });
  });

  it('should allow valid bid amount', async () => {
    render(<BidForm {...defaultProps} />);

    const input = screen.getByPlaceholderText('510,000');
    
    // Enter valid amount
    fireEvent.change(input, { target: { value: '520000' } });

    await waitFor(() => {
      expect(screen.queryByText(/Minimum bid/)).not.toBeInTheDocument();
    });
  });

  it('should send OTP when confirming bid', async () => {
    render(<BidForm {...defaultProps} />);

    const input = screen.getByPlaceholderText('510,000');
    fireEvent.change(input, { target: { value: '520000' } });

    const confirmButton = screen.getByText('Confirm Bid');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/resend-otp',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ phone: '+2348012345678' }),
        })
      );
    });
  });

  it('should show OTP input after sending OTP', async () => {
    render(<BidForm {...defaultProps} />);

    const input = screen.getByPlaceholderText('510,000');
    fireEvent.change(input, { target: { value: '520000' } });

    const confirmButton = screen.getByText('Confirm Bid');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText('Verify OTP')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
    });
  });

  it('should submit bid with OTP', async () => {
    render(<BidForm {...defaultProps} />);

    // Enter bid amount
    const bidInput = screen.getByPlaceholderText('510,000');
    fireEvent.change(bidInput, { target: { value: '520000' } });

    // Confirm bid
    const confirmButton = screen.getByText('Confirm Bid');
    fireEvent.click(confirmButton);

    // Wait for OTP step
    await waitFor(() => {
      expect(screen.getByText('Verify OTP')).toBeInTheDocument();
    });

    // Enter OTP (auto-submits at 6 digits)
    const otpInput = screen.getByPlaceholderText('000000');
    fireEvent.change(otpInput, { target: { value: '123456' } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auctions/auction-1/bids',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ amount: 520000, otp: '123456' }),
        })
      );
    });
  });

  it('should show countdown timer in OTP step', async () => {
    render(<BidForm {...defaultProps} />);

    // Enter bid amount and confirm
    const bidInput = screen.getByPlaceholderText('510,000');
    fireEvent.change(bidInput, { target: { value: '520000' } });
    fireEvent.click(screen.getByText('Confirm Bid'));

    // Wait for OTP step
    await waitFor(() => {
      expect(screen.getByText(/Time remaining:/)).toBeInTheDocument();
    });
  });

  it('should show resend OTP button in OTP step', async () => {
    render(<BidForm {...defaultProps} />);

    // Enter bid amount and confirm
    const bidInput = screen.getByPlaceholderText('510,000');
    fireEvent.change(bidInput, { target: { value: '520000' } });
    fireEvent.click(screen.getByText('Confirm Bid'));

    // Wait for OTP step
    await waitFor(() => {
      expect(screen.getByText('Verify OTP')).toBeInTheDocument();
    });

    // Resend button should be present and disabled initially
    const resendButton = screen.getByText('Resend OTP');
    expect(resendButton).toBeInTheDocument();
    expect(resendButton).toBeDisabled();
  });

  it('should submit bid successfully', async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(<BidForm {...defaultProps} onSuccess={onSuccess} onClose={onClose} />);

    // Enter bid amount
    const bidInput = screen.getByPlaceholderText('510,000');
    fireEvent.change(bidInput, { target: { value: '520000' } });
    fireEvent.click(screen.getByText('Confirm Bid'));

    // Wait for OTP step
    await waitFor(() => {
      expect(screen.getByText('Verify OTP')).toBeInTheDocument();
    });

    // Enter OTP (this will auto-submit)
    const otpInput = screen.getByPlaceholderText('000000');
    fireEvent.change(otpInput, { target: { value: '123456' } });

    // Wait for the API call to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auctions/auction-1/bids',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    // Give time for callbacks to be called
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    }, { timeout: 1000 });
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should display error when OTP send fails', async () => {
    // Mock failed OTP send
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, message: 'Failed to send OTP' }),
    });

    render(<BidForm {...defaultProps} />);

    const bidInput = screen.getByPlaceholderText('510,000');
    fireEvent.change(bidInput, { target: { value: '520000' } });
    
    const confirmButton = screen.getByText('Confirm Bid');
    fireEvent.click(confirmButton);

    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByText('Failed to send OTP')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Should still be on bid step
    expect(screen.getByText('Place Your Bid')).toBeInTheDocument();
  });

  it('should close modal when clicking close button', () => {
    const onClose = vi.fn();
    render(<BidForm {...defaultProps} onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: '' }); // SVG button
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('should navigate back to bid step from OTP step', async () => {
    render(<BidForm {...defaultProps} />);

    // Enter bid amount and confirm
    const bidInput = screen.getByPlaceholderText('510,000');
    fireEvent.change(bidInput, { target: { value: '520000' } });
    
    const confirmButton = screen.getByText('Confirm Bid');
    fireEvent.click(confirmButton);

    // Wait for OTP step
    await waitFor(() => {
      expect(screen.getByText('Verify OTP')).toBeInTheDocument();
    });

    // Click back button
    const backButton = screen.getByText('Back to Bid Amount');
    fireEvent.click(backButton);

    // Should return to bid step
    await waitFor(() => {
      expect(screen.getByText('Place Your Bid')).toBeInTheDocument();
    }, { timeout: 1000 });
    
    // Bid input should be visible
    expect(screen.getByPlaceholderText('510,000')).toBeInTheDocument();
  });
});
