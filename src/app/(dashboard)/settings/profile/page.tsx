'use client';

import { ProfileSettingsPanel } from '@/components/settings/profile-settings-panel';
import { Suspense } from 'react';

export default function SettingsProfilePage() {
  return (
    <Suspense fallback={<div className="p-6 animate-pulse h-64 bg-white rounded-lg shadow-md" />}>
      <ProfileSettingsPanel />
    </Suspense>
  );
}
