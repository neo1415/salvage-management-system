import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AuctionConfigContent } from '@/components/admin/auction-config-content';

export const metadata = {
  title: 'Auction Configuration | System Admin',
  description: 'Configure auction deposit system business rules',
};

export default async function AuctionConfigPage() {
  const session = await auth();

  if (!session || (session.user.role !== 'admin' && session.user.role !== 'system_admin' && session.user.role !== 'manager')) {
    redirect('/unauthorized');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Auction Deposit Configuration</h1>
        <p className="text-gray-600 mt-2">
          Configure business rules and view configuration change history
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <AuctionConfigContent />
      </Suspense>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
