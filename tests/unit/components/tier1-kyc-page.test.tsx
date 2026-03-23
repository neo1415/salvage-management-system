import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Tier1KYCPage from '@/app/(dashboard)/vendor/kyc/tier1/page';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(() => ({
    get: vi.fn(),
  })),
}));

// Mock NextAuth
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

describe('Tier1KYCPage', () => {
  const mockPush = vi.fn();
  const mockBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({
      push: mockPush,
      back: mockBack,
    });
    (useSession as any).mockReturnValue({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
        },
      },
      status: 'authenticated',
    });
  });

  it('renders the Tier 1 KYC page', () => {
    render(<Tier1KYCPage />);
    
    expect(screen.getByText('Tier 1 Verification')).toBeInTheDocument();
    expect(screen.getByText('Verify your identity with BVN to start bidding')).toBeInTheDocument();
  });

  it('displays BVN input field', () => {
    render(<Tier1KYCPage />);
    
    const bvnInput = screen.getByLabelText(/Bank Verification Number/i);
    expect(bvnInput).toBeInTheDocument();
    expect(bvnInput).toHaveAttribute('maxLength', '11');
    expect(bvnInput).toHaveAttribute('inputMode', 'numeric');
  });

  it('displays date of birth input field', () => {
    render(<Tier1KYCPage />);
    
    const dobInput = screen.getByLabelText(/Confirm Your Date of Birth/i);
    expect(dobInput).toBeInTheDocument();
    expect(dobInput).toHaveAttribute('type', 'date');
  });

  it('displays Tier 1 benefits', () => {
    render(<Tier1KYCPage />);
    
    expect(screen.getByText('Tier 1 Benefits')).toBeInTheDocument();
    expect(screen.getByText('Instant Approval')).toBeInTheDocument();
    expect(screen.getByText('Bid up to ₦500k')).toBeInTheDocument();
    expect(screen.getByText('Secure & Private')).toBeInTheDocument();
    expect(screen.getByText('Build Reputation')).toBeInTheDocument();
  });

  it('only allows numeric input for BVN', () => {
    render(<Tier1KYCPage />);
    
    const bvnInput = screen.getByLabelText(/Bank Verification Number/i) as HTMLInputElement;
    
    // Try to enter letters
    fireEvent.change(bvnInput, { target: { value: 'abc123' } });
    expect(bvnInput.value).toBe('123');
    
    // Try to enter valid digits
    fireEvent.change(bvnInput, { target: { value: '12345678901' } });
    expect(bvnInput.value).toBe('12345678901');
  });

  it('limits BVN input to 11 digits', () => {
    render(<Tier1KYCPage />);
    
    const bvnInput = screen.getByLabelText(/Bank Verification Number/i) as HTMLInputElement;
    
    // Enter exactly 11 digits - should be accepted
    fireEvent.change(bvnInput, { target: { value: '12345678901' } });
    expect(bvnInput.value).toBe('12345678901');
    
    // The component prevents entering more than 11 digits via state management
    // The maxLength attribute on the input also enforces this at the HTML level
    expect(bvnInput).toHaveAttribute('maxLength', '11');
  });

  it('disables submit button when BVN is incomplete', () => {
    render(<Tier1KYCPage />);
    
    const submitButton = screen.getByRole('button', { name: /Verify My Identity/i });
    expect(submitButton).toBeDisabled();
    
    // Enter incomplete BVN
    const bvnInput = screen.getByLabelText(/Bank Verification Number/i);
    fireEvent.change(bvnInput, { target: { value: '12345' } });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when BVN and DOB are complete', () => {
    render(<Tier1KYCPage />);
    
    const bvnInput = screen.getByLabelText(/Bank Verification Number/i);
    const dobInput = screen.getByLabelText(/Confirm Your Date of Birth/i);
    const submitButton = screen.getByRole('button', { name: /Verify My Identity/i });
    
    // Enter complete BVN
    fireEvent.change(bvnInput, { target: { value: '12345678901' } });
    
    // Enter DOB
    fireEvent.change(dobInput, { target: { value: '1990-01-01' } });
    
    expect(submitButton).not.toBeDisabled();
  });

  it('shows error message on validation failure', async () => {
    render(<Tier1KYCPage />);
    
    const bvnInput = screen.getByLabelText(/Bank Verification Number/i);
    const dobInput = screen.getByLabelText(/Confirm Your Date of Birth/i);
    const submitButton = screen.getByRole('button', { name: /Verify My Identity/i });
    
    // Mock failed API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'BVN verification failed',
        message: 'The BVN details do not match your registration information.',
      }),
    });
    
    // Fill form
    fireEvent.change(bvnInput, { target: { value: '12345678901' } });
    fireEvent.change(dobInput, { target: { value: '1990-01-01' } });
    
    // Submit
    fireEvent.click(submitButton);
    
    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText('Verification Failed')).toBeInTheDocument();
      expect(screen.getByText(/The BVN details do not match/i)).toBeInTheDocument();
    });
  });

  it('shows mismatch details when provided', async () => {
    render(<Tier1KYCPage />);
    
    const bvnInput = screen.getByLabelText(/Bank Verification Number/i);
    const dobInput = screen.getByLabelText(/Confirm Your Date of Birth/i);
    const submitButton = screen.getByRole('button', { name: /Verify My Identity/i });
    
    // Mock failed API response with mismatches
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'BVN details do not match',
        message: 'The BVN details do not match your registration information.',
        matchScore: 65,
        mismatches: [
          'First name mismatch: "John" vs "Jonathan"',
          'Date of birth mismatch: "1990-01-01" vs "1990-01-15"',
        ],
      }),
    });
    
    // Fill form
    fireEvent.change(bvnInput, { target: { value: '12345678901' } });
    fireEvent.change(dobInput, { target: { value: '1990-01-01' } });
    
    // Submit
    fireEvent.click(submitButton);
    
    // Wait for error message with details
    await waitFor(() => {
      expect(screen.getByText('Match Score: 65%')).toBeInTheDocument();
      expect(screen.getByText(/First name mismatch/i)).toBeInTheDocument();
      expect(screen.getByText(/Date of birth mismatch/i)).toBeInTheDocument();
    });
  });

  it('shows success message and redirects on successful verification', async () => {
    render(<Tier1KYCPage />);
    
    const bvnInput = screen.getByLabelText(/Bank Verification Number/i);
    const dobInput = screen.getByLabelText(/Confirm Your Date of Birth/i);
    const submitButton = screen.getByRole('button', { name: /Verify My Identity/i });
    
    // Mock successful API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Congratulations! Your Tier 1 verification is complete.',
        data: {
          tier: 'tier1_bvn',
          status: 'approved',
          bvnVerified: true,
          maxBidAmount: 500000,
        },
      }),
    });
    
    // Fill form
    fireEvent.change(bvnInput, { target: { value: '12345678901' } });
    fireEvent.change(dobInput, { target: { value: '1990-01-01' } });
    
    // Submit
    fireEvent.click(submitButton);
    
    // Wait for success message
    await waitFor(() => {
      expect(screen.getByText(/Verification Complete!/i)).toBeInTheDocument();
      expect(screen.getByText('Tier 1 Verified')).toBeInTheDocument();
      expect(screen.getByText(/You can now bid up to/i)).toBeInTheDocument();
    });
    
    // Check that redirect is scheduled
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/vendor/dashboard');
    }, { timeout: 3500 });
  });

  it('shows verification progress indicator during submission', async () => {
    render(<Tier1KYCPage />);
    
    const bvnInput = screen.getByLabelText(/Bank Verification Number/i);
    const dobInput = screen.getByLabelText(/Confirm Your Date of Birth/i);
    const submitButton = screen.getByRole('button', { name: /Verify My Identity/i });
    
    // Mock slow API response
    (global.fetch as any).mockImplementationOnce(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({ success: true }),
      }), 100))
    );
    
    // Fill form
    fireEvent.change(bvnInput, { target: { value: '12345678901' } });
    fireEvent.change(dobInput, { target: { value: '1990-01-01' } });
    
    // Submit
    fireEvent.click(submitButton);
    
    // Check for progress indicator
    expect(screen.getByText('Verifying your BVN...')).toBeInTheDocument();
    expect(screen.getByText('Connecting to Paystack Identity API')).toBeInTheDocument();
    expect(screen.getByText('Verifying BVN details')).toBeInTheDocument();
    expect(screen.getByText('Matching with your registration information')).toBeInTheDocument();
  });

  it('displays security information', () => {
    render(<Tier1KYCPage />);
    
    expect(screen.getByText('Why do we need your BVN?')).toBeInTheDocument();
    expect(screen.getByText(/Your BVN is encrypted and secure/i)).toBeInTheDocument();
    expect(screen.getByText(/Your data is secure/i)).toBeInTheDocument();
    expect(screen.getByText(/bank-grade encryption/i)).toBeInTheDocument();
  });

  it('redirects to login if not authenticated', () => {
    (useSession as any).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    });
    
    render(<Tier1KYCPage />);
    
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('shows loading state while checking authentication', () => {
    (useSession as any).mockReturnValue({
      data: null,
      status: 'loading',
    });
    
    render(<Tier1KYCPage />);
    
    // Should show loading spinner
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('navigates back when back button is clicked', () => {
    render(<Tier1KYCPage />);
    
    const backButton = screen.getByRole('button', { name: /Back/i });
    fireEvent.click(backButton);
    
    expect(mockBack).toHaveBeenCalled();
  });
});
