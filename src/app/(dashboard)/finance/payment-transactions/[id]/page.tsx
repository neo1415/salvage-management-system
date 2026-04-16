import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { PaymentDetailsContent } from '@/components/finance/payment-details-content';

export const metadata = {
  title: 'Payment Details | Finance Officer',
  description: 'View auction payment details and timeline',
};

interface PageProps {
  params: {
    id: string;
  };
}

export default async function PaymentDetailsPage({ params }: PageProps) {
  const session = await auth();

  if (!session || (session.user.role !== 'finance_officer' && session.user.role !== 'manager' && session.user.role !== 'admin')) {
    redirect('/unauthorized');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Suspense fallback={<LoadingSkeleton />}>
        <PaymentDetailsContent auctionId={params.id} />
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
          <div className="h-24 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}
