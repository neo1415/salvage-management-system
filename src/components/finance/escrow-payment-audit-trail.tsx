/**
 * Escrow Payment Audit Trail Component
 * 
 * Displays timeline of events for escrow wallet payments with timestamps, users, IP addresses.
 * Highlights errors in red for easy identification.
 * 
 * Requirements: Escrow Wallet Payment Completion - Requirement 6
 * Task 7.2: Create escrow payment audit trail view
 * 
 * Features:
 * - Timeline view of all payment events
 * - Display timestamps, user info, IP addresses
 * - Highlight errors in red
 * - Responsive design (mobile-first)
 * - Accessibility support (ARIA labels, semantic HTML)
 */

'use client';

import { formatDistanceToNow } from 'date-fns';

interface AuditLogEntry {
  id: string;
  actionType: string;
  userId: string;
  userName?: string;
  ipAddress: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
  userAgent: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  createdAt: string;
}

interface EscrowPaymentAuditTrailProps {
  auditLogs: AuditLogEntry[];
  paymentId: string;
}

export function EscrowPaymentAuditTrail({
  auditLogs,
  paymentId,
}: EscrowPaymentAuditTrailProps) {
  // Sort logs by createdAt descending (most recent first)
  const sortedLogs = [...auditLogs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const getActionLabel = (actionType: string): string => {
    const labels: Record<string, string> = {
      payment_initiated: 'Payment Initiated',
      wallet_funded: 'Wallet Funded',
      funds_frozen: 'Funds Frozen',
      funds_released: 'Funds Released',
      funds_unfrozen: 'Funds Unfrozen',
      document_signing_progress: 'Document Signing Progress',
      document_signed: 'Document Signed',
      payment_verified: 'Payment Verified',
      payment_auto_verified: 'Payment Auto-Verified',
      pickup_confirmed_vendor: 'Pickup Confirmed by Vendor',
      pickup_confirmed_admin: 'Pickup Confirmed by Admin',
    };
    return labels[actionType] || actionType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const isErrorEvent = (log: AuditLogEntry): boolean => {
    // Check if afterState contains error indicators
    if (log.afterState) {
      if (log.afterState.escrowStatus === 'failed') return true;
      if (log.afterState.status === 'rejected') return true;
      if (log.afterState.error) return true;
      if (log.actionType.includes('failed')) return true;
    }
    return false;
  };

  const getEventIcon = (log: AuditLogEntry): string => {
    if (isErrorEvent(log)) return '✗';
    
    const icons: Record<string, string> = {
      payment_initiated: '💳',
      wallet_funded: '💰',
      funds_frozen: '🔒',
      funds_released: '✓',
      funds_unfrozen: '🔓',
      document_signing_progress: '📝',
      document_signed: '✓',
      payment_verified: '✓',
      payment_auto_verified: '✓',
      pickup_confirmed_vendor: '📦',
      pickup_confirmed_admin: '✓',
    };
    return icons[log.actionType] || '•';
  };

  const getDeviceIcon = (deviceType: string): string => {
    const icons: Record<string, string> = {
      mobile: '📱',
      desktop: '💻',
      tablet: '📱',
    };
    return icons[deviceType] || '💻';
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getEventDetails = (log: AuditLogEntry): string | null => {
    if (!log.afterState) return null;

    const details: string[] = [];

    // Document signing progress
    if (log.actionType === 'document_signing_progress' && log.afterState.signedDocuments !== undefined) {
      details.push(`${log.afterState.signedDocuments}/${log.afterState.totalDocuments} documents signed`);
    }

    // Fund release details
    if (log.actionType === 'funds_released') {
      if (log.afterState.amount) {
        details.push(`Amount: ₦${Number(log.afterState.amount).toLocaleString()}`);
      }
      if (log.afterState.autoVerified) {
        details.push('Automatic release');
      } else if (log.afterState.manualRelease) {
        details.push('Manual release');
        if (log.afterState.reason) {
          details.push(`Reason: ${log.afterState.reason}`);
        }
      }
      if (log.afterState.transferReference) {
        details.push(`Ref: ${log.afterState.transferReference}`);
      }
    }

    // Error details
    if (log.afterState.error) {
      details.push(`Error: ${log.afterState.error}`);
    }

    // Pickup confirmation details
    if (log.actionType === 'pickup_confirmed_vendor' && log.afterState.pickupAuthCode) {
      details.push(`Code: ${log.afterState.pickupAuthCode}`);
    }

    if (log.actionType === 'pickup_confirmed_admin' && log.afterState.notes) {
      details.push(`Notes: ${log.afterState.notes}`);
    }

    return details.length > 0 ? details.join(' • ') : null;
  };

  if (sortedLogs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6" role="region" aria-label="Audit trail">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Audit Trail</h3>
        <p className="text-sm text-gray-600">No audit logs available for this payment.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6" role="region" aria-label="Audit trail">
      <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Audit Trail</h3>
      
      <div className="space-y-4" role="list" aria-label="Timeline of events">
        {sortedLogs.map((log, index) => {
          const isError = isErrorEvent(log);
          const eventDetails = getEventDetails(log);
          
          return (
            <div
              key={log.id}
              className={`relative pl-8 pb-4 ${index !== sortedLogs.length - 1 ? 'border-l-2 border-gray-200' : ''}`}
              role="listitem"
              data-testid={`audit-log-${log.id}`}
            >
              {/* Timeline Icon */}
              <div
                className={`absolute left-0 top-0 -ml-2 w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  isError
                    ? 'bg-red-100 text-red-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
                aria-label={isError ? 'Error event' : 'Normal event'}
              >
                {getEventIcon(log)}
              </div>

              {/* Event Content */}
              <div className={`ml-4 ${isError ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'} rounded-lg p-3`}>
                {/* Event Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <h4 className={`text-sm sm:text-base font-semibold ${isError ? 'text-red-900' : 'text-gray-900'}`}>
                    {getActionLabel(log.actionType)}
                  </h4>
                  <span className="text-xs text-gray-600" title={formatTimestamp(log.createdAt)}>
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                  </span>
                </div>

                {/* Event Details */}
                {eventDetails && (
                  <p className="text-xs sm:text-sm text-gray-700 mb-2">{eventDetails}</p>
                )}

                {/* User and Device Info */}
                <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                  {log.userName && (
                    <span className="flex items-center gap-1">
                      <span className="font-medium">User:</span>
                      <span data-testid={`user-name-${log.id}`}>{log.userName}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <span className="font-medium">IP:</span>
                    <span className="font-mono" data-testid={`ip-address-${log.id}`}>{log.ipAddress}</span>
                  </span>
                  <span className="flex items-center gap-1" title={log.userAgent}>
                    <span>{getDeviceIcon(log.deviceType)}</span>
                    <span className="capitalize" data-testid={`device-type-${log.id}`}>{log.deviceType}</span>
                  </span>
                </div>

                {/* Timestamp (full) */}
                <div className="mt-2 text-xs text-gray-500">
                  {formatTimestamp(log.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
