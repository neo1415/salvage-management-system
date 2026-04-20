'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { EscrowPaymentDetails } from '@/components/finance/escrow-payment-details';
import { EscrowPaymentAuditTrail } from '@/components/finance/escrow-payment-audit-trail';
import { ClipboardList, Star } from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import { OfflineAwareButton } from '@/components/ui/offline-aware-button';

const SuccessModal = dynamic(
  () => import('@/components/modals/success-modal').then(mod => ({ default: mod.SuccessModal })),
  { ssr: false }
);

const ErrorModal = dynamic(
  () => import('@/components/modals/error-modal').then(mod => ({ default: mod.ErrorModal })),
  { ssr: false }
);

interface Payment {
  id: string;
  auctionId: string | null; // Can be null for registration fees
  auctionStatus: string | null; // Can be null for registration fees
  vendorId: string;
  amount: string;
  paymentMethod: 'paystack' | 'flutterwave' | 'bank_transfer' | 'escrow_wallet';
  paymentReference: string | null;
  paymentProofUrl: string | null;
  status: 'pending' | 'verified' | 'rejected' | 'overdue';
  autoVerified: boolean;
  paymentDeadline: string;
  createdAt: string;
  escrowStatus?: 'frozen' | 'released' | 'failed' | null;
  paymentType: 'auction' | 'registration_fee'; // NEW: Payment type
  walletBalance?: {
    availableBalance: number;
    frozenAmount: number;
  };
  documentProgress?: {
    signedDocuments: number;
    totalDocuments: number;
    progress: number;
    allSigned: boolean;
  };
  vendor: {
    id: string;
    businessName: string | null;
    contactPersonName: string | null;
    phoneNumber: string | null;
    email: string | null;
    profilePictureUrl?: string | null;
    kycTier: 'tier1' | 'tier2' | null;
    kycStatus: 'pending' | 'approved' | 'rejected' | null;
    bankAccountNumber: string | null;
    bankName: string | null;
    bankAccountName: string | null;
  };
  case: {
    claimReference: string;
    assetType: string;
    assetDetails: Record<string, unknown>;
  } | null; // Can be null for registration fees
}

interface PaymentStats {
  total: number;
  autoVerified: number;
  pendingManual: number;
  overdue: number;
  registrationFees: {
    count: number;
    total: number;
  };
}

type ViewTab = 'all' | 'today' | 'pending' | 'overdue';

export default function FinancePaymentsPage() {
  const { data: session } = useSession();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats>({
    total: 0,
    autoVerified: 0,
    pendingManual: 0,
    overdue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Success/Error modal states
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState<string | undefined>();
  
  // Audit trail states
  const [auditLogs, setAuditLogs] = useState<Array<{
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
  }>>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

  // Filter states
  const [activeTab, setActiveTab] = useState<ViewTab>('all');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [methodFilter, setMethodFilter] = useState<string>('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>(''); // NEW: Payment type filter
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Export states
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchPayments = useCallback(async () => {
    try {
      // Use different loading state for initial load vs filtering
      if (payments.length === 0) {
        setLoading(true);
      } else {
        setIsFiltering(true);
      }
      setError(null);

      // Build query parameters
      const params = new URLSearchParams();
      params.append('view', activeTab);
      if (statusFilter) params.append('status', statusFilter);
      if (methodFilter) params.append('paymentMethod', methodFilter);
      if (paymentTypeFilter) params.append('paymentType', paymentTypeFilter); // NEW: Payment type filter
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const response = await fetch(`/api/finance/payments?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch payments');
      }

      const data = await response.json();
      
      // Debug logging for Paystack payments
      const paystackPayments = (data.payments || []).filter((p: Payment) => p.paymentMethod === 'paystack');
      if (paystackPayments.length > 0) {
        console.log('🔍 Client: Received Paystack payments from API:');
        paystackPayments.forEach((p: Payment) => {
          console.log(`   - ${p.paymentReference}`);
          console.log(`     Status: ${p.status}, Auction Status: ${p.auctionStatus || 'MISSING!'}`);
          console.log(`     Should hide buttons: ${p.status === 'pending' && p.auctionStatus === 'awaiting_payment'}`);
        });
      }
      
      setPayments(data.payments || []);
      setStats(data.stats || {
        total: 0,
        autoVerified: 0,
        pendingManual: 0,
        overdue: 0,
        registrationFees: {
          count: 0,
          total: 0,
        },
      });
    } catch (err) {
      console.error('Error fetching payments:', err);
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
      setIsFiltering(false);
    }
  }, [activeTab, statusFilter, methodFilter, dateFrom, dateTo, payments.length]);

  useEffect(() => {
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, statusFilter, methodFilter, paymentTypeFilter, dateFrom, dateTo]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showExportMenu && !target.closest('.relative')) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showExportMenu]);

  const clearFilters = () => {
    setActiveTab('all');
    setStatusFilter('');
    setMethodFilter('');
    setPaymentTypeFilter(''); // NEW: Clear payment type filter
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = statusFilter || methodFilter || paymentTypeFilter || dateFrom || dateTo;

  const handleVerifyPayment = async () => {
    if (!selectedPayment || !action) return;

    if (action === 'reject' && comment.trim().length < 10) {
      setError('Comment must be at least 10 characters for rejection');
      return;
    }

    try {
      setProcessing(true);
      setError(null);

      const response = await fetch(`/api/payments/${selectedPayment.id}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          financeOfficerId: session?.user?.id,
          action,
          comment: action === 'reject' ? comment : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to verify payment');
      }

      const result = await response.json();

      // Close verification modal first
      setShowModal(false);
      setSelectedPayment(null);
      setAction(null);
      setComment('');

      // Show success modal
      const message = action === 'approve' 
        ? `Payment verified successfully! ₦${parseFloat(selectedPayment.amount).toLocaleString()} released to vendor.`
        : 'Payment rejected successfully.';
      
      setSuccessMessage(message);
      setShowSuccessModal(true);

      // Refresh payments list
      await fetchPayments();
    } catch (err) {
      console.error('Error verifying payment:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to verify payment';
      
      // Show error modal instead of inline error
      setErrorMessage('Payment Verification Failed');
      setErrorDetails(errorMsg);
      setShowErrorModal(true);
      
      // Also set inline error for the verification modal
      setError(errorMsg);
    } finally {
      setProcessing(false);
    }
  };

  const openVerificationModal = (payment: Payment, verifyAction: 'approve' | 'reject') => {
    setSelectedPayment(payment);
    setAction(verifyAction);
    setComment('');
    setError(null);
    setShowModal(true);
  };

  const openDetailsModal = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowDetailsModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setShowDetailsModal(false);
    setSelectedPayment(null);
    setAction(null);
    setComment('');
    setError(null);
  };

  const autoVerificationPercentage = stats.total > 0
    ? Math.round((stats.autoVerified / stats.total) * 100)
    : 0;

  const manualVerificationPercentage = stats.total > 0
    ? Math.round((stats.pendingManual / stats.total) * 100)
    : 0;

  const getPaymentSourceLabel = (method: string) => {
    switch (method) {
      case 'paystack':
        return 'Paystack';
      case 'flutterwave':
        return 'Flutterwave';
      case 'bank_transfer':
        return 'Bank Transfer';
      case 'escrow_wallet':
        return 'Escrow Wallet';
      default:
        return method;
    }
  };

  const getEscrowStatusBadge = (status?: string | null) => {
    if (!status) return null;
    
    const classes = {
      frozen: 'bg-yellow-100 text-yellow-800',
      released: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    }[status] || 'bg-gray-100 text-gray-800';

    const labels = {
      frozen: '🔒 Frozen',
      released: '✅ Released',
      failed: '❌ Failed',
    }[status] || status;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes}`}>
        {labels}
      </span>
    );
  };

  const handleManualRelease = async (paymentId: string) => {
    if (!selectedPayment) return;
    
    try {
      setProcessing(true);
      setError(null);

      const response = await fetch(`/api/payments/${paymentId}/release-funds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          financeOfficerId: session?.user?.id,
          reason: 'Manual release by Finance Officer',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to release funds');
      }

      const result = await response.json();

      // Show success modal
      setSuccessMessage(`Funds released successfully! ₦${parseFloat(selectedPayment.amount).toLocaleString()} transferred to NEM Insurance.`);
      setShowSuccessModal(true);
      
      // Refresh payments list
      await fetchPayments();
    } catch (err) {
      console.error('Error releasing funds:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to release funds';
      
      // Show error modal
      setErrorMessage('Fund Release Failed');
      setErrorDetails(errorMsg);
      setShowErrorModal(true);
      
      setError(errorMsg);
      throw err;
    } finally {
      setProcessing(false);
    }
  };

  const handleGrantGracePeriod = async (paymentId: string) => {
    try {
      setProcessing(true);
      setError(null);

      const response = await fetch(`/api/payments/${paymentId}/grant-grace-period`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to grant grace period');
      }

      // Show success modal
      setSuccessMessage('Grace period granted successfully! Vendor has been notified of the 3-day extension.');
      setShowSuccessModal(true);
      
      // Close details modal
      closeModal();
      
      // Refresh payments list
      await fetchPayments();
    } catch (err) {
      console.error('Error granting grace period:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to grant grace period';
      
      // Show error modal
      setErrorMessage('Grace Period Failed');
      setErrorDetails(errorMsg);
      setShowErrorModal(true);
      
      setError(errorMsg);
    } finally {
      setProcessing(false);
    }
  };

  const fetchAuditLogs = async (paymentId: string) => {
    try {
      setLoadingAuditLogs(true);
      const response = await fetch(`/api/payments/${paymentId}/audit-logs`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      const data = await response.json();
      setAuditLogs(data.auditLogs || []);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setAuditLogs([]);
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  const exportAuditLogsToCSV = () => {
    if (!selectedPayment || auditLogs.length === 0) return;

    // CSV headers
    const headers = ['Timestamp', 'Action', 'User', 'IP Address', 'Device', 'Details'];
    
    // CSV rows
    const rows = auditLogs.map((log) => {
      const timestamp = new Date(log.createdAt).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      
      const action = log.actionType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      const user = log.userName || 'Unknown User';
      const ipAddress = log.ipAddress;
      const device = log.deviceType.charAt(0).toUpperCase() + log.deviceType.slice(1);
      
      // Extract details from afterState
      let details = '';
      if (log.afterState) {
        const detailParts: string[] = [];
        if (log.afterState.amount) {
          detailParts.push(`Amount: ₦${Number(log.afterState.amount).toLocaleString()}`);
        }
        if (log.afterState.escrowStatus) {
          detailParts.push(`Status: ${log.afterState.escrowStatus}`);
        }
        if (log.afterState.autoVerified) {
          detailParts.push('Auto-verified');
        }
        if (log.afterState.error) {
          detailParts.push(`Error: ${log.afterState.error}`);
        }
        details = detailParts.join(' | ');
      }
      
      return [timestamp, action, user, ipAddress, device, details];
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `audit-trail-${selectedPayment.id}-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openDetailsModalWithAuditLogs = async (payment: Payment) => {
    setSelectedPayment(payment);
    setShowDetailsModal(true);
    
    // Fetch audit logs if it's an escrow wallet payment
    if (payment.paymentMethod === 'escrow_wallet') {
      await fetchAuditLogs(payment.id);
    }
  };

  const handleExportCSV = () => {
    try {
      setExporting(true);
      
      // Prepare data for export with comprehensive columns
      const exportData = payments.map(payment => ({
        paymentId: payment.id,
        auctionId: payment.auctionId,
        claimReference: payment.case.claimReference,
        vendorName: payment.vendor.businessName || payment.vendor.contactPersonName || 'N/A',
        amount: `₦${parseFloat(payment.amount).toLocaleString()}`,
        status: payment.status.charAt(0).toUpperCase() + payment.status.slice(1),
        paymentMethod: getPaymentSourceLabel(payment.paymentMethod),
        paymentReference: payment.paymentReference || 'N/A',
        createdDate: new Date(payment.createdAt).toLocaleDateString('en-NG', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        verifiedDate: payment.status === 'verified' ? new Date(payment.createdAt).toLocaleDateString('en-NG', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }) : 'N/A',
        escrowStatus: payment.escrowStatus || 'N/A',
        autoVerified: payment.autoVerified ? 'Yes' : 'No',
        vendorEmail: payment.vendor.email || 'N/A',
        vendorPhone: payment.vendor.phoneNumber || 'N/A'
      }));

      // Generate CSV content with more columns
      const headers = ['Payment ID', 'Auction ID', 'Claim Reference', 'Vendor Name', 'Amount', 'Status', 'Payment Method', 'Transaction Reference', 'Created Date', 'Verified Date', 'Escrow Status', 'Auto-Verified', 'Vendor Email', 'Vendor Phone'];
      const csvRows = [headers.join(',')];
      
      exportData.forEach(row => {
        const values = [
          escapeCSVField(row.paymentId),
          escapeCSVField(row.auctionId),
          escapeCSVField(row.claimReference),
          escapeCSVField(row.vendorName),
          escapeCSVField(row.amount),
          escapeCSVField(row.status),
          escapeCSVField(row.paymentMethod),
          escapeCSVField(row.paymentReference),
          escapeCSVField(row.createdDate),
          escapeCSVField(row.verifiedDate),
          escapeCSVField(row.escrowStatus),
          escapeCSVField(row.autoVerified),
          escapeCSVField(row.vendorEmail),
          escapeCSVField(row.vendorPhone)
        ];
        csvRows.push(values.join(','));
      });

      const csvContent = csvRows.join('\n');
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().split('T')[0];
      
      link.setAttribute('href', url);
      link.setAttribute('download', `finance-payments-${date}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Show success message
      setSuccessMessage(`Successfully exported ${payments.length} payment records to CSV`);
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Error exporting CSV:', err);
      setErrorMessage('Export Failed');
      setErrorDetails('Failed to generate CSV export. Please try again.');
      setShowErrorModal(true);
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setExporting(true);
      
      // Prepare data for export with more comprehensive columns
      const exportData = payments.map(payment => ({
        paymentId: payment.id.substring(0, 8),
        auctionId: payment.auctionId.substring(0, 8),
        claimRef: payment.case.claimReference,
        vendorName: payment.vendor.businessName || payment.vendor.contactPersonName || 'N/A',
        amount: `₦${parseFloat(payment.amount).toLocaleString()}`,
        status: payment.status.charAt(0).toUpperCase() + payment.status.slice(1),
        paymentMethod: getPaymentSourceLabel(payment.paymentMethod),
        reference: payment.paymentReference || 'N/A',
        createdDate: new Date(payment.createdAt).toLocaleDateString('en-NG', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }),
        verifiedDate: payment.status === 'verified' ? new Date(payment.createdAt).toLocaleDateString('en-NG', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }) : 'N/A',
        escrowStatus: payment.escrowStatus || 'N/A',
        autoVerified: payment.autoVerified ? 'Yes' : 'No'
      }));

      // Dynamically import jsPDF and services
      const { jsPDF } = await import('jspdf');
      const { PDFTemplateService } = await import('@/features/documents/services/pdf-template.service');
      
      // Use landscape orientation for more columns
      const doc = new jsPDF('landscape');
      
      // Add letterhead
      await PDFTemplateService.addLetterhead(doc, 'FINANCE PAYMENTS REPORT');
      
      // Add table data
      let y = 65; // Start below letterhead
      const maxY = PDFTemplateService.getMaxContentY(doc);
      
      // Add headers (landscape allows more columns)
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('Pay ID', 15, y);
      doc.text('Auction', 35, y);
      doc.text('Claim Ref', 55, y);
      doc.text('Vendor', 85, y);
      doc.text('Amount', 120, y);
      doc.text('Status', 150, y);
      doc.text('Method', 175, y);
      doc.text('Reference', 205, y);
      doc.text('Created', 240, y);
      doc.text('Verified', 265, y);
      
      y += 5;
      doc.setFont('helvetica', 'normal');
      
      // Add data rows
      for (const item of exportData) {
        if (y > maxY) {
          // Add footer to current page
          PDFTemplateService.addFooter(doc);
          // Start new page
          doc.addPage();
          await PDFTemplateService.addLetterhead(doc, 'FINANCE PAYMENTS REPORT');
          y = 65;
          
          // Re-add headers on new page
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text('Pay ID', 15, y);
          doc.text('Auction', 35, y);
          doc.text('Claim Ref', 55, y);
          doc.text('Vendor', 85, y);
          doc.text('Amount', 120, y);
          doc.text('Status', 150, y);
          doc.text('Method', 175, y);
          doc.text('Reference', 205, y);
          doc.text('Created', 240, y);
          doc.text('Verified', 265, y);
          y += 5;
          doc.setFont('helvetica', 'normal');
        }
        
        doc.text(item.paymentId, 15, y);
        doc.text(item.auctionId, 35, y);
        doc.text(item.claimRef.substring(0, 12), 55, y);
        doc.text(item.vendorName.substring(0, 15), 85, y);
        doc.text(item.amount, 120, y);
        doc.text(item.status, 150, y);
        doc.text(item.paymentMethod.substring(0, 12), 175, y);
        doc.text(item.reference.substring(0, 15), 205, y);
        doc.text(item.createdDate, 240, y);
        doc.text(item.verifiedDate, 265, y);
        y += 5;
      }
      
      // Add footer to last page
      PDFTemplateService.addFooter(doc, `Total Records: ${payments.length} | Auto-Verified: ${payments.filter(p => p.autoVerified).length}`);
      
      // Download PDF
      const date = new Date().toISOString().split('T')[0];
      doc.save(`finance-payments-${date}.pdf`);
      
      // Show success message
      setSuccessMessage(`Successfully exported ${payments.length} payment records to PDF`);
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      setErrorMessage('Export Failed');
      setErrorDetails('Failed to generate PDF export. Please try again.');
      setShowErrorModal(true);
    } finally {
      setExporting(false);
    }
  };

  const escapeCSVField = (field: string): string => {
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#800020] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading payments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - Mobile Responsive with 2-row layout on mobile */}
      <div className="flex flex-col gap-4">
        {/* Title Row - Always on top */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Payment Verification</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review and verify vendor payments
            {isFiltering && (
              <span className="ml-2 inline-flex items-center text-[#800020]">
                <svg className="animate-spin h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Updating...
              </span>
            )}
          </p>
        </div>
        
        {/* Action Buttons Row - Second row on mobile, same row on desktop */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Export Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setShowExportMenu(!showExportMenu);
              }}
              disabled={isFiltering || payments.length === 0}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">Export</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleExportCSV();
                    setShowExportMenu(false);
                  }}
                  disabled={exporting}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 disabled:opacity-50"
                >
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Export as CSV</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleExportPDF();
                    setShowExportMenu(false);
                  }}
                  disabled={exporting}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 border-t border-gray-100 disabled:opacity-50"
                >
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Export as PDF</span>
                </button>
              </div>
            )}
          </div>
          
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              fetchPayments();
            }}
            disabled={isFiltering}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Total {activeTab === 'today' ? 'Today' : activeTab === 'all' ? 'Payments' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
              {hasActiveFilters && (
                <p className="text-xs text-gray-500 mt-1">Filtered results</p>
              )}
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Auto-Verified</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{stats.autoVerified}</p>
              <p className="text-xs text-gray-500 mt-1">{autoVerificationPercentage}% of total</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Manual</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.pendingManual}</p>
              <p className="text-xs text-gray-500 mt-1">{manualVerificationPercentage}% of total</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Registration Fees</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">{stats.registrationFees.count}</p>
              <p className="text-xs text-gray-500 mt-1">
                ₦{stats.registrationFees.total.toLocaleString()} total
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Pie Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Verification Distribution
          <span className="text-sm font-normal text-gray-500 ml-2">
            (Target: 90%+ auto-verified)
          </span>
        </h2>
        <div className="flex items-center justify-center space-x-8">
          <div className="relative w-48 h-48">
            <svg viewBox="0 0 100 100" className="transform -rotate-90">
              {/* Auto-verified segment */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#10b981"
                strokeWidth="20"
                strokeDasharray={`${autoVerificationPercentage * 2.51} 251`}
              />
              {/* Manual verification segment */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="20"
                strokeDasharray={`${manualVerificationPercentage * 2.51} 251`}
                strokeDashoffset={`-${autoVerificationPercentage * 2.51}`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{autoVerificationPercentage}%</p>
                <p className="text-xs text-gray-500">Auto</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm text-gray-700">
                Auto-Verified: {stats.autoVerified} ({autoVerificationPercentage}%)
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span className="text-sm text-gray-700">
                Manual: {stats.pendingManual} ({manualVerificationPercentage}%)
              </span>
            </div>
            {autoVerificationPercentage >= 90 ? (
              <div className="flex items-center space-x-2 text-green-600 text-sm font-medium">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Target achieved!</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-yellow-600 text-sm font-medium">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Below 90% target</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <div className="flex flex-wrap gap-2 px-6 pt-4">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveTab('all');
              }}
              className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                activeTab === 'all'
                  ? 'bg-[#800020] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <ClipboardList className="w-4 h-4" aria-hidden="true" />
              <span>All Payments</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveTab('today');
              }}
              className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === 'today'
                  ? 'bg-[#800020] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📅 Today
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveTab('pending');
              }}
              className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === 'pending'
                  ? 'bg-[#800020] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ⏳ Pending
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveTab('overdue');
              }}
              className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === 'overdue'
                  ? 'bg-[#800020] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🚨 Overdue
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  clearFilters();
                }}
                className="text-sm text-[#800020] hover:text-[#600018] font-medium"
              >
                Clear All Filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Status Filter */}
            <div>
              <label htmlFor="status-filter" className="block text-xs font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#800020] focus:border-transparent"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>

            {/* Payment Method Filter */}
            <div>
              <label htmlFor="method-filter" className="block text-xs font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <select
                id="method-filter"
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#800020] focus:border-transparent"
              >
                <option value="">All Methods</option>
                <option value="paystack">Paystack</option>
                <option value="flutterwave">Flutterwave</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="escrow_wallet">Escrow Wallet</option>
              </select>
            </div>

            {/* Payment Type Filter - NEW */}
            <div>
              <label htmlFor="payment-type-filter" className="block text-xs font-medium text-gray-700 mb-1">
                Payment Type
              </label>
              <select
                id="payment-type-filter"
                value={paymentTypeFilter}
                onChange={(e) => setPaymentTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#800020] focus:border-transparent"
              >
                <option value="">All Types</option>
                <option value="auction">Auction Payments</option>
                <option value="registration_fee">Registration Fees</option>
              </select>
            </div>

            {/* Date From */}
            <div>
              <label htmlFor="date-from" className="block text-xs font-medium text-gray-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                id="date-from"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#800020] focus:border-transparent"
              />
            </div>

            {/* Date To */}
            <div>
              <label htmlFor="date-to" className="block text-xs font-medium text-gray-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                id="date-to"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#800020] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Payments List Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {activeTab === 'all' && 'All Payments'}
                {activeTab === 'today' && "Today's Payments"}
                {activeTab === 'pending' && 'Pending Payments'}
                {activeTab === 'overdue' && 'Overdue Payments'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {payments.length} payment{payments.length !== 1 ? 's' : ''} found
                {hasActiveFilters && ' (filtered)'}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="divide-y divide-gray-200">
          {payments.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No payments found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {hasActiveFilters 
                  ? 'Try adjusting your filters to see more results.'
                  : activeTab === 'today'
                  ? 'No payments have been made today yet.'
                  : activeTab === 'pending'
                  ? 'All payments have been verified.'
                  : activeTab === 'overdue'
                  ? 'No overdue payments at this time.'
                  : 'No payments in the system yet.'}
              </p>
            </div>
          ) : (
            <div className={`transition-opacity duration-200 ${isFiltering ? 'opacity-50' : 'opacity-100'}`}>
              {payments.map((payment) => (
              <div key={payment.id} className="px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="flex-1 w-full min-w-0">
                    {/* Payment ID and Tags - Stack on mobile */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {payment.case ? payment.case.claimReference : payment.paymentReference || 'Registration Fee'}
                      </h3>
                      {/* Tags container with wrapping */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Payment Type Badge - NEW */}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          payment.paymentType === 'registration_fee' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {payment.paymentType === 'registration_fee' ? '🎫 Registration Fee' : payment.case?.assetType || 'Auction'}
                        </span>
                        {/* Status Badge */}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          payment.status === 'verified' ? 'bg-green-100 text-green-800' :
                          payment.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          payment.status === 'overdue' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {payment.status === 'pending' && '⏳ Pending'}
                          {payment.status === 'verified' && '✅ Verified'}
                          {payment.status === 'rejected' && '❌ Rejected'}
                          {payment.status === 'overdue' && '🚨 Overdue'}
                        </span>
                        {/* Auto-verified Badge */}
                        {payment.autoVerified && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            🤖 Auto-Verified
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Amount</p>
                        <p className="font-medium text-gray-900">
                          ₦{parseFloat(payment.amount).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Payment Source</p>
                        <p className="font-medium text-gray-900">
                          {getPaymentSourceLabel(payment.paymentMethod)}
                        </p>
                        {payment.paymentMethod === 'escrow_wallet' && payment.escrowStatus && (
                          <div className="mt-1">
                            {getEscrowStatusBadge(payment.escrowStatus)}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-gray-500">Vendor Business</p>
                        <div className="flex items-center gap-2 mt-1">
                          <UserAvatar
                            profilePictureUrl={payment.vendor.profilePictureUrl}
                            userName={payment.vendor.businessName || payment.vendor.contactPersonName || 'Vendor'}
                            size="sm"
                          />
                          <div>
                            <p className="font-medium text-gray-900">
                              {payment.vendor.businessName || 'Individual Vendor'}
                            </p>
                            {payment.vendor.kycTier && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                                payment.vendor.kycTier === 'tier2' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                                {payment.vendor.kycTier === 'tier2' ? (
                                  <>
                                    <Star className="w-3 h-3" aria-hidden="true" />
                                    <span>Tier 2</span>
                                  </>
                                ) : (
                                  <>
                                    <ClipboardList className="w-3 h-3" aria-hidden="true" />
                                    <span>Tier 1</span>
                                  </>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-gray-500">Contact Person</p>
                        <p className="font-medium text-gray-900">
                          {payment.vendor.contactPersonName || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Phone</p>
                        <p className="font-medium text-gray-900">
                          {payment.vendor.phoneNumber || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Email</p>
                        <p className="font-medium text-gray-900 text-xs truncate" title={payment.vendor.email || 'N/A'}>
                          {payment.vendor.email || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Submitted</p>
                        <p className="font-medium text-gray-900">
                          {new Date(payment.createdAt).toLocaleDateString('en-NG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Deadline</p>
                        <p className={`font-medium ${
                          new Date(payment.paymentDeadline) < new Date() && payment.status === 'pending'
                            ? 'text-red-600'
                            : 'text-gray-900'
                        }`}>
                          {new Date(payment.paymentDeadline).toLocaleDateString('en-NG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                      {payment.paymentReference && (
                        <div className="col-span-2 md:col-span-3">
                          <p className="text-gray-500">Reference</p>
                          <p className="font-mono text-xs text-gray-900 bg-gray-100 px-2 py-1 rounded inline-block">
                            {payment.paymentReference}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          openDetailsModalWithAuditLogs(payment);
                        }}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        View Details
                      </button>
                      {payment.paymentProofUrl && (
                        <a
                          href={payment.paymentProofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Receipt
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons - Mobile responsive */}
                  {/* CRITICAL FIX: Only show approve/reject when payment is actually completed and needs verification */}
                  {/* Don't show for: */}
                  {/* 1. escrow_wallet with frozen status (waiting for documents) */}
                  {/* 2. Paystack pending (vendor hasn't completed payment yet - auction status is awaiting_payment) */}
                  {/* 3. Registration fees (auto-verified via webhook, no manual approval needed) */}
                  {payment.status === 'pending' && 
                   payment.paymentType === 'auction' &&
                   !(payment.paymentMethod === 'escrow_wallet' && payment.escrowStatus === 'frozen') &&
                   !(payment.paymentMethod === 'paystack' && payment.auctionStatus === 'awaiting_payment') && (
                    <div className="w-full sm:w-auto sm:ml-4 flex flex-col gap-2">
                      <OfflineAwareButton
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          openVerificationModal(payment, 'approve');
                        }}
                        requiresOnline={true}
                        offlineTooltip="Payment approval requires internet connection"
                        className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                      >
                        Approve
                      </OfflineAwareButton>
                      <OfflineAwareButton
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          openVerificationModal(payment, 'reject');
                        }}
                        requiresOnline={true}
                        offlineTooltip="Payment rejection requires internet connection"
                        className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                      >
                        Reject
                      </OfflineAwareButton>
                    </div>
                  )}
                  {/* Show waiting message for frozen escrow payments */}
                  {payment.status === 'pending' && 
                   payment.paymentMethod === 'escrow_wallet' && 
                   payment.escrowStatus === 'frozen' && (
                    <div className="w-full sm:w-auto sm:ml-4 flex flex-col items-start sm:items-end">
                      <div className="w-full sm:w-auto px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                        <p className="text-yellow-800 font-medium">⏳ Waiting for Documents</p>
                        <p className="text-yellow-600 text-xs mt-1">
                          {payment.documentProgress 
                            ? `${payment.documentProgress.signedDocuments}/${payment.documentProgress.totalDocuments} signed`
                            : 'Vendor must sign documents'}
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Show waiting message for Paystack payments that are awaiting payment */}
                  {payment.status === 'pending' && 
                   payment.paymentMethod === 'paystack' && 
                   payment.auctionStatus === 'awaiting_payment' && (
                    <div className="w-full sm:w-auto sm:ml-4 flex flex-col items-start sm:items-end">
                      <div className="w-full sm:w-auto px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                        <p className="text-blue-800 font-medium">⏳ Awaiting Payment</p>
                        <p className="text-blue-600 text-xs mt-1">
                          Vendor must complete Paystack payment
                        </p>
                      </div>
                    </div>
                  )}
                  {payment.status === 'overdue' && (
                    <div className="w-full sm:w-auto sm:ml-4">
                      <OfflineAwareButton
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleGrantGracePeriod(payment.id);
                        }}
                        disabled={processing}
                        requiresOnline={true}
                        offlineTooltip="Granting grace period requires internet connection"
                        className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Grant Grace Period
                      </OfflineAwareButton>
                    </div>
                  )}
                </div>
              </div>
            ))}
            </div>
          )}
        </div>
      </div>

      {/* Verification Modal */}
      {showModal && selectedPayment && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0" style={{ zIndex: 999999 }}>
          <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {action === 'approve' ? 'Approve Payment' : 'Reject Payment'}
              </h3>

              <div className="space-y-3 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Claim Reference</p>
                  <p className="font-medium text-gray-900">{selectedPayment.case.claimReference}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="font-medium text-gray-900">
                    ₦{parseFloat(selectedPayment.amount).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Vendor</p>
                  <p className="font-medium text-gray-900">
                    {selectedPayment.vendor.businessName || selectedPayment.vendor.contactPersonName || 'Individual Vendor'}
                  </p>
                </div>
              </div>

              {action === 'reject' && (
                <div className="mb-6">
                  <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="comment"
                    rows={4}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Explain why this payment is being rejected (minimum 10 characters)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {comment.length}/10 characters minimum
                  </p>
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    closeModal();
                  }}
                  disabled={processing}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleVerifyPayment();
                  }}
                  disabled={processing || (action === 'reject' && comment.trim().length < 10)}
                  className={`flex-1 px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-50 ${
                    action === 'approve'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {processing ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    `Confirm ${action === 'approve' ? 'Approval' : 'Rejection'}`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {/* Payment Details Modal */}
      {showDetailsModal && selectedPayment && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0" style={{ zIndex: 999999 }}>
          <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Payment Details</h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    closeModal();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
              {/* Payment Information */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-[#800020]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Payment Information
                </h4>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Amount</p>
                    <p className="text-lg font-bold text-[#800020]">
                      ₦{parseFloat(selectedPayment.amount).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Payment Source</p>
                    <p className="font-medium text-gray-900">
                      {getPaymentSourceLabel(selectedPayment.paymentMethod)}
                    </p>
                    {selectedPayment.paymentMethod === 'escrow_wallet' && selectedPayment.escrowStatus && (
                      <div className="mt-1">
                        {getEscrowStatusBadge(selectedPayment.escrowStatus)}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedPayment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      selectedPayment.status === 'verified' ? 'bg-green-100 text-green-800' :
                      selectedPayment.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {selectedPayment.status.charAt(0).toUpperCase() + selectedPayment.status.slice(1)}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Verification</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedPayment.autoVerified ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {selectedPayment.autoVerified ? '🤖 Auto-Verified' : '👤 Manual Review'}
                    </span>
                  </div>
                  {selectedPayment.paymentReference && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500 mb-1">Payment Reference</p>
                      <p className="font-mono text-sm text-gray-900 bg-white px-3 py-2 rounded border border-gray-200">
                        {selectedPayment.paymentReference}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Submitted</p>
                    <p className="text-sm text-gray-900">
                      {new Date(selectedPayment.createdAt).toLocaleDateString('en-NG', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Deadline</p>
                    <p className={`text-sm font-medium ${
                      new Date(selectedPayment.paymentDeadline) < new Date() && selectedPayment.status === 'pending'
                        ? 'text-red-600'
                        : 'text-gray-900'
                    }`}>
                      {new Date(selectedPayment.paymentDeadline).toLocaleDateString('en-NG', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Vendor Information */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-[#800020]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Vendor Information
                </h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Business Name</p>
                      <p className="font-medium text-gray-900">
                        {selectedPayment.vendor.businessName || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Contact Person</p>
                      <p className="font-medium text-gray-900">
                        {selectedPayment.vendor.contactPersonName || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Phone Number</p>
                      <p className="font-medium text-gray-900">
                        {selectedPayment.vendor.phoneNumber || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Email</p>
                      <p className="font-medium text-gray-900 text-sm break-all">
                        {selectedPayment.vendor.email || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">KYC Tier</p>
                      {selectedPayment.vendor.kycTier ? (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          selectedPayment.vendor.kycTier === 'tier2' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {selectedPayment.vendor.kycTier === 'tier2' ? (
                            <>
                              <Star className="w-3 h-3" aria-hidden="true" />
                              <span>Tier 2 Verified</span>
                            </>
                          ) : (
                            <>
                              <ClipboardList className="w-3 h-3" aria-hidden="true" />
                              <span>Tier 1 Verified</span>
                            </>
                          )}
                        </span>
                      ) : (
                        <p className="text-sm text-gray-500">Not verified</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">KYC Status</p>
                      {selectedPayment.vendor.kycStatus ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          selectedPayment.vendor.kycStatus === 'approved' ? 'bg-green-100 text-green-800' :
                          selectedPayment.vendor.kycStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {selectedPayment.vendor.kycStatus.charAt(0).toUpperCase() + selectedPayment.vendor.kycStatus.slice(1)}
                        </span>
                      ) : (
                        <p className="text-sm text-gray-500">N/A</p>
                      )}
                    </div>
                  </div>
                  
                  {selectedPayment.vendor.bankAccountNumber && (
                    <div className="pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-2">Bank Account Details</p>
                      <div className="bg-white p-3 rounded border border-gray-200">
                        <p className="text-sm font-medium text-gray-900">
                          {selectedPayment.vendor.bankName}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {selectedPayment.vendor.bankAccountNumber}
                        </p>
                        {selectedPayment.vendor.bankAccountName && (
                          <p className="text-sm text-gray-600">
                            {selectedPayment.vendor.bankAccountName}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Case Information */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-[#800020]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Case Information
                </h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Claim Reference</p>
                      <p className="font-medium text-gray-900">
                        {selectedPayment.case.claimReference}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Asset Type</p>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                        {selectedPayment.case.assetType}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Escrow Payment Details - Only for escrow_wallet payments */}
              {selectedPayment.paymentMethod === 'escrow_wallet' && 
               selectedPayment.walletBalance && 
               selectedPayment.documentProgress && (
                <>
                  <div>
                    <EscrowPaymentDetails
                      payment={{
                        id: selectedPayment.id,
                        amount: parseFloat(selectedPayment.amount),
                        escrowStatus: selectedPayment.escrowStatus || 'frozen',
                        status: selectedPayment.status,
                      }}
                      documentProgress={{
                        signedDocuments: selectedPayment.documentProgress.signedDocuments,
                        totalDocuments: selectedPayment.documentProgress.totalDocuments,
                      }}
                      walletBalance={{
                        balance: selectedPayment.walletBalance.availableBalance,
                        frozenAmount: selectedPayment.walletBalance.frozenAmount,
                      }}
                      onManualRelease={async () => {
                        await handleManualRelease(selectedPayment.id);
                        closeModal();
                      }}
                    />
                  </div>

                  {/* Audit Trail Section */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-semibold text-gray-900 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-[#800020]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Audit Trail
                      </h4>
                      {auditLogs.length > 0 && (
                        <button
                          type="button"
                          onClick={exportAuditLogsToCSV}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                          data-testid="export-csv-button"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Export CSV
                        </button>
                      )}
                    </div>
                    
                    {loadingAuditLogs ? (
                      <div className="bg-white rounded-lg shadow-md p-6 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#800020] mx-auto"></div>
                        <p className="mt-2 text-sm text-gray-600">Loading audit trail...</p>
                      </div>
                    ) : (
                      <EscrowPaymentAuditTrail
                        auditLogs={auditLogs}
                        paymentId={selectedPayment.id}
                      />
                    )}
                  </div>
                </>
              )}

              {/* Actions */}
              {/* CRITICAL FIX: Don't show approve/reject for frozen escrow payments */}
              {selectedPayment.status === 'pending' && 
               !(selectedPayment.paymentMethod === 'escrow_wallet' && selectedPayment.escrowStatus === 'frozen') && (
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      closeModal();
                      openVerificationModal(selectedPayment, 'approve');
                    }}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    Approve Payment
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      closeModal();
                      openVerificationModal(selectedPayment, 'reject');
                    }}
                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    Reject Payment
                  </button>
                </div>
              )}
              {/* Show waiting message for frozen escrow payments */}
              {selectedPayment.status === 'pending' && 
               selectedPayment.paymentMethod === 'escrow_wallet' && 
               selectedPayment.escrowStatus === 'frozen' && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <h5 className="text-sm font-semibold text-yellow-800 mb-1">
                          Waiting for Vendor to Sign Documents
                        </h5>
                        <p className="text-sm text-yellow-700">
                          This escrow wallet payment will be automatically released after the vendor signs all required documents. 
                          {selectedPayment.documentProgress && (
                            <span className="font-medium">
                              {' '}Progress: {selectedPayment.documentProgress.signedDocuments}/{selectedPayment.documentProgress.totalDocuments} documents signed.
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-yellow-600 mt-2">
                          No manual approval needed - funds will auto-release when documents are complete.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>,
        document.body
      ) : null}

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Success!"
        message={successMessage}
      />

      {/* Error Modal */}
      <ErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title={errorMessage}
        message="An error occurred while processing your request."
        details={errorDetails}
      />
    </div>
  );
}
