/**
 * Action Modal Component for Admin User Management
 * Isolated modal to prevent parent component re-renders
 */

'use client';

import { useState, useCallback } from 'react';

interface User {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  loginDeviceType: string | null;
}

type ActionModalType = 'suspend' | 'unsuspend' | 'delete' | 'resetPassword' | 'changeRole' | 'view' | null;

interface ActionModalProps {
  actionModal: ActionModalType;
  selectedUser: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ActionModal({ actionModal, selectedUser, onClose, onSuccess }: ActionModalProps) {
  const [suspensionReason, setSuspensionReason] = useState('');
  const [newRole, setNewRole] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  const getRoleDisplayName = useCallback((role: string): string => {
    const roleNames: Record<string, string> = {
      vendor: 'Vendor',
      claims_adjuster: 'Claims Adjuster',
      salvage_manager: 'Salvage Manager',
      finance_officer: 'Finance Officer',
      system_admin: 'System Admin',
    };
    return roleNames[role] || role;
  }, []);

  const getStatusDisplayName = useCallback((status: string): string => {
    const statusNames: Record<string, string> = {
      unverified_tier_0: 'Unverified',
      phone_verified_tier_0: 'Phone Verified',
      verified_tier_1: 'Tier 1',
      verified_tier_2: 'Tier 2',
      suspended: 'Suspended',
      deleted: 'Deleted',
    };
    return statusNames[status] || status;
  }, []);

  const getStatusColor = useCallback((status: string): string => {
    const colors: Record<string, string> = {
      unverified_tier_0: 'bg-gray-100 text-gray-800',
      phone_verified_tier_0: 'bg-blue-100 text-blue-800',
      verified_tier_1: 'bg-green-100 text-green-800',
      verified_tier_2: 'bg-purple-100 text-purple-800',
      suspended: 'bg-red-100 text-red-800',
      deleted: 'bg-gray-100 text-gray-500',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }, []);

  const getRoleColor = useCallback((role: string): string => {
    const colors: Record<string, string> = {
      vendor: 'bg-blue-100 text-blue-800',
      claims_adjuster: 'bg-green-100 text-green-800',
      salvage_manager: 'bg-purple-100 text-purple-800',
      finance_officer: 'bg-yellow-100 text-yellow-800',
      system_admin: 'bg-red-100 text-red-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  }, []);

  const executeAction = useCallback(async () => {
    if (!selectedUser) return;

    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      let response;
      
      switch (actionModal) {
        case 'suspend':
          if (!suspensionReason || suspensionReason.length < 10) {
            setActionError('Suspension reason must be at least 10 characters');
            setActionLoading(false);
            return;
          }
          response = await fetch(`/api/admin/users/${selectedUser.id}/suspend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: suspensionReason }),
          });
          break;

        case 'unsuspend':
          response = await fetch(`/api/admin/users/${selectedUser.id}/unsuspend`, {
            method: 'POST',
          });
          break;

        case 'delete':
          response = await fetch(`/api/admin/users/${selectedUser.id}`, {
            method: 'DELETE',
          });
          break;

        case 'resetPassword':
          response = await fetch(`/api/admin/users/${selectedUser.id}/reset-password`, {
            method: 'POST',
          });
          break;

        case 'changeRole':
          if (!newRole) {
            setActionError('Please select a new role');
            setActionLoading(false);
            return;
          }
          response = await fetch(`/api/admin/users/${selectedUser.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: newRole }),
          });
          break;

        default:
          setActionLoading(false);
          return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Action failed');
      }

      setActionSuccess(data.message || 'Action completed successfully');
      
      // Store temporary password if returned
      if (data.temporaryPassword) {
        setTemporaryPassword(data.temporaryPassword);
      }

      // Notify parent to refresh
      onSuccess();

      // Auto-close modal after 3 seconds (except for password reset)
      if (actionModal !== 'resetPassword') {
        setTimeout(() => {
          onClose();
        }, 3000);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }, [selectedUser, actionModal, suspensionReason, newRole, onSuccess, onClose]);

  if (!actionModal || !selectedUser) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* View Details Modal */}
          {actionModal === 'view' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">User Details</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Full Name</p>
                  <p className="text-base font-medium">{selectedUser.fullName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="text-base font-medium">{selectedUser.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="text-base font-medium">{selectedUser.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Role</p>
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(selectedUser.role)}`}>
                    {getRoleDisplayName(selectedUser.role)}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(selectedUser.status)}`}>
                    {getStatusDisplayName(selectedUser.status)}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">User ID</p>
                  <p className="text-xs font-mono">{selectedUser.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Created</p>
                  <p className="text-base">{new Date(selectedUser.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Last Updated</p>
                  <p className="text-base">{new Date(selectedUser.updatedAt).toLocaleString()}</p>
                </div>
                {selectedUser.lastLoginAt && (
                  <div>
                    <p className="text-sm text-gray-500">Last Login</p>
                    <p className="text-base">{new Date(selectedUser.lastLoginAt).toLocaleString()}</p>
                    <p className="text-xs text-gray-500">{selectedUser.loginDeviceType || 'Unknown device'}</p>
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                className="mt-6 w-full px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
            </>
          )}

          {/* Change Role Modal */}
          {actionModal === 'changeRole' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Change User Role</h2>
              {actionError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {actionError}
                </div>
              )}
              {actionSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
                  {actionSuccess}
                </div>
              )}
              <p className="text-gray-600 mb-4">
                Change role for <strong>{selectedUser.fullName}</strong>
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Role</label>
                <span className={`px-3 py-1 inline-flex text-sm font-semibold rounded-full ${getRoleColor(selectedUser.role)}`}>
                  {getRoleDisplayName(selectedUser.role)}
                </span>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">New Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-burgundy-500"
                >
                  <option value="">Select new role...</option>
                  <option value="vendor">Vendor</option>
                  <option value="claims_adjuster">Claims Adjuster</option>
                  <option value="salvage_manager">Salvage Manager</option>
                  <option value="finance_officer">Finance Officer</option>
                  <option value="system_admin">System Admin</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={executeAction}
                  className="flex-1 px-4 py-2 bg-burgundy-600 text-white font-semibold rounded-lg hover:bg-burgundy-700 disabled:opacity-50"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Changing...' : 'Change Role'}
                </button>
              </div>
            </>
          )}

          {/* Suspend Modal */}
          {actionModal === 'suspend' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Suspend User Account</h2>
              {actionError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {actionError}
                </div>
              )}
              {actionSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
                  {actionSuccess}
                </div>
              )}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-orange-800">
                  <strong>⚠️ Warning:</strong> This will suspend <strong>{selectedUser.fullName}</strong> and prevent them from logging in.
                </p>
              </div>
              <div className="mb-6">
                <label htmlFor="suspensionReasonInput" className="block text-sm font-medium text-gray-700 mb-2">
                  Suspension Reason (required, min 10 characters)
                </label>
                <textarea
                  id="suspensionReasonInput"
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-burgundy-500"
                  rows={4}
                  placeholder="Enter reason for suspension (minimum 10 characters)..."
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeAction}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 disabled:opacity-50"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Suspending...' : 'Suspend User'}
                </button>
              </div>
            </>
          )}

          {/* Unsuspend Modal */}
          {actionModal === 'unsuspend' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Unsuspend User Account</h2>
              {actionError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {actionError}
                </div>
              )}
              {actionSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
                  {actionSuccess}
                </div>
              )}
              <p className="text-gray-600 mb-6">
                Are you sure you want to unsuspend <strong>{selectedUser.fullName}</strong>? They will be able to log in again.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={executeAction}
                  className="flex-1 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Unsuspending...' : 'Unsuspend User'}
                </button>
              </div>
            </>
          )}

          {/* Delete Modal */}
          {actionModal === 'delete' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Delete User Account</h2>
              {actionError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {actionError}
                </div>
              )}
              {actionSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
                  {actionSuccess}
                </div>
              )}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800">
                  <strong>🗑️ Warning:</strong> This will permanently delete <strong>{selectedUser.fullName}</strong>. This action cannot be undone.
                </p>
              </div>
              <p className="text-gray-600 mb-6">
                Are you absolutely sure you want to delete this user?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={executeAction}
                  className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Deleting...' : 'Delete User'}
                </button>
              </div>
            </>
          )}

          {/* Reset Password Modal */}
          {actionModal === 'resetPassword' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Reset User Password</h2>
              {actionError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {actionError}
                </div>
              )}
              {actionSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
                  <p className="font-semibold">{actionSuccess}</p>
                  {temporaryPassword && (
                    <div className="mt-3 p-3 bg-white border border-green-300 rounded">
                      <p className="text-sm font-medium mb-1">New Temporary Password:</p>
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded block">{temporaryPassword}</code>
                      <p className="text-xs mt-2 text-green-600">
                        ⚠️ This password has been emailed to the user.
                      </p>
                    </div>
                  )}
                </div>
              )}
              {!actionSuccess && (
                <>
                  <p className="text-gray-600 mb-4">
                    Reset password for <strong>{selectedUser.fullName}</strong>?
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-blue-800">
                      <strong>ℹ️ Note:</strong> A new temporary password will be generated and emailed to the user. They will be required to change it on next login.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50"
                      disabled={actionLoading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={executeAction}
                      className="flex-1 px-4 py-2 bg-burgundy-600 text-white font-semibold rounded-lg hover:bg-burgundy-700 disabled:opacity-50"
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </div>
                </>
              )}
              {actionSuccess && (
                <button
                  onClick={onClose}
                  className="mt-4 w-full px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700"
                >
                  Close
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
