import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VendorRegistrationForm } from '@/components/forms/vendor-registration-form';

describe('VendorRegistrationForm', () => {
  it('renders all form fields', () => {
    const mockOnSubmit = vi.fn();
    render(<VendorRegistrationForm onSubmit={mockOnSubmit} />);

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    const mockOnSubmit = vi.fn();
    const user = userEvent.setup();
    render(<VendorRegistrationForm onSubmit={mockOnSubmit} />);

    const submitButton = screen.getByRole('button', { name: /create account/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/full name must be at least 2 characters/i)).toBeInTheDocument();
    });
  });

  it('shows password strength indicator', async () => {
    const mockOnSubmit = vi.fn();
    const user = userEvent.setup();
    render(<VendorRegistrationForm onSubmit={mockOnSubmit} />);

    const passwordInput = screen.getByLabelText(/password/i);
    await user.type(passwordInput, 'weak');

    await waitFor(() => {
      expect(screen.getByText(/password strength:/i)).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    const mockOnSubmit = vi.fn();
    const user = userEvent.setup();
    render(<VendorRegistrationForm onSubmit={mockOnSubmit} />);

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'invalid-email');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
    });
  });

  it('validates Nigerian phone number format', async () => {
    const mockOnSubmit = vi.fn();
    const user = userEvent.setup();
    render(<VendorRegistrationForm onSubmit={mockOnSubmit} />);

    const phoneInput = screen.getByLabelText(/phone number/i);
    await user.type(phoneInput, '1234567890');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/invalid nigerian phone number format/i)).toBeInTheDocument();
    });
  });

  it('requires terms and conditions acceptance', async () => {
    const mockOnSubmit = vi.fn();
    const user = userEvent.setup();
    render(<VendorRegistrationForm onSubmit={mockOnSubmit} />);

    // Fill all fields except terms
    await user.type(screen.getByLabelText(/full name/i), 'John Doe');
    await user.type(screen.getByLabelText(/email address/i), 'john@example.com');
    await user.type(screen.getByLabelText(/phone number/i), '08012345678');
    await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');
    await user.type(screen.getByLabelText(/password/i), 'Password123!');

    const submitButton = screen.getByRole('button', { name: /create account/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/you must accept the terms and conditions/i)).toBeInTheDocument();
    });
  });

  it('renders OAuth buttons when onOAuthLogin is provided', () => {
    const mockOnSubmit = vi.fn();
    const mockOnOAuthLogin = vi.fn();
    render(<VendorRegistrationForm onSubmit={mockOnSubmit} onOAuthLogin={mockOnOAuthLogin} />);

    expect(screen.getByText(/sign up with google/i)).toBeInTheDocument();
    expect(screen.getByText(/sign up with facebook/i)).toBeInTheDocument();
  });

  it('calls onOAuthLogin when OAuth button is clicked', async () => {
    const mockOnSubmit = vi.fn();
    const mockOnOAuthLogin = vi.fn();
    const user = userEvent.setup();
    render(<VendorRegistrationForm onSubmit={mockOnSubmit} onOAuthLogin={mockOnOAuthLogin} />);

    const googleButton = screen.getByText(/sign up with google/i);
    await user.click(googleButton);

    expect(mockOnOAuthLogin).toHaveBeenCalledWith('google');
  });

  it('toggles password visibility', async () => {
    const mockOnSubmit = vi.fn();
    const user = userEvent.setup();
    render(<VendorRegistrationForm onSubmit={mockOnSubmit} />);

    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    const toggleButton = screen.getByRole('button', { name: '' }); // Eye icon button
    await user.click(toggleButton);

    expect(passwordInput.type).toBe('text');
  });

  it('submits form with valid data', async () => {
    const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<VendorRegistrationForm onSubmit={mockOnSubmit} />);

    // Fill all fields
    await user.type(screen.getByLabelText(/full name/i), 'John Doe');
    await user.type(screen.getByLabelText(/email address/i), 'john@example.com');
    await user.type(screen.getByLabelText(/phone number/i), '08012345678');
    await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');
    await user.type(screen.getByLabelText(/password/i), 'Password123!');
    await user.click(screen.getByRole('checkbox'));

    const submitButton = screen.getByRole('button', { name: /create account/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'John Doe',
          email: 'john@example.com',
          phone: '+2348012345678',
          dateOfBirth: expect.any(Object), // Can be string or Date object
          password: 'Password123!',
          termsAccepted: true,
        })
      );
    });
  });
});
