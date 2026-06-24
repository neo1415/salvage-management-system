export type CaseChannelType = 'broker' | 'agency' | 'unassigned';

export function resolveCaseChannelLabel(
  brokerName?: string | null,
  agencyName?: string | null
): { type: CaseChannelType; label: string } {
  const broker = brokerName?.trim();
  if (broker) return { type: 'broker', label: broker };

  const agency = agencyName?.trim();
  if (agency) return { type: 'agency', label: agency };

  return { type: 'unassigned', label: 'Unassigned' };
}

export function formatCaseChannelDisplay(channel: { type: CaseChannelType; label: string }): string {
  if (channel.type === 'broker') return `Broker: ${channel.label}`;
  if (channel.type === 'agency') return `Agency: ${channel.label}`;
  return '—';
}
