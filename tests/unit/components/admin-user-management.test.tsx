/**
 * Unit Tests: Admin User Management UI
 * Tests the admin user management page component
 * 
 * Requirements:
 * - Requirement 10: Staff Account Creation
 * - NFR5.3: User Experience
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminUserManagement from '@/app/(dashboard)/admin/users/page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock fetch
global.fetch = vi.fn();

describe('AdminUserManagement Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the page title and description', async () => {
    // Mock successful fetch
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, users: [], count: 0 }),
    });

    render(<AdminUserManagement />);

    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Manage staff accounts and view all system users')).toBeInTheDocument();
  });

  it('should render filter controls', async () => {
    // Mock successful fetch
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, users: [], count: 0 }),
    });

    render(<AdminUserManagement />);

    await waitFor(() => {
      expect(screen.getByLabelText('Search')).toBeInTheDocument();
      expect(screen.getByLabelText('Role')).toBeInTheDocument();
      expect(screen.getByLabelText('Status')).toBeInTheDocument();
    });
  });

  it('should render "Add New User" button', async () => {
    // Mock successful fetch
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, users: [], count: 0 }),
    });

    render(<AdminUserManagement />);

    await waitFor(() => {
      expect(screen.getByText('+ Add New User')).toBeInTheDocument();
    });
  });

  it('should display loading state initially', () => {
    // Mock pending fetch
    (global.fetch as any).mockImplementationOnce(() => new Promise(() => {}));

    render(<AdminUserManagement />);

    expect(screen.getByText('Loading users...')).toBeInTheDocument();
  });

  it('should display users in table when data is loaded', async () => {
    const mockUsers = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'john.doe@nem-insurance.com',
        phone: '+2348012345678',
        fullName: 'John Doe',
        role: 'claims_adjuster',
        status: 'phone_verified_tier_0',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        lastLoginAt: '2024-01-15T10:30:00Z',
        loginDeviceType: 'mobile',
      },
    ];

    // Mock successful fetch
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, users: mockUsers, count: 1 }),
    });

    render(<AdminUserManagement />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@nem-insurance.com')).toBeInTheDocument();
      expect(screen.getByText('+2348012345678')).toBeInTheDocument();
      // Use getAllByText since these appear in both filter dropdown and table
      const claimsAdjusterElements = screen.getAllByText('Claims Adjuster');
      expect(claimsAdjusterElements.length).toBeGreaterThan(0);
      const phoneVerifiedElements = screen.getAllByText('Phone Verified');
      expect(phoneVerifiedElements.length).toBeGreaterThan(0);
    });
  });

  it('should display empty state when no users found', async () => {
    // Mock successful fetch with no users
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, users: [], count: 0 }),
    });

    render(<AdminUserManagement />);

    await waitFor(() => {
      expect(screen.getByText('No users found')).toBeInTheDocument();
    });
  });

  it('should display error message when fetch fails', async () => {
    // Mock failed fetch
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to fetch users' }),
    });

    render(<AdminUserManagement />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch users')).toBeInTheDocument();
    });
  });

  it('should open modal when "Add New User" button is clicked', async () => {
    // Mock successful fetch
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, users: [], count: 0 }),
    });

    render(<AdminUserManagement />);

    await waitFor(() => {
      const addButton = screen.getByText('+ Add New User');
      fireEvent.click(addButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Add New User')).toBeInTheDocument();
      expect(screen.getByLabelText('Full Name *')).toBeInTheDocument();
      expect(screen.getByLabelText('Email *')).toBeInTheDocument();
      expect(screen.getByLabelText('Phone Number *')).toBeInTheDocument();
      expect(screen.getByLabelText('Role *')).toBeInTheDocument();
    });
  });

  it('should validate form fields before submission', async () => {
    // Mock successful fetch for initial load
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, users: [], count: 0 }),
    });

    render(<AdminUserManagement />);

    // Open modal
    await waitFor(() => {
      const addButton = screen.getByText('+ Add New User');
      fireEvent.click(addButton);
    });

    // Try to submit empty form
    await waitFor(() => {
      const submitButton = screen.getByText('Create User');
      fireEvent.click(submitButton);
    });

    // Check for validation errors
    await waitFor(() => {
      expect(screen.getByText('Full name must be at least 2 characters')).toBeInTheDocument();
      expect(screen.getByText('Invalid email format')).toBeInTheDocument();
      expect(screen.getByText('Invalid phone number format (10-15 digits)')).toBeInTheDocument();
    });
  });

  it('should submit form with valid data', async () => {
    // Mock successful fetch for initial load
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, users: [], count: 0 }),
    });

    render(<AdminUserManagement />);

    // Open modal
    await waitFor(() => {
      const addButton = screen.getByText('+ Add New User');
      fireEvent.click(addButton);
    });

    // Fill form
    await waitFor(() => {
      fireEvent.change(screen.getByLabelText('Full Name *'), {
        target: { value: 'Jane Smith' },
      });
      fireEvent.change(screen.getByLabelText('Email *'), {
        target: { value: 'jane.smith@nem-insurance.com' },
      });
      fireEvent.change(screen.getByLabelText('Phone Number *'), {
        target: { value: '+2348087654321' },
      });
    });

    // Mock successful user creation
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Staff account created successfully',
        user: {
          id: '456e7890-e89b-12d3-a456-426614174001',
          email: 'jane.smith@nem-insurance.com',
          fullName: 'Jane Smith',
          role: 'claims_adjuster',
          status: 'phone_verified_tier_0',
          createdAt: '2024-01-20T00:00:00Z',
        },
        temporaryPassword: 'Sunset-Mountain-River-42!',
        provisioningTime: '1234ms',
      }),
    });

    // Mock fetch for refreshing user list
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, users: [], count: 0 }),
    });

    // Submit form
    await waitFor(() => {
      const submitButton = screen.getByText('Create User');
      fireEvent.click(submitButton);
    });

    // Check for success message
    await waitFor(() => {
      expect(screen.getByText(/User created successfully/)).toBeInTheDocument();
      expect(screen.getByText('Sunset-Mountain-River-42!')).toBeInTheDocument();
    });
  });

  it('should apply filters when changed', async () => {
    // Mock initial fetch
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, users: [], count: 0 }),
    });

    render(<AdminUserManagement />);

    await waitFor(() => {
      expect(screen.getByLabelText('Role')).toBeInTheDocument();
    });

    // Mock fetch with role filter
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, users: [], count: 0 }),
    });

    // Change role filter
    const roleSelect = screen.getByLabelText('Role');
    fireEvent.change(roleSelect, { target: { value: 'claims_adjuster' } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('role=claims_adjuster')
      );
    });
  });

  it('should display role badges with correct colors', async () => {
    const mockUsers = [
      {
        id: '1',
        email: 'adjuster@nem.com',
        phone: '+2348012345678',
        fullName: 'Adjuster User',
        role: 'claims_adjuster',
        status: 'phone_verified_tier_0',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        lastLoginAt: null,
        loginDeviceType: null,
      },
      {
        id: '2',
        email: 'manager@nem.com',
        phone: '+2348012345679',
        fullName: 'Manager User',
        role: 'salvage_manager',
        status: 'phone_verified_tier_0',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        lastLoginAt: null,
        loginDeviceType: null,
      },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, users: mockUsers, count: 2 }),
    });

    render(<AdminUserManagement />);

    await waitFor(() => {
      expect(screen.getByText('Claims Adjuster')).toBeInTheDocument();
      expect(screen.getByText('Salvage Manager')).toBeInTheDocument();
    });
  });
});
