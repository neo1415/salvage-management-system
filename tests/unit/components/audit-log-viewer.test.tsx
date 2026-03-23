/**
 * Unit tests for Audit Log Viewer UI Component
 * 
 * Requirements:
 * - Requirement 11: Comprehensive Activity Logging
 * - NFR5.3: User Experience
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuditLogViewer from '@/app/(dashboard)/admin/audit-logs/page';

// Mock fetch
global.fetch = vi.fn();

describe('AuditLogViewer Component', () => {
  const mockLogs = [
    {
      id: 'log-1',
      userId: 'user-1',
      userName: 'John Doe',
      userEmail: 'john@example.com',
      userRole: 'vendor',
      actionType: 'login',
      entityType: 'user',
      entityId: 'user-1',
      ipAddress: '192.168.1.1',
      deviceType: 'mobile',
      userAgent: 'Mozilla/5.0 (iPhone)',
      beforeState: null,
      afterState: null,
      createdAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 'log-2',
      userId: 'user-2',
      userName: 'Jane Smith',
      userEmail: 'jane@example.com',
      userRole: 'claims_adjuster',
      actionType: 'case_created',
      entityType: 'case',
      entityId: 'case-1',
      ipAddress: '192.168.1.2',
      deviceType: 'desktop',
      userAgent: 'Mozilla/5.0 (Windows)',
      beforeState: null,
      afterState: { status: 'pending_approval' },
      createdAt: '2024-01-15T11:00:00Z',
    },
  ];

  const mockPagination = {
    page: 1,
    limit: 50,
    totalCount: 2,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        logs: mockLogs,
        pagination: mockPagination,
      }),
    });
  });

  describe('Rendering', () => {
    it('should render the page title and description', async () => {
      render(<AuditLogViewer />);

      expect(screen.getByText('Audit Log Viewer')).toBeInTheDocument();
      expect(screen.getByText(/Comprehensive activity logging for security and compliance/i)).toBeInTheDocument();
    });

    it('should render filter controls', async () => {
      render(<AuditLogViewer />);

      expect(screen.getByLabelText('User ID')).toBeInTheDocument();
      expect(screen.getByLabelText('Action Type')).toBeInTheDocument();
      expect(screen.getByLabelText('Entity Type')).toBeInTheDocument();
      expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
      expect(screen.getByLabelText('End Date')).toBeInTheDocument();
      expect(screen.getByLabelText('Items per page')).toBeInTheDocument();
    });

    it('should render action buttons', async () => {
      render(<AuditLogViewer />);

      expect(screen.getByText('Reset Filters')).toBeInTheDocument();
      expect(screen.getByText(/Export CSV/i)).toBeInTheDocument();
      expect(screen.getByText(/Export Excel/i)).toBeInTheDocument();
    });

    it('should display loading state initially', () => {
      render(<AuditLogViewer />);

      expect(screen.getByText('Loading audit logs...')).toBeInTheDocument();
    });

    it('should display audit logs after loading', async () => {
      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    it('should display table headers', async () => {
      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
      
      // Check for headers using role - this verifies the table structure
      const columnHeaders = screen.getAllByRole('columnheader');
      expect(columnHeaders.length).toBeGreaterThan(0);
      
      // Verify key headers are present in the column headers
      const headerTexts = columnHeaders.map(header => header.textContent);
      expect(headerTexts).toContain('Timestamp');
      expect(headerTexts).toContain('User');
      expect(headerTexts).toContain('IP Address');
    });

    it('should display log details in table rows', async () => {
      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
      
      // Verify specific data is present (using getAllByText for items that appear multiple times)
      const emails = screen.getAllByText('john@example.com');
      expect(emails.length).toBeGreaterThan(0);
    });

    it('should display pagination summary', async () => {
      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText(/Showing/i)).toBeInTheDocument();
        expect(screen.getByText(/audit logs/i)).toBeInTheDocument();
      });
    });
  });

  describe('Filtering', () => {
    it('should filter by user ID', async () => {
      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const userIdInput = screen.getByLabelText('User ID');
      fireEvent.change(userIdInput, { target: { value: 'user-1' } });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('userId=user-1')
        );
      });
    });

    it('should filter by action type', async () => {
      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const actionTypeSelect = screen.getByLabelText('Action Type');
      fireEvent.change(actionTypeSelect, { target: { value: 'login' } });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('actionType=login')
        );
      });
    });

    it('should filter by entity type', async () => {
      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const entityTypeSelect = screen.getByLabelText('Entity Type');
      fireEvent.change(entityTypeSelect, { target: { value: 'case' } });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('entityType=case')
        );
      });
    });

    it('should filter by date range', async () => {
      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const startDateInput = screen.getByLabelText('Start Date');
      const endDateInput = screen.getByLabelText('End Date');

      fireEvent.change(startDateInput, { target: { value: '2024-01-15' } });
      fireEvent.change(endDateInput, { target: { value: '2024-01-16' } });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('startDate=')
        );
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('endDate=')
        );
      });
    });

    it('should reset filters when reset button is clicked', async () => {
      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Set some filters
      const userIdInput = screen.getByLabelText('User ID');
      fireEvent.change(userIdInput, { target: { value: 'user-1' } });

      // Click reset
      const resetButton = screen.getByText('Reset Filters');
      fireEvent.click(resetButton);

      // Check that input is cleared
      expect(userIdInput).toHaveValue('');
    });
  });

  describe('Pagination', () => {
    it('should change page limit', async () => {
      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const limitSelect = screen.getByLabelText('Items per page');
      fireEvent.change(limitSelect, { target: { value: '100' } });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('limit=100')
        );
      });
    });

    it('should navigate to next page', async () => {
      const multiPagePagination = {
        ...mockPagination,
        totalPages: 3,
        hasNextPage: true,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          logs: mockLogs,
          pagination: multiPagePagination,
        }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const nextButton = screen.getByText('Next →');
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('page=2')
        );
      });
    });

    it('should navigate to previous page', async () => {
      const multiPagePagination = {
        ...mockPagination,
        page: 2,
        totalPages: 3,
        hasPreviousPage: true,
        hasNextPage: true,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          logs: mockLogs,
          pagination: multiPagePagination,
        }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const prevButton = screen.getByText('← Previous');
      fireEvent.click(prevButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('page=1')
        );
      });
    });
  });

  describe('Export Functionality', () => {
    it('should export as CSV', async () => {
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ logs: mockLogs, pagination: mockPagination }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Mock blob response for export
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      });

      // Mock URL.createObjectURL
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();

      const exportButton = screen.getByText(/Export CSV/i);
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('export=csv')
        );
      });
    });

    it('should export as Excel', async () => {
      const mockBlob = new Blob(['excel data'], { type: 'application/vnd.ms-excel' });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ logs: mockLogs, pagination: mockPagination }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Mock blob response for export
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      });

      // Mock URL.createObjectURL
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();

      const exportButton = screen.getByText(/Export Excel/i);
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('export=excel')
        );
      });
    });

    it('should disable export buttons when no logs', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          logs: [],
          pagination: { ...mockPagination, totalCount: 0 },
        }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText('No audit logs found')).toBeInTheDocument();
      });

      const csvButton = screen.getByText(/Export CSV/i);
      const excelButton = screen.getByText(/Export Excel/i);

      expect(csvButton).toBeDisabled();
      expect(excelButton).toBeDisabled();
    });
  });

  describe('Detail Modal', () => {
    it('should open detail modal when View Details is clicked', async () => {
      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const viewDetailsButtons = screen.getAllByText('View Details');
      fireEvent.click(viewDetailsButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Audit Log Details')).toBeInTheDocument();
      });
    });

    it('should display log details in modal', async () => {
      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const viewDetailsButtons = screen.getAllByText('View Details');
      fireEvent.click(viewDetailsButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Audit Log Details')).toBeInTheDocument();
        // Check for user agent which is unique to modal
        expect(screen.getByText(/Mozilla\/5\.0 \(iPhone\)/i)).toBeInTheDocument();
      });
    });

    it('should close detail modal when close button is clicked', async () => {
      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const viewDetailsButtons = screen.getAllByText('View Details');
      fireEvent.click(viewDetailsButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Audit Log Details')).toBeInTheDocument();
      });

      // Find the main Close button (not the X button)
      const modalContent = screen.getByText('Audit Log Details').closest('div');
      const closeButton = modalContent?.querySelector('button:last-child');
      
      if (closeButton) {
        fireEvent.click(closeButton);
      }

      await waitFor(() => {
        expect(screen.queryByText('Audit Log Details')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when fetch fails', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Failed to fetch audit logs' }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch audit logs')).toBeInTheDocument();
      });
    });

    it('should display empty state when no logs found', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          logs: [],
          pagination: { ...mockPagination, totalCount: 0 },
        }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText('No audit logs found')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for form inputs', async () => {
      render(<AuditLogViewer />);

      expect(screen.getByLabelText('User ID')).toBeInTheDocument();
      expect(screen.getByLabelText('Action Type')).toBeInTheDocument();
      expect(screen.getByLabelText('Entity Type')).toBeInTheDocument();
      expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
      expect(screen.getByLabelText('End Date')).toBeInTheDocument();
      expect(screen.getByLabelText('Items per page')).toBeInTheDocument();
    });

    it('should have proper button states', async () => {
      const multiPagePagination = {
        ...mockPagination,
        page: 1,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: false,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          logs: mockLogs,
          pagination: multiPagePagination,
        }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const prevButton = screen.getByText('← Previous');
      const nextButton = screen.getByText('Next →');

      expect(prevButton).toBeDisabled();
      expect(nextButton).not.toBeDisabled();
    });
  });
});
