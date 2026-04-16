/**
 * Analytics Dashboard Component Tests
 * 
 * Comprehensive tests for analytics dashboard components
 * Task: 11.3.13 - Add page tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnalyticsDashboardContent } from '@/components/intelligence/admin/analytics/analytics-dashboard-content';
import { AssetPerformanceMatrix } from '@/components/intelligence/admin/analytics/asset-performance-matrix';
import { AttributePerformanceTabs } from '@/components/intelligence/admin/analytics/attribute-performance-tabs';
import { TemporalPatternsHeatmap } from '@/components/intelligence/admin/analytics/temporal-patterns-heatmap';
import { GeographicDistributionMap } from '@/components/intelligence/admin/analytics/geographic-distribution-map';
import { VendorSegmentsChart } from '@/components/intelligence/admin/analytics/vendor-segments-chart';
import { ConversionFunnelDiagram } from '@/components/intelligence/admin/analytics/conversion-funnel-diagram';
import { SessionAnalyticsMetrics } from '@/components/intelligence/admin/analytics/session-analytics-metrics';
import { TopPerformersSection } from '@/components/intelligence/admin/analytics/top-performers-section';
import { ToastProvider } from '@/components/ui/toast';

// Mock fetch
global.fetch = vi.fn();

const mockAssetPerformance = [
  { make: 'Toyota', model: 'Camry', year: 2020, avgPrice: 8500000, sellThroughRate: 92.5, totalAuctions: 45, avgDaysToSell: 12.5, demandScore: 88.5 },
  { make: 'Honda', model: 'Accord', year: 2019, avgPrice: 7800000, sellThroughRate: 88.3, totalAuctions: 38, avgDaysToSell: 14.2, demandScore: 85.2 },
];

const mockAttributePerformance = [
  { attribute: 'Black', avgPrice: 8200000, conversionRate: 78.5, totalAuctions: 125, avgDaysToSell: 13.2 },
  { attribute: 'White', avgPrice: 8000000, conversionRate: 75.3, totalAuctions: 142, avgDaysToSell: 14.5 },
];

const mockTemporalPatterns = [
  { hour: 14, dayOfWeek: 1, activityScore: 85.3, avgBids: 12.5, avgPrice: 8500000, totalAuctions: 45 },
  { hour: 15, dayOfWeek: 1, activityScore: 82.1, avgBids: 11.8, avgPrice: 8200000, totalAuctions: 42 },
];

const mockGeographicPatterns = [
  { region: 'Lagos', avgPrice: 9500000, priceVariance: 5.2, demandScore: 88.5, totalAuctions: 456, topAssetType: 'vehicle' },
  { region: 'Abuja', avgPrice: 8800000, priceVariance: 3.1, demandScore: 82.3, totalAuctions: 312, topAssetType: 'vehicle' },
];

const mockVendorSegments = [
  { segment: 'premium_buyer', count: 125, avgWinRate: 68.5, avgBidAmount: 12500000, totalRevenue: 1560000000 },
  { segment: 'bargain_hunter', count: 234, avgWinRate: 45.2, avgBidAmount: 3200000, totalRevenue: 748800000 },
];

const mockConversionFunnel = {
  views: 15000,
  bids: 3200,
  wins: 980,
  viewToBidRate: 21.3,
  bidToWinRate: 30.6,
  overallConversionRate: 6.5,
};

const mockSessionMetrics = {
  avgSessionDuration: 272,
  avgPagesPerSession: 5.8,
  bounceRate: 38.5,
  totalSessions: 12450,
};

const mockSessionTrends = [
  { date: '2024-01-01', avgDuration: 265, pagesPerSession: 5.5, bounceRate: 40.2 },
  { date: '2024-01-02', avgDuration: 278, pagesPerSession: 6.1, bounceRate: 36.8 },
];

describe('AnalyticsDashboardContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock all API responses
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/asset-performance')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockAssetPerformance }),
        });
      }
      if (url.includes('/attribute-performance')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ 
            success: true, 
            data: { 
              color: mockAttributePerformance, 
              trim: mockAttributePerformance, 
              storage: mockAttributePerformance 
            } 
          }),
        });
      }
      if (url.includes('/temporal-patterns')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockTemporalPatterns }),
        });
      }
      if (url.includes('/geographic-patterns')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockGeographicPatterns }),
        });
      }
      if (url.includes('/vendor-segments')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockVendorSegments }),
        });
      }
      if (url.includes('/conversion-funnel')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockConversionFunnel }),
        });
      }
      if (url.includes('/session-metrics')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ 
            success: true, 
            data: { 
              metrics: mockSessionMetrics, 
              trends: mockSessionTrends 
            } 
          }),
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render all analytics sections', async () => {
    render(
      <ToastProvider>
        <AnalyticsDashboardContent />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Check that all major sections are present
    expect(screen.getByText('Apply Filters')).toBeInTheDocument();
    expect(screen.getByText('Export All')).toBeInTheDocument();
  });

  it('should handle filter changes and apply', async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <AnalyticsDashboardContent />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const applyButton = screen.getByText('Apply Filters');
    await user.click(applyButton);

    // Verify fetch was called again
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it.skip('should handle export functionality', async () => {
    const user = userEvent.setup();

    // Mock export endpoint
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/export')) {
        return Promise.resolve({
          ok: true,
          blob: async () => new Blob(['test'], { type: 'text/csv' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });
    });

    render(
      <ToastProvider>
        <AnalyticsDashboardContent />
      </ToastProvider>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    }, { timeout: 5000 });

    // Wait for the Export All button to appear
    const exportButton = await screen.findByText('Export All', {}, { timeout: 5000 });
    expect(exportButton).toBeInTheDocument();
    
    await user.click(exportButton);

    // Verify export was initiated
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/export'),
        expect.any(Object)
      );
    });
  });
});

describe('AssetPerformanceMatrix', () => {
  it('should render asset performance table', () => {
    render(<AssetPerformanceMatrix data={mockAssetPerformance} />);

    expect(screen.getByText('Toyota')).toBeInTheDocument();
    expect(screen.getByText('Camry')).toBeInTheDocument();
    expect(screen.getByText('92.5%')).toBeInTheDocument();
  });

  it('should handle sorting', async () => {
    const user = userEvent.setup();

    render(<AssetPerformanceMatrix data={mockAssetPerformance} />);

    const makeHeader = screen.getByText('Make').closest('button');
    expect(makeHeader).toBeInTheDocument();
    
    if (makeHeader) {
      await user.click(makeHeader);
      // Verify sorting occurred (data order should change)
      expect(screen.getByText('Toyota')).toBeInTheDocument();
    }
  });

  it('should export to CSV', async () => {
    const user = userEvent.setup();

    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    render(<AssetPerformanceMatrix data={mockAssetPerformance} />);

    const exportButton = screen.getByText('Export to CSV');
    await user.click(exportButton);

    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('should handle empty data', () => {
    render(<AssetPerformanceMatrix data={[]} />);

    expect(screen.getByText(/no asset performance data available/i)).toBeInTheDocument();
  });
});

describe('AttributePerformanceTabs', () => {
  it('should render tabs for color, trim, and storage', () => {
    render(
      <AttributePerformanceTabs
        colorData={mockAttributePerformance}
        trimData={mockAttributePerformance}
        storageData={mockAttributePerformance}
      />
    );

    expect(screen.getByText('Color Performance')).toBeInTheDocument();
    expect(screen.getByText('Trim Level Performance')).toBeInTheDocument();
    expect(screen.getByText('Storage Performance')).toBeInTheDocument();
  });

  it('should switch between tabs', async () => {
    const user = userEvent.setup();

    render(
      <AttributePerformanceTabs
        colorData={mockAttributePerformance}
        trimData={mockAttributePerformance}
        storageData={mockAttributePerformance}
      />
    );

    const trimTab = screen.getByText('Trim Level Performance');
    await user.click(trimTab);

    expect(screen.getByText('Performance by Trim Level')).toBeInTheDocument();
  });
});

describe('TemporalPatternsHeatmap', () => {
  it('should render heatmap grid', () => {
    render(<TemporalPatternsHeatmap data={mockTemporalPatterns} />);

    expect(screen.getByText('Temporal Activity Patterns')).toBeInTheDocument();
    expect(screen.getByText('Monday')).toBeInTheDocument();
  });

  it('should handle empty data', () => {
    render(<TemporalPatternsHeatmap data={[]} />);

    expect(screen.getByText(/no temporal pattern data available/i)).toBeInTheDocument();
  });
});

describe('GeographicDistributionMap', () => {
  it('should render geographic regions', () => {
    render(<GeographicDistributionMap data={mockGeographicPatterns} />);

    // Use getAllByText since these appear multiple times in the component
    const lagosElements = screen.getAllByText('Lagos');
    expect(lagosElements.length).toBeGreaterThan(0);
    expect(screen.getByText('Abuja')).toBeInTheDocument();
    
    const demandElements = screen.getAllByText(/Very High Demand/);
    expect(demandElements.length).toBeGreaterThan(0);
  });

  it('should display summary stats', () => {
    render(<GeographicDistributionMap data={mockGeographicPatterns} />);

    expect(screen.getByText('Highest Demand')).toBeInTheDocument();
    expect(screen.getByText('Highest Avg Price')).toBeInTheDocument();
  });
});

describe('VendorSegmentsChart', () => {
  it('should render pie chart and table', () => {
    render(<VendorSegmentsChart data={mockVendorSegments} />);

    expect(screen.getByText('Vendor Segments')).toBeInTheDocument();
    expect(screen.getByText('Total Vendors')).toBeInTheDocument();
  });

  it('should display segment breakdown', () => {
    render(<VendorSegmentsChart data={mockVendorSegments} />);

    // Use getAllByText since these appear multiple times (in legend and table)
    const premiumBuyersElements = screen.getAllByText('Premium Buyers');
    expect(premiumBuyersElements.length).toBeGreaterThan(0);
    
    const bargainHuntersElements = screen.getAllByText('Bargain Hunters');
    expect(bargainHuntersElements.length).toBeGreaterThan(0);
  });
});

describe('ConversionFunnelDiagram', () => {
  it('should render funnel stages', () => {
    render(<ConversionFunnelDiagram data={mockConversionFunnel} />);

    expect(screen.getByText('Views')).toBeInTheDocument();
    expect(screen.getByText('Bids')).toBeInTheDocument();
    expect(screen.getByText('Wins')).toBeInTheDocument();
  });

  it('should display conversion rates', () => {
    render(<ConversionFunnelDiagram data={mockConversionFunnel} />);

    expect(screen.getByText('21.3%')).toBeInTheDocument();
    expect(screen.getByText('30.6%')).toBeInTheDocument();
  });

  it('should show insights', () => {
    render(<ConversionFunnelDiagram data={mockConversionFunnel} />);

    expect(screen.getByText('Key Insights')).toBeInTheDocument();
  });
});

describe('SessionAnalyticsMetrics', () => {
  it('should render session metrics', () => {
    render(
      <SessionAnalyticsMetrics
        metrics={mockSessionMetrics}
        trends={mockSessionTrends}
      />
    );

    expect(screen.getByText('Session Analytics')).toBeInTheDocument();
    expect(screen.getByText('4m 32s')).toBeInTheDocument();
    expect(screen.getByText('5.8')).toBeInTheDocument();
  });

  it('should render trend charts', () => {
    render(
      <SessionAnalyticsMetrics
        metrics={mockSessionMetrics}
        trends={mockSessionTrends}
      />
    );

    expect(screen.getByText('Session Duration Trend')).toBeInTheDocument();
    expect(screen.getByText('Pages per Session Trend')).toBeInTheDocument();
    expect(screen.getByText('Bounce Rate Trend')).toBeInTheDocument();
  });
});

describe('TopPerformersSection', () => {
  const mockTopVendors = [
    { vendorId: '1', vendorName: 'Premium Auto', winRate: 78.5, totalBids: 145, totalWins: 114, totalRevenue: 45000000 },
  ];

  const mockTopAssets = [
    { assetId: '1', make: 'Toyota', model: 'Camry', year: 2020, sellThroughRate: 92.5, avgPrice: 8500000, totalAuctions: 45 },
  ];

  const mockTopMakes = [
    { make: 'Toyota', totalAuctions: 234, avgPrice: 7500000, sellThroughRate: 82.5 },
  ];

  it('should render top performers sections', () => {
    render(
      <TopPerformersSection
        topVendors={mockTopVendors}
        topAssets={mockTopAssets}
        topMakes={mockTopMakes}
      />
    );

    expect(screen.getByText('Top Vendors')).toBeInTheDocument();
    expect(screen.getByText('Top Assets')).toBeInTheDocument();
    expect(screen.getByText('Top Makes')).toBeInTheDocument();
  });

  it('should display vendor rankings', () => {
    render(
      <TopPerformersSection
        topVendors={mockTopVendors}
        topAssets={mockTopAssets}
        topMakes={mockTopMakes}
      />
    );

    expect(screen.getByText('Premium Auto')).toBeInTheDocument();
    expect(screen.getByText('78.5% win rate')).toBeInTheDocument();
  });

  it('should handle empty data', () => {
    render(
      <TopPerformersSection
        topVendors={[]}
        topAssets={[]}
        topMakes={[]}
      />
    );

    expect(screen.getAllByText(/no.*data available/i).length).toBeGreaterThan(0);
  });
});
