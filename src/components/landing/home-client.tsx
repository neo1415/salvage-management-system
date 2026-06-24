'use client';

import { useEffect, useState } from 'react';
import { useAppRouter } from '@/hooks/use-app-router';
import { isStandalonePwa } from '@/lib/pwa/detect';
import { usePublicBranding } from '@/hooks/use-public-branding';
import { WhiteLabelHomeTemplates } from './home-templates';

export function HomeClient() {
  const [showBelowFold, setShowBelowFold] = useState(false);
  const router = useAppRouter();
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
