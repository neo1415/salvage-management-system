'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import imageCompression from 'browser-image-compression';
import {
  CheckCircle2,
  Loader2,
  Shield,
  ArrowLeft,
  Award,
  AlertCircle,
  Clock,
  XCircle,
  RefreshCw,
  Upload,
  FileText,
  Home,
  Building,
  User,
} from 'lucide-react';

type PageState = 'idle' | 'loading' | 'submitting' | 'pending_review' | 'approved' | 'rejected' | 'error';

interface FormData {
  businessName: string;
  businessType: 'individual' | 'sole_proprietor' | 'limited_company';
  cacNumber: string;
  tin: string;
  address: string;
  city: string;
  state: string;
  nin: string;
  bvn: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  cacCertificate: File | null;
  ninCard: File | null;
  utilityBill: File | null;
  bankStatement: File | null;
  photoId: File | null;
}

export default function Tier2ManualKYCPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [pageState, setPageState] = useState<PageState>('loading');
  const isSubmittingKyc = pageState === 'submitting';
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    businessName: '',
    businessType: 'individual',
    cacNumber: '',
    tin: '',
    address: '',
    city: '',
    state: '',
    nin: '',
    bvn: '',
    bankName: '',
    accountName: '',
    accountNumber: '',
    cacCertificate: null,
    ninCard: null,
    utilityBill: null,
    bankStatement: null,
    photoId: null,
  });

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login');
    if (authStatus === 'authenticated') {
      // Check if registration fee is paid
      fetch('/api/vendors/registration-fee/status')
        .then(res => res.json())
        .then(data => {
          if (!data?.data?.paid) {
            router.push('/vendor/registration-fee');
          } else {
            // Check KYC status
            return fetch('/api/kyc/status');
          }
        })
        .then(res => res?.json())
        .then(data => {
          if (data?.status === 'pending_review') {
            setPageState('pending_review');
          } else if (data?.status === 'approved') {
            setPageState('approved');
          } else if (data?.status === 'rejected') {
            setPageState('rejected');
          } else {
            setPageState('idle');
          }
        })
        .catch(() => setPageState('idle'));
    }
  }, [authStatus, router]);

  const handleFileChange = async (field: keyof FormData, file: File | null) => {
    if (!file) {
      setFormData(prev => ({ ...prev, [field]: null }));
      return;
    }

    // Compress images before storing
    if (file.type.startsWith('image/')) {
      try {
        const options = {
          maxSizeMB: 0.5, // Target 500KB
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: file.type,
        };

        const compressedFile = await imageCompression(file, options);
        
        // Ensure the compressed file has the correct type property
        // browser-image-compression sometimes returns a file without proper type
        const fileWithType = new File(
          [compressedFile], 
          compressedFile.name || file.name, 
          { 
            type: compressedFile.type || file.type,
            lastModified: compressedFile.lastModified || Date.now()
          }
        );
        
        setFormData(prev => ({ ...prev, [field]: fileWithType }));
      } catch (error) {
        console.error('Image compression failed:', error);
        // Fall back to original file if compression fails
        setFormData(prev => ({ ...prev, [field]: file }));
      }
    } else {
      // PDFs are not compressed
      setFormData(prev => ({ ...prev, [field]: file }));
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPageState('submitting');
    setErrorMessage(null);

    try {
      // Create FormData for file upload
      const submitData = new FormData();
      
      // Add text fields
      Object.entries(formData).forEach(([key, value]) => {
        if (value && !(value instanceof File)) {
          submitData.append(key, value.toString());
        }
      });

      // Add files with validation logging
      const filesToUpload = [
        { key: 'cacCertificate', file: formData.cacCertificate },
        { key: 'ninCard', file: formData.ninCard },
        { key: 'utilityBill', file: formData.utilityBill },
        { key: 'bankStatement', file: formData.bankStatement },
        { key: 'photoId', file: formData.photoId },
      ];

      for (const { key, file } of filesToUpload) {
        if (file) {
          console.log(`[KYC Submit] ${key}:`, {
            name: file.name,
            type: file.type,
            size: file.size,
          });
          submitData.append(key, file);
        }
      }

      const res = await fetch('/api/kyc/manual/submit', {
        method: 'POST',
        body: submitData,
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('[KYC Submit] Error response:', data);
        setErrorMessage(data.error ?? 'Submission failed. Please try again.');
        if (data.details) {
          setErrorMessage(`${data.error}\n\n${data.details}`);
        }
        setPageState('idle');
        return;
      }

      setPageState('pending_review');
    } catch (error) {
      console.error('[KYC Submit] Network error:', error);
      setErrorMessage('Network error. Please check your connection and try again.');
      setPageState('idle');
    }
  };

  if (authStatus === 'loading' || pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-hover)] flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-hover)] py-8 px-4">
      <div className="w-full max-w-4xl mx-auto">
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-white hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4">
            <Award className="w-8 h-8 text-[var(--brand-primary)]" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Tier 2 Verification</h1>
          <p className="text-gray-200">Complete identity verification for higher bidding access</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {pageState === 'pending_review' && (
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-6">
                <Clock className="w-12 h-12 text-yellow-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Under Review</h2>
              <p className="text-gray-600 mb-6">
                Your application is being reviewed by our team. You'll receive an SMS and email notification once the review is complete.
              </p>
              <button
                onClick={() => router.push('/vendor/dashboard')}
                className="w-full bg-[var(--brand-accent)] text-[var(--brand-primary)] font-bold py-3 rounded-lg hover:bg-[var(--brand-accent-hover)] transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          )}

          {pageState === 'approved' && (
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Approved!</h2>
              <p className="text-gray-600 mb-6">
                Your full verification has been approved. Your account access has been updated.
              </p>
              <button
                onClick={() => router.push('/vendor/dashboard')}
                className="w-full bg-[var(--brand-accent)] text-[var(--brand-primary)] font-bold py-3 rounded-lg hover:bg-[var(--brand-accent-hover)] transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          )}

          {pageState === 'rejected' && (
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
                <XCircle className="w-12 h-12 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Rejected</h2>
              <p className="text-gray-600 mb-6">
                Your application was not approved. You may resubmit after 24 hours. Contact support for assistance.
              </p>
              <button
                onClick={() => router.push('/vendor/dashboard')}
                className="w-full bg-[var(--brand-accent)] text-[var(--brand-primary)] font-bold py-3 rounded-lg hover:bg-[var(--brand-accent-hover)] transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          )}

          {pageState === 'submitting' && (
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Submitting Your Application</h2>
              <p className="text-gray-600 mb-4">
                Please wait while we upload your documents and process your application...
              </p>
              <div className="max-w-md mx-auto">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>What's happening:</strong>
                  </p>
                  <ul className="text-sm text-blue-700 mt-2 space-y-1 text-left">
                    <li>• Uploading your documents securely</li>
                    <li>• Encrypting sensitive information</li>
                    <li>• Submitting to our review team</li>
                    <li>• Sending confirmation notifications</li>
                  </ul>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                This may take 30-60 seconds. Please don't close this page.
              </p>
            </div>
          )}

          {pageState === 'idle' && (
            <form onSubmit={handleSubmit} className="p-6 sm:p-8">
              <div className="bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-hover)] rounded-xl p-5 text-white mb-6">
                <h2 className="text-lg font-bold mb-3">Tier 2 Benefits</h2>
                <ul className="space-y-2 text-sm text-gray-200">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[var(--brand-accent)]" /> Higher bidding access when approved</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[var(--brand-accent)]" /> Leaderboard eligibility</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[var(--brand-accent)]" /> Tier 2 Verified badge</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[var(--brand-accent)]" /> Priority support</li>
                </ul>
              </div>

              {errorMessage && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{errorMessage}</p>
                </div>
              )}

              {/* Business Details */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Business Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Business Name</label>
                    <input
                      type="text"
                      required
                      value={formData.businessName}
                      onChange={(e) => handleInputChange('businessName', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Business Type</label>
                    <select
                      required
                      value={formData.businessType}
                      onChange={(e) => handleInputChange('businessType', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
                    >
                      <option value="individual">Individual</option>
                      <option value="sole_proprietor">Sole Proprietor</option>
                      <option value="limited_company">Limited Company</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">CAC Number</label>
                    <input
                      type="text"
                      value={formData.cacNumber}
                      onChange={(e) => handleInputChange('cacNumber', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">TIN</label>
                    <input
                      type="text"
                      value={formData.tin}
                      onChange={(e) => handleInputChange('tin', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Home className="w-5 h-5" />
                  Address Information
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Street Address</label>
                    <input
                      type="text"
                      required
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                      <input
                        type="text"
                        required
                        value={formData.city}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                      <input
                        type="text"
                        required
                        value={formData.state}
                        onChange={(e) => handleInputChange('state', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Details */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Personal Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">NIN</label>
                    <input
                      type="text"
                      required
                      maxLength={11}
                      value={formData.nin}
                      onChange={(e) => handleInputChange('nin', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">BVN</label>
                    <input
                      type="text"
                      required
                      maxLength={11}
                      value={formData.bvn}
                      onChange={(e) => handleInputChange('bvn', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Bank Account Details */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Bank Account Details
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Bank account details will be verified against your bank statement. 
                    Please ensure the information matches exactly.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
                    <input
                      type="text"
                      required
                      value={formData.bankName}
                      onChange={(e) => handleInputChange('bankName', e.target.value)}
                      placeholder="e.g., Access Bank"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Account Name</label>
                    <input
                      type="text"
                      required
                      value={formData.accountName}
                      onChange={(e) => handleInputChange('accountName', e.target.value)}
                      placeholder="As shown on bank statement"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      value={formData.accountNumber}
                      onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                      placeholder="10-digit account number"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Document Uploads */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Required Documents
                </h3>
                <div className="space-y-4">
                  {[
                    { key: 'cacCertificate', label: 'CAC Certificate', required: formData.businessType !== 'individual' },
                    { key: 'ninCard', label: 'NIN Card', required: true },
                    { key: 'utilityBill', label: 'Utility Bill (within 3 months)', required: true },
                    { key: 'bankStatement', label: 'Bank Statement', required: true },
                    { key: 'photoId', label: 'Photo ID (Passport/Driver\'s License)', required: true },
                  ].map(({ key, label, required }) => (
                    <div key={key} className="border border-gray-300 rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {label} {required && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type="file"
                        required={required}
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileChange(key as keyof FormData, e.target.files?.[0] || null)}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--brand-primary)] file:text-white hover:file:bg-[var(--brand-primary-hover)]"
                      />
                      {formData[key as keyof FormData] && (
                        <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          File selected
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingKyc}
                className="w-full bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-accent)] text-white font-bold py-4 rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
              >
                {isSubmittingKyc ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
                ) : (
                  <><Shield className="w-5 h-5" /> Submit for Review</>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center mt-3">
                Your data is encrypted and processed securely. Review starts after submission.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
