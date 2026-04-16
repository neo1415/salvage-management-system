/**
 * ML Datasets Table Component Tests
 * 
 * Tests for MLDatasetsTable component
 * Task: 15.1.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MLDatasetsTable } from '@/components/intelligence/admin/ml-datasets-table';

// Mock fetch
global.fetch = vi.fn();

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

const mockDatasets = {
  datasets: [
    {
      id: 'ds-1',
      datasetType: 'price_prediction',
      recordCount: 5000,
      featureCount: 25,
      createdAt: '2024-01-15T10:00:00Z',
      format: 'csv',
      size: 2048000,
      trainSplit: 70,
      validationSplit: 15,
      testSplit: 15,
    },
    {
      id: 'ds-2',
      datasetType: 'recommendation',
      recordCount: 10000,
      featureCount: 30,
      createdAt: '2024-01-14T09:00:00Z',
      format: 'json',
      size: 5120000,
      trainSplit: 80,
      validationSplit: 10,
      testSplit: 10,
    },
    {
      id: 'ds-3',
      datasetType: 'fraud_detection',
      recordCount: 3000,
      featureCount: 20,
      createdAt: '2024-01-13T08:00:00Z',
      format: 'parquet',
      size: 1024000,
      trainSplit: 70,
      validationSplit: 15,
      testSplit: 15,
    },
  ],
  totalRecords: 18000,
  totalSize: 8192000,
};

describe('MLDatasetsTable', () => {
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

    render(<MLDatasetsTable />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should fetch and display datasets', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDatasets,
    });

    render(<MLDatasetsTable />);

    await waitFor(() => {
      expect(screen.getByText('ML Training Datasets')).toBeInTheDocument();
    });

    expect(screen.getByText('3 datasets available')).toBeInTheDocument();
  });

  it('should display dataset types', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDatasets,
    });

    render(<MLDatasetsTable />);

    await waitFor(() => {
      expect(screen.getByText('price prediction')).toBeInTheDocument();
    });

    expect(screen.getByText('recommendation')).toBeInTheDocument();
    expect(screen.getByText('fraud detection')).toBeInTheDocument();
  });

  it('should display record counts', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDatasets,
    });

    render(<MLDatasetsTable />);

    await waitFor(() => {
      expect(screen.getByText('5,000')).toBeInTheDocument();
    });

    expect(screen.getByText('10,000')).toBeInTheDocument();
    expect(screen.getByText('3,000')).toBeInTheDocument();
  });

  it('should display feature counts', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDatasets,
    });

    render(<MLDatasetsTable />);

    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('should display split percentages', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDatasets,
    });

    render(<MLDatasetsTable />);

    await waitFor(() => {
      expect(screen.getAllByText(/Train:\s*70\s*%/)).toHaveLength(2); // Two datasets with 70% train split
    });

    expect(screen.getAllByText(/Val:\s*15\s*%/)).toHaveLength(2);
    expect(screen.getAllByText(/Test:\s*15\s*%/)).toHaveLength(2);
  });

  it('should display formats', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDatasets,
    });

    render(<MLDatasetsTable />);

    await waitFor(() => {
      expect(screen.getByText('CSV')).toBeInTheDocument();
    });

    expect(screen.getByText('JSON')).toBeInTheDocument();
    expect(screen.getByText('PARQUET')).toBeInTheDocument();
  });

  it('should display formatted file sizes', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDatasets,
    });

    render(<MLDatasetsTable />);

    await waitFor(() => {
      expect(screen.getByText(/1\.95\s*MB/)).toBeInTheDocument(); // First dataset
    });

    expect(screen.getByText(/4\.88\s*MB/)).toBeInTheDocument(); // Second dataset
    expect(screen.getByText(/0\.98\s*MB/)).toBeInTheDocument(); // Third dataset
  });

  it('should display download buttons', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDatasets,
    });

    render(<MLDatasetsTable />);

    await waitFor(() => {
      const downloadButtons = screen.getAllByRole('button', { name: /download/i });
      expect(downloadButtons).toHaveLength(3);
    });
  });

  it('should handle download action', async () => {
    const user = userEvent.setup();

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDatasets,
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['mock data'], { type: 'application/zip' }),
      });

    render(<MLDatasetsTable />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /download/i })).toHaveLength(3);
    });

    const downloadButtons = screen.getAllByRole('button', { name: /download/i });
    await user.click(downloadButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/intelligence/ml/export-dataset?datasetId=ds-1')
      );
    });

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('should show downloading state', async () => {
    const user = userEvent.setup();

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDatasets,
      })
      .mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          blob: async () => new Blob(['mock data'], { type: 'application/zip' }),
        }), 100))
      );

    render(<MLDatasetsTable />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /download/i })).toHaveLength(3);
    });

    const downloadButtons = screen.getAllByRole('button', { name: /download/i });
    await user.click(downloadButtons[0]);

    expect(screen.getByText('Downloading...')).toBeInTheDocument();
  });

  it('should display total records', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDatasets,
    });

    render(<MLDatasetsTable />);

    await waitFor(() => {
      expect(screen.getByText('Total records: 18,000')).toBeInTheDocument();
    });
  });

  it('should handle empty data gracefully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ datasets: [], totalRecords: 0, totalSize: 0 }),
    });

    render(<MLDatasetsTable />);

    await waitFor(() => {
      expect(screen.getByText('No datasets available')).toBeInTheDocument();
    });
  });

  it('should handle API error gracefully', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('API Error'));

    render(<MLDatasetsTable />);

    await waitFor(() => {
      expect(screen.getByText('No datasets available')).toBeInTheDocument();
    });
  });

  it('should call correct API endpoint', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDatasets,
    });

    render(<MLDatasetsTable />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/intelligence/ml/datasets');
    });
  });

  it('should handle download error gracefully', async () => {
    const user = userEvent.setup();

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDatasets,
      })
      .mockRejectedValueOnce(new Error('Download failed'));

    render(<MLDatasetsTable />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /download/i })).toHaveLength(3);
    });

    const downloadButtons = screen.getAllByRole('button', { name: /download/i });
    await user.click(downloadButtons[0]);

    // Should not crash and button should be re-enabled
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /download/i })).toHaveLength(3);
    });
  });

  it('should format bytes correctly for different sizes', async () => {
    const datasetsWithVariousSizes = {
      datasets: [
        { ...mockDatasets.datasets[0], size: 500 }, // 500 B
        { ...mockDatasets.datasets[1], size: 1024 * 500 }, // 500 KB
        { ...mockDatasets.datasets[2], size: 1024 * 1024 * 500 }, // 500 MB
      ],
      totalRecords: 18000,
      totalSize: 8192000,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => datasetsWithVariousSizes,
    });

    render(<MLDatasetsTable />);

    await waitFor(() => {
      expect(screen.getByText('500.00 B')).toBeInTheDocument();
    });

    expect(screen.getByText('500.00 KB')).toBeInTheDocument();
    expect(screen.getByText('500.00 MB')).toBeInTheDocument();
  });
});
