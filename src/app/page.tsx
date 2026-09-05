import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getAppUrl } from '@/features/notifications/templates/email-urls';
import { businessPolicyService } from '@/features/business-policy';
import { HomeClient } from '@/components/landing/home-client';

export function generateMetadata(): Metadata {
  return { alternates: { canonical: getAppUrl() } };
}

export default async function Home() {
  const policy = await businessPolicyService.getPublicPolicy();

  if (policy.branding.homepageMode === 'login_first') {
    redirect('/login');
  }

  return <HomeClient />;
}
