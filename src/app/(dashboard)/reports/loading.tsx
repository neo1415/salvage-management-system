import { DataLoadingState } from '@/components/ui/loading-states';

export default function ReportsRouteLoading() {
  return <DataLoadingState label="Report" variant="report" className="no-print" />;
}
