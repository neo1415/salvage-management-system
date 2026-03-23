import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

// Import component after mocks
const VerifyOTPPage = (await import('@/app/(auth)/verify-otp/page')).default;

describe('VerifyOTPPage', () => {
  const mockPush = vi.fn();
  const mockBack = vi.fn();
  const mockGet = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    (useRouter as any).mockReturnValue({
      push: mockPush,
      back: mockBack,
    });
    
    mockGet.mockReturnValue('+2348012345678');
    (useSearchParams as any).mockReturnValue({
      get: mockGet,
    });

    // Mock fetch
    global.fetch = vi.fn();
  });

  it('should render OTP verification page with 6 input fields', () => {
    render(<VerifyOTPPage />);
    
    expect(screen.getByText('Verify Your Phone')).toBeInTheDocument();
    expect(screen.getByText('+2348012345678')).toBeInTheDocument();
    
    // Should have 6 OTP input fields
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(6);
  });

  it('should display countdown timer', () => {
    render(<VerifyOTPPage />);
    
    expect(screen.getByText(/Time remaining:/)).toBeInTheDocument();
  });

  it('should auto-focus first input on mount', () => {
    render(<VerifyOTPPage />);
    
    const inputs = screen.getAllByRole('textbox');
    expect(inputs[0]).toHaveFocus();
  });

  it('should move to next input when digit is entered', () => {
    render(<VerifyOTPPage />);
    
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    
    fireEvent.change(inputs[0], { target: { value: '1' } });
    
    expect(inputs[0].value).toBe('1');
    expect(inputs[1]).toHaveFocus();
  });

  it('should only accept numeric digits', () => {
    render(<VerifyOTPPage />);
    
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    
    fireEvent.change(inputs[0], { target: { value: 'a' } });
    expect(inputs[0].value).toBe('');
    
    fireEvent.change(inputs[0], { target: { value: '5' } });
    expect(inputs[0].value).toBe('5');
  });

  it('should handle backspace to move to previous input', () => {
    render(<VerifyOTPPage />);
    
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    
    // Enter digit in first input
    fireEvent.change(inputs[0], { target: { value: '1' } });
    expect(inputs[1]).toHaveFocus();
    
    // Press backspace on empty second input
    fireEvent.keyDown(inputs[1], { key: 'Backspace' });
    expect(inputs[0]).toHaveFocus();
  });

  it('should call API when all 6 digits are entered', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: 'Phone verified successfully' }),
    });

    render(<VerifyOTPPage />);
    
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    
    // Enter all 6 digits
    fireEvent.change(inputs[0], { target: { value: '1' } });
    fireEvent.change(inputs[1], { target: { value: '2' } });
    fireEvent.change(inputs[2], { target: { value: '3' } });
    fireEvent.change(inputs[3], { target: { value: '4' } });
    fireEvent.change(inputs[4], { target: { value: '5' } });
    fireEvent.change(inputs[5], { target: { value: '6' } });
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+2348012345678', otp: '123456' }),
      });
    });
  });

  it('should display error message for invalid OTP', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid OTP. 2 attempts remaining.' }),
    });

    render(<VerifyOTPPage />);
    
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    
    // Enter all 6 digits
    fireEvent.change(inputs[0], { target: { value: '1' } });
    fireEvent.change(inputs[1], { target: { value: '2' } });
    fireEvent.change(inputs[2], { target: { value: '3' } });
    fireEvent.change(inputs[3], { target: { value: '4' } });
    fireEvent.change(inputs[4], { target: { value: '5' } });
    fireEvent.change(inputs[5], { target: { value: '6' } });
    
    await waitFor(() => {
      expect(screen.getByText('Verification Failed')).toBeInTheDocument();
      expect(screen.getByText('Invalid OTP. 2 attempts remaining.')).toBeInTheDocument();
    });
  });

  it('should clear inputs after error', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid OTP' }),
    });

    render(<VerifyOTPPage />);
    
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    
    // Enter all 6 digits
    fireEvent.change(inputs[0], { target: { value: '1' } });
    fireEvent.change(inputs[1], { target: { value: '2' } });
    fireEvent.change(inputs[2], { target: { value: '3' } });
    fireEvent.change(inputs[3], { target: { value: '4' } });
    fireEvent.change(inputs[4], { target: { value: '5' } });
    fireEvent.change(inputs[5], { target: { value: '6' } });
    
    await waitFor(() => {
      expect(inputs[0].value).toBe('');
      expect(inputs[1].value).toBe('');
      expect(inputs[2].value).toBe('');
      expect(inputs[3].value).toBe('');
      expect(inputs[4].value).toBe('');
      expect(inputs[5].value).toBe('');
    });
  });

  it('should show success message on successful verification', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: 'Phone verified successfully', userId: 'user-123' }),
    });

    render(<VerifyOTPPage />);
    
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    
    // Enter all 6 digits
    fireEvent.change(inputs[0], { target: { value: '1' } });
    fireEvent.change(inputs[1], { target: { value: '2' } });
    fireEvent.change(inputs[2], { target: { value: '3' } });
    fireEvent.change(inputs[3], { target: { value: '4' } });
    fireEvent.change(inputs[4], { target: { value: '5' } });
    fireEvent.change(inputs[5], { target: { value: '6' } });
    
    await waitFor(() => {
      expect(screen.getByText('Phone Verified Successfully!')).toBeInTheDocument();
    });
  });

  it('should disable submit button when not all digits are entered', () => {
    render(<VerifyOTPPage />);
    
    const submitButton = screen.getByRole('button', { name: /Verify Phone Number/i });
    expect(submitButton).toBeDisabled();
    
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    
    // Enter only 3 digits
    fireEvent.change(inputs[0], { target: { value: '1' } });
    fireEvent.change(inputs[1], { target: { value: '2' } });
    fireEvent.change(inputs[2], { target: { value: '3' } });
    
    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button when all 6 digits are entered', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: 'Phone verified successfully' }),
    });

    render(<VerifyOTPPage />);
    
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    
    // Enter all 6 digits
    fireEvent.change(inputs[0], { target: { value: '1' } });
    fireEvent.change(inputs[1], { target: { value: '2' } });
    fireEvent.change(inputs[2], { target: { value: '3' } });
    fireEvent.change(inputs[3], { target: { value: '4' } });
    fireEvent.change(inputs[4], { target: { value: '5' } });
    fireEvent.change(inputs[5], { target: { value: '6' } });
    
    // Button text changes to "Verifying..." when auto-submit is triggered
    await waitFor(() => {
      const verifyingButton = screen.getByRole('button', { name: /Verifying/i });
      expect(verifyingButton).toBeInTheDocument();
    });
  });

  it('should display resend button', () => {
    render(<VerifyOTPPage />);
    
    const resendButton = screen.getByRole('button', { name: /Resend/i });
    expect(resendButton).toBeInTheDocument();
    // Initially disabled until timer expires
    expect(resendButton).toBeDisabled();
  });
});
