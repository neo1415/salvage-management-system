/**
 * Unit Tests for AdminPickupConfirmation Component
 * 
 * Tests the admin pickup confirmation component functionality including:
 * - Rendering with different vendor pickup statuses
 * - Notes input and validation
 * - Confirm button behavior
 * - Success and error states
 * - Accessibility features
 * 
 * Requirements: Escrow Wallet Payment Completion - Requirement 5
 * Task: 5.1.5 - Write unit tests for component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminPickupConfirmation } from '@/components/admin/admin-pickup-confirmation';

// Helper function to click the modal confirm button
const clickModalConfirmButton = () => {
  const confirmButtons = screen.getAllByRole('button');
  const modalConfirmButton = confirmButtons.find(btn => 
    btn.textContent === 'Confirm' && btn.className.includes('bg-orange')
  );
  if (modalConfirmButton) {
    fireEvent.click(modalConfirmButton);
  }
};

describe('AdminPickupConfirmation', () => {
  const mockAuctionId = 'auction-123';
  const mockAdminId = 'admin-456';
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render component with title', () => {
      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: false, confirmedAt: null }}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('Confirm Vendor Pickup')).toBeInTheDocument();
    });

    it('should display vendor pickup status section', () => {
      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: false, confirmedAt: null }}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('Vendor Pickup Status')).toBeInTheDocument();
    });

    it('should render notes textarea', () => {
      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: true, confirmedAt: new Date().toISOString() }}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByTestId('admin-notes-input')).toBeInTheDocument();
      expect(screen.getByLabelText('Admin Notes (Optional)')).toBeInTheDocument();
    });

    it('should render confirm button', () => {
      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: false, confirmedAt: null }}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByTestId('confirm-button')).toBeInTheDocument();
    });
  });

  describe('Vendor Pickup Status Display', () => {
    it('should show pending status when vendor has not confirmed', () => {
      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: false, confirmedAt: null }}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('Not confirmed yet')).toBeInTheDocument();
      expect(screen.getByTestId('vendor-status-badge')).toHaveTextContent('Pending');
    });

    it('should show confirmed status when vendor has confirmed', () => {
      const confirmedAt = new Date('2024-01-15T10:30:00Z').toISOString();
      
      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: true, confirmedAt }}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByTestId('vendor-status-badge')).toHaveTextContent('✓ Confirmed');
      expect(screen.getByText(/Confirmed on/)).toBeInTheDocument();
    });

    it('should display vendor confirmation date correctly', () => {
      const confirmedAt = new Date('2024-01-15T10:30:00Z').toISOString();
      
      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: true, confirmedAt }}
          onConfirm={mockOnConfirm}
        />
      );

      const expectedDate = new Date(confirmedAt).toLocaleDateString();
      expect(screen.getByText(`Confirmed on ${expectedDate}`)).toBeInTheDocument();
    });
  });

  describe('Notes Input', () => {
    it('should allow typing in notes field when vendor confirmed', () => {
      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: true, confirmedAt: new Date().toISOString() }}
          onConfirm={mockOnConfirm}
        />
      );

      const notesInput = screen.getByTestId('admin-notes-input') as HTMLTextAreaElement;
      fireEvent.change(notesInput, { target: { value: 'Item in good condition' } });

      expect(notesInput.value).toBe('Item in good condition');
    });

    it('should disable notes field when vendor has not confirmed', () => {
      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: false, confirmedAt: null }}
          onConfirm={mockOnConfirm}
        />
      );

      const notesInput = screen.getByTestId('admin-notes-input');
      expect(notesInput).toBeDisabled();
    });

    it('should show character count for notes', () => {
      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: true, confirmedAt: new Date().toISOString() }}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('0/500 characters')).toBeInTheDocument();

      const notesInput = screen.getByTestId('admin-notes-input');
      fireEvent.change(notesInput, { target: { value: 'Test note' } });

      expect(screen.getByText('9/500 characters')).toBeInTheDocument();
    });
  });

  describe('Confirm Button Behavior', () => {
    it('should disable confirm button when vendor has not confirmed', () => {
      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: false, confirmedAt: null }}
          onConfirm={mockOnConfirm}
        />
      );

      const confirmButton = screen.getByTestId('confirm-button');
      expect(confirmButton).toBeDisabled();
    });

    it('should enable confirm button when vendor has confirmed', () => {
      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: true, confirmedAt: new Date().toISOString() }}
          onConfirm={mockOnConfirm}
        />
      );

      const confirmButton = screen.getByTestId('confirm-button');
      expect(confirmButton).not.toBeDisabled();
    });

    it('should show error when clicking confirm without vendor confirmation', () => {
      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: false, confirmedAt: null }}
          onConfirm={mockOnConfirm}
        />
      );

      // Force click on disabled button (simulating programmatic click)
      const confirmButton = screen.getByTestId('confirm-button');
      fireEvent.click(confirmButton);

      // Modal should not open, onConfirm should not be called
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });
  });

  describe('Confirmation Flow', () => {
    it('should call onConfirm with notes when confirmed', async () => {
      mockOnConfirm.mockResolvedValueOnce(undefined);

      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: true, confirmedAt: new Date().toISOString() }}
          onConfirm={mockOnConfirm}
        />
      );

      // Type notes
      const notesInput = screen.getByTestId('admin-notes-input');
      fireEvent.change(notesInput, { target: { value: 'Item collected successfully' } });

      // Click confirm button
      const confirmButton = screen.getByTestId('confirm-button');
      fireEvent.click(confirmButton);

      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByText(/Confirm that the vendor has collected the item/)).toBeInTheDocument();
      });

      // Click confirm in modal
      clickModalConfirmButton();

      // Wait for onConfirm to be called
      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledWith('Item collected successfully');
      });
    });

    it('should call onConfirm with empty string when no notes provided', async () => {
      mockOnConfirm.mockResolvedValueOnce(undefined);

      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: true, confirmedAt: new Date().toISOString() }}
          onConfirm={mockOnConfirm}
        />
      );

      // Click confirm button without typing notes
      const confirmButton = screen.getByTestId('confirm-button');
      fireEvent.click(confirmButton);

      // Wait for modal
      await waitFor(() => {
        expect(screen.getByText(/Confirm that the vendor has collected the item/)).toBeInTheDocument();
      });

      // Confirm in modal
      clickModalConfirmButton();

      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledWith('');
      });
    });

    it('should show loading state during confirmation', async () => {
      mockOnConfirm.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: true, confirmedAt: new Date().toISOString() }}
          onConfirm={mockOnConfirm}
        />
      );

      const confirmButton = screen.getByTestId('confirm-button');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Confirm that the vendor has collected the item/)).toBeInTheDocument();
      });

      clickModalConfirmButton();

      // Check loading state
      await waitFor(() => {
        expect(screen.getByText('Confirming...')).toBeInTheDocument();
      });
    });
  });

  describe('Success State', () => {
    it('should show success message after confirmation', async () => {
      mockOnConfirm.mockResolvedValueOnce(undefined);

      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: true, confirmedAt: new Date().toISOString() }}
          onConfirm={mockOnConfirm}
        />
      );

      const confirmButton = screen.getByTestId('confirm-button');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Confirm that the vendor has collected the item/)).toBeInTheDocument();
      });

      clickModalConfirmButton();

      await waitFor(() => {
        expect(screen.getByText(/Pickup confirmed successfully/)).toBeInTheDocument();
      });
    });

    it('should disable inputs after successful confirmation', async () => {
      mockOnConfirm.mockResolvedValueOnce(undefined);

      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: true, confirmedAt: new Date().toISOString() }}
          onConfirm={mockOnConfirm}
        />
      );

      const confirmButton = screen.getByTestId('confirm-button');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Confirm that the vendor has collected the item/)).toBeInTheDocument();
      });

      clickModalConfirmButton();

      await waitFor(() => {
        expect(screen.getByTestId('admin-notes-input')).toBeDisabled();
        expect(screen.getByTestId('confirm-button')).toBeDisabled();
      });
    });

    it('should clear notes after successful confirmation', async () => {
      mockOnConfirm.mockResolvedValueOnce(undefined);

      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: true, confirmedAt: new Date().toISOString() }}
          onConfirm={mockOnConfirm}
        />
      );

      const notesInput = screen.getByTestId('admin-notes-input') as HTMLTextAreaElement;
      fireEvent.change(notesInput, { target: { value: 'Test notes' } });

      const confirmButton = screen.getByTestId('confirm-button');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Confirm that the vendor has collected the item/)).toBeInTheDocument();
      });

      clickModalConfirmButton();

      await waitFor(() => {
        expect(notesInput.value).toBe('');
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when confirmation fails', async () => {
      mockOnConfirm.mockRejectedValueOnce(new Error('Network error'));

      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: true, confirmedAt: new Date().toISOString() }}
          onConfirm={mockOnConfirm}
        />
      );

      const confirmButton = screen.getByTestId('confirm-button');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Confirm that the vendor has collected the item/)).toBeInTheDocument();
      });

      clickModalConfirmButton();

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('Network error');
      });
    });

    it('should re-enable button after error', async () => {
      mockOnConfirm.mockRejectedValueOnce(new Error('Failed'));

      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: true, confirmedAt: new Date().toISOString() }}
          onConfirm={mockOnConfirm}
        />
      );

      const confirmButton = screen.getByTestId('confirm-button');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Confirm that the vendor has collected the item/)).toBeInTheDocument();
      });

      clickModalConfirmButton();

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });

      expect(confirmButton).not.toBeDisabled();
    });

    it('should handle non-Error exceptions', async () => {
      mockOnConfirm.mockRejectedValueOnce('String error');

      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: true, confirmedAt: new Date().toISOString() }}
          onConfirm={mockOnConfirm}
        />
      );

      const confirmButton = screen.getByTestId('confirm-button');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Confirm that the vendor has collected the item/)).toBeInTheDocument();
      });

      clickModalConfirmButton();

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to confirm pickup');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: true, confirmedAt: new Date().toISOString() }}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByRole('region', { name: 'Admin pickup confirmation' })).toBeInTheDocument();
      expect(screen.getByLabelText('Admin notes')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm pickup')).toBeInTheDocument();
    });

    it('should have proper status roles', () => {
      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: true, confirmedAt: new Date().toISOString() }}
          onConfirm={mockOnConfirm}
        />
      );

      const statusElements = screen.getAllByRole('status');
      expect(statusElements.length).toBeGreaterThan(0);
    });

    it('should announce errors with assertive aria-live', async () => {
      mockOnConfirm.mockRejectedValueOnce(new Error('Test error'));

      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: true, confirmedAt: new Date().toISOString() }}
          onConfirm={mockOnConfirm}
        />
      );

      const confirmButton = screen.getByTestId('confirm-button');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Confirm that the vendor has collected the item/)).toBeInTheDocument();
      });

      clickModalConfirmButton();

      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toHaveAttribute('aria-live', 'assertive');
      });
    });
  });

  describe('Responsive Design', () => {
    it('should render with responsive classes', () => {
      render(
        <AdminPickupConfirmation
          auctionId={mockAuctionId}
          adminId={mockAdminId}
          vendorPickupStatus={{ confirmed: true, confirmedAt: new Date().toISOString() }}
          onConfirm={mockOnConfirm}
        />
      );

      const container = screen.getByRole('region');
      expect(container).toHaveClass('p-4', 'sm:p-6');
    });
  });
});

