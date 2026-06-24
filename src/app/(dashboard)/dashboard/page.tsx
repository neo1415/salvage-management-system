import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  CHANGE_PASSWORD_PATH,
  resolveVendorOnboardingRedirectForUser,
} from '@/lib/auth/vendor-onboarding-navigation';

export default async function DashboardRedirectPage() {
  const session = await auth();

  if (!session?.user?.role) {
    redirect('/login');
  }

  if (session.user.requirePasswordChange) {
    redirect(CHANGE_PASSWORD_PATH);
  }

  switch (session.user.role) {
    case 'vendor': {
      const onboardingPath = await resolveVendorOnboardingRedirectForUser(session.user.id);
      if (onboardingPath) {
        redirect(onboardingPath);
      }
      redirect('/vendor/dashboard');
    }
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
