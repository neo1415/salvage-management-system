'use client';

import dynamic from 'next/dynamic';
import { Navigation } from '@/components/landing/navigation';
import { HeroSection } from '@/components/landing/hero-section';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePublicBranding } from '@/hooks/use-public-branding';

// Lazy load ALL sections below the fold
const BelowFoldSections = dynamic(() => import('@/components/landing/below-fold-sections'), {
  loading: () => <div className="min-h-screen bg-gray-50" />,
});

export default function Home() {
  const [showBelowFold, setShowBelowFold] = useState(false);
  const router = useRouter();
  const { branding, loading } = usePublicBranding();

  useEffect(() => {
    // Load below-the-fold content after hero is visible
    const timer = setTimeout(() => {
      setShowBelowFold(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loading && branding.homepageMode === 'login_first') {
      router.replace('/login');
    }
  }, [branding.homepageMode, loading, router]);

  if (!loading && branding.homepageMode === 'login_first') {
    return <main className="min-h-screen bg-white" />;
  }

  return (
    <main className="min-h-screen bg-white">
      <Navigation />
      <HeroSection />
      {showBelowFold && <BelowFoldSections />}
    </main>
  );
}
