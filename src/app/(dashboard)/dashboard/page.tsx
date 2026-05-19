import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function DashboardRedirectPage() {
  const session = await auth();

  if (!session?.user?.role) {
    redirect('/login');
  }

  switch (session.user.role) {
    case 'vendor':
      redirect('/vendor/dashboard');
    case 'salvage_manager':
      redirect('/manager/dashboard');
    case 'claims_adjuster':
      redirect('/adjuster/dashboard');
    case 'finance_officer':
      redirect('/finance/dashboard');
    case 'system_admin':
      redirect('/admin/dashboard');
    default:
      redirect('/login');
  }
}
