/**
 * Intelligence Dashboard Component Tests
 * 
 * Tests for admin intelligence dashboard page and components
 * Task: 11.1.8
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntelligenceDashboardContent } from '@/components/intelligence/admin/intelligence-dashboard-content';
import { ToastProvider } from '@/components/ui/toast';

// Mock fetch
global.fetch = vi.fn();

const mockDashboardMetrics = {
  predictionAccuracy: {
    current: 88.5,
    change: 2.3,
    avgError: 11.5,
    totalPredictions: 1250,
  },
  recommendationEffectiveness: {
    bidConversionRate: 18.7,
    change: 1.5,
    avgMatchScore: 72.3,
    totalRecommendations: 3420,
  },
  fraudAlerts: {
    pending: 5,
    confirmed: 12,
    dismissed: 8,
    total: 25,
  },
  systemHealth: {
    cacheHitRate: 85.2,
    avgResponseTime: 145,
    jobsRunning: 6,
    lastRefresh: new Date().toISOString(),
  },
};

describe('IntelligenceDashboardContent', () => {
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

    render(
      <ToastProvider>
        <IntelligenceDashboardContent />
      </ToastProvider>
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should fetch and display dashboard metrics', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardMetrics,
    });

    render(
      <ToastProvider>
        <IntelligenceDashboardContent />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('88.5%')).toBeInTheDocument();
    });

    // Check prediction accuracy card
    expect(screen.getByText('Prediction Accuracy')).toBeInTheDocument();
    expect(screen.getByText('±11.5% avg error')).toBeInTheDocument();
    expect(screen.getByText('1,250 predictions')).toBeInTheDocument();

    // Check recommendation effectiveness card
    expect(screen.getByText('Recommendation Conversion')).toBeInTheDocument();
    expect(screen.getByText('18.7%')).toBeInTheDocument();
    expect(screen.getByText('72 avg match score')).toBeInTheDocument();

    // Check fraud alerts card
    expect(screen.getByText('Fraud Alerts')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('12 confirmed, 8 dismissed')).toBeInTheDocument();

    // Check system health card (first occurrence)
    const systemHealthCards = screen.getAllByText('System Health');
    expect(systemHealthCards.length).toBeGreaterThan(0);
    const cacheHitRates = screen.getAllByText('85%');
    expect(cacheHitRates.length).toBeGreaterThan(0);
    expect(screen.getByText('145ms avg response')).toBeInTheDocument();
  });

  it('should display change indicators correctly', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardMetrics,
    });

    render(
      <ToastProvider>
        <IntelligenceDashboardContent />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('+2.3%')).toBeInTheDocument();
    });

    expect(screen.getByText('+1.5%')).toBeInTheDocument();
  });

  it('should handle API error gracefully', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('API Error'));

    render(
      <ToastProvider>
        <IntelligenceDashboardContent />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/error loading dashboard/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/api error/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('should retry fetching on error', async () => {
    const user = userEvent.setup();

    (global.fetch as any)
      .mockRejectedValueOnce(new Error('API Error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDashboardMetrics,
      });

    render(
      <ToastProvider>
        <IntelligenceDashboardContent />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/error loading dashboard/i)).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
    
    await user.click(retryButton);

    // Verify fetch was called again
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('should render charts section', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardMetrics,
    });

    render(
      <ToastProvider>
        <IntelligenceDashboardContent />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Prediction Accuracy Trend')).toBeInTheDocument();
    });

    expect(screen.getByText('Match Score Distribution')).toBeInTheDocument();
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    expect(screen.getByText('Recommendation quality breakdown')).toBeInTheDocument();
  });

  it('should render fraud alerts table', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardMetrics,
    });

    render(
      <ToastProvider>
        <IntelligenceDashboardContent />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Recent Fraud Alerts')).toBeInTheDocument();
    });

    expect(screen.getByText('Pending alerts requiring review')).toBeInTheDocument();
  });

  it('should apply correct variant styling for warning state', async () => {
    const warningMetrics = {
      ...mockDashboardMetrics,
      fraudAlerts: {
        ...mockDashboardMetrics.fraudAlerts,
        pending: 10, // High pending count
      },
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => warningMetrics,
    });

    render(
      <ToastProvider>
        <IntelligenceDashboardContent />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    // Check that fraud alerts card has warning styling
    const fraudCard = screen.getByText('Fraud Alerts').closest('[class*="border-yellow"]');
    expect(fraudCard).toBeInTheDocument();
  });

  it('should display system health indicators', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardMetrics,
    });

    render(
      <ToastProvider>
        <IntelligenceDashboardContent />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('6 jobs running')).toBeInTheDocument();
    });
  });
});
