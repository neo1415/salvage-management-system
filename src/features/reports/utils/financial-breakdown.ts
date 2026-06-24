import {
  formatCaseChannelDisplay,
  resolveCaseChannelLabel,
} from './case-channel-label';

export type FinancialDetailRow = {
  claimReference: string;
  policyNumber: string | null;
  branchName: string;
  channelLabel: string;
  brokerName: string | null;
  agencyName: string | null;
  assetType: string;
  marketValue: number;
  salvageRecovery: number;
  netLoss: number;
  recoveryRate: number;
  roi: number;
  date: string;
};

type RevenueLikeRow = {
  claimReference: string;
  policyNumber?: string | null;
  branchName?: string | null;
  brokerName?: string | null;
  agencyName?: string | null;
  assetType: string;
  marketValue: string | number;
  salvageRecovery: string | number;
  netLoss: number;
  recoveryRate: number;
  createdAt: Date | string;
};

export function mapRevenueToFinancialDetail(row: RevenueLikeRow): FinancialDetailRow {
  const channel = resolveCaseChannelLabel(row.brokerName, row.agencyName);
  const marketValue = Math.round(parseFloat(String(row.marketValue || '0')));
  const salvageRecovery = Math.round(parseFloat(String(row.salvageRecovery || '0')));
  const netLoss = row.netLoss ?? marketValue - salvageRecovery;
  const recoveryRate = row.recoveryRate ?? (marketValue > 0 ? (salvageRecovery / marketValue) * 100 : 0);

  return {
    claimReference: row.claimReference,
    policyNumber: row.policyNumber?.trim() || null,
    branchName: row.branchName || 'Unassigned',
    channelLabel: formatCaseChannelDisplay(channel),
    brokerName: row.brokerName?.trim() || null,
    agencyName: row.agencyName?.trim() || null,
    assetType: row.assetType,
    marketValue,
    salvageRecovery,
    netLoss: Math.round(netLoss),
    recoveryRate: Math.round(recoveryRate * 100) / 100,
    roi: Math.round(recoveryRate * 100) / 100,
    date: new Date(row.createdAt).toISOString().split('T')[0],
  };
}

export type FinancialSummaryGroup = {
  label: string;
  count: number;
  claimsPaid: number;
  salvageRecovered: number;
  netLoss: number;
  recoveryRate: number;
  roi: number;
};

export type FinancialBreakdownGroup = FinancialSummaryGroup & {
  cases: FinancialDetailRow[];
};

function summarizeFinancialRows(rows: FinancialDetailRow[]): Omit<FinancialSummaryGroup, 'label'> {
  const claimsPaid = rows.reduce((sum, row) => sum + row.marketValue, 0);
  const salvageRecovered = rows.reduce((sum, row) => sum + row.salvageRecovery, 0);
  const netLoss = claimsPaid - salvageRecovered;
  const recoveryRate = claimsPaid > 0 ? (salvageRecovered / claimsPaid) * 100 : 0;
  return {
    count: rows.length,
    claimsPaid: Math.round(claimsPaid * 100) / 100,
    salvageRecovered: Math.round(salvageRecovered * 100) / 100,
    netLoss: Math.round(netLoss * 100) / 100,
    recoveryRate: Math.round(recoveryRate * 100) / 100,
    roi: Math.round(recoveryRate * 100) / 100,
  };
}

export function buildFinancialBranchBreakdown(rows: FinancialDetailRow[]): FinancialBreakdownGroup[] {
  const grouped: Record<string, FinancialDetailRow[]> = {};
  for (const row of rows) {
    const key = row.branchName || 'Unassigned';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }

  return Object.entries(grouped)
    .map(([label, cases]) => ({
      label,
      ...summarizeFinancialRows(cases),
      cases: [...cases].sort((a, b) => b.date.localeCompare(a.date)),
    }))
    .sort((a, b) => b.salvageRecovered - a.salvageRecovered);
}

export function buildFinancialBrokerBreakdown(rows: FinancialDetailRow[]): FinancialBreakdownGroup[] {
  const grouped: Record<string, FinancialDetailRow[]> = {};
  for (const row of rows) {
    const channel = resolveCaseChannelLabel(row.brokerName, row.agencyName);
    const key = `${channel.type}:${channel.label}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }

  return Object.entries(grouped)
    .map(([key, cases]) => ({
      label: resolveCaseChannelLabel(cases[0].brokerName, cases[0].agencyName).label,
      ...summarizeFinancialRows(cases),
      cases: [...cases].sort((a, b) => b.date.localeCompare(a.date)),
    }))
    .sort((a, b) => b.salvageRecovered - a.salvageRecovered);
}

export function buildFinancialBranchSummary(rows: FinancialDetailRow[]): FinancialSummaryGroup[] {
  return buildFinancialBranchBreakdown(rows).map(({ label, ...summary }) => ({
    label,
    ...summary,
  }));
}

export function buildFinancialBrokerSummary(rows: FinancialDetailRow[]): Array<
  FinancialSummaryGroup & { channelType: 'broker' | 'agency' | 'unassigned' }
> {
  const grouped: Record<string, FinancialDetailRow[]> = {};
  for (const row of rows) {
    const channel = resolveCaseChannelLabel(row.brokerName, row.agencyName);
    const key = `${channel.type}:${channel.label}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }

  return Object.entries(grouped)
    .map(([key, cases]) => {
      const channel = resolveCaseChannelLabel(cases[0].brokerName, cases[0].agencyName);
      return {
        label: channel.label,
        channelType: channel.type,
        ...summarizeFinancialRows(cases),
      };
    })
    .sort((a, b) => b.salvageRecovered - a.salvageRecovered);
}
