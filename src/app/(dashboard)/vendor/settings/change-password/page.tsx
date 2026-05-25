import { redirect } from 'next/navigation';

export default function VendorChangePasswordSettingsRedirect() {
  redirect('/settings/change-password');
}
