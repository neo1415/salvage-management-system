'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { ReportFiltersComponent, ReportFilters } from '@/components/reports/common/report-filters';
import { ExportButton } from '@/components/reports/common/export-button';
import { subDays } from 'date-fns';

export default function PaymentAnalyticsPage() {
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

      const response = await fetch(`/api/reports/financial/payment-analytics?${params}`);
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
            <h1 className="text-3xl font-bold">Payment Analytics</h1>
            <p className="text-muted-foreground">Monitor payment methods, timing, and success rates</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchReport} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {reportData && <ExportButton reportType="payment-analytics" reportData={reportData} filters={filters} />}
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
            <div className="text-center py-8">Loading payment analytics...</div>
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
                  <p className="text-sm text-muted-foreground">Total Payments</p>
                  <p className="text-2xl font-bold">{reportData.summary?.totalPayments || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold">₦{(reportData.summary?.totalAmount || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">{reportData.summary?.successRate || 0}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Payment Time</p>
                  <p className="text-2xl font-bold">{reportData.summary?.averagePaymentTime || 0}h</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <span className="text-blue-600">💡</span>
                Payment Breakdown by Status
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                The total amount includes all auction payments regardless of status. Here's the breakdown:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(reportData.byStatus || []).map((status: any) => {
                  const isVerified = status.status === 'verified' || status.status === 'completed';
                  return (
                    <div 
                      key={status.status} 
                      className={`p-4 rounded-lg border ${isVerified ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium capitalize">{status.status || ''}</p>
                        {isVerified && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Received</span>}
                        {!isVerified && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">Pending</span>}
                      </div>
                      <p className="text-2xl font-bold">₦{(status.totalAmount || 0).toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {status.count || 0} payment{status.count !== 1 ? 's' : ''} ({status.percentage || 0}%)
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 p-3 bg-white rounded border border-blue-200">
                <p className="text-sm">
                  <span className="font-semibold">Note:</span> Only <span className="font-semibold text-green-600">verified</span> payments 
                  are counted in Vendor Spending and Salvage Recovery reports. Pending/overdue payments are included here for monitoring purposes.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">By Payment Method</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Method</th>
                      <th className="text-right p-2">Count</th>
                      <th className="text-right p-2">Amount</th>
                      <th className="text-right p-2">Percentage</th>
                      <th className="text-right p-2">Success Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reportData.byMethod || []).map((method: any) => (
                      <tr key={method.method} className="border-b">
                        <td className="p-2 capitalize">{(method.method || '').replace('_', ' ')}</td>
                        <td className="text-right p-2">{method.count || 0}</td>
                        <td className="text-right p-2">₦{(method.totalAmount || 0).toLocaleString()}</td>
                        <td className="text-right p-2">{method.percentage || 0}%</td>
                        <td className="text-right p-2">{method.successRate || 0}%</td>
                      </tr>
                    ))}
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
