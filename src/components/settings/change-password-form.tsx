'use client';

import { useState } from 'react';

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

interface ChangePasswordFormProps {
  /** Defaults to universal auth route (all roles). Vendors may pass vendor-specific route. */
  apiEndpoint?: string;
}

export default function ChangePasswordForm({
  apiEndpoint = '/api/auth/change-password',
}: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const calculatePasswordStrength = (password: string): PasswordStrength => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
    if (score <= 4) return { score, label: 'Fair', color: 'bg-yellow-500' };
    if (score <= 5) return { score, label: 'Good', color: 'bg-blue-500' };
    return { score, label: 'Strong', color: 'bg-green-500' };
  };

  const passwordStrength = newPassword ? calculatePasswordStrength(newPassword) : null;

  const validateForm = (): string | null => {
    if (!currentPassword) return 'Current password is required';
    if (!newPassword) return 'New password is required';
    if (!confirmPassword) return 'Please confirm your new password';
    if (newPassword.length < 8) return 'New password must be at least 8 characters long';
    if (!/[a-z]/.test(newPassword)) return 'New password must contain at least one lowercase letter';
    if (!/[A-Z]/.test(newPassword)) return 'New password must contain at least one uppercase letter';
    if (!/[0-9]/.test(newPassword)) return 'New password must contain at least one number';
    if (!/[^a-zA-Z0-9]/.test(newPassword)) {
      return 'New password must contain at least one special character';
    }
    if (newPassword !== confirmPassword) return 'New password and confirmation do not match';
    if (currentPassword === newPassword) {
      return 'New password must be different from current password';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        const message =
          data.error ||
          (Array.isArray(data.details) && data.details[0]?.message) ||
          'Failed to change password';
        throw new Error(message);
      }

      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          {success}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Current password</label>
        <div className="relative">
          <input
            type={showCurrentPassword ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent pr-10"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm"
          >
            {showCurrentPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">New password</label>
        <div className="relative">
          <input
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent pr-10"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm"
          >
            {showNewPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {passwordStrength && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Strength</span>
              <span>{passwordStrength.label}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${passwordStrength.color} transition-all`}
                style={{ width: `${(passwordStrength.score / 6) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Confirm new password</label>
        <div className="relative">
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent pr-10"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm"
          >
            {showConfirmPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full sm:w-auto px-6 py-3 bg-[var(--brand-primary)] text-white rounded-lg hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 font-medium"
      >
        {loading ? 'Updating…' : 'Update password'}
      </button>
    </form>
  );
}
