import { redirect } from 'next/navigation';

/**
 * Settings Root Page
 * Redirects to /vendor/settings/profile (default tab)
 */
export default function SettingsPage() {
  redirect('/vendor/settings/profile');
}
