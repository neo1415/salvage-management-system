import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import ReportsPage from '@/app/(dashboard)/manager/reports/page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

describe('ReportsPage', () => {
  const mockRouter = {
    back: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
    (global.fetch as any).mockClear();
  });

  describe('Component Rendering', () => {
    it('should render the reports page with header', () => {
      render(<ReportsPage />);

      expect(screen.getByText('Reports')).toBeInTheDocument();
      expect(screen.getByText('Generate and share insights')).toBeInTheDocument();
    });

    it('should render all three report type options', () => {
      render(<ReportsPage />);

      expect(screen.getByText('Recovery Summary')).toBeInTheDocument();
      expect(screen.getByText('Vendor Rankings')).toBeInTheDocument();
      expect(screen.getByText('Payment Aging')).toBeInTheDocument();
    });

    it('should render date range picker', () => {
      render(<ReportsPage />);

      expect(screen.getByText('Start Date')).toBeInTheDocument();
      expect(screen.getByText('End Date')).toBeInTheDocument();
    });

    it('should render generate report button', () => {
      render(<ReportsPage />);

      expect(screen.getByText('Generate Report')).toBeInTheDocument();
    });
  });

  describe('Report Type Selection', () => {
    it('should allow selecting different report types', () => {
      render(<ReportsPage />);

      const vendorRankingsButton = screen.getByText('Vendor Rankings').closest('button');
      fireEvent.click(vendorRankingsButton!);

      expect(vendorRankingsButton).toHaveClass('border-[#800020]');
    });
  });

  describe('Report Generation', () => {
    it('should generate report successfully', async () => {
      const mockReportData = {
        status: 'success',
        data: {
          summary: {
            totalCases: 50,
            totalMarketValue: 5000000,
            totalRecoveryValue: 2000000,
            averageRecoveryRate: 40,
          },
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockReportData,
      });

      render(<ReportsPage />);

      const generateButton = screen.getByText('Generate Report');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Report Generated Successfully')).toBeInTheDocument();
      });
    });

    it('should handle report generation error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          status: 'error',
          error: { message: 'Failed to generate report' },
        }),
      });

      render(<ReportsPage />);

      const generateButton = screen.getByText('Generate Report');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to generate report')).toBeInTheDocument();
      });
    });

    it('should validate date range', async () => {
      render(<ReportsPage />);

      const startDateInput = screen.getByText('Start Date').nextElementSibling as HTMLInputElement;
      const endDateInput = screen.getByText('End Date').nextElementSibling as HTMLInputElement;

      if (startDateInput && endDateInput) {
        fireEvent.change(startDateInput, { target: { value: '2024-12-31' } });
        fireEvent.change(endDateInput, { target: { value: '2024-01-01' } });

        const generateButton = screen.getByText('Generate Report');
        fireEvent.click(generateButton);

        await waitFor(() => {
          expect(screen.getByText('Start date must be before end date')).toBeInTheDocument();
        });
      }
    });
  });

  describe('PDF Generation and Sharing', () => {
    beforeEach(async () => {
      const mockReportData = {
        status: 'success',
        data: {
          summary: {
            totalCases: 50,
            totalMarketValue: 5000000,
            totalRecoveryValue: 2000000,
            averageRecoveryRate: 40,
          },
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockReportData,
      });

      render(<ReportsPage />);

      const generateButton = screen.getByText('Generate Report');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Report Generated Successfully')).toBeInTheDocument();
      });
    });

    it('should show PDF and share buttons after report generation', () => {
      expect(screen.getByText('Generate PDF')).toBeInTheDocument();
      expect(screen.getByText('Share Report')).toBeInTheDocument();
    });

    it('should show share info text', () => {
      expect(
        screen.getByText('Share via WhatsApp, Email, SMS, or other apps')
      ).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate back when back button is clicked', () => {
      render(<ReportsPage />);

      const backButton = screen.getByLabelText('Go back');
      fireEvent.click(backButton);

      expect(mockRouter.back).toHaveBeenCalled();
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should render mobile-optimized layout', () => {
      render(<ReportsPage />);

      const headerText = screen.getByText('Reports');
      const headerContainer = headerText.closest('.sticky');
      expect(headerContainer).toBeInTheDocument();
    });

    it('should have full-width buttons', () => {
      render(<ReportsPage />);

      const generateButton = screen.getByText('Generate Report').closest('button');
      expect(generateButton).toHaveClass('w-full');
    });
  });
});
