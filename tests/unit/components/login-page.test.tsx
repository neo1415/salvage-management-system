import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import LoginPage from '@/app/(auth)/login/page';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

// Mock NextAuth
vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}));

describe('LoginPage Component', () => {
  const mockPush = vi.fn();
  const mockGet = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push: mockPush });
    (useSearchParams as any).mockReturnValue({ get: mockGet });
    mockGet.mockReturnValue(null); // Default no callback URL
  });

  it('should render login form with all required fields', () => {
    render(<LoginPage />);

    // Check header
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByText('Sign in to access your account')).toBeInTheDocument();

    // Check form fields
    expect(screen.getByLabelText(/Email or Phone Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();

    // Check remember me checkbox
    expect(screen.getByLabelText(/Remember me/i)).toBeInTheDocument();

    // Check forgot password link
    expect(screen.getByText('Forgot password?')).toBeInTheDocument();

    // Check submit button (use exact match to avoid OAuth buttons)
    expect(screen.getByRole('button', { name: /^Sign In$/i })).toBeInTheDocument();
  });

  it('should render OAuth login buttons', () => {
    render(<LoginPage />);

    // Check Google OAuth button
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();

    // Check Facebook OAuth button
    expect(screen.getByText('Sign in with Facebook')).toBeInTheDocument();
  });

  it('should show validation errors for empty fields', async () => {
    render(<LoginPage />);

    const submitButton = screen.getByRole('button', { name: /^Sign In$/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Email or phone number is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });
  });

  it('should toggle password visibility', () => {
    render(<LoginPage />);

    const passwordInput = screen.getByLabelText(/Password/i) as HTMLInputElement;
    const toggleButton = screen.getByRole('button', { name: '' }); // Eye icon button

    // Initially password should be hidden
    expect(passwordInput.type).toBe('password');

    // Click to show password
    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe('text');

    // Click to hide password again
    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe('password');
  });

  it('should call signIn with credentials on form submit', async () => {
    (signIn as any).mockResolvedValue({ error: null });

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/Email or Phone Number/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitButton = screen.getByRole('button', { name: /^Sign In$/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'TestPassword123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith('credentials', expect.objectContaining({
        emailOrPhone: 'test@example.com',
        password: 'TestPassword123!',
        redirect: false,
      }));
    });
  });

  it('should display error message on login failure', async () => {
    const errorMessage = 'Invalid credentials';
    (signIn as any).mockResolvedValue({ error: errorMessage });

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/Email or Phone Number/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitButton = screen.getByRole('button', { name: /^Sign In$/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'WrongPassword123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Login Failed')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('should display account lockout message', async () => {
    const lockoutMessage = 'Account locked due to too many failed login attempts. Please try again in 25 minutes.';
    (signIn as any).mockResolvedValue({ error: lockoutMessage });

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/Email or Phone Number/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitButton = screen.getByRole('button', { name: /^Sign In$/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'WrongPassword123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(lockoutMessage)).toBeInTheDocument();
    });
  });

  it('should redirect to callback URL on successful login', async () => {
    mockGet.mockReturnValue('/vendor/auctions');
    (signIn as any).mockResolvedValue({ error: null });

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/Email or Phone Number/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitButton = screen.getByRole('button', { name: /^Sign In$/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'TestPassword123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/vendor/auctions');
    });
  });

  it('should call OAuth signIn when Google button is clicked', async () => {
    render(<LoginPage />);

    const googleButton = screen.getByText('Sign in with Google');
    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith('google', expect.objectContaining({
        callbackUrl: '/vendor/dashboard',
      }));
    });
  });

  it('should call OAuth signIn when Facebook button is clicked', async () => {
    render(<LoginPage />);

    const facebookButton = screen.getByText('Sign in with Facebook');
    fireEvent.click(facebookButton);

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith('facebook', expect.objectContaining({
        callbackUrl: '/vendor/dashboard',
      }));
    });
  });

  it('should have link to registration page', () => {
    render(<LoginPage />);

    const signUpLink = screen.getByText('Sign up');
    expect(signUpLink).toHaveAttribute('href', '/register');
  });

  it('should have link to forgot password page', () => {
    render(<LoginPage />);

    const forgotPasswordLink = screen.getByText('Forgot password?');
    expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password');
  });
});
