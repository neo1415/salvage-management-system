import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { PaymentTransactionsContent } from '@/components/finance/payment-transactions-content';

export const metadata = {
  title: 'Payment Transactions | Finance Officer',
  description: 'Manage auction payment transactions and deposits',
};

export default async function PaymentTransactionsPage() {
  const session = await auth();

  if (!session || (session.user.role !== 'finance_officer' && session.user.role !== 'manager' && session.user.role !== 'admin')) {
    redirect('/unauthorized');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Payment Transactions</h1>
        <p className="text-gray-600 mt-2">
          Manage auction payments, grant extensions, and transfer forfeited deposits
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <PaymentTransactionsContent />
      </Suspense>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="space-y-3">
            <div className="h-32 bg-gray-200 rounded" />
            <div className="h-32 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
