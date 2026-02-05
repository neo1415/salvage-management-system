/**
 * Admin User Management UI
 * Displays user list with filters and allows creating new staff accounts
 * 
 * Requirements:
 * - Requirement 10: Staff Account Creation
 * - NFR5.3: User Experience
 * - Enterprise Standards Section 6.1: Authentication & Authorization
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import ActionModal from './action-modal';

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

export default function AdminUserManagement() {
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modal states
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'claims_adjuster' as 'claims_adjuster' | 'salvage_manager' | 'finance_officer',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  // Action modal states
  const [actionModal, setActionModal] = useState<ActionModalType>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (roleFilter !== 'all') params.append('role', roleFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/admin/users?${params.toString()}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [roleFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setSubmitError(null);
    setSubmitSuccess(null);
    setTemporaryPassword(null);

    // Client-side validation
    const errors: Record<string, string> = {};
    
    if (!formData.fullName || formData.fullName.length < 2) {
      errors.fullName = 'Full name must be at least 2 characters';
    }
    
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    
    if (!formData.phone || !/^\+?[0-9]{10,15}$/.test(formData.phone)) {
      errors.phone = 'Invalid phone number format (10-15 digits)';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.details) {
          const fieldErrors: Record<string, string> = {};
          data.details.forEach((detail: { field: string; message: string }) => {
            fieldErrors[detail.field] = detail.message;
          });
          setFormErrors(fieldErrors);
        }
        throw new Error(data.error || 'Failed to create user');
      }

      setSubmitSuccess(`User created successfully! Provisioning time: ${data.provisioningTime}`);
      setTemporaryPassword(data.temporaryPassword);
      
      // Reset form
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        role: 'claims_adjuster',
      });

      // Refresh user list
      fetchUsers();

      // Auto-close modal after 10 seconds
      setTimeout(() => {
        setShowAddUserModal(false);
        setSubmitSuccess(null);
        setTemporaryPassword(null);
      }, 10000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

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

  const handleAction = useCallback((action: ActionModalType, user: User) => {
    setSelectedUser(user);
    setActionModal(action);
    setOpenDropdownId(null);
  }, []);

  const closeActionModal = useCallback(() => {
    setActionModal(null);
    setSelectedUser(null);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
        <p className="text-gray-600">Manage staff accounts and view all system users</p>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <input
              type="text"
              id="search"
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-burgundy-500 focus:border-transparent"
            />
          </div>

          {/* Role Filter */}
          <div>
            <label htmlFor="roleFilter" className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <select
              id="roleFilter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-burgundy-500 focus:border-transparent"
            >
              <option value="all">All Roles</option>
              <option value="vendor">Vendor</option>
              <option value="claims_adjuster">Claims Adjuster</option>
              <option value="salvage_manager">Salvage Manager</option>
              <option value="finance_officer">Finance Officer</option>
              <option value="system_admin">System Admin</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-burgundy-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="unverified_tier_0">Unverified</option>
              <option value="phone_verified_tier_0">Phone Verified</option>
              <option value="verified_tier_1">Tier 1</option>
              <option value="verified_tier_2">Tier 2</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {/* Add User Button */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowAddUserModal(true)}
            className="px-6 py-2 bg-burgundy-600 text-white font-semibold rounded-lg hover:bg-burgundy-700 transition-colors"
          >
            + Add New User
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-burgundy-600"></div>
          <p className="mt-4 text-gray-600">Loading users...</p>
        </div>
      )}

      {/* Users Table */}
      {!loading && users.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
                      <div className="text-sm text-gray-500">{user.id.substring(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.email}</div>
                      <div className="text-sm text-gray-500">{user.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(user.role)}`}>
                        {getRoleDisplayName(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(user.status)}`}>
                        {getStatusDisplayName(user.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.lastLoginAt ? (
                        <>
                          <div>{new Date(user.lastLoginAt).toLocaleDateString()}</div>
                          <div className="text-xs">{user.loginDeviceType || 'Unknown'}</div>
                        </>
                      ) : (
                        <span className="text-gray-400">Never</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="relative inline-block text-left">
                        <button
                          onClick={() => setOpenDropdownId(openDropdownId === user.id ? null : user.id)}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-burgundy-500"
                        >
                          Actions
                          <svg className="ml-2 -mr-0.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>

                        {openDropdownId === user.id && (
                          <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                            <div className="py-1" role="menu">
                              <button
                                onClick={() => handleAction('view', user)}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                👁️ View Details
                              </button>
                              <button
                                onClick={() => handleAction('changeRole', user)}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                🔄 Change Role
                              </button>
                              <button
                                onClick={() => handleAction('resetPassword', user)}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                🔑 Reset Password
                              </button>
                              {user.status === 'suspended' ? (
                                <button
                                  onClick={() => handleAction('unsuspend', user)}
                                  className="block w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50"
                                >
                                  ✅ Unsuspend Account
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleAction('suspend', user)}
                                  className="block w-full text-left px-4 py-2 text-sm text-orange-700 hover:bg-orange-50"
                                >
                                  ⚠️ Suspend Account
                                </button>
                              )}
                              <button
                                onClick={() => handleAction('delete', user)}
                                className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                              >
                                🗑️ Delete User
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && users.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Get started by creating a new user'}
          </p>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Add New User</h2>
                <button
                  onClick={() => {
                    setShowAddUserModal(false);
                    setFormErrors({});
                    setSubmitError(null);
                    setSubmitSuccess(null);
                    setTemporaryPassword(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Success Message */}
              {submitSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
                  <p className="font-semibold">{submitSuccess}</p>
                  {temporaryPassword && (
                    <div className="mt-3 p-3 bg-white border border-green-300 rounded">
                      <p className="text-sm font-medium mb-1">Temporary Password:</p>
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">{temporaryPassword}</code>
                      <p className="text-xs mt-2 text-green-600">
                        ⚠️ Save this password! It has been emailed to the user.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {submitError}
                </div>
              )}

              <form onSubmit={handleAddUser}>
                {/* Full Name */}
                <div className="mb-4">
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-burgundy-500 focus:border-transparent ${
                      formErrors.fullName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="John Doe"
                  />
                  {formErrors.fullName && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.fullName}</p>
                  )}
                </div>

                {/* Email */}
                <div className="mb-4">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-burgundy-500 focus:border-transparent ${
                      formErrors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="john.doe@nem-insurance.com"
                  />
                  {formErrors.email && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                  )}
                </div>

                {/* Phone */}
                <div className="mb-4">
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-burgundy-500 focus:border-transparent ${
                      formErrors.phone ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="+2348012345678"
                  />
                  {formErrors.phone && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.phone}</p>
                  )}
                </div>

                {/* Role */}
                <div className="mb-6">
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                    Role *
                  </label>
                  <select
                    id="role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-burgundy-500 focus:border-transparent"
                  >
                    <option value="claims_adjuster">Claims Adjuster</option>
                    <option value="salvage_manager">Salvage Manager</option>
                    <option value="finance_officer">Finance Officer</option>
                  </select>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-800">
                    <strong>ℹ️ Note:</strong> A temporary password will be generated and emailed to the user. 
                    They will be required to change it on first login.
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddUserModal(false);
                      setFormErrors({});
                      setSubmitError(null);
                      setSubmitSuccess(null);
                      setTemporaryPassword(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-burgundy-600 text-white font-semibold rounded-lg hover:bg-burgundy-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={submitting}
                  >
                    {submitting ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Action Modal */}
      <ActionModal
        actionModal={actionModal}
        selectedUser={selectedUser}
        onClose={closeActionModal}
        onSuccess={fetchUsers}
      />
    </div>
  );
}
