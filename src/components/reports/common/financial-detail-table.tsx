'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PaginatedReportRows } from '@/components/reports/common/paginated-report-table';
import { formatReportCurrency } from '@/components/reports/common/report-currency';
import type {
  FinancialBreakdownGroup,
  FinancialDetailRow,
} from '@/features/reports/utils/financial-breakdown';

export function FinancialDetailTable({
  rows,
  label = 'items',
}: {
  rows: FinancialDetailRow[];
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
                <th className="text-left py-2 px-3">Asset</th>
                <th className="text-right py-2 px-3">Market Value</th>
                <th className="text-right py-2 px-3">Salvage Recovery</th>
                <th className="text-right py-2 px-3">Net Loss</th>
                <th className="text-right py-2 px-3">Recovery</th>
                <th className="text-left py-2 px-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((item, index) => (
                <tr
                  key={`${item.claimReference}-${item.date}-${startIndex + index}`}
                  className="border-b hover:bg-gray-50"
                >
                  <td className="py-2 px-3 font-medium">{item.claimReference}</td>
                  <td className="py-2 px-3">{item.policyNumber || '—'}</td>
                  <td className="py-2 px-3">{item.branchName}</td>
                  <td className="py-2 px-3">{item.channelLabel}</td>
                  <td className="py-2 px-3 capitalize">{item.assetType}</td>
                  <td className="py-2 px-3 text-right">{formatReportCurrency(item.marketValue)}</td>
                  <td className="py-2 px-3 text-right text-green-700">
                    {formatReportCurrency(item.salvageRecovery)}
                  </td>
                  <td className="py-2 px-3 text-right text-red-700">
                    {formatReportCurrency(item.netLoss)}
                  </td>
                  <td className="py-2 px-3 text-right">{item.recoveryRate.toFixed(2)}%</td>
                  <td className="py-2 px-3">{item.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PaginatedReportRows>
  );
}

export function FinancialBreakdownSection({
  groups,
  nameColumnLabel,
}: {
  groups: FinancialBreakdownGroup[];
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
                <p className="text-gray-600">Claims paid</p>
                <p className="font-bold text-lg">{formatReportCurrency(group.claimsPaid)}</p>
              </div>
              <div>
                <p className="text-gray-600">Salvage recovered</p>
                <p className="font-bold text-lg">{formatReportCurrency(group.salvageRecovered)}</p>
              </div>
              <div>
                <p className="text-gray-600">Net loss</p>
                <p className="font-bold text-lg">{formatReportCurrency(group.netLoss)}</p>
              </div>
              <div>
                <p className="text-gray-600">Recovery rate</p>
                <p className="font-bold text-lg">{group.recoveryRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <FinancialDetailTable rows={group.cases} />
          </CardContent>
        </Card>
      ))}
    </>
  );
}
