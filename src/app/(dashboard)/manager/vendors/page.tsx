'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Shield, 
  ArrowLeft,
  FileText,
  Building2,
  CreditCard,
  IdCard,
  XCircle,
  Clock,
  User,
  Mail,
  Phone,
  Calendar,
  ExternalLink
} from 'lucide-react';

/**
 * Tier 2 KYC Review Queue for Salvage Manager
 * 
 * Allows Salvage Manager to review and approve/reject Tier 2 vendor applications
 * Features:
 * - Display Tier 2 KYC review queue
 * - Show vendor details and uploaded documents
 * - Display verification statuses (BVN ✓, NIN ✓, Bank Account ✓, CAC pending)
 * - Add approve/reject buttons with comment field
 * 
 * Requirements: 7, NFR5.3
 */

interface VendorApplication {
  id: string;
  userId: string;
  businessName: string;
  cacNumber: string;
  tin: string;
  bankAccountNumber: string;
  bankName: string;
  bankAccountName: string;
  tier: string;
  status: string;
  bvnVerified: boolean;
  ninVerified: boolean;
  bankAccountVerified: boolean;
  cacVerified: boolean;
  cacCertificateUrl: string;
  bankStatementUrl: string;
  ninCardUrl: string;
  createdAt: string;
  user: {
    fullName: string;
    email: string;
    phone: string;
  };
}

export default function Tier2ReviewQueuePage() {
  const router = useRouter();
  const { status: sessionStatus } = useSession();

  // State
  const [applications, setApplications] = useState<VendorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<VendorApplication | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/login');
    }
  }, [sessionStatus, router]);

  // Fetch pending applications
  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      fetchApplications();
    }
  }, [sessionStatus]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/vendors?status=pending&tier=tier2');
      
      if (!response.ok) {
        throw new Error('Failed to fetch applications');
      }

      const data = await response.json();
      setApplications(data.vendors || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  // Handle review submission
  const handleReviewSubmit = async () => {
    if (!selectedApplication || !reviewAction) return;

    // Validate comment for rejection
    if (reviewAction === 'reject' && (!comment || comment.trim().length === 0)) {
      setError('Please provide a reason for rejection');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/vendors/${selectedApplication.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: reviewAction,
          comment: comment.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Review submission failed');
      }

      // Success - refresh list and close modal
      await fetchApplications();
      setSelectedApplication(null);
      setReviewAction(null);
      setComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#800020] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="w-full max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
          </div>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-[#800020] rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Tier 2 KYC Review Queue</h1>
              <p className="text-gray-600">Review and approve vendor applications</p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && !selectedApplication && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Applications List */}
        {applications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <CheckCircle2 className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Pending Applications</h2>
            <p className="text-gray-600">
              All Tier 2 applications have been reviewed. Check back later for new submissions.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {applications.map((application) => (
              <ApplicationCard
                key={application.id}
                application={application}
                onReview={() => setSelectedApplication(application)}
              />
            ))}
          </div>
        )}

        {/* Review Modal */}
        {selectedApplication && (
          <ReviewModal
            application={selectedApplication}
            reviewAction={reviewAction}
            comment={comment}
            submitting={submitting}
            error={error}
            onClose={() => {
              setSelectedApplication(null);
              setReviewAction(null);
              setComment('');
              setError(null);
            }}
            onActionChange={setReviewAction}
            onCommentChange={setComment}
            onSubmit={handleReviewSubmit}
          />
        )}
      </div>
    </div>
  );
}

// Application Card Component
function ApplicationCard({ 
  application, 
  onReview 
}: { 
  application: VendorApplication; 
  onReview: () => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#800020] rounded-full flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{application.businessName}</h3>
              <p className="text-sm text-gray-600">{application.user.fullName}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
            <Clock className="w-4 h-4" />
            Pending Review
          </div>
        </div>

        {/* Vendor Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">Contact:</span>
            <span className="font-medium text-gray-900">{application.user.fullName}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">Email:</span>
            <span className="font-medium text-gray-900">{application.user.email}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">Phone:</span>
            <span className="font-medium text-gray-900">{application.user.phone}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">Submitted:</span>
            <span className="font-medium text-gray-900">
              {new Date(application.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Business Details */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <h4 className="font-semibold text-gray-900 mb-3">Business Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600">CAC Number:</span>
              <span className="ml-2 font-medium text-gray-900">{application.cacNumber}</span>
            </div>
            <div>
              <span className="text-gray-600">TIN:</span>
              <span className="ml-2 font-medium text-gray-900">{application.tin}</span>
            </div>
            <div>
              <span className="text-gray-600">Bank:</span>
              <span className="ml-2 font-medium text-gray-900">{application.bankName}</span>
            </div>
            <div>
              <span className="text-gray-600">Account:</span>
              <span className="ml-2 font-medium text-gray-900">{application.bankAccountNumber}</span>
            </div>
          </div>
        </div>

        {/* Verification Status */}
        <div className="mb-4">
          <h4 className="font-semibold text-gray-900 mb-3">Verification Status</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <VerificationBadge
              label="BVN"
              verified={application.bvnVerified}
            />
            <VerificationBadge
              label="NIN"
              verified={application.ninVerified}
            />
            <VerificationBadge
              label="Bank Account"
              verified={application.bankAccountVerified}
            />
            <VerificationBadge
              label="CAC"
              verified={application.cacVerified}
            />
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onReview}
          className="w-full bg-[#800020] text-white font-bold py-3 px-4 rounded-lg hover:bg-[#600018] transition-colors flex items-center justify-center gap-2"
        >
          <Shield className="w-5 h-5" />
          Review Application
        </button>
      </div>
    </div>
  );
}

// Verification Badge Component
function VerificationBadge({ label, verified }: { label: string; verified: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
      verified 
        ? 'bg-green-100 text-green-800' 
        : 'bg-gray-100 text-gray-600'
    }`}>
      {verified ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <Clock className="w-4 h-4" />
      )}
      <span>{label}</span>
    </div>
  );
}

// Review Modal Component
function ReviewModal({
  application,
  reviewAction,
  comment,
  submitting,
  error,
  onClose,
  onActionChange,
  onCommentChange,
  onSubmit,
}: {
  application: VendorApplication;
  reviewAction: 'approve' | 'reject' | null;
  comment: string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onActionChange: (action: 'approve' | 'reject' | null) => void;
  onCommentChange: (comment: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#800020] rounded-full flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{application.businessName}</h2>
              <p className="text-sm text-gray-600">{application.user.fullName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900">Error</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Vendor Information */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Vendor Information</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">Full Name:</span>
                  <span className="ml-2 font-medium text-gray-900">{application.user.fullName}</span>
                </div>
                <div>
                  <span className="text-gray-600">Email:</span>
                  <span className="ml-2 font-medium text-gray-900">{application.user.email}</span>
                </div>
                <div>
                  <span className="text-gray-600">Phone:</span>
                  <span className="ml-2 font-medium text-gray-900">{application.user.phone}</span>
                </div>
                <div>
                  <span className="text-gray-600">Submitted:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {new Date(application.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Business Details */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Business Details</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">Business Name:</span>
                  <span className="ml-2 font-medium text-gray-900">{application.businessName}</span>
                </div>
                <div>
                  <span className="text-gray-600">CAC Number:</span>
                  <span className="ml-2 font-medium text-gray-900">{application.cacNumber}</span>
                </div>
                <div>
                  <span className="text-gray-600">TIN:</span>
                  <span className="ml-2 font-medium text-gray-900">{application.tin}</span>
                </div>
                <div>
                  <span className="text-gray-600">Bank:</span>
                  <span className="ml-2 font-medium text-gray-900">{application.bankName}</span>
                </div>
                <div>
                  <span className="text-gray-600">Account Number:</span>
                  <span className="ml-2 font-medium text-gray-900">{application.bankAccountNumber}</span>
                </div>
                <div>
                  <span className="text-gray-600">Account Name:</span>
                  <span className="ml-2 font-medium text-gray-900">{application.bankAccountName}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Verification Status */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Verification Status</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <VerificationBadge label="BVN" verified={application.bvnVerified} />
              <VerificationBadge label="NIN" verified={application.ninVerified} />
              <VerificationBadge label="Bank Account" verified={application.bankAccountVerified} />
              <VerificationBadge label="CAC" verified={application.cacVerified} />
            </div>
          </div>

          {/* Uploaded Documents */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Uploaded Documents</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DocumentPreview
                label="CAC Certificate"
                url={application.cacCertificateUrl}
                icon={<Building2 className="w-6 h-6" />}
              />
              <DocumentPreview
                label="Bank Statement"
                url={application.bankStatementUrl}
                icon={<CreditCard className="w-6 h-6" />}
              />
              <DocumentPreview
                label="NIN Card"
                url={application.ninCardUrl}
                icon={<IdCard className="w-6 h-6" />}
              />
            </div>
          </div>

          {/* Review Actions */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Review Decision</h3>
            
            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button
                onClick={() => onActionChange('approve')}
                disabled={submitting}
                className={`flex items-center justify-center gap-2 px-6 py-4 rounded-lg font-bold transition-all ${
                  reviewAction === 'approve'
                    ? 'bg-green-600 text-white shadow-lg scale-105'
                    : 'bg-green-100 text-green-800 hover:bg-green-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <CheckCircle2 className="w-5 h-5" />
                Approve
              </button>
              
              <button
                onClick={() => onActionChange('reject')}
                disabled={submitting}
                className={`flex items-center justify-center gap-2 px-6 py-4 rounded-lg font-bold transition-all ${
                  reviewAction === 'reject'
                    ? 'bg-red-600 text-white shadow-lg scale-105'
                    : 'bg-red-100 text-red-800 hover:bg-red-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <XCircle className="w-5 h-5" />
                Reject
              </button>
            </div>

            {/* Comment Field */}
            {reviewAction && (
              <div className="space-y-2">
                <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
                  {reviewAction === 'reject' ? (
                    <>Comment <span className="text-red-500">*</span> (Required for rejection)</>
                  ) : (
                    'Comment (Optional)'
                  )}
                </label>
                <textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => onCommentChange(e.target.value)}
                  disabled={submitting}
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder={
                    reviewAction === 'approve'
                      ? 'Add any notes about this approval (optional)'
                      : 'Please explain why this application is being rejected and what the vendor needs to correct'
                  }
                />
                {reviewAction === 'reject' && (
                  <p className="text-sm text-gray-600">
                    This comment will be sent to the vendor via email and SMS
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex items-center justify-end gap-4">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          
          <button
            onClick={onSubmit}
            disabled={!reviewAction || submitting}
            className="px-6 py-3 bg-[#800020] text-white font-bold rounded-lg hover:bg-[#600018] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Submit Review
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Document Preview Component
function DocumentPreview({ 
  label, 
  url, 
  icon 
}: { 
  label: string; 
  url: string; 
  icon: React.ReactNode;
}) {
  const isPDF = url.toLowerCase().endsWith('.pdf');

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-[#800020]">{icon}</div>
        <h4 className="font-semibold text-gray-900 text-sm">{label}</h4>
      </div>
      
      {isPDF ? (
        <div className="bg-white rounded-lg p-8 flex flex-col items-center justify-center border border-gray-200 mb-3">
          <FileText className="w-12 h-12 text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">PDF Document</p>
        </div>
      ) : (
        <div className="relative w-full h-40 bg-white rounded-lg overflow-hidden border border-gray-200 mb-3">
          <Image
            src={url}
            alt={label}
            fill
            className="object-contain"
          />
        </div>
      )}
      
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-[#800020] text-white text-sm font-medium rounded-lg hover:bg-[#600018] transition-colors"
      >
        <ExternalLink className="w-4 h-4" />
        View Full Document
      </a>
    </div>
  );
}
