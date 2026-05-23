'use client';

import { useSession } from 'next-auth/react';
import { NotificationPreferencesPanel } from '@/components/settings/notification-preferences-panel';

export default function SettingsNotificationsPage() {
  const { data: session } = useSession();
  const isVendor = session?.user?.role === 'vendor';

  return <NotificationPreferencesPanel showVendorTypes={isVendor} />;
}
