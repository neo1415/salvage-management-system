import { Metadata } from 'next';
import { ReconciliationDashboard } from '@/components/finance/reconciliation-dashboard';

export const metadata: Metadata = {
  title: 'Payment Reconciliation | Finance Dashboard',
  description: 'Daily reconciliation between database balances and Paystack',
};

/**
 * Finance Reconciliation Dashboard Page
 * 
 * Provides finance officers with:
 * - Daily reconciliation status
 * - Discrepancy history
 * - Vendor balance breakdown
 * - Unmatched transactions
 * - Manual reconciliation tools
 */
export default function ReconciliationPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Payment Reconciliation</h1>
        <p className="text-muted-foreground mt-2">
          Daily reconciliation between database balances and Paystack
        </p>
      </div>

      <ReconciliationDashboard />
    </div>
  );
}
