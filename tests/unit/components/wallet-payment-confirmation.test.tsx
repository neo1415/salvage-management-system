/**
 * Unit tests for WalletPaymentConfirmation component
 * 
 * Tests cover:
 * - Component rendering with payment data
 * - Button click triggers API call
 * - Loading state displays during confirmation
 * - Success state displays after confirmation
 * - Error states display appropriate messages
 * - Responsive design (mobile and desktop)
 * - Accessibility (ARIA labels, keyboard navigation)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WalletPaymentConfirmation } from '@/components/payments/wallet-payment-confirmation';

describe('WalletPaymentConfirmation', () => {
  const mockPayment = {
    id: 'payment-123',
    amount: 400000,
    escrowStatus: 'frozen',
  };

  const mockWalletBalance = {
    frozenAmount: 400000,
    availableBalance: 100000,
  };

  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render component with payment details', () => {
      render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('Payment from Wallet')).toBeInTheDocument();
      expect(screen.getByText('Payment Source: Escrow Wallet')).toBeInTheDocument();
      expect(screen.getByText('₦400,000 frozen in your wallet')).toBeInTheDocument();
    });

    it('should display amount to pay correctly', () => {
      render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      const amountElement = screen.getByTestId('amount-to-pay');
      expect(amountElement).toHaveTextContent('₦400,000');
    });

    it('should display frozen amount correctly', () => {
      render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      const frozenElement = screen.getByTestId('frozen-amount');
      expect(frozenElement).toHaveTextContent('₦400,000');
    });

    it('should render confirm button', () => {
      render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      const button = screen.getByTestId('confirm-button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Confirm Payment from Wallet');
    });

    it('should display helper text', () => {
      render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      expect(
        screen.getByText('After confirmation, sign all documents to complete the process')
      ).toBeInTheDocument();
    });
  });

  describe('Confirmation Flow', () => {
    it('should open modal when confirm button is clicked', async () => {
      render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Confirm Wallet Payment')).toBeInTheDocument();
        expect(
          screen.getByText('Confirm you want to pay ₦400,000 from your wallet balance?')
        ).toBeInTheDocument();
      });
    });

    it('should call onConfirm when modal confirm button is clicked', async () => {
      mockOnConfirm.mockResolvedValue(undefined);

      render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      // Open modal
      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      // Click confirm in modal
      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      });
    });

    it('should close modal when cancel button is clicked', async () => {
      render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      // Open modal
      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      // Click cancel in modal
      await waitFor(() => {
        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);
      });

      await waitFor(() => {
        expect(screen.queryByText('Confirm Wallet Payment')).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should display loading state during confirmation', async () => {
      mockOnConfirm.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      // Open modal
      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      // Click confirm in modal
      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      // Check loading state
      await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeInTheDocument();
      });
    });

    it('should disable button during confirmation', async () => {
      mockOnConfirm.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      // Open modal and confirm
      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      // Button should be disabled
      await waitFor(() => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe('Success State', () => {
    it('should display success message after confirmation', async () => {
      mockOnConfirm.mockResolvedValue(undefined);

      render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      // Open modal and confirm
      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      // Check success message
      await waitFor(() => {
        expect(
          screen.getByText('Payment confirmed! Sign all documents to complete the process')
        ).toBeInTheDocument();
      });
    });

    it('should update button text after successful confirmation', async () => {
      mockOnConfirm.mockResolvedValue(undefined);

      render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      // Open modal and confirm
      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      // Check button text changed
      await waitFor(() => {
        expect(button).toHaveTextContent('Payment Confirmed');
      });
    });

    it('should disable button after successful confirmation', async () => {
      mockOnConfirm.mockResolvedValue(undefined);

      render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      // Open modal and confirm
      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      // Button should remain disabled
      await waitFor(() => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when confirmation fails', async () => {
      mockOnConfirm.mockRejectedValue(new Error('Insufficient funds'));

      render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      // Open modal and confirm
      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      // Check error message
      await waitFor(() => {
        const errorElement = screen.getByTestId('error-message');
        expect(errorElement).toHaveTextContent('Insufficient funds');
      });
    });

    it('should display generic error message for unknown errors', async () => {
      mockOnConfirm.mockRejectedValue('Unknown error');

      render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      // Open modal and confirm
      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      // Check generic error message
      await waitFor(() => {
        const errorElement = screen.getByTestId('error-message');
        expect(errorElement).toHaveTextContent('Failed to confirm payment');
      });
    });

    it('should re-enable button after error', async () => {
      mockOnConfirm.mockRejectedValue(new Error('Network error'));

      render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      // Open modal and confirm
      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      // Button should be enabled again after error
      await waitFor(() => {
        expect(button).not.toBeDisabled();
      });
    });

    it('should clear previous error when retrying', async () => {
      mockOnConfirm
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(undefined);

      render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      // First attempt - fails
      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });

      // Second attempt - succeeds
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      await waitFor(() => {
        expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      const button = screen.getByTestId('confirm-button');
      expect(button).toHaveAttribute('aria-label', 'Confirm payment from wallet');

      const region = screen.getByRole('region');
      expect(region).toHaveAttribute('aria-label', 'Wallet payment confirmation');
    });

    it('should have proper role attributes for status messages', () => {
      render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      const statusElement = screen.getByRole('status');
      expect(statusElement).toHaveAttribute('aria-live', 'polite');
    });

    it('should announce success message to screen readers', async () => {
      mockOnConfirm.mockResolvedValue(undefined);

      render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      // Confirm payment
      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      // Check success alert
      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveAttribute('aria-live', 'assertive');
      });
    });

    it('should announce error message to screen readers', async () => {
      mockOnConfirm.mockRejectedValue(new Error('Test error'));

      render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      // Confirm payment
      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      // Check error alert
      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveAttribute('aria-live', 'assertive');
      });
    });
  });

  describe('Responsive Design', () => {
    it('should apply responsive classes for mobile', () => {
      const { container } = render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      const mainDiv = container.firstChild as HTMLElement;
      expect(mainDiv).toHaveClass('p-4', 'sm:p-6');
    });

    it('should have responsive text sizes', () => {
      render(
        <WalletPaymentConfirmation
          payment={mockPayment}
          walletBalance={mockWalletBalance}
          onConfirm={mockOnConfirm}
        />
      );

      const heading = screen.getByText('Payment from Wallet');
      expect(heading).toHaveClass('text-lg', 'sm:text-xl');
    });
  });

  describe('Edge Cases', () => {
    it('should handle large payment amounts', () => {
      const largePayment = {
        ...mockPayment,
        amount: 50000000, // 50 million
      };

      const largeWallet = {
        ...mockWalletBalance,
        frozenAmount: 50000000,
      };

      render(
        <WalletPaymentConfirmation
          payment={largePayment}
          walletBalance={largeWallet}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('₦50,000,000 frozen in your wallet')).toBeInTheDocument();
    });

    it('should handle zero amounts', () => {
      const zeroPayment = {
        ...mockPayment,
        amount: 0,
      };

      const zeroWallet = {
        ...mockWalletBalance,
        frozenAmount: 0,
      };

      render(
        <WalletPaymentConfirmation
          payment={zeroPayment}
          walletBalance={zeroWallet}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('₦0 frozen in your wallet')).toBeInTheDocument();
    });

    it('should handle decimal amounts', () => {
      const decimalPayment = {
        ...mockPayment,
        amount: 400000.50,
      };

      const decimalWallet = {
        ...mockWalletBalance,
        frozenAmount: 400000.50,
      };

      render(
        <WalletPaymentConfirmation
          payment={decimalPayment}
          walletBalance={decimalWallet}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('₦400,000.5 frozen in your wallet')).toBeInTheDocument();
    });
  });
});
