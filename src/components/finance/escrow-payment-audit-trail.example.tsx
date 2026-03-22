/**
 * Example usage of EscrowPaymentAuditTrail component
 * 
 * This file demonstrates various use cases and states of the audit trail component.
 */

import { EscrowPaymentAuditTrail } from './escrow-payment-audit-trail';

// Example 1: Complete payment flow with automatic fund release
export function CompletePaymentFlowExample() {
  const auditLogs = [
    {
      id: 'log-1',
      actionType: 'payment_initiated',
      userId: 'user-123',
      userName: 'John Vendor',
      ipAddress: '192.168.1.1',
      deviceType: 'mobile' as const,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      afterState: {
        status: 'pending',
        escrowStatus: 'frozen',
        amount: 500000,
        walletConfirmed: true,
        frozenAmount: 500000,
      },
      createdAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 'log-2',
      actionType: 'document_signing_progress',
      userId: 'user-123',
      userName: 'John Vendor',
      ipAddress: '192.168.1.1',
      deviceType: 'mobile' as const,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      afterState: {
        auctionId: 'auction-123',
        vendorId: 'vendor-123',
        signedDocuments: 1,
        totalDocuments: 3,
        progress: 33,
        allSigned: false,
      },
      createdAt: '2024-01-15T10:10:00Z',
    },
    {
      id: 'log-3',
      actionType: 'document_signing_progress',
      userId: 'user-123',
      userName: 'John Vendor',
      ipAddress: '192.168.1.1',
      deviceType: 'mobile' as const,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      afterState: {
        auctionId: 'auction-123',
        vendorId: 'vendor-123',
        signedDocuments: 2,
        totalDocuments: 3,
        progress: 67,
        allSigned: false,
      },
      createdAt: '2024-01-15T10:15:00Z',
    },
    {
      id: 'log-4',
      actionType: 'document_signing_progress',
      userId: 'user-123',
      userName: 'John Vendor',
      ipAddress: '192.168.1.1',
      deviceType: 'mobile' as const,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      afterState: {
        auctionId: 'auction-123',
        vendorId: 'vendor-123',
        signedDocuments: 3,
        totalDocuments: 3,
        progress: 100,
        allSigned: true,
      },
      createdAt: '2024-01-15T10:20:00Z',
    },
    {
      id: 'log-5',
      actionType: 'funds_released',
      userId: 'user-123',
      userName: 'System',
      ipAddress: 'system',
      deviceType: 'desktop' as const,
      userAgent: 'document-service',
      afterState: {
        auctionId: 'auction-123',
        vendorId: 'vendor-123',
        amount: 500000,
        status: 'verified',
        escrowStatus: 'released',
        autoVerified: true,
        trigger: 'document_signing_completion',
        transferReference: 'TRANSFER_12345678_1234567890',
      },
      createdAt: '2024-01-15T10:21:00Z',
    },
    {
      id: 'log-6',
      actionType: 'pickup_confirmed_vendor',
      userId: 'user-123',
      userName: 'John Vendor',
      ipAddress: '192.168.1.1',
      deviceType: 'mobile' as const,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      afterState: {
        pickupConfirmedVendor: true,
        pickupConfirmedVendorAt: '2024-01-16T09:00:00Z',
        pickupAuthCode: 'AUTH-12345678',
        vendorId: 'vendor-123',
        vendorName: 'John Vendor',
      },
      createdAt: '2024-01-16T09:00:00Z',
    },
    {
      id: 'log-7',
      actionType: 'pickup_confirmed_admin',
      userId: 'admin-123',
      userName: 'Admin User',
      ipAddress: '192.168.1.2',
      deviceType: 'desktop' as const,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      afterState: {
        pickupConfirmedAdmin: true,
        pickupConfirmedAdminAt: '2024-01-16T09:30:00Z',
        pickupConfirmedAdminBy: 'admin-123',
        adminName: 'Admin User',
        caseStatus: 'sold',
        notes: 'Item collected in good condition',
      },
      createdAt: '2024-01-16T09:30:00Z',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Complete Payment Flow</h2>
      <EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />
    </div>
  );
}

// Example 2: Manual fund release by Finance Officer
export function ManualFundReleaseExample() {
  const auditLogs = [
    {
      id: 'log-1',
      actionType: 'payment_initiated',
      userId: 'user-123',
      userName: 'John Vendor',
      ipAddress: '192.168.1.1',
      deviceType: 'mobile' as const,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      afterState: {
        status: 'pending',
        escrowStatus: 'frozen',
        amount: 500000,
      },
      createdAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 'log-2',
      actionType: 'funds_released',
      userId: 'finance-officer-123',
      userName: 'Jane Finance Officer',
      ipAddress: '192.168.1.2',
      deviceType: 'desktop' as const,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      beforeState: {
        status: 'pending',
        escrowStatus: 'frozen',
      },
      afterState: {
        status: 'verified',
        escrowStatus: 'released',
        manualRelease: true,
        financeOfficerId: 'finance-officer-123',
        financeOfficerName: 'Jane Finance Officer',
        reason: 'Automatic release failed - manual intervention required',
        amount: 500000,
        transferReference: 'TRANSFER_12345678_1234567890',
      },
      createdAt: '2024-01-15T11:00:00Z',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Manual Fund Release</h2>
      <EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-456" />
    </div>
  );
}

// Example 3: Failed fund release (error highlighting)
export function FailedFundReleaseExample() {
  const auditLogs = [
    {
      id: 'log-1',
      actionType: 'payment_initiated',
      userId: 'user-123',
      userName: 'John Vendor',
      ipAddress: '192.168.1.1',
      deviceType: 'mobile' as const,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      afterState: {
        status: 'pending',
        escrowStatus: 'frozen',
        amount: 500000,
      },
      createdAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 'log-2',
      actionType: 'document_signing_progress',
      userId: 'user-123',
      userName: 'John Vendor',
      ipAddress: '192.168.1.1',
      deviceType: 'mobile' as const,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      afterState: {
        signedDocuments: 3,
        totalDocuments: 3,
        progress: 100,
        allSigned: true,
      },
      createdAt: '2024-01-15T10:20:00Z',
    },
    {
      id: 'log-3',
      actionType: 'funds_released',
      userId: 'system',
      userName: 'System',
      ipAddress: 'system',
      deviceType: 'desktop' as const,
      userAgent: 'document-service',
      afterState: {
        status: 'pending',
        escrowStatus: 'failed',
        error: 'Paystack transfer timeout - connection error',
        amount: 500000,
      },
      createdAt: '2024-01-15T10:21:00Z',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Failed Fund Release (Error Highlighted)</h2>
      <EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-789" />
    </div>
  );
}

// Example 4: Empty state (no audit logs)
export function EmptyStateExample() {
  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Empty State</h2>
      <EscrowPaymentAuditTrail auditLogs={[]} paymentId="payment-empty" />
    </div>
  );
}

// Example 5: Multiple device types
export function MultipleDeviceTypesExample() {
  const auditLogs = [
    {
      id: 'log-1',
      actionType: 'payment_initiated',
      userId: 'user-123',
      userName: 'John Vendor',
      ipAddress: '192.168.1.1',
      deviceType: 'mobile' as const,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      afterState: {
        status: 'pending',
      },
      createdAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 'log-2',
      actionType: 'document_signed',
      userId: 'user-123',
      userName: 'John Vendor',
      ipAddress: '192.168.1.2',
      deviceType: 'tablet' as const,
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
      afterState: {
        documentType: 'bill_of_sale',
      },
      createdAt: '2024-01-15T10:10:00Z',
    },
    {
      id: 'log-3',
      actionType: 'funds_released',
      userId: 'finance-officer-123',
      userName: 'Jane Finance Officer',
      ipAddress: '192.168.1.3',
      deviceType: 'desktop' as const,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      afterState: {
        status: 'verified',
        manualRelease: true,
      },
      createdAt: '2024-01-15T11:00:00Z',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Multiple Device Types</h2>
      <EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-multi" />
    </div>
  );
}
