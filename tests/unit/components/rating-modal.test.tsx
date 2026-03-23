import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RatingModal } from '@/components/vendor/rating-modal';

describe('RatingModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    vendorId: 'vendor-123',
    vendorName: 'John\'s Auto Parts',
    auctionId: 'auction-456',
    onSubmit: mockOnSubmit,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(<RatingModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render modal when isOpen is true', () => {
    render(<RatingModal {...defaultProps} />);
    expect(screen.getByText('Rate Vendor')).toBeInTheDocument();
    expect(screen.getByText('John\'s Auto Parts')).toBeInTheDocument();
  });

  it('should display overall rating section', () => {
    render(<RatingModal {...defaultProps} />);
    expect(screen.getByText('Overall Rating *')).toBeInTheDocument();
  });

  it('should display all category rating sections', () => {
    render(<RatingModal {...defaultProps} />);
    expect(screen.getByText('Payment Speed')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
    expect(screen.getByText('Pickup Punctuality')).toBeInTheDocument();
  });

  it('should display optional review textarea', () => {
    render(<RatingModal {...defaultProps} />);
    const textarea = screen.getByPlaceholderText(/Share your experience/i);
    expect(textarea).toBeInTheDocument();
  });

  it('should show character count for review', () => {
    render(<RatingModal {...defaultProps} />);
    expect(screen.getByText('0/500 characters')).toBeInTheDocument();
  });

  it('should update character count when typing review', () => {
    render(<RatingModal {...defaultProps} />);
    const textarea = screen.getByPlaceholderText(/Share your experience/i);
    
    fireEvent.change(textarea, { target: { value: 'Great vendor!' } });
    
    expect(screen.getByText('13/500 characters')).toBeInTheDocument();
  });

  it('should allow selecting star ratings', () => {
    render(<RatingModal {...defaultProps} />);
    
    // Find all star buttons (5 stars × 4 sections = 20 buttons)
    const starButtons = screen.getAllByRole('button', { name: /Rate \d stars/i });
    
    // Click the 5th star in the first rating section (overall rating)
    fireEvent.click(starButtons[4]);
    
    // Should show "5 stars" text
    expect(screen.getByText('5 stars')).toBeInTheDocument();
  });

  it('should show error when submitting without overall rating', async () => {
    render(<RatingModal {...defaultProps} />);
    
    const submitButton = screen.getByRole('button', { name: /Submit Rating/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Please provide an overall rating')).toBeInTheDocument();
    });
    
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should show error when submitting without all category ratings', async () => {
    render(<RatingModal {...defaultProps} />);
    
    // Set overall rating
    const starButtons = screen.getAllByRole('button', { name: /Rate \d stars/i });
    fireEvent.click(starButtons[4]); // 5 stars for overall
    
    const submitButton = screen.getByRole('button', { name: /Submit Rating/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Please rate all categories')).toBeInTheDocument();
    });
    
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should call onSubmit with correct data when form is valid', async () => {
    mockOnSubmit.mockResolvedValue(undefined);
    
    render(<RatingModal {...defaultProps} />);
    
    // Get all star buttons
    const starButtons = screen.getAllByRole('button', { name: /Rate \d stars/i });
    
    // Set overall rating (5 stars)
    fireEvent.click(starButtons[4]);
    
    // Set category ratings (5 stars each)
    fireEvent.click(starButtons[9]); // Payment Speed
    fireEvent.click(starButtons[14]); // Communication
    fireEvent.click(starButtons[19]); // Pickup Punctuality
    
    // Add review
    const textarea = screen.getByPlaceholderText(/Share your experience/i);
    fireEvent.change(textarea, { target: { value: 'Excellent vendor!' } });
    
    // Submit form
    const submitButton = screen.getByRole('button', { name: /Submit Rating/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        overallRating: 5,
        categoryRatings: {
          paymentSpeed: 5,
          communication: 5,
          pickupPunctuality: 5,
        },
        review: 'Excellent vendor!',
      });
    });
  });

  it('should call onClose after successful submission', async () => {
    mockOnSubmit.mockResolvedValue(undefined);
    
    render(<RatingModal {...defaultProps} />);
    
    // Get all star buttons
    const starButtons = screen.getAllByRole('button', { name: /Rate \d stars/i });
    
    // Set all ratings
    fireEvent.click(starButtons[4]); // Overall
    fireEvent.click(starButtons[9]); // Payment Speed
    fireEvent.click(starButtons[14]); // Communication
    fireEvent.click(starButtons[19]); // Pickup Punctuality
    
    // Submit form
    const submitButton = screen.getByRole('button', { name: /Submit Rating/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('should call onClose when cancel button is clicked', () => {
    render(<RatingModal {...defaultProps} />);
    
    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call onClose when X button is clicked', () => {
    render(<RatingModal {...defaultProps} />);
    
    const closeButton = screen.getByRole('button', { name: /Close modal/i });
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should disable buttons while submitting', async () => {
    mockOnSubmit.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<RatingModal {...defaultProps} />);
    
    // Get all star buttons
    const starButtons = screen.getAllByRole('button', { name: /Rate \d stars/i });
    
    // Set all ratings
    fireEvent.click(starButtons[4]); // Overall
    fireEvent.click(starButtons[9]); // Payment Speed
    fireEvent.click(starButtons[14]); // Communication
    fireEvent.click(starButtons[19]); // Pickup Punctuality
    
    // Submit form
    const submitButton = screen.getByRole('button', { name: /Submit Rating/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Submitting...')).toBeInTheDocument();
    });
    
    // Buttons should be disabled
    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    expect(cancelButton).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });

  it('should show error message when submission fails', async () => {
    mockOnSubmit.mockRejectedValue(new Error('Network error'));
    
    render(<RatingModal {...defaultProps} />);
    
    // Get all star buttons
    const starButtons = screen.getAllByRole('button', { name: /Rate \d stars/i });
    
    // Set all ratings
    fireEvent.click(starButtons[4]); // Overall
    fireEvent.click(starButtons[9]); // Payment Speed
    fireEvent.click(starButtons[14]); // Communication
    fireEvent.click(starButtons[19]); // Pickup Punctuality
    
    // Submit form
    const submitButton = screen.getByRole('button', { name: /Submit Rating/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('should enforce 500 character limit on review', () => {
    render(<RatingModal {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText(/Share your experience/i) as HTMLTextAreaElement;
    
    // The maxLength attribute prevents typing beyond 500 characters in the browser
    // but doesn't prevent programmatic setting in tests
    expect(textarea).toHaveAttribute('maxLength', '500');
  });

  it('should submit without review if not provided', async () => {
    mockOnSubmit.mockResolvedValue(undefined);
    
    render(<RatingModal {...defaultProps} />);
    
    // Get all star buttons
    const starButtons = screen.getAllByRole('button', { name: /Rate \d stars/i });
    
    // Set all ratings
    fireEvent.click(starButtons[4]); // Overall
    fireEvent.click(starButtons[9]); // Payment Speed
    fireEvent.click(starButtons[14]); // Communication
    fireEvent.click(starButtons[19]); // Pickup Punctuality
    
    // Submit without review
    const submitButton = screen.getByRole('button', { name: /Submit Rating/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        overallRating: 5,
        categoryRatings: {
          paymentSpeed: 5,
          communication: 5,
          pickupPunctuality: 5,
        },
        review: undefined,
      });
    });
  });

  it('should trim whitespace from review before submission', async () => {
    mockOnSubmit.mockResolvedValue(undefined);
    
    render(<RatingModal {...defaultProps} />);
    
    // Get all star buttons
    const starButtons = screen.getAllByRole('button', { name: /Rate \d stars/i });
    
    // Set all ratings
    fireEvent.click(starButtons[4]); // Overall
    fireEvent.click(starButtons[9]); // Payment Speed
    fireEvent.click(starButtons[14]); // Communication
    fireEvent.click(starButtons[19]); // Pickup Punctuality
    
    // Add review with whitespace
    const textarea = screen.getByPlaceholderText(/Share your experience/i);
    fireEvent.change(textarea, { target: { value: '  Great vendor!  ' } });
    
    // Submit form
    const submitButton = screen.getByRole('button', { name: /Submit Rating/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        overallRating: 5,
        categoryRatings: {
          paymentSpeed: 5,
          communication: 5,
          pickupPunctuality: 5,
        },
        review: 'Great vendor!',
      });
    });
  });
});
