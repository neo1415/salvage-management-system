'use client';

import ChangePasswordForm from '@/components/settings/change-password-form';

export default function SettingsChangePasswordPage() {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Change password</h2>
      <ChangePasswordForm />
    </div>
  );
}
