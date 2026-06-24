'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PaginatedReportRows } from '@/components/reports/common/paginated-report-table';
import { formatReportCurrency } from '@/components/reports/common/report-currency';
import type { CaseBreakdownRow } from '@/features/reports/utils/case-breakdown';

export function CaseBreakdownTable({
  rows,
  label = 'cases',
}: {
  rows: CaseBreakdownRow[];
  label?: string;
}) {
  return (
    <PaginatedReportRows rows={rows} label={label}>
      {(pageRows, startIndex) => (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3">Claim</th>
                <th className="text-left py-2 px-3">Policy</th>
                <th className="text-left py-2 px-3">Branch</th>
                <th className="text-left py-2 px-3">Broker / Agency</th>
                <th className="text-left py-2 px-3">Status</th>
                <th className="text-right py-2 px-3">Market Value</th>
                <th className="text-right py-2 px-3">Salvage Value</th>
                <th className="text-right py-2 px-3">Days</th>
                <th className="text-left py-2 px-3">Vendor</th>
                <th className="text-left py-2 px-3">Picked Up</th>
                <th className="text-left py-2 px-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((caseItem, index) => (
                <tr
                  key={`${caseItem.claimReference}-${caseItem.createdAt}-${startIndex + index}`}
                  className="border-b hover:bg-gray-50"
                >
                  <td className="py-2 px-3 font-medium">{caseItem.claimReference}</td>
                  <td className="py-2 px-3">{caseItem.policyNumber || '—'}</td>
                  <td className="py-2 px-3">{caseItem.branchName}</td>
                  <td className="py-2 px-3">{caseItem.channelLabel}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        caseItem.status === 'sold'
                          ? 'bg-green-100 text-green-800'
                          : caseItem.status === 'approved'
                            ? 'bg-blue-100 text-blue-800'
                            : caseItem.status === 'active_auction'
                              ? 'bg-yellow-100 text-yellow-800'
                              : caseItem.status === 'pending_approval'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {caseItem.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-medium">
                    {formatReportCurrency(caseItem.marketValue)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {formatReportCurrency(caseItem.salvageValue)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {(caseItem.processingDays ?? 0).toFixed(1)}
                  </td>
                  <td className="py-2 px-3">{caseItem.possessingVendorName || '—'}</td>
                  <td className="py-2 px-3">{caseItem.pickedUpAt || '—'}</td>
                  <td className="py-2 px-3">{caseItem.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PaginatedReportRows>
  );
}

export function CategoryBreakdownSection({
  groups,
  nameColumnLabel,
}: {
  groups: Array<{
    label: string;
    count: number;
    averageProcessingTime: number;
    approvalRate: number;
    totalMarketValue: number;
    totalSalvageValue: number;
    cases: CaseBreakdownRow[];
  }>;
  nameColumnLabel: string;
}) {
  if (!groups.length) return null;

  return (
    <>
      {groups.map((group) => (
        <Card key={group.label} className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle>
              {nameColumnLabel}: {group.label} ({group.count})
            </CardTitle>
            <div className="grid gap-4 mt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-gray-600">Market Value</p>
                <p className="font-bold text-lg">{formatReportCurrency(group.totalMarketValue)}</p>
              </div>
              <div>
                <p className="text-gray-600">Salvage Value</p>
                <p className="font-bold text-lg">{formatReportCurrency(group.totalSalvageValue)}</p>
              </div>
              <div>
                <p className="text-gray-600">Avg Processing</p>
                <p className="font-bold text-lg">{group.averageProcessingTime.toFixed(1)} days</p>
              </div>
              <div>
                <p className="text-gray-600">Approval Rate</p>
                <p className="font-bold text-lg">{group.approvalRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CaseBreakdownTable rows={group.cases} />
          </CardContent>
        </Card>
      ))}
    </>
  );
}
