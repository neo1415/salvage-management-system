/**
 * Schema Evolution Table Component Tests
 * 
 * Tests for SchemaEvolutionTable component
 * Task: 15.1.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SchemaEvolutionTable } from '@/components/intelligence/admin/schema-evolution-table';

// Mock fetch
global.fetch = vi.fn();

const mockSchemaChanges = {
  changes: [
    {
      id: '1',
      changeType: 'new_asset_type',
      entityType: 'vehicle',
      entityName: 'electric_scooter',
      detectedAt: '2024-01-15T10:00:00Z',
      status: 'pending',
      sampleCount: 15,
      confidence: 0.85,
    },
    {
      id: '2',
      changeType: 'new_attribute',
      entityType: 'vehicle',
      entityName: 'battery_capacity',
      detectedAt: '2024-01-14T09:00:00Z',
      status: 'approved',
      sampleCount: 25,
      confidence: 0.92,
    },
    {
      id: '3',
      changeType: 'schema_update',
      entityType: 'electronics',
      entityName: 'screen_size',
      detectedAt: '2024-01-13T08:00:00Z',
      status: 'rejected',
      sampleCount: 8,
      confidence: 0.65,
    },
  ],
  pending: 1,
  approved: 1,
  rejected: 1,
};

describe('SchemaEvolutionTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render loading state initially', () => {
    (global.fetch as any).mockImplementation(() => 
      new Promise(() => {}) // Never resolves
    );

    render(<SchemaEvolutionTable />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should fetch and display schema changes', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSchemaChanges,
    });

    render(<SchemaEvolutionTable />);

    await waitFor(() => {
      expect(screen.getByText('Schema Evolution')).toBeInTheDocument();
    });

    expect(screen.getByText('1 pending changes')).toBeInTheDocument();
  });

  it('should display all change types', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSchemaChanges,
    });

    render(<SchemaEvolutionTable />);

    await waitFor(() => {
      expect(screen.getByText(/new.*asset.*type/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/new.*attribute/i)).toBeInTheDocument();
    expect(screen.getByText(/schema.*update/i)).toBeInTheDocument();
  });

  it('should display entity information', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSchemaChanges,
    });

    render(<SchemaEvolutionTable />);

    await waitFor(() => {
      expect(screen.getByText('electric_scooter')).toBeInTheDocument();
    });

    expect(screen.getByText('battery_capacity')).toBeInTheDocument();
    expect(screen.getByText('screen_size')).toBeInTheDocument();
  });

  it('should display sample counts', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSchemaChanges,
    });

    render(<SchemaEvolutionTable />);

    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument();
    });

    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('should display confidence scores', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSchemaChanges,
    });

    render(<SchemaEvolutionTable />);

    await waitFor(() => {
      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument();
  });

  it('should display status badges correctly', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSchemaChanges,
    });

    render(<SchemaEvolutionTable />);

    await waitFor(() => {
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('should show action buttons for pending changes', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSchemaChanges,
    });

    render(<SchemaEvolutionTable />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
  });

  it('should handle approve action', async () => {
    const user = userEvent.setup();

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSchemaChanges,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockSchemaChanges,
          changes: mockSchemaChanges.changes.map(c => 
            c.id === '1' ? { ...c, status: 'approved' } : c
          ),
        }),
      });

    render(<SchemaEvolutionTable />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    });

    const approveButton = screen.getByRole('button', { name: /approve/i });
    await user.click(approveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/intelligence/admin/schema/validate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ changeId: '1', action: 'approve' }),
        })
      );
    });
  });

  it('should handle reject action', async () => {
    const user = userEvent.setup();

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSchemaChanges,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockSchemaChanges,
          changes: mockSchemaChanges.changes.map(c => 
            c.id === '1' ? { ...c, status: 'rejected' } : c
          ),
        }),
      });

    render(<SchemaEvolutionTable />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
    });

    const rejectButton = screen.getByRole('button', { name: /reject/i });
    await user.click(rejectButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/intelligence/admin/schema/validate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ changeId: '1', action: 'reject' }),
        })
      );
    });
  });

  it('should handle empty data gracefully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ changes: [], pending: 0, approved: 0, rejected: 0 }),
    });

    render(<SchemaEvolutionTable />);

    await waitFor(() => {
      expect(screen.getByText('No schema changes detected')).toBeInTheDocument();
    });
  });

  it('should handle API error gracefully', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('API Error'));

    render(<SchemaEvolutionTable />);

    await waitFor(() => {
      expect(screen.getByText('No schema changes detected')).toBeInTheDocument();
    });
  });

  it('should call correct API endpoint', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSchemaChanges,
    });

    render(<SchemaEvolutionTable />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/intelligence/admin/schema/pending');
    });
  });

  it('should not show action buttons for approved changes', async () => {
    const approvedOnly = {
      changes: [mockSchemaChanges.changes[1]], // Only approved change
      pending: 0,
      approved: 1,
      rejected: 0,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => approvedOnly,
    });

    render(<SchemaEvolutionTable />);

    await waitFor(() => {
      expect(screen.getByText('Approved')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
  });
});
