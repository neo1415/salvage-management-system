import { formatCaseChannelDisplay, resolveCaseChannelLabel } from './case-channel-label';

export type CaseBreakdownRow = {
  claimReference: string;
  policyNumber: string | null;
  branchName: string;
  channelLabel: string;
  status: string;
  marketValue: number;
  salvageValue: number;
  processingDays: number;
  possessingVendorName: string | null;
  pickedUpAt: string | null;
  createdAt: string;
};

type RawCaseRow = {
  claimReference: string;
  policyNumber?: string | null;
  branchName?: string | null;
  brokerName?: string | null;
  agencyName?: string | null;
  status: string;
  marketValue: string | number;
  estimatedSalvageValue?: string | number | null;
  processingTimeHours?: number | null;
  possessingVendorName?: string | null;
  pickedUpAt?: Date | string | null;
  createdAt: Date | string;
};

export function mapCaseToBreakdownRow(row: RawCaseRow): CaseBreakdownRow {
  const channel = resolveCaseChannelLabel(row.brokerName, row.agencyName);
  const processingDays = row.processingTimeHours
    ? Math.round((row.processingTimeHours / 24) * 10) / 10
    : 0;

  return {
    claimReference: row.claimReference,
    policyNumber: row.policyNumber?.trim() || null,
    branchName: row.branchName || 'Unassigned',
    channelLabel: formatCaseChannelDisplay(channel),
    status: row.status,
    marketValue: Math.round(parseFloat(String(row.marketValue || '0'))),
    salvageValue: Math.round(parseFloat(String(row.estimatedSalvageValue || '0'))),
    processingDays,
    possessingVendorName: row.possessingVendorName || null,
    pickedUpAt: row.pickedUpAt
      ? new Date(row.pickedUpAt).toISOString().split('T')[0]
      : null,
    createdAt: new Date(row.createdAt).toISOString().split('T')[0],
  };
}

export type CategoryBreakdownGroup<TKey extends string> = {
  key: TKey;
  label: string;
  count: number;
  averageProcessingTime: number;
  approvalRate: number;
  totalMarketValue: number;
  totalSalvageValue: number;
  cases: CaseBreakdownRow[];
};

export function buildCategoryBreakdown<T extends RawCaseRow>(
  data: T[],
  getKey: (row: T) => string,
  getLabel: (key: string, row: T) => string
): CategoryBreakdownGroup<string>[] {
  if (data.length === 0) return [];

  const grouped: Record<string, T[]> = {};
  for (const row of data) {
    const key = getKey(row);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }

  return Object.entries(grouped)
    .map(([key, items]) => {
      const approved = items.filter((c) =>
        ['approved', 'active_auction', 'awaiting_payment', 'sold'].includes(c.status)
      ).length;
      const approvalRate = items.length > 0 ? (approved / items.length) * 100 : 0;
      const withTime = items.filter(
        (c) => c.processingTimeHours !== null && c.processingTimeHours !== undefined
      );
      const avgHours =
        withTime.length > 0
          ? withTime.reduce((sum, c) => sum + (c.processingTimeHours || 0), 0) / withTime.length
          : 0;
      const totalMarketValue = items.reduce(
        (sum, c) => sum + parseFloat(String(c.marketValue || '0')),
        0
      );
      const totalSalvageValue = items.reduce(
        (sum, c) => sum + parseFloat(String(c.estimatedSalvageValue || '0')),
        0
      );
      const cases = items
        .map(mapCaseToBreakdownRow)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      return {
        key,
        label: getLabel(key, items[0]),
        count: items.length,
        averageProcessingTime: Math.round((avgHours / 24) * 100) / 100,
        approvalRate: Math.round(approvalRate * 100) / 100,
        totalMarketValue: Math.round(totalMarketValue),
        totalSalvageValue: Math.round(totalSalvageValue),
        cases,
      };
    })
    .sort((a, b) => b.totalSalvageValue - a.totalSalvageValue);
}
