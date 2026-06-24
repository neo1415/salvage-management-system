import { Metadata } from 'next';
import { ReconciliationDashboard } from '@/components/finance/reconciliation-dashboard';

export const metadata: Metadata = {
  title: 'Wallet reconciliation | Finance',
  description: 'Vendor wallet totals and Paystack balance for finance',
};

export default function ReconciliationPage() {
  return (
    <div className="container mx-auto py-6">
      <ReconciliationDashboard />
    </div>
  );
}
