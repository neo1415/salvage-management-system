import { redirect } from 'next/navigation';
import { businessPolicyService } from '@/features/business-policy';
import { HomeClient } from '@/components/landing/home-client';

export default async function Home() {
  const policy = await businessPolicyService.getPublicPolicy();

  if (policy.branding.homepageMode === 'login_first') {
    redirect('/login');
  }

  return <HomeClient />;
}
