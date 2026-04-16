'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { ReportFiltersComponent, ReportFilters } from '@/components/reports/common/report-filters';
import { ExportButton } from '@/components/reports/common/export-button';
import { subDays } from 'date-fns';

export default function AuctionPerformancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
  });

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());

      const response = await fetch(`/api/reports/operational/auction-performance?${params}`);
      const result = await response.json();
      
      if (result.status === 'success') {
        setReportData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/reports')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Auction Performance</h1>
            <p className="text-muted-foreground">Monitor auction success rates and bidding activity</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchReport} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {reportData && <ExportButton reportType="auction-performance" reportData={reportData} filters={filters} />}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ReportFiltersComponent
            filters={filters}
            onFiltersChange={setFilters}
            onApply={fetchReport}
            onReset={() => setFilters({ startDate: subDays(new Date(), 30), endDate: new Date() })}
            showAssetTypes={false}
            showRegions={false}
          />
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">Loading auction performance data...</div>
          </CardContent>
        </Card>
      )}

      {!loading && reportData && (
        <div className="grid gap-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Summary</h3>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Auctions</p>
                  <p className="text-2xl font-bold">{reportData.summary?.totalAuctions || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">{reportData.summary?.successRate || 0}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Bids/Auction</p>
                  <p className="text-2xl font-bold">{reportData.summary?.averageBidsPerAuction || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reserve Met Rate</p>
                  <p className="text-2xl font-bold">{reportData.summary?.reserveMetRate || 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Bidding Metrics</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Bids</p>
                  <p className="text-2xl font-bold">{reportData.bidding?.totalBids || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Competitive Auctions</p>
                  <p className="text-2xl font-bold">{reportData.bidding?.competitiveAuctions || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Single Bidder</p>
                  <p className="text-2xl font-bold">{reportData.bidding?.singleBidderAuctions || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
