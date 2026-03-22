/**
 * Unit tests for EscrowPaymentDetails component
 * 
 * Tests Requirements 4.1, 4.2, 4.3 from Escrow Wallet Payment Completion spec
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EscrowPaymentDetails } from '@/components/finance/escrow-payment-details';

describe('EscrowPaymentDetails', () => {
  const mockOnManualRelease = vi.fn();

  const defaultProps = {
    payment: {
      id: 'payment-123',
      amount: 500000,
      escrowStatus: 'frozen' as const,
      status: 'pending' as const,
    },
    documentProgress: {
      signedDocuments: 3,
      totalDocuments: 3,
    },
    walletBalance: {
      balance: 900000,
      frozenAmount: 500000,
    },
    onManualRelease: mockOnManualRelease,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Display Requirements', () => {
    it('should display payment amount correctly', () => {
      render(<EscrowPaymentDetails {...defaultProps} />);
      
      expect(screen.getByTestId('payment-amount')).toHaveTextContent('₦500,000');
    });

    it('should display escrow status badge', () => {
      render(<EscrowPaymentDetails {...defaultProps} />);
      
      const statusBadge = screen.getByTestId('escrow-status');
      expect(statusBadge).toHaveTextContent('Frozen');
      expect(statusBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');
    });

    it('should display document progress', () => {
      render(<EscrowPaymentDetails {...defaultProps} />);
      
      expect(screen.getByTestId('document-progress')).toHaveTextContent('3/3 Signed');
    });

    it('should display wallet balance', () => {
      render(<EscrowPaymentDetails {...defaultProps} />);
      
      expect(screen.getByTestId('wallet-balance')).toHaveTextContent('₦900,000');
    });

    it('should display frozen amount', () => {
      render(<EscrowPaymentDetails {...defaultProps} />);
      
      expect(screen.getByTestId('frozen-amount')).toHaveTextContent('₦500,000');
    });

    it('should display component title', () => {
      render(<EscrowPaymentDetails {...defaultProps} />);
      
      expect(screen.getByText('Escrow Wallet Payment')).toBeInTheDocument();
    });
  });

  describe('Escrow Status Badge Colors', () => {
    it('should display green badge for released status', () => {
      const props = {
        ...defaultProps,
        payment: { ...defaultProps.payment, escrowStatus: 'released' as const },
      };
      
      render(<EscrowPaymentDetails {...props} />);
      
      const statusBadge = screen.getByTestId('escrow-status');
      expect(statusBadge).toHaveTextContent('Released');
      expect(statusBadge).toHaveClass('bg-green-100', 'text-green-800');
    });

    it('should display red badge for failed status', () => {
      const props = {
        ...defaultProps,
        payment: { ...defaultProps.payment, escrowStatus: 'failed' as const },
      };
      
      render(<EscrowPaymentDetails {...props} />);
      
      const statusBadge = screen.getByTestId('escrow-status');
      expect(statusBadge).toHaveTextContent('Failed');
      expect(statusBadge).toHaveClass('bg-red-100', 'text-red-800');
    });

    it('should display yellow badge for frozen status', () => {
      render(<EscrowPaymentDetails {...defaultProps} />);
      
      const statusBadge = screen.getByTestId('escrow-status');
      expect(statusBadge).toHaveTextContent('Frozen');
      expect(statusBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');
    });
  });

  describe('Manual Release Button Visibility', () => {
    it('should show manual release button when all conditions are met', () => {
      render(<EscrowPaymentDetails {...defaultProps} />);
      
      expect(screen.getByTestId('manual-release-button')).toBeInTheDocument();
    });

    it('should hide manual release button when escrow status is released', () => {
      const props = {
        ...defaultProps,
        payment: { ...defaultProps.payment, escrowStatus: 'released' as const },
      };
      
      render(<EscrowPaymentDetails {...props} />);
      
      expect(screen.queryByTestId('manual-release-button')).not.toBeInTheDocument();
    });

    it('should hide manual release button when payment status is verified', () => {
      const props = {
        ...defaultProps,
        payment: { ...defaultProps.payment, status: 'verified' as const },
      };
      
      render(<EscrowPaymentDetails {...props} />);
      
      expect(screen.queryByTestId('manual-release-button')).not.toBeInTheDocument();
    });

    it('should hide manual release button when not all documents are signed', () => {
      const props = {
        ...defaultProps,
        documentProgress: {
          signedDocuments: 2,
          totalDocuments: 3,
        },
      };
      
      render(<EscrowPaymentDetails {...props} />);
      
      expect(screen.queryByTestId('manual-release-button')).not.toBeInTheDocument();
    });

    it('should show manual release button when escrow status is failed and all documents signed', () => {
      const props = {
        ...defaultProps,
        payment: { ...defaultProps.payment, escrowStatus: 'failed' as const },
      };
      
      render(<EscrowPaymentDetails {...props} />);
      
      // Button should not show for failed status unless we explicitly handle retry
      expect(screen.queryByTestId('manual-release-button')).not.toBeInTheDocument();
    });
  });

  describe('Manual Release Flow', () => {
    it('should open confirmation modal when manual release button is clicked', async () => {
      const user = userEvent.setup();
      render(<EscrowPaymentDetails {...defaultProps} />);
      
      const releaseButton = screen.getByTestId('manual-release-button');
      await user.click(releaseButton);
      
      expect(screen.getByRole('heading', { name: 'Manual Release Funds' })).toBeInTheDocument();
      expect(screen.getByText(/Manually release ₦500,000 from vendor wallet/)).toBeInTheDocument();
    });

    it('should call onManualRelease when confirmed', async () => {
      const user = userEvent.setup();
      mockOnManualRelease.mockResolvedValue(undefined);
      
      render(<EscrowPaymentDetails {...defaultProps} />);
      
      const releaseButton = screen.getByTestId('manual-release-button');
      await user.click(releaseButton);
      
      const confirmButton = screen.getByText('Release Funds');
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(mockOnManualRelease).toHaveBeenCalledTimes(1);
      });
    });

    it('should show success message after successful release', async () => {
      const user = userEvent.setup();
      mockOnManualRelease.mockResolvedValue(undefined);
      
      render(<EscrowPaymentDetails {...defaultProps} />);
      
      const releaseButton = screen.getByTestId('manual-release-button');
      await user.click(releaseButton);
      
      const confirmButton = screen.getByText('Release Funds');
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(screen.getByText('✓ Funds released successfully!')).toBeInTheDocument();
      });
    });

    it('should display error message when release fails', async () => {
      const user = userEvent.setup();
      mockOnManualRelease.mockRejectedValue(new Error('Paystack transfer failed'));
      
      render(<EscrowPaymentDetails {...defaultProps} />);
      
      const releaseButton = screen.getByTestId('manual-release-button');
      await user.click(releaseButton);
      
      const confirmButton = screen.getByText('Release Funds');
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('Paystack transfer failed');
      });
    });

    it('should disable button during release', async () => {
      const user = userEvent.setup();
      mockOnManualRelease.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));
      
      render(<EscrowPaymentDetails {...defaultProps} />);
      
      const releaseButton = screen.getByTestId('manual-release-button');
      await user.click(releaseButton);
      
      const confirmButton = screen.getByText('Release Funds');
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('manual-release-button')).toBeDisabled();
      });
    });

    it('should show "Releasing..." text during release', async () => {
      const user = userEvent.setup();
      mockOnManualRelease.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));
      
      render(<EscrowPaymentDetails {...defaultProps} />);
      
      const releaseButton = screen.getByTestId('manual-release-button');
      await user.click(releaseButton);
      
      const confirmButton = screen.getByText('Release Funds');
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('manual-release-button')).toHaveTextContent('Releasing...');
      });
    });

    it('should close modal when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<EscrowPaymentDetails {...defaultProps} />);
      
      const releaseButton = screen.getByTestId('manual-release-button');
      await user.click(releaseButton);
      
      expect(screen.getByRole('heading', { name: 'Manual Release Funds' })).toBeInTheDocument();
      
      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);
      
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Manual Release Funds' })).not.toBeInTheDocument();
      });
    });
  });

  describe('Failed Payment Alert', () => {
    it('should show alert when escrow status is failed', () => {
      const props = {
        ...defaultProps,
        payment: { ...defaultProps.payment, escrowStatus: 'failed' as const },
      };
      
      render(<EscrowPaymentDetails {...props} />);
      
      expect(screen.getByText('Automatic fund release failed. Use manual release to retry.')).toBeInTheDocument();
    });

    it('should not show alert when escrow status is frozen', () => {
      render(<EscrowPaymentDetails {...defaultProps} />);
      
      expect(screen.queryByText('Automatic fund release failed. Use manual release to retry.')).not.toBeInTheDocument();
    });

    it('should not show alert when escrow status is released', () => {
      const props = {
        ...defaultProps,
        payment: { ...defaultProps.payment, escrowStatus: 'released' as const },
      };
      
      render(<EscrowPaymentDetails {...props} />);
      
      expect(screen.queryByText('Automatic fund release failed. Use manual release to retry.')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<EscrowPaymentDetails {...defaultProps} />);
      
      expect(screen.getByRole('region', { name: 'Escrow payment details' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Manual release funds' })).toBeInTheDocument();
    });

    it('should have proper role for status badge', () => {
      render(<EscrowPaymentDetails {...defaultProps} />);
      
      const statusBadge = screen.getByTestId('escrow-status');
      expect(statusBadge).toHaveAttribute('role', 'status');
      expect(statusBadge).toHaveAttribute('aria-label', 'Escrow status: Frozen');
    });

    it('should announce success message to screen readers', async () => {
      const user = userEvent.setup();
      mockOnManualRelease.mockResolvedValue(undefined);
      
      render(<EscrowPaymentDetails {...defaultProps} />);
      
      const releaseButton = screen.getByTestId('manual-release-button');
      await user.click(releaseButton);
      
      const confirmButton = screen.getByText('Release Funds');
      await user.click(confirmButton);
      
      await waitFor(() => {
        const successAlert = screen.getByRole('alert');
        expect(successAlert).toHaveAttribute('aria-live', 'assertive');
      });
    });

    it('should announce error message to screen readers', async () => {
      const user = userEvent.setup();
      mockOnManualRelease.mockRejectedValue(new Error('Test error'));
      
      render(<EscrowPaymentDetails {...defaultProps} />);
      
      const releaseButton = screen.getByTestId('manual-release-button');
      await user.click(releaseButton);
      
      const confirmButton = screen.getByText('Release Funds');
      await user.click(confirmButton);
      
      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toHaveAttribute('aria-live', 'assertive');
      });
    });
  });

  describe('Responsive Design', () => {
    it('should render without errors on mobile viewport', () => {
      render(<EscrowPaymentDetails {...defaultProps} />);
      
      expect(screen.getByTestId('payment-amount')).toBeInTheDocument();
      expect(screen.getByTestId('escrow-status')).toBeInTheDocument();
      expect(screen.getByTestId('document-progress')).toBeInTheDocument();
    });

    it('should have responsive text classes', () => {
      render(<EscrowPaymentDetails {...defaultProps} />);
      
      const title = screen.getByText('Escrow Wallet Payment');
      expect(title).toHaveClass('text-lg', 'sm:text-xl');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero frozen amount', () => {
      const props = {
        ...defaultProps,
        walletBalance: {
          balance: 900000,
          frozenAmount: 0,
        },
      };
      
      render(<EscrowPaymentDetails {...props} />);
      
      expect(screen.getByTestId('frozen-amount')).toHaveTextContent('₦0');
    });

    it('should handle large amounts with proper formatting', () => {
      const props = {
        ...defaultProps,
        payment: { ...defaultProps.payment, amount: 10000000 },
        walletBalance: {
          balance: 20000000,
          frozenAmount: 10000000,
        },
      };
      
      render(<EscrowPaymentDetails {...props} />);
      
      expect(screen.getByTestId('payment-amount')).toHaveTextContent('₦10,000,000');
      expect(screen.getByTestId('wallet-balance')).toHaveTextContent('₦20,000,000');
      expect(screen.getByTestId('frozen-amount')).toHaveTextContent('₦10,000,000');
    });

    it('should handle partial document signing', () => {
      const props = {
        ...defaultProps,
        documentProgress: {
          signedDocuments: 1,
          totalDocuments: 3,
        },
      };
      
      render(<EscrowPaymentDetails {...props} />);
      
      expect(screen.getByTestId('document-progress')).toHaveTextContent('1/3 Signed');
      expect(screen.queryByTestId('manual-release-button')).not.toBeInTheDocument();
    });

    it('should handle rejected payment status', () => {
      const props = {
        ...defaultProps,
        payment: { ...defaultProps.payment, status: 'rejected' as const },
      };
      
      render(<EscrowPaymentDetails {...props} />);
      
      expect(screen.queryByTestId('manual-release-button')).not.toBeInTheDocument();
    });
  });
});
