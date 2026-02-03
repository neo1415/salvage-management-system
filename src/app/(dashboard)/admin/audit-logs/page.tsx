/**
 * Admin Audit Log Viewer UI
 * Displays comprehensive audit logs with filtering and export capabilities
 * 
 * Requirements:
 * - Requirement 11: Comprehensive Activity Logging
 * - NFR5.3: User Experience
 * - Enterprise Standards Section 6.4: Audit Logging
 */

'use client';

import { useEffect, useState } from 'react';

interface AuditLog {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userRole: string | null;
  actionType: string;
  entityType: string;
  entityId: string;
  ipAddress: string;
  deviceType: string;
  userAgent: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  
  // Filter states
  const [userIdFilter, setUserIdFilter] = useState<string>('');
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageLimit, setPageLimit] = useState<number>(50);
  
  // Detail modal state
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Export state
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [userIdFilter, actionTypeFilter, entityTypeFilter, startDate, endDate, currentPage, pageLimit]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (userIdFilter) params.append('userId', userIdFilter);
      if (actionTypeFilter !== 'all') params.append('actionType', actionTypeFilter);
      if (entityTypeFilter !== 'all') params.append('entityType', entityTypeFilter);
      if (startDate) params.append('startDate', new Date(startDate).toISOString());
      if (endDate) params.append('endDate', new Date(endDate).toISOString());
      params.append('page', currentPage.toString());
      params.append('limit', pageLimit.toString());

      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch audit logs');
      }

      const data = await response.json();
      setLogs(data.logs || []);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      setExporting(true);

      const params = new URLSearchParams();
      if (userIdFilter) params.append('userId', userIdFilter);
      if (actionTypeFilter !== 'all') params.append('actionType', actionTypeFilter);
      if (entityTypeFilter !== 'all') params.append('entityType', entityTypeFilter);
      if (startDate) params.append('startDate', new Date(startDate).toISOString());
      if (endDate) params.append('endDate', new Date(endDate).toISOString());
      params.append('export', format);

      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to export audit logs');
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xls'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to export audit logs');
    } finally {
      setExporting(false);
    }
  };

  const handleResetFilters = () => {
    setUserIdFilter('');
    setActionTypeFilter('all');
    setEntityTypeFilter('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Africa/Lagos',
    });
  };

  const getActionTypeColor = (actionType: string): string => {
    if (actionType.includes('login') || actionType.includes('auth')) {
      return 'bg-blue-100 text-blue-800';
    }
    if (actionType.includes('create') || actionType.includes('register')) {
      return 'bg-green-100 text-green-800';
    }
    if (actionType.includes('update') || actionType.includes('edit')) {
      return 'bg-yellow-100 text-yellow-800';
    }
    if (actionType.includes('delete') || actionType.includes('suspend')) {
      return 'bg-red-100 text-red-800';
    }
    if (actionType.includes('approve') || actionType.includes('verify')) {
      return 'bg-purple-100 text-purple-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const getDeviceTypeIcon = (deviceType: string): string => {
    switch (deviceType) {
      case 'mobile':
        return '📱';
      case 'tablet':
        return '📱';
      case 'desktop':
        return '💻';
      default:
        return '🖥️';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Audit Log Viewer</h1>
        <p className="text-gray-600">
          Comprehensive activity logging for security and compliance (NDPR)
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {/* User ID Filter */}
          <div>
            <label htmlFor="userIdFilter" className="block text-sm font-medium text-gray-700 mb-2">
              User ID
            </label>
            <input
              type="text"
              id="userIdFilter"
              placeholder="Enter user ID..."
              value={userIdFilter}
              onChange={(e) => {
                setUserIdFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-burgundy-500 focus:border-transparent"
            />
          </div>

          {/* Action Type Filter */}
          <div>
            <label htmlFor="actionTypeFilter" className="block text-sm font-medium text-gray-700 mb-2">
              Action Type
            </label>
            <select
              id="actionTypeFilter"
              value={actionTypeFilter}
              onChange={(e) => {
                setActionTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-burgundy-500 focus:border-transparent"
            >
              <option value="all">All Actions</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="register">Register</option>
              <option value="otp_verification">OTP Verification</option>
              <option value="bvn_verification">BVN Verification</option>
              <option value="case_created">Case Created</option>
              <option value="case_approved">Case Approved</option>
              <option value="bid_placed">Bid Placed</option>
              <option value="payment_initiated">Payment Initiated</option>
              <option value="payment_verified">Payment Verified</option>
              <option value="user_created">User Created</option>
              <option value="user_suspended">User Suspended</option>
            </select>
          </div>

          {/* Entity Type Filter */}
          <div>
            <label htmlFor="entityTypeFilter" className="block text-sm font-medium text-gray-700 mb-2">
              Entity Type
            </label>
            <select
              id="entityTypeFilter"
              value={entityTypeFilter}
              onChange={(e) => {
                setEntityTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-burgundy-500 focus:border-transparent"
            >
              <option value="all">All Entities</option>
              <option value="user">User</option>
              <option value="vendor">Vendor</option>
              <option value="case">Case</option>
              <option value="auction">Auction</option>
              <option value="bid">Bid</option>
              <option value="payment">Payment</option>
              <option value="session">Session</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-burgundy-500 focus:border-transparent"
            />
          </div>

          {/* End Date */}
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-burgundy-500 focus:border-transparent"
            />
          </div>

          {/* Page Limit */}
          <div>
            <label htmlFor="pageLimit" className="block text-sm font-medium text-gray-700 mb-2">
              Items per page
            </label>
            <select
              id="pageLimit"
              value={pageLimit}
              onChange={(e) => {
                setPageLimit(parseInt(e.target.value, 10));
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-burgundy-500 focus:border-transparent"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reset Filters
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting || logs.length === 0}
            className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? 'Exporting...' : '📥 Export CSV'}
          </button>
          <button
            onClick={() => handleExport('excel')}
            disabled={exporting || logs.length === 0}
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? 'Exporting...' : '📊 Export Excel'}
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
          <p className="mt-4 text-gray-600">Loading audit logs...</p>
        </div>
      )}

      {/* Audit Logs Table */}
      {!loading && logs.length > 0 && (
        <>
          {/* Summary */}
          {pagination && (
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <p className="text-sm text-gray-600">
                Showing <span className="font-semibold">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
                <span className="font-semibold">
                  {Math.min(pagination.page * pagination.limit, pagination.totalCount)}
                </span>{' '}
                of <span className="font-semibold">{pagination.totalCount}</span> audit logs
              </p>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Device Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTimestamp(log.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {log.userName || 'Unknown User'}
                        </div>
                        <div className="text-sm text-gray-500">{log.userEmail || log.userId.substring(0, 8) + '...'}</div>
                        {log.userRole && (
                          <div className="text-xs text-gray-400 mt-1">{log.userRole}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionTypeColor(log.actionType)}`}>
                          {log.actionType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{log.entityType}</div>
                        <div className="text-xs text-gray-500">{log.entityId.substring(0, 12)}...</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.ipAddress}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          {getDeviceTypeIcon(log.deviceType)}
                          {log.deviceType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => {
                            setSelectedLog(log);
                            setShowDetailModal(true);
                          }}
                          className="text-burgundy-600 hover:text-burgundy-900 font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="bg-white rounded-lg shadow-sm p-4 mt-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={!pagination.hasPreviousPage}
                  className="px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                </div>
                
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={!pagination.hasNextPage}
                  className="px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!loading && logs.length === 0 && (
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No audit logs found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {userIdFilter || actionTypeFilter !== 'all' || entityTypeFilter !== 'all' || startDate || endDate
              ? 'Try adjusting your filters'
              : 'No audit logs have been recorded yet'}
          </p>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Audit Log Details</h2>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedLog(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Timestamp</label>
                    <p className="text-sm text-gray-900">{formatTimestamp(selectedLog.createdAt)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Log ID</label>
                    <p className="text-sm text-gray-900 font-mono">{selectedLog.id}</p>
                  </div>
                </div>

                {/* User Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-900">{selectedLog.userName || 'Unknown User'}</p>
                    <p className="text-sm text-gray-600">{selectedLog.userEmail || 'No email'}</p>
                    <p className="text-xs text-gray-500 mt-1">ID: {selectedLog.userId}</p>
                    {selectedLog.userRole && (
                      <p className="text-xs text-gray-500">Role: {selectedLog.userRole}</p>
                    )}
                  </div>
                </div>

                {/* Action Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Action Type</label>
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionTypeColor(selectedLog.actionType)}`}>
                      {selectedLog.actionType}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Entity</label>
                    <p className="text-sm text-gray-900">{selectedLog.entityType}</p>
                    <p className="text-xs text-gray-500 font-mono">{selectedLog.entityId}</p>
                  </div>
                </div>

                {/* Network Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">IP Address</label>
                    <p className="text-sm text-gray-900 font-mono">{selectedLog.ipAddress}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Device Type</label>
                    <p className="text-sm text-gray-900">
                      {getDeviceTypeIcon(selectedLog.deviceType)} {selectedLog.deviceType}
                    </p>
                  </div>
                </div>

                {/* User Agent */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">User Agent</label>
                  <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 font-mono break-all">
                    {selectedLog.userAgent}
                  </p>
                </div>

                {/* State Changes */}
                {(selectedLog.beforeState || selectedLog.afterState) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">State Changes</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedLog.beforeState && (
                        <div>
                          <p className="text-xs font-medium text-gray-600 mb-1">Before</p>
                          <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-auto max-h-48">
                            {JSON.stringify(selectedLog.beforeState, null, 2)}
                          </pre>
                        </div>
                      )}
                      {selectedLog.afterState && (
                        <div>
                          <p className="text-xs font-medium text-gray-600 mb-1">After</p>
                          <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-auto max-h-48">
                            {JSON.stringify(selectedLog.afterState, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div className="mt-6">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedLog(null);
                  }}
                  className="w-full px-4 py-2 bg-burgundy-600 text-white font-semibold rounded-lg hover:bg-burgundy-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
