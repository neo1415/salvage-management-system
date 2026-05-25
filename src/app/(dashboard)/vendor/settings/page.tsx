import { redirect } from 'next/navigation';

export default function VendorSettingsRedirect() {
  redirect('/settings/profile');
}
