/**
 * Data Export Page Tests
 * 
 * Task 11.5.6: Add page tests
 * 
 * @module tests/unit/components/intelligence/admin
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { DataExportContent } from '@/components/intelligence/admin/export/data-export-content';
import { ExportForm } from '@/components/intelligence/admin/export/export-form';
import { ExportProgress } from '@/components/intelligence/admin/export/export-progress';
import { ExportHistory } from '@/components/intelligence/admin/export/export-history';

// Mock fetch
global.fetch = vi.fn();

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DataExportContent', () => {
  it('renders export form and history tabs', () => {
    render(<DataExportContent />);
    
    expect(screen.getByText('Data Export')).toBeInTheDocument();
    expect(screen.getByText('New Export')).toBeInTheDocument();
    expect(screen.getByText('Export History')).toBeInTheDocument();
  });

  it('shows export form by default', () => {
    render(<DataExportContent />);
    
    expect(screen.getByText('Configure Export')).toBeInTheDocument();
    expect(screen.getByLabelText('Data Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Export Format')).toBeInTheDocument();
  });

  it('switches to history tab', async () => {
    render(<DataExportContent />);
    
    const historyTab = screen.getByText('Export History');
    fireEvent.click(historyTab);
    
    // Wait for tab content to render
    await waitFor(() => {
      expect(screen.getByText(/No exports yet|Export History/)).toBeInTheDocument();
    });
  });
});

describe('ExportForm', () => {
  const mockOnExportStart = vi.fn();
  const mockOnExportComplete = vi.fn();
  const mockOnExportError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['test data'], { type: 'text/csv' })),
      headers: new Map([['content-disposition', 'attachment; filename="export.csv"']]),
    });
  });

  it('renders all form fields', () => {
    render(
      <ExportForm
        onExportStart={mockOnExportStart}
        onExportComplete={mockOnExportComplete}
        onExportError={mockOnExportError}
      />
    );
    
    expect(screen.getByLabelText('Data Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Export Format')).toBeInTheDocument();
    expect(screen.getByText('Start Date')).toBeInTheDocument();
    expect(screen.getByText('End Date')).toBeInTheDocument();
    expect(screen.getByText('Anonymize PII (GDPR Compliant)')).toBeInTheDocument();
    expect(screen.getByText('Include feature vectors (for ML training)')).toBeInTheDocument();
  });

  it('submits export request with correct parameters', async () => {
    render(
      <ExportForm
        onExportStart={mockOnExportStart}
        onExportComplete={mockOnExportComplete}
        onExportError={mockOnExportError}
      />
    );
    
    const submitButton = screen.getByText('Start Export');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnExportStart).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/intelligence/export')
      );
    });
  });

  it('handles export errors', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Export failed' }),
    });

    render(
      <ExportForm
        onExportStart={mockOnExportStart}
        onExportComplete={mockOnExportComplete}
        onExportError={mockOnExportError}
      />
    );
    
    const submitButton = screen.getByText('Start Export');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnExportError).toHaveBeenCalledWith(
        expect.any(String),
        'Export failed'
      );
    });
  });

  it('disables submit button while processing', async () => {
    render(
      <ExportForm
        onExportStart={mockOnExportStart}
        onExportComplete={mockOnExportComplete}
        onExportError={mockOnExportError}
      />
    );
    
    const submitButton = screen.getByText('Start Export');
    fireEvent.click(submitButton);
    
    expect(submitButton).toBeDisabled();
    expect(screen.getByText('Preparing Export...')).toBeInTheDocument();
  });
});

describe('ExportProgress', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows processing state', () => {
    const job = {
      id: 'export_123',
      dataType: 'predictions' as const,
      format: 'csv' as const,
      status: 'processing' as const,
      progress: 45,
      createdAt: new Date().toISOString(),
    };

    render(<ExportProgress job={job} onComplete={mockOnComplete} />);
    
    expect(screen.getByText('Export in Progress')).toBeInTheDocument();
    expect(screen.getByText('Processing...')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('shows completed state with download button', () => {
    const job = {
      id: 'export_123',
      dataType: 'predictions' as const,
      format: 'csv' as const,
      status: 'completed' as const,
      progress: 100,
      downloadUrl: 'blob:http://localhost/test',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      fileSize: 1024 * 1024 * 5, // 5 MB
      recordCount: 1000,
    };

    render(<ExportProgress job={job} onComplete={mockOnComplete} />);
    
    expect(screen.getByText('Export Completed')).toBeInTheDocument();
    expect(screen.getByText('Your export is ready for download')).toBeInTheDocument();
    expect(screen.getByText('Download File')).toBeInTheDocument();
    expect(screen.getByText('5.00 MB')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
  });

  it('shows failed state with error message', () => {
    const job = {
      id: 'export_123',
      dataType: 'predictions' as const,
      format: 'csv' as const,
      status: 'failed' as const,
      progress: 0,
      error: 'Database connection failed',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    render(<ExportProgress job={job} onComplete={mockOnComplete} />);
    
    expect(screen.getByText('Export Failed')).toBeInTheDocument();
    expect(screen.getByText('Database connection failed')).toBeInTheDocument();
  });

  it('triggers download when download button clicked', () => {
    const job = {
      id: 'export_123',
      dataType: 'predictions' as const,
      format: 'csv' as const,
      status: 'completed' as const,
      progress: 100,
      downloadUrl: 'blob:http://localhost/test',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    render(<ExportProgress job={job} onComplete={mockOnComplete} />);
    
    // Mock document methods after render
    const mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
      style: {},
    } as unknown as HTMLAnchorElement;
    
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink);
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink);
    
    const downloadButton = screen.getByText('Download File');
    fireEvent.click(downloadButton);
    
    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(mockLink.click).toHaveBeenCalled();
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();

    // Cleanup
    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });
});

describe('ExportHistory', () => {
  const mockOnRetry = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no exports', () => {
    render(<ExportHistory exports={[]} onRetry={mockOnRetry} />);
    
    expect(screen.getByText('No exports yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first export using the form above')).toBeInTheDocument();
  });

  it('displays export history table', () => {
    const exports = [
      {
        id: 'export_1',
        dataType: 'predictions' as const,
        format: 'csv' as const,
        status: 'completed' as const,
        progress: 100,
        downloadUrl: 'blob:http://localhost/test1',
        createdAt: new Date('2025-01-15T10:00:00Z').toISOString(),
        completedAt: new Date('2025-01-15T10:05:00Z').toISOString(),
        fileSize: 1024 * 1024 * 2,
        recordCount: 500,
      },
      {
        id: 'export_2',
        dataType: 'recommendations' as const,
        format: 'json' as const,
        status: 'failed' as const,
        progress: 0,
        error: 'Timeout',
        createdAt: new Date('2025-01-15T09:00:00Z').toISOString(),
        completedAt: new Date('2025-01-15T09:01:00Z').toISOString(),
      },
    ];

    render(<ExportHistory exports={exports} onRetry={mockOnRetry} />);
    
    expect(screen.getByText('Predictions')).toBeInTheDocument();
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    expect(screen.getByText('CSV')).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
    expect(screen.getByText('2.00 MB')).toBeInTheDocument();
  });

  it('shows download button for completed exports', () => {
    const exports = [
      {
        id: 'export_1',
        dataType: 'predictions' as const,
        format: 'csv' as const,
        status: 'completed' as const,
        progress: 100,
        downloadUrl: 'blob:http://localhost/test1',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
    ];

    render(<ExportHistory exports={exports} onRetry={mockOnRetry} />);
    
    const downloadButtons = screen.getAllByRole('button');
    expect(downloadButtons.length).toBeGreaterThan(0);
  });

  it('shows retry button for failed exports', () => {
    const exports = [
      {
        id: 'export_1',
        dataType: 'predictions' as const,
        format: 'csv' as const,
        status: 'failed' as const,
        progress: 0,
        error: 'Timeout',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
    ];

    render(<ExportHistory exports={exports} onRetry={mockOnRetry} />);
    
    const retryButtons = screen.getAllByRole('button');
    expect(retryButtons.length).toBeGreaterThan(0);
    
    fireEvent.click(retryButtons[0]);
    expect(mockOnRetry).toHaveBeenCalledWith(exports[0]);
  });
});
