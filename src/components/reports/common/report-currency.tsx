import { formatNaira } from '@/lib/utils/currency-formatter';

/** Consistent Naira formatting for report tables and cards. */
export function ReportCurrency({
  amount,
  className,
}: {
  amount: number | string | null | undefined;
  className?: string;
}) {
  return <span className={className}>{formatNaira(amount)}</span>;
}

export function formatReportCurrency(amount: number | string | null | undefined): string {
  return formatNaira(amount);
}
