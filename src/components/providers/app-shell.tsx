'use client';

import type { ReactNode } from 'react';
import { NavigationProvider } from '@/components/navigation/navigation-provider';
import { NavigationProgressBar, NavigationBusyHint } from '@/components/ui/loading-states';

/** Global navigation feedback + progress for all routes */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <NavigationProvider>
      <NavigationProgressBar />
      <NavigationBusyHint />
      {children}
    </NavigationProvider>
  );
}
