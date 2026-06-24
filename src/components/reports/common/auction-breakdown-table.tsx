'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PaginatedReportRows } from '@/components/reports/common/paginated-report-table';
import { formatReportCurrency } from '@/components/reports/common/report-currency';
import type {
  AuctionBreakdownRow,
  AuctionCategoryBreakdownGroup,
} from '@/features/reports/utils/auction-breakdown';

export function AuctionBreakdownTable({
  rows,
  label = 'auctions',
}: {
  rows: AuctionBreakdownRow[];
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
                <th className="text-left py-2 px-3">Status</th>
                <th className="text-right py-2 px-3">Bids</th>
                <th className="text-right py-2 px-3">Bidders</th>
                <th className="text-right py-2 px-3">Winning Bid</th>
                <th className="text-right py-2 px-3">Reserve</th>
                <th className="text-right py-2 px-3">Duration (h)</th>
                <th className="text-left py-2 px-3">Pickup</th>
                <th className="text-left py-2 px-3">Vendor</th>
                <th className="text-left py-2 px-3">Picked Up</th>
                <th className="text-left py-2 px-3">Start</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((auction, index) => (
                <tr
                  key={`${auction.claimReference}-${auction.startTime}-${startIndex + index}`}
                  className="border-b hover:bg-gray-50"
                >
                  <td className="py-2 px-3 font-medium">{auction.claimReference}</td>
                  <td className="py-2 px-3">{auction.policyNumber || '—'}</td>
                  <td className="py-2 px-3">{auction.branchName}</td>
                  <td className="py-2 px-3">{auction.channelLabel}</td>
                  <td className="py-2 px-3 capitalize">{auction.assetType}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        auction.isSuccessful
                          ? 'bg-green-100 text-green-800'
                          : auction.status === 'active'
                            ? 'bg-yellow-100 text-yellow-800'
                            : auction.status === 'awaiting_payment'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {auction.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">{auction.bidCount}</td>
                  <td className="py-2 px-3 text-right">{auction.uniqueBidders}</td>
                  <td className="py-2 px-3 text-right font-medium">
                    {auction.winningBid != null ? formatReportCurrency(auction.winningBid) : '—'}
                  </td>
                  <td className="py-2 px-3 text-right">{formatReportCurrency(auction.reservePrice)}</td>
                  <td className="py-2 px-3 text-right">{auction.durationHours}</td>
                  <td className="py-2 px-3 capitalize">
                    {auction.pickupStatus.replace(/_/g, ' ')}
                  </td>
                  <td className="py-2 px-3">{auction.pickupVendorName || '—'}</td>
                  <td className="py-2 px-3">{auction.pickedUpAt || '—'}</td>
                  <td className="py-2 px-3">{auction.startTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PaginatedReportRows>
  );
}

export function AuctionCategoryBreakdownSection({
  groups,
  nameColumnLabel,
}: {
  groups: AuctionCategoryBreakdownGroup[];
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
                <p className="text-gray-600">Revenue</p>
                <p className="font-bold text-lg">{formatReportCurrency(group.totalRevenue)}</p>
              </div>
              <div>
                <p className="text-gray-600">Success Rate</p>
                <p className="font-bold text-lg">{group.successRate.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-gray-600">Avg Winning Bid</p>
                <p className="font-bold text-lg">{formatReportCurrency(group.averageWinningBid)}</p>
              </div>
              <div>
                <p className="text-gray-600">Avg Bids</p>
                <p className="font-bold text-lg">{group.averageBids.toFixed(1)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <AuctionBreakdownTable rows={group.auctions} />
          </CardContent>
        </Card>
      ))}
    </>
  );
}
