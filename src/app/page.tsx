'use client';

import dynamic from 'next/dynamic';
import { Navigation } from '@/components/landing/navigation';
import { HeroSection } from '@/components/landing/hero-section';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isStandalonePwa } from '@/lib/pwa/detect';

// Lazy load ALL sections below the fold
const BelowFoldSections = dynamic(() => import('@/components/landing/below-fold-sections'), {
  loading: () => <div className="min-h-screen bg-gray-50" />,
});

export default function Home() {
  const [showBelowFold, setShowBelowFold] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isStandalonePwa()) {
      router.replace('/launch');
      return;
    }

    const timer = setTimeout(() => {
      setShowBelowFold(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="min-h-screen bg-white">
      <Navigation />
      <HeroSection />
      {showBelowFold && <BelowFoldSections />}
    </main>
  );
}
