/**
 * Unit tests for PickupConfirmation component
 * 
 * Tests cover:
 * - Component rendering
 * - Code input validation
 * - Button click triggers API call
 * - Loading state displays during confirmation
 * - Success state displays after confirmation
 * - Error states display appropriate messages
 * - Responsive design (mobile and desktop)
 * - Accessibility (ARIA labels, keyboard navigation)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PickupConfirmation } from '@/components/vendor/pickup-confirmation';

describe('PickupConfirmation', () => {
  const mockAuctionId = 'auction-123';
  const mockVendorId = 'vendor-456';
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render component with instructions', () => {
      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByRole('heading', { name: 'Confirm Pickup' })).toBeInTheDocument();
      expect(screen.getByText('Ready to collect your item?')).toBeInTheDocument();
      expect(
        screen.getByText(/Enter the pickup authorization code you received via SMS\/email/)
      ).toBeInTheDocument();
    });

    it('should render pickup code input field', () => {
      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('placeholder', 'Enter code (e.g., ABC123XYZ)');
    });

    it('should render confirm button', () => {
      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const button = screen.getByTestId('confirm-button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Confirm Pickup');
    });

    it('should display helper text', () => {
      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      expect(
        screen.getByText(/The pickup code was sent to you via SMS and email/)
      ).toBeInTheDocument();
    });
  });

  describe('Code Input Validation', () => {
    it('should convert input to uppercase', () => {
      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'abc123' } });

      expect(input.value).toBe('ABC123');
    });

    it('should show error for empty code', () => {
      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      // Button should remain disabled when empty
      expect(button).toBeDisabled();
    });

    it('should show error for code less than 6 characters', () => {
      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      fireEvent.change(input, { target: { value: 'ABC12' } });

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      expect(screen.getByTestId('code-error')).toHaveTextContent(
        'Pickup code must be at least 6 characters'
      );
    });

    it('should show error for code with special characters', () => {
      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      fireEvent.change(input, { target: { value: 'ABC-123' } });

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      expect(screen.getByTestId('code-error')).toHaveTextContent(
        'Pickup code must contain only letters and numbers'
      );
    });

    it('should accept valid alphanumeric code', () => {
      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      fireEvent.change(input, { target: { value: 'ABC123XYZ' } });

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      expect(screen.queryByTestId('code-error')).not.toBeInTheDocument();
    });

    it('should clear error when user types after validation error', () => {
      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      const button = screen.getByTestId('confirm-button');

      // Trigger validation error
      fireEvent.change(input, { target: { value: 'ABC' } });
      fireEvent.click(button);
      expect(screen.getByTestId('code-error')).toBeInTheDocument();

      // Type more characters
      fireEvent.change(input, { target: { value: 'ABC123' } });
      expect(screen.queryByTestId('code-error')).not.toBeInTheDocument();
    });
  });

  describe('Confirmation Flow', () => {
    it('should open modal when confirm button is clicked with valid code', async () => {
      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      fireEvent.change(input, { target: { value: 'ABC123XYZ' } });

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/Have you collected the item/)).toBeInTheDocument();
        expect(screen.getByText(/Enter code ABC123XYZ to confirm pickup/)).toBeInTheDocument();
      });
    });

    it('should call onConfirm when modal confirm button is clicked', async () => {
      mockOnConfirm.mockResolvedValue(undefined);

      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      fireEvent.change(input, { target: { value: 'ABC123XYZ' } });

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledWith('ABC123XYZ');
      });
    });

    it('should close modal when cancel button is clicked', async () => {
      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      fireEvent.change(input, { target: { value: 'ABC123XYZ' } });

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);
      });

      await waitFor(() => {
        expect(screen.queryByText(/Have you collected the item/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should display loading state during confirmation', async () => {
      mockOnConfirm.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      fireEvent.change(input, { target: { value: 'ABC123XYZ' } });

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeInTheDocument();
      });
    });

    it('should disable button during confirmation', async () => {
      mockOnConfirm.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      fireEvent.change(input, { target: { value: 'ABC123XYZ' } });

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      await waitFor(() => {
        expect(button).toBeDisabled();
      });
    });

    it('should disable input during confirmation', async () => {
      mockOnConfirm.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      fireEvent.change(input, { target: { value: 'ABC123XYZ' } });

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      await waitFor(() => {
        expect(input).toBeDisabled();
      });
    });
  });

  describe('Success State', () => {
    it('should display success message after confirmation', async () => {
      mockOnConfirm.mockResolvedValue(undefined);

      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      fireEvent.change(input, { target: { value: 'ABC123XYZ' } });

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Pickup confirmed successfully! Admin will verify shortly/)
        ).toBeInTheDocument();
      });
    });

    it('should update button text after successful confirmation', async () => {
      mockOnConfirm.mockResolvedValue(undefined);

      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      fireEvent.change(input, { target: { value: 'ABC123XYZ' } });

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      await waitFor(() => {
        expect(button).toHaveTextContent('Pickup Confirmed');
      });
    });

    it('should clear input after successful confirmation', async () => {
      mockOnConfirm.mockResolvedValue(undefined);

      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'ABC123XYZ' } });

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    it('should disable button after successful confirmation', async () => {
      mockOnConfirm.mockResolvedValue(undefined);

      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      fireEvent.change(input, { target: { value: 'ABC123XYZ' } });

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      await waitFor(() => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when confirmation fails', async () => {
      mockOnConfirm.mockRejectedValue(new Error('Invalid pickup authorization code'));

      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      fireEvent.change(input, { target: { value: 'WRONG123' } });

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      await waitFor(() => {
        const errorElement = screen.getByTestId('error-message');
        expect(errorElement).toHaveTextContent('Invalid pickup authorization code');
      });
    });

    it('should display generic error message for unknown errors', async () => {
      mockOnConfirm.mockRejectedValue('Unknown error');

      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      fireEvent.change(input, { target: { value: 'ABC123XYZ' } });

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      await waitFor(() => {
        const errorElement = screen.getByTestId('error-message');
        expect(errorElement).toHaveTextContent('Failed to confirm pickup');
      });
    });

    it('should re-enable button after error', async () => {
      mockOnConfirm.mockRejectedValue(new Error('Network error'));

      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      fireEvent.change(input, { target: { value: 'ABC123XYZ' } });

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      await waitFor(() => {
        expect(button).not.toBeDisabled();
      });
    });

    it('should clear previous error when retrying', async () => {
      mockOnConfirm
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(undefined);

      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      const button = screen.getByTestId('confirm-button');

      // First attempt - fails
      fireEvent.change(input, { target: { value: 'ABC123XYZ' } });
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });

      // Second attempt - succeeds
      fireEvent.change(input, { target: { value: 'XYZ789ABC' } });
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
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const button = screen.getByTestId('confirm-button');
      expect(button).toHaveAttribute('aria-label', 'Confirm pickup');

      const input = screen.getByTestId('pickup-code-input');
      expect(input).toHaveAttribute('aria-label', 'Pickup authorization code');

      const region = screen.getByRole('region');
      expect(region).toHaveAttribute('aria-label', 'Pickup confirmation');
    });

    it('should have proper role attributes for status messages', () => {
      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const statusElement = screen.getByRole('status');
      expect(statusElement).toHaveAttribute('aria-live', 'polite');
    });

    it('should announce success message to screen readers', async () => {
      mockOnConfirm.mockResolvedValue(undefined);

      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      fireEvent.change(input, { target: { value: 'ABC123XYZ' } });

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveAttribute('aria-live', 'assertive');
      });
    });

    it('should announce error message to screen readers', async () => {
      mockOnConfirm.mockRejectedValue(new Error('Test error'));

      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      fireEvent.change(input, { target: { value: 'ABC123XYZ' } });

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveAttribute('aria-live', 'assertive');
      });
    });

    it('should have aria-invalid when code has error', () => {
      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      const button = screen.getByTestId('confirm-button');

      fireEvent.change(input, { target: { value: 'ABC' } });
      fireEvent.click(button);

      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', 'code-error');
    });
  });

  describe('Responsive Design', () => {
    it('should apply responsive classes for mobile', () => {
      const { container } = render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const mainDiv = container.firstChild as HTMLElement;
      expect(mainDiv).toHaveClass('p-4', 'sm:p-6');
    });

    it('should have responsive text sizes', () => {
      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const heading = screen.getByRole('heading', { name: 'Confirm Pickup' });
      expect(heading).toHaveClass('text-lg', 'sm:text-xl');
    });
  });

  describe('Edge Cases', () => {
    it('should handle code with leading/trailing spaces', async () => {
      mockOnConfirm.mockResolvedValue(undefined);

      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      fireEvent.change(input, { target: { value: '  ABC123XYZ  ' } });

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      await waitFor(() => {
        const modalConfirmButton = screen.getByText('Confirm');
        fireEvent.click(modalConfirmButton);
      });

      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledWith('ABC123XYZ');
      });
    });

    it('should handle very long codes', () => {
      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      const longCode = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
      fireEvent.change(input, { target: { value: longCode } });

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      expect(screen.queryByTestId('code-error')).not.toBeInTheDocument();
    });

    it('should disable button when input is empty', () => {
      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const button = screen.getByTestId('confirm-button');
      expect(button).toBeDisabled();
    });

    it('should enable button when valid code is entered', () => {
      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      fireEvent.change(input, { target: { value: 'ABC123XYZ' } });

      const button = screen.getByTestId('confirm-button');
      expect(button).not.toBeDisabled();
    });

    it('should handle numeric-only codes', () => {
      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      fireEvent.change(input, { target: { value: '123456' } });

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      expect(screen.queryByTestId('code-error')).not.toBeInTheDocument();
    });

    it('should handle letter-only codes', () => {
      render(
        <PickupConfirmation
          auctionId={mockAuctionId}
          vendorId={mockVendorId}
          onConfirm={mockOnConfirm}
        />
      );

      const input = screen.getByTestId('pickup-code-input');
      fireEvent.change(input, { target: { value: 'ABCDEF' } });

      const button = screen.getByTestId('confirm-button');
      fireEvent.click(button);

      expect(screen.queryByTestId('code-error')).not.toBeInTheDocument();
    });
  });
});
