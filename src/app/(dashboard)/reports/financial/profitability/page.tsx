'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { ReportFiltersComponent, ReportFilters } from '@/components/reports/common/report-filters';
import { ExportButton } from '@/components/reports/common/export-button';
import { subDays } from 'date-fns';

export default function ProfitabilityPage() {
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

      const response = await fetch(`/api/reports/financial/profitability?${params}`);
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
            <h1 className="text-3xl font-bold">Profitability Analysis</h1>
            <p className="text-muted-foreground">Monitor profit margins and ROI across operations</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchReport} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {reportData && <ExportButton reportType="profitability" reportData={reportData} filters={filters} />}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ReportFiltersComponent
            filters={filters}
            onFiltersChange={setFilters}
            onApply={fetchReport}
            onReset={() => setFilters({ startDate: subDays(new Date(), 30), endDate: new Date() })}
            showAssetTypes={true}
            showRegions={false}
          />
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">Loading profitability data...</div>
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
                  <p className="text-sm text-muted-foreground">Total Cases</p>
                  <p className="text-2xl font-bold">{reportData.summary?.totalCases || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Salvage Recovered</p>
                  <p className="text-2xl font-bold">₦{(reportData.summary?.totalSalvageRecovered || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Recovery Rate</p>
                  <p className="text-2xl font-bold">{reportData.summary?.averageRecoveryRate || 0}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ROI</p>
                  <p className="text-2xl font-bold">{reportData.summary?.roi || 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">By Asset Type</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Asset Type</th>
                      <th className="text-right p-2">Count</th>
                      <th className="text-right p-2">Claims Paid</th>
                      <th className="text-right p-2">Salvage Recovered</th>
                      <th className="text-right p-2">Net Loss</th>
                      <th className="text-right p-2">Recovery Rate</th>
                      <th className="text-right p-2">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reportData.byAssetType || []).map((data: any) => (
                      <tr key={data.assetType} className="border-b">
                        <td className="p-2 capitalize">{data.assetType}</td>
                        <td className="text-right p-2">{data.count || 0}</td>
                        <td className="text-right p-2">₦{(data.claimsPaid || 0).toLocaleString()}</td>
                        <td className="text-right p-2">₦{(data.salvageRecovered || 0).toLocaleString()}</td>
                        <td className="text-right p-2">₦{(data.netLoss || 0).toLocaleString()}</td>
                        <td className="text-right p-2">{data.recoveryRate || 0}%</td>
                        <td className="text-right p-2">{data.roi || 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Profit Distribution</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Profitable</p>
                  <p className="text-xl font-bold text-green-600">{reportData.profitDistribution?.profitable || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Break Even</p>
                  <p className="text-xl font-bold text-yellow-600">{reportData.profitDistribution?.breakEven || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Loss</p>
                  <p className="text-xl font-bold text-red-600">{reportData.profitDistribution?.loss || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {reportData.itemBreakdown && reportData.itemBreakdown.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Detailed Item Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Claim Reference</th>
                        <th className="text-left p-2 font-medium">Asset Type</th>
                        <th className="text-right p-2 font-medium">Market Value</th>
                        <th className="text-right p-2 font-medium">Salvage Recovery</th>
                        <th className="text-right p-2 font-medium">Net Loss</th>
                        <th className="text-right p-2 font-medium">Recovery Rate</th>
                        <th className="text-right p-2 font-medium">ROI</th>
                        <th className="text-left p-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.itemBreakdown.map((item: any, index: number) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="p-2 font-medium">{item.claimReference}</td>
                          <td className="p-2 capitalize">{item.assetType}</td>
                          <td className="p-2 text-right">₦{item.marketValue.toLocaleString()}</td>
                          <td className="p-2 text-right text-green-600">₦{item.salvageRecovery.toLocaleString()}</td>
                          <td className="p-2 text-right text-red-600">₦{item.netLoss.toLocaleString()}</td>
                          <td className="p-2 text-right">{item.recoveryRate.toFixed(2)}%</td>
                          <td className="p-2 text-right">{item.roi.toFixed(2)}%</td>
                          <td className="p-2">{new Date(item.date).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
