'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isStandalonePwa } from '@/lib/pwa/detect';
import { usePublicBranding } from '@/hooks/use-public-branding';
import { WhiteLabelHomeTemplates } from './home-templates';

export function HomeClient() {
  const [showBelowFold, setShowBelowFold] = useState(false);
  const router = useRouter();
  const { branding } = usePublicBranding();

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

  return <WhiteLabelHomeTemplates branding={branding} showLegacyBelowFold={showBelowFold} />;
}
