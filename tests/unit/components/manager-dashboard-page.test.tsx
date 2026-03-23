import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/use-auth';
import ManagerDashboardPage from '@/app/(dashboard)/manager/dashboard/page';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock auth hook
vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

describe('ManagerDashboardPage', () => {
  const mockRouter = {
    push: vi.fn(),
  };

  const mockDashboardData = {
    kpis: {
      activeAuctions: 10,
      totalBidsToday: 25,
      averageRecoveryRate: 38.5,
      casesPendingApproval: 5,
    },
    charts: {
      recoveryRateTrend: [
        { date: '2024-01-01', recoveryRate: 35.5, totalCases: 10 },
        { date: '2024-01-02', recoveryRate: 38.2, totalCases: 12 },
      ],
      topVendors: [
        {
          vendorId: 'v1',
          vendorName: 'Vendor A',
          totalBids: 50,
          totalWins: 10,
          totalSpent: 5000000,
        },
      ],
      paymentStatusBreakdown: [
        { status: 'verified', count: 20, percentage: 50 },
        { status: 'pending', count: 15, percentage: 37.5 },
        { status: 'overdue', count: 5, percentage: 12.5 },
      ],
    },
    lastUpdated: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockDashboardData,
    });
  });

  it('should show loading state initially', () => {
    (useAuth as any).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    });

    render(<ManagerDashboardPage />);
    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
  });

  it('should redirect to login if not authenticated', () => {
    (useAuth as any).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });

    render(<ManagerDashboardPage />);
    expect(mockRouter.push).toHaveBeenCalledWith('/login');
  });

  it('should show error if user is not a salvage manager', async () => {
    (useAuth as any).mockReturnValue({
      user: { id: '1', role: 'vendor', name: 'Test User' },
      isAuthenticated: true,
      isLoading: false,
    });

    render(<ManagerDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(screen.getByText(/Access denied. Salvage Manager role required/)).toBeInTheDocument();
    });
  });

  it('should render dashboard with KPIs for salvage manager', async () => {
    (useAuth as any).mockReturnValue({
      user: { id: '1', role: 'salvage_manager', name: 'Manager User' },
      isAuthenticated: true,
      isLoading: false,
    });

    render(<ManagerDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Manager Dashboard')).toBeInTheDocument();
    });

    // Check KPI cards
    await waitFor(() => {
      expect(screen.getByText('Active Auctions')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('Bids Today')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('Recovery Rate')).toBeInTheDocument();
      expect(screen.getByText('38.5%')).toBeInTheDocument();
      expect(screen.getByText('Pending Approval')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  it('should render charts section', async () => {
    (useAuth as any).mockReturnValue({
      user: { id: '1', role: 'salvage_manager', name: 'Manager User' },
      isAuthenticated: true,
      isLoading: false,
    });

    render(<ManagerDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Recovery Rate Trend')).toBeInTheDocument();
      expect(screen.getByText('Payment Status')).toBeInTheDocument();
      expect(screen.getByText('Top 5 Vendors by Volume')).toBeInTheDocument();
    });
  });

  it('should render filters', async () => {
    (useAuth as any).mockReturnValue({
      user: { id: '1', role: 'salvage_manager', name: 'Manager User' },
      isAuthenticated: true,
      isLoading: false,
    });

    render(<ManagerDashboardPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Date Range')).toBeInTheDocument();
      expect(screen.getByLabelText('Asset Type')).toBeInTheDocument();
    });
  });

  it('should render quick actions', async () => {
    (useAuth as any).mockReturnValue({
      user: { id: '1', role: 'salvage_manager', name: 'Manager User' },
      isAuthenticated: true,
      isLoading: false,
    });

    render(<ManagerDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      expect(screen.getByText('Review Cases')).toBeInTheDocument();
      expect(screen.getByText('Manage Vendors')).toBeInTheDocument();
      expect(screen.getByText('View Auctions')).toBeInTheDocument();
      expect(screen.getByText('View Payments')).toBeInTheDocument();
    });
  });

  it('should handle API error gracefully', async () => {
    (useAuth as any).mockReturnValue({
      user: { id: '1', role: 'salvage_manager', name: 'Manager User' },
      isAuthenticated: true,
      isLoading: false,
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(<ManagerDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load dashboard data. Please try again.')).toBeInTheDocument();
    });
  });

  it('should fetch dashboard data with filters', async () => {
    (useAuth as any).mockReturnValue({
      user: { id: '1', role: 'salvage_manager', name: 'Manager User' },
      isAuthenticated: true,
      isLoading: false,
    });

    render(<ManagerDashboardPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/dashboard/manager?dateRange=30')
      );
    });
  });
});
