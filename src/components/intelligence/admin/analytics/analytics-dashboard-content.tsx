'use client';

/**
 * Analytics Dashboard Content Component
 * 
 * Main dashboard content orchestrating all analytics components
 * Tasks: 11.3.1-11.3.12
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, AlertCircle, RefreshCw } from 'lucide-react';
import { subDays } from 'date-fns';
import { AnalyticsFiltersComponent, AnalyticsFilters } from './analytics-filters';
import { AssetPerformanceMatrix } from './asset-performance-matrix';
import { AttributePerformanceTabs } from './attribute-performance-tabs';
import { TemporalPatternsHeatmap } from './temporal-patterns-heatmap';
import { GeographicDistributionMap } from './geographic-distribution-map';
import { VendorSegmentsChart } from './vendor-segments-chart';
import { ConversionFunnelDiagram } from './conversion-funnel-diagram';
import { SessionAnalyticsMetrics } from './session-analytics-metrics';
import { TopPerformersSection } from './top-performers-section';
import { useToast } from '@/components/ui/toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function AnalyticsDashboardContent() {
  const { data: session, status } = useSession();
  const { error: showError, success: showSuccess } = useToast();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize filters with last 30 days
  const [filters, setFilters] = useState<AnalyticsFilters>({
    dateRange: {
      from: subDays(new Date(), 30),
      to: new Date(),
    },
  });

  // State for all analytics data
  const [assetPerformance, setAssetPerformance] = useState<any[]>([]);
  const [colorPerformance, setColorPerformance] = useState<any[]>([]);
  const [trimPerformance, setTrimPerformance] = useState<any[]>([]);
  const [storagePerformance, setStoragePerformance] = useState<any[]>([]);
  const [temporalPatterns, setTemporalPatterns] = useState<any[]>([]);
  const [geographicPatterns, setGeographicPatterns] = useState<any[]>([]);
  const [vendorSegments, setVendorSegments] = useState<any[]>([]);
  const [conversionFunnel, setConversionFunnel] = useState<any>(null);
  const [sessionMetrics, setSessionMetrics] = useState<any>(null);
  const [sessionTrends, setSessionTrends] = useState<any[]>([]);
  const [topVendors, setTopVendors] = useState<any[]>([]);
  const [topAssets, setTopAssets] = useState<any[]>([]);
  const [topMakes, setTopMakes] = useState<any[]>([]);

  useEffect(() => {
    // Wait for session to be loaded before fetching analytics
    if (status === 'authenticated') {
      fetchAllAnalytics();
    } else if (status === 'unauthenticated') {
      setError('You must be logged in to view analytics');
      setLoading(false);
    }
  }, [status]);

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.append('startDate', filters.dateRange.from.toISOString());
    params.append('endDate', filters.dateRange.to.toISOString());
    if (filters.assetType) params.append('assetType', filters.assetType);
    if (filters.region) params.append('region', filters.region);
    return params.toString();
  };

  async function fetchAllAnalytics() {
    try {
      setLoading(true);
      setError(null);
      const queryParams = buildQueryParams();

      // Fetch all analytics in parallel
      const [
        assetRes,
        attrRes,
        temporalRes,
        geoRes,
        segmentsRes,
        funnelRes,
        sessionRes,
      ] = await Promise.all([
        fetch(`/api/intelligence/analytics/asset-performance?${queryParams}`),
        fetch(`/api/intelligence/analytics/attribute-performance?${queryParams}`),
        fetch(`/api/intelligence/analytics/temporal-patterns?${queryParams}`),
        fetch(`/api/intelligence/analytics/geographic-patterns?${queryParams}`),
        fetch(`/api/intelligence/analytics/vendor-segments?${queryParams}`),
        fetch(`/api/intelligence/analytics/conversion-funnel?${queryParams}`),
        fetch(`/api/intelligence/analytics/session-metrics?${queryParams}`),
      ]);

      // Check for authorization errors
      const responses = [assetRes, attrRes, temporalRes, geoRes, segmentsRes, funnelRes, sessionRes];
      const forbiddenResponse = responses.find(r => r.status === 403);
      if (forbiddenResponse) {
        const errorData = await forbiddenResponse.json();
        setError(`Access denied: ${errorData.error || 'You do not have permission to view analytics'}`);
        setLoading(false);
        return;
      }

      const unauthorizedResponse = responses.find(r => r.status === 401);
      if (unauthorizedResponse) {
        setError('Session expired. Please refresh the page and log in again.');
        setLoading(false);
        return;
      }

      // Process successful responses
      if (assetRes.ok) {
        const data = await assetRes.json();
        setAssetPerformance(data.data || []);
      } else {
        console.warn('Asset performance API failed:', assetRes.status);
      }

      if (attrRes.ok) {
        const data = await attrRes.json();
        setColorPerformance(data.data?.color || []);
        setTrimPerformance(data.data?.trim || []);
        setStoragePerformance(data.data?.storage || []);
      } else {
        console.warn('Attribute performance API failed:', attrRes.status);
      }

      if (temporalRes.ok) {
        const data = await temporalRes.json();
        setTemporalPatterns(data.data || []);
      } else {
        console.warn('Temporal patterns API failed:', temporalRes.status);
      }

      if (geoRes.ok) {
        const data = await geoRes.json();
        setGeographicPatterns(data.data || []);
      } else {
        console.warn('Geographic patterns API failed:', geoRes.status);
      }

      if (segmentsRes.ok) {
        const data = await segmentsRes.json();
        setVendorSegments(data.data || []);
      } else {
        console.warn('Vendor segments API failed:', segmentsRes.status);
      }

      if (funnelRes.ok) {
        const data = await funnelRes.json();
        setConversionFunnel(data.data || null);
      } else {
        console.warn('Conversion funnel API failed:', funnelRes.status);
      }

      if (sessionRes.ok) {
        const data = await sessionRes.json();
        setSessionMetrics(data.data?.metrics || null);
        setSessionTrends(data.data?.trends || []);
      } else {
        console.warn('Session metrics API failed:', sessionRes.status);
      }

      // Generate mock top performers data (in production, this would come from API)
      generateTopPerformersData();

    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError('Failed to load analytics data. Please try again.');
      showError('Error', 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }

  function generateTopPerformersData() {
    // Mock data - in production, fetch from dedicated endpoints
    setTopVendors([
      { vendorId: '1', vendorName: 'Premium Auto Dealers', winRate: 78.5, totalBids: 145, totalWins: 114, totalRevenue: 45000000 },
      { vendorId: '2', vendorName: 'Elite Motors', winRate: 72.3, totalBids: 132, totalWins: 95, totalRevenue: 38000000 },
      { vendorId: '3', vendorName: 'Best Value Cars', winRate: 68.9, totalBids: 156, totalWins: 107, totalRevenue: 32000000 },
    ]);

    setTopAssets([
      { assetId: '1', make: 'Toyota', model: 'Camry', year: 2020, sellThroughRate: 92.5, avgPrice: 8500000, totalAuctions: 45 },
      { assetId: '2', make: 'Honda', model: 'Accord', year: 2019, sellThroughRate: 88.3, avgPrice: 7800000, totalAuctions: 38 },
      { assetId: '3', make: 'Toyota', model: 'Corolla', year: 2021, sellThroughRate: 85.7, avgPrice: 6200000, totalAuctions: 52 },
    ]);

    setTopMakes([
      { make: 'Toyota', totalAuctions: 234, avgPrice: 7500000, sellThroughRate: 82.5 },
      { make: 'Honda', totalAuctions: 187, avgPrice: 6800000, sellThroughRate: 78.3 },
      { make: 'Mercedes-Benz', totalAuctions: 145, avgPrice: 12500000, sellThroughRate: 75.2 },
    ]);
  }

  const handleApplyFilters = () => {
    fetchAllAnalytics();
  };

  const handleResetFilters = () => {
    setFilters({
      dateRange: {
        from: subDays(new Date(), 30),
        to: new Date(),
      },
    });
    setTimeout(() => fetchAllAnalytics(), 100);
  };

  const handleExportAll = async () => {
    try {
      setExporting(true);
      const queryParams = buildQueryParams();
      
      const response = await fetch(`/api/intelligence/analytics/export?${queryParams}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

      showSuccess('Success', 'Analytics exported successfully');
    } catch (error) {
      console.error('Error exporting analytics:', error);
      showError('Error', 'Failed to export analytics');
    } finally {
      setExporting(false);
    }
  };

  // Show loading state while session is loading
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters and Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <AnalyticsFiltersComponent
              filters={filters}
              onFiltersChange={setFilters}
              onApply={handleApplyFilters}
              onReset={handleResetFilters}
            />
            
            <div className="flex items-center gap-2">
              <Button
                onClick={handleExportAll}
                variant="outline"
                size="sm"
                disabled={exporting}
                className="bg-[#800020] text-white hover:bg-[#600018]"
              >
                <Download className="mr-2 h-4 w-4" />
                {exporting ? 'Exporting...' : 'Export All'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Asset Performance Matrix */}
      <AssetPerformanceMatrix data={assetPerformance} loading={loading} />

      {/* Attribute Performance Tabs */}
      <AttributePerformanceTabs
        colorData={colorPerformance}
        trimData={trimPerformance}
        storageData={storagePerformance}
        loading={loading}
      />

      {/* Temporal Patterns and Geographic Distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TemporalPatternsHeatmap data={temporalPatterns} loading={loading} />
        <GeographicDistributionMap data={geographicPatterns} loading={loading} />
      </div>

      {/* Vendor Segments */}
      <VendorSegmentsChart data={vendorSegments} loading={loading} />

      {/* Conversion Funnel and Session Analytics */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ConversionFunnelDiagram data={conversionFunnel} loading={loading} />
        <SessionAnalyticsMetrics
          metrics={sessionMetrics}
          trends={sessionTrends}
          loading={loading}
        />
      </div>

      {/* Top Performers */}
      <TopPerformersSection
        topVendors={topVendors}
        topAssets={topAssets}
        topMakes={topMakes}
        loading={loading}
      />
    </div>
  );
}
