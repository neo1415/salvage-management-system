'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ReportFiltersComponent, ReportFilters } from '@/components/reports/common/report-filters';
import { ExportButton } from '@/components/reports/common/export-button';
import { subDays } from 'date-fns';

export default function VendorSpendingPage() {
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

      const response = await fetch(`/api/reports/financial/vendor-spending?${params}`);
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
            <h1 className="text-3xl font-bold">Vendor Spending Analysis</h1>
            <p className="text-muted-foreground">Monitor vendor spending patterns and trends</p>
          </div>
        </div>
        <div className="flex gap-2">
          {reportData && <ExportButton reportType="vendor-spending" reportData={reportData} filters={filters} />}
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
            <div className="text-center py-8">Loading vendor spending data...</div>
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
                  <p className="text-sm text-muted-foreground">Total Vendors</p>
                  <p className="text-2xl font-bold">{reportData.summary?.totalVendors || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Spending</p>
                  <p className="text-2xl font-bold">₦{(reportData.summary?.totalSpent || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Spending/Vendor</p>
                  <p className="text-2xl font-bold">₦{(reportData.summary?.averageSpendPerVendor || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Top Vendor Share</p>
                  <p className="text-2xl font-bold">{reportData.summary?.topSpenderPercentage || 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Top Vendors by Spending</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Rank</th>
                      <th className="text-left p-2">Vendor</th>
                      <th className="text-left p-2">Tier</th>
                      <th className="text-right p-2">Total Spent</th>
                      <th className="text-right p-2">Transactions</th>
                      <th className="text-right p-2">Avg Transaction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reportData.topSpenders || []).slice(0, 10).map((vendor: any, index: number) => {
                      const totalSpent = reportData.summary?.totalSpent || 1;
                      const share = ((vendor.totalSpent / totalSpent) * 100).toFixed(2);
                      return (
                        <tr key={vendor.vendorId} className="border-b">
                          <td className="p-2">{index + 1}</td>
                          <td className="p-2">{vendor.vendorName}</td>
                          <td className="p-2 capitalize">{vendor.tier}</td>
                          <td className="text-right p-2">₦{(vendor.totalSpent || 0).toLocaleString()}</td>
                          <td className="text-right p-2">{vendor.transactionCount || 0}</td>
                          <td className="text-right p-2">₦{(vendor.averageTransaction || 0).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
