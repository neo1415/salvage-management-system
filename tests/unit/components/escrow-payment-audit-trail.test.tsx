/**
 * Unit Tests for EscrowPaymentAuditTrail Component
 * 
 * Tests the audit trail component for escrow wallet payments.
 * 
 * Task 7.2.5: Write unit tests for component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EscrowPaymentAuditTrail } from '@/components/finance/escrow-payment-audit-trail';

describe('EscrowPaymentAuditTrail Component', () => {
  describe('7.2.1 Build EscrowPaymentAuditTrail component', () => {
    it('should render component with audit logs', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'payment_initiated',
          userId: 'user-123',
          userName: 'John Vendor',
          ipAddress: '192.168.1.1',
          deviceType: 'mobile' as const,
          userAgent: 'Mozilla/5.0',
          afterState: {
            status: 'pending',
            amount: 500000,
          },
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      expect(screen.getByRole('region', { name: /audit trail/i })).toBeInTheDocument();
      expect(screen.getByText('Audit Trail')).toBeInTheDocument();
    });

    it('should render empty state when no audit logs', () => {
      render(<EscrowPaymentAuditTrail auditLogs={[]} paymentId="payment-123" />);

      expect(screen.getByText('No audit logs available for this payment.')).toBeInTheDocument();
    });

    it('should render multiple audit log entries', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'payment_initiated',
          userId: 'user-123',
          userName: 'John Vendor',
          ipAddress: '192.168.1.1',
          deviceType: 'mobile' as const,
          userAgent: 'Mozilla/5.0',
          createdAt: '2024-01-15T10:00:00Z',
        },
        {
          id: 'log-2',
          actionType: 'funds_released',
          userId: 'user-123',
          userName: 'John Vendor',
          ipAddress: '192.168.1.1',
          deviceType: 'mobile' as const,
          userAgent: 'Mozilla/5.0',
          createdAt: '2024-01-15T10:30:00Z',
        },
      ];

      render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      expect(screen.getByTestId('audit-log-log-1')).toBeInTheDocument();
      expect(screen.getByTestId('audit-log-log-2')).toBeInTheDocument();
    });
  });

  describe('7.2.2 Display timeline of events', () => {
    it('should display events in chronological order (most recent first)', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'payment_initiated',
          userId: 'user-123',
          userName: 'John Vendor',
          ipAddress: '192.168.1.1',
          deviceType: 'mobile' as const,
          userAgent: 'Mozilla/5.0',
          createdAt: '2024-01-15T10:00:00Z',
        },
        {
          id: 'log-2',
          actionType: 'funds_released',
          userId: 'user-123',
          userName: 'John Vendor',
          ipAddress: '192.168.1.1',
          deviceType: 'mobile' as const,
          userAgent: 'Mozilla/5.0',
          createdAt: '2024-01-15T10:30:00Z',
        },
      ];

      const { container } = render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      const logEntries = container.querySelectorAll('[data-testid^="audit-log-"]');
      expect(logEntries).toHaveLength(2);
      
      // Most recent first (log-2 before log-1)
      expect(logEntries[0]).toHaveAttribute('data-testid', 'audit-log-log-2');
      expect(logEntries[1]).toHaveAttribute('data-testid', 'audit-log-log-1');
    });

    it('should display action labels correctly', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'payment_initiated',
          userId: 'user-123',
          userName: 'John Vendor',
          ipAddress: '192.168.1.1',
          deviceType: 'mobile' as const,
          userAgent: 'Mozilla/5.0',
          createdAt: '2024-01-15T10:00:00Z',
        },
        {
          id: 'log-2',
          actionType: 'funds_released',
          userId: 'user-123',
          userName: 'John Vendor',
          ipAddress: '192.168.1.1',
          deviceType: 'mobile' as const,
          userAgent: 'Mozilla/5.0',
          createdAt: '2024-01-15T10:30:00Z',
        },
      ];

      render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      expect(screen.getByText('Payment Initiated')).toBeInTheDocument();
      expect(screen.getByText('Funds Released')).toBeInTheDocument();
    });

    it('should display relative timestamps', () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'payment_initiated',
          userId: 'user-123',
          userName: 'John Vendor',
          ipAddress: '192.168.1.1',
          deviceType: 'mobile' as const,
          userAgent: 'Mozilla/5.0',
          createdAt: fiveMinutesAgo.toISOString(),
        },
      ];

      render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      // Should show relative time like "5 minutes ago"
      expect(screen.getByText(/minutes ago/i)).toBeInTheDocument();
    });
  });

  describe('7.2.3 Show timestamps, users, IP addresses', () => {
    it('should display user name', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'payment_initiated',
          userId: 'user-123',
          userName: 'John Vendor',
          ipAddress: '192.168.1.1',
          deviceType: 'mobile' as const,
          userAgent: 'Mozilla/5.0',
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      expect(screen.getByTestId('user-name-log-1')).toHaveTextContent('John Vendor');
    });

    it('should display IP address', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'payment_initiated',
          userId: 'user-123',
          userName: 'John Vendor',
          ipAddress: '192.168.1.1',
          deviceType: 'mobile' as const,
          userAgent: 'Mozilla/5.0',
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      expect(screen.getByTestId('ip-address-log-1')).toHaveTextContent('192.168.1.1');
    });

    it('should display device type', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'payment_initiated',
          userId: 'user-123',
          userName: 'John Vendor',
          ipAddress: '192.168.1.1',
          deviceType: 'mobile' as const,
          userAgent: 'Mozilla/5.0',
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      expect(screen.getByTestId('device-type-log-1')).toHaveTextContent('mobile');
    });

    it('should display full timestamp', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'payment_initiated',
          userId: 'user-123',
          userName: 'John Vendor',
          ipAddress: '192.168.1.1',
          deviceType: 'mobile' as const,
          userAgent: 'Mozilla/5.0',
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      // Should display formatted timestamp like "Jan 15, 2024, 10:00:00 AM"
      expect(screen.getByText(/Jan 15, 2024/i)).toBeInTheDocument();
    });

    it('should handle missing user name gracefully', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'payment_initiated',
          userId: 'user-123',
          ipAddress: '192.168.1.1',
          deviceType: 'mobile' as const,
          userAgent: 'Mozilla/5.0',
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      // Should not display user name section if userName is missing
      expect(screen.queryByText('User:')).not.toBeInTheDocument();
    });
  });

  describe('7.2.4 Highlight errors in red', () => {
    it('should highlight failed escrow status in red', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'funds_released',
          userId: 'user-123',
          userName: 'System',
          ipAddress: 'system',
          deviceType: 'desktop' as const,
          userAgent: 'document-service',
          afterState: {
            escrowStatus: 'failed',
            error: 'Paystack transfer timeout',
          },
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      const { container } = render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      const logEntry = container.querySelector('[data-testid="audit-log-log-1"]');
      const eventCard = logEntry?.querySelector('.bg-red-50');
      expect(eventCard).toBeInTheDocument();
    });

    it('should highlight rejected payment status in red', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'payment_verified',
          userId: 'user-123',
          userName: 'Finance Officer',
          ipAddress: '192.168.1.1',
          deviceType: 'desktop' as const,
          userAgent: 'Mozilla/5.0',
          afterState: {
            status: 'rejected',
          },
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      const { container } = render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      const logEntry = container.querySelector('[data-testid="audit-log-log-1"]');
      const eventCard = logEntry?.querySelector('.bg-red-50');
      expect(eventCard).toBeInTheDocument();
    });

    it('should highlight events with error field in red', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'funds_released',
          userId: 'user-123',
          userName: 'System',
          ipAddress: 'system',
          deviceType: 'desktop' as const,
          userAgent: 'document-service',
          afterState: {
            error: 'Connection timeout',
          },
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      const { container } = render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      const logEntry = container.querySelector('[data-testid="audit-log-log-1"]');
      const eventCard = logEntry?.querySelector('.bg-red-50');
      expect(eventCard).toBeInTheDocument();
    });

    it('should display error message from afterState', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'funds_released',
          userId: 'user-123',
          userName: 'System',
          ipAddress: 'system',
          deviceType: 'desktop' as const,
          userAgent: 'document-service',
          afterState: {
            error: 'Paystack transfer timeout - connection error',
          },
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      expect(screen.getByText(/Error: Paystack transfer timeout - connection error/i)).toBeInTheDocument();
    });

    it('should not highlight normal events in red', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'payment_initiated',
          userId: 'user-123',
          userName: 'John Vendor',
          ipAddress: '192.168.1.1',
          deviceType: 'mobile' as const,
          userAgent: 'Mozilla/5.0',
          afterState: {
            status: 'pending',
          },
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      const { container } = render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      const logEntry = container.querySelector('[data-testid="audit-log-log-1"]');
      const eventCard = logEntry?.querySelector('.bg-red-50');
      expect(eventCard).not.toBeInTheDocument();
      
      // Should have normal styling
      const normalCard = logEntry?.querySelector('.bg-gray-50');
      expect(normalCard).toBeInTheDocument();
    });
  });

  describe('Event Details Display', () => {
    it('should display document signing progress details', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'document_signing_progress',
          userId: 'user-123',
          userName: 'John Vendor',
          ipAddress: '192.168.1.1',
          deviceType: 'mobile' as const,
          userAgent: 'Mozilla/5.0',
          afterState: {
            signedDocuments: 2,
            totalDocuments: 3,
            progress: 67,
          },
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      expect(screen.getByText(/2\/3 documents signed/i)).toBeInTheDocument();
    });

    it('should display fund release amount', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'funds_released',
          userId: 'user-123',
          userName: 'System',
          ipAddress: 'system',
          deviceType: 'desktop' as const,
          userAgent: 'document-service',
          afterState: {
            amount: 500000,
            autoVerified: true,
          },
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      expect(screen.getByText(/Amount: ₦500,000/i)).toBeInTheDocument();
    });

    it('should display automatic release indicator', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'funds_released',
          userId: 'user-123',
          userName: 'System',
          ipAddress: 'system',
          deviceType: 'desktop' as const,
          userAgent: 'document-service',
          afterState: {
            autoVerified: true,
          },
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      expect(screen.getByText(/Automatic release/i)).toBeInTheDocument();
    });

    it('should display manual release indicator and reason', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'funds_released',
          userId: 'finance-officer-123',
          userName: 'Jane Finance Officer',
          ipAddress: '192.168.1.1',
          deviceType: 'desktop' as const,
          userAgent: 'Mozilla/5.0',
          afterState: {
            manualRelease: true,
            reason: 'Automatic release failed - manual intervention required',
          },
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      expect(screen.getByText(/Manual release/i)).toBeInTheDocument();
      expect(screen.getByText(/Reason: Automatic release failed - manual intervention required/i)).toBeInTheDocument();
    });

    it('should display transfer reference', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'funds_released',
          userId: 'user-123',
          userName: 'System',
          ipAddress: 'system',
          deviceType: 'desktop' as const,
          userAgent: 'document-service',
          afterState: {
            transferReference: 'TRANSFER_12345678_1234567890',
          },
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      expect(screen.getByText(/Ref: TRANSFER_12345678_1234567890/i)).toBeInTheDocument();
    });

    it('should display pickup authorization code', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'pickup_confirmed_vendor',
          userId: 'user-123',
          userName: 'John Vendor',
          ipAddress: '192.168.1.1',
          deviceType: 'mobile' as const,
          userAgent: 'Mozilla/5.0',
          afterState: {
            pickupAuthCode: 'AUTH-12345678',
          },
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      expect(screen.getByText(/Code: AUTH-12345678/i)).toBeInTheDocument();
    });

    it('should display admin pickup notes', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'pickup_confirmed_admin',
          userId: 'admin-123',
          userName: 'Admin User',
          ipAddress: '192.168.1.1',
          deviceType: 'desktop' as const,
          userAgent: 'Mozilla/5.0',
          afterState: {
            notes: 'Item collected in good condition',
          },
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      expect(screen.getByText(/Notes: Item collected in good condition/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'payment_initiated',
          userId: 'user-123',
          userName: 'John Vendor',
          ipAddress: '192.168.1.1',
          deviceType: 'mobile' as const,
          userAgent: 'Mozilla/5.0',
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      expect(screen.getByRole('region', { name: /audit trail/i })).toBeInTheDocument();
      expect(screen.getByRole('list', { name: /timeline of events/i })).toBeInTheDocument();
    });

    it('should mark error events with proper ARIA label', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'funds_released',
          userId: 'user-123',
          userName: 'System',
          ipAddress: 'system',
          deviceType: 'desktop' as const,
          userAgent: 'document-service',
          afterState: {
            escrowStatus: 'failed',
          },
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      expect(screen.getByLabelText('Error event')).toBeInTheDocument();
    });

    it('should mark normal events with proper ARIA label', () => {
      const auditLogs = [
        {
          id: 'log-1',
          actionType: 'payment_initiated',
          userId: 'user-123',
          userName: 'John Vendor',
          ipAddress: '192.168.1.1',
          deviceType: 'mobile' as const,
          userAgent: 'Mozilla/5.0',
          createdAt: '2024-01-15T10:00:00Z',
        },
      ];

      render(<EscrowPaymentAuditTrail auditLogs={auditLogs} paymentId="payment-123" />);

      expect(screen.getByLabelText('Normal event')).toBeInTheDocument();
    });
  });
});
