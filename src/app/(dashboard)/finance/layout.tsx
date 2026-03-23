import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/next-auth.config';

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Redirect if not authenticated
  if (!session?.user) {
    redirect('/login');
  }

  // Verify user is a Finance Officer
  if (session.user.role !== 'finance_officer') {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </div>
    </div>
  );
}
