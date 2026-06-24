import { formatCaseChannelDisplay, resolveCaseChannelLabel } from './case-channel-label';

export type AuctionBreakdownRow = {
  claimReference: string;
  policyNumber: string | null;
  branchName: string;
  channelLabel: string;
  assetType: string;
  status: string;
  bidCount: number;
  uniqueBidders: number;
  winningBid: number | null;
  reservePrice: number;
  durationHours: number;
  isSuccessful: boolean;
  pickupStatus: string;
  pickupVendorName: string | null;
  pickedUpAt: string | null;
  startTime: string;
};

type RawAuctionRow = {
  claimReference: string;
  policyNumber?: string | null;
  branchName?: string | null;
  brokerName?: string | null;
  agencyName?: string | null;
  assetType: string;
  status: string;
  bidCount: number;
  uniqueBidders: number;
  winningBid: string | number | null;
  reservePrice: string | number;
  durationHours: number;
  pickupStatus: string;
  pickupVendorName?: string | null;
  pickedUpAt?: Date | string | null;
  startTime: Date | string;
};

function isSoldAuction(row: RawAuctionRow): boolean {
  return row.status === 'sold' && row.winningBid != null && parseFloat(String(row.winningBid)) > 0;
}

export function mapAuctionToBreakdownRow(row: RawAuctionRow): AuctionBreakdownRow {
  const channel = resolveCaseChannelLabel(row.brokerName, row.agencyName);
  const winningBid = row.winningBid ? Math.round(parseFloat(String(row.winningBid))) : null;

  return {
    claimReference: row.claimReference,
    policyNumber: row.policyNumber?.trim() || null,
    branchName: row.branchName || 'Unassigned',
    channelLabel: formatCaseChannelDisplay(channel),
    assetType: row.assetType || 'unknown',
    status: row.status,
    bidCount: row.bidCount,
    uniqueBidders: row.uniqueBidders,
    winningBid,
    reservePrice: Math.round(parseFloat(String(row.reservePrice || '0'))),
    durationHours: Math.round(row.durationHours * 100) / 100,
    isSuccessful: isSoldAuction(row),
    pickupStatus: row.pickupStatus,
    pickupVendorName: row.pickupVendorName || null,
    pickedUpAt: row.pickedUpAt ? new Date(row.pickedUpAt).toISOString().split('T')[0] : null,
    startTime: new Date(row.startTime).toISOString().split('T')[0],
  };
}

export type AuctionCategoryBreakdownGroup = {
  key: string;
  label: string;
  count: number;
  successfulAuctions: number;
  successRate: number;
  totalRevenue: number;
  averageWinningBid: number;
  averageBids: number;
  auctions: AuctionBreakdownRow[];
};

export function buildAuctionCategoryBreakdown<T extends RawAuctionRow>(
  data: T[],
  getKey: (row: T) => string,
  getLabel: (key: string, row: T) => string
): AuctionCategoryBreakdownGroup[] {
  if (data.length === 0) return [];

  const grouped: Record<string, T[]> = {};
  for (const row of data) {
    const key = getKey(row);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }

  return Object.entries(grouped)
    .map(([key, items]) => {
      const sold = items.filter(isSoldAuction);
      const totalRevenue = sold.reduce(
        (sum, a) => sum + parseFloat(String(a.winningBid || '0')),
        0
      );
      const totalBids = items.reduce((sum, a) => sum + a.bidCount, 0);
      const auctions = items
        .map(mapAuctionToBreakdownRow)
        .sort((a, b) => b.startTime.localeCompare(a.startTime));

      return {
        key,
        label: getLabel(key, items[0]),
        count: items.length,
        successfulAuctions: sold.length,
        successRate:
          items.length > 0 ? Math.round((sold.length / items.length) * 10000) / 100 : 0,
        totalRevenue: Math.round(totalRevenue),
        averageWinningBid:
          sold.length > 0 ? Math.round(totalRevenue / sold.length) : 0,
        averageBids: items.length > 0 ? Math.round((totalBids / items.length) * 100) / 100 : 0,
        auctions,
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export function mapAuctionListToBreakdownRow(item: {
  claimReference: string;
  policyNumber: string | null;
  channelLabel: string;
  branchName: string;
  assetType: string;
  status: string;
  bidCount: number;
  uniqueBidders: number;
  winningBid: number | null;
  reservePrice: number;
  durationHours: number;
  isSuccessful: boolean;
  pickupStatus: string;
  pickupVendorName: string | null;
  pickedUpAt: string | null;
  startTime: string;
}): AuctionBreakdownRow {
  return {
    claimReference: item.claimReference,
    policyNumber: item.policyNumber,
    branchName: item.branchName || 'Unassigned',
    channelLabel: item.channelLabel || '—',
    assetType: item.assetType || 'unknown',
    status: item.status,
    bidCount: item.bidCount,
    uniqueBidders: item.uniqueBidders,
    winningBid: item.winningBid,
    reservePrice: item.reservePrice,
    durationHours: item.durationHours,
    isSuccessful: item.isSuccessful,
    pickupStatus: item.pickupStatus,
    pickupVendorName: item.pickupVendorName,
    pickedUpAt: item.pickedUpAt ? new Date(item.pickedUpAt).toISOString().split('T')[0] : null,
    startTime: new Date(item.startTime).toISOString().split('T')[0],
  };
}
