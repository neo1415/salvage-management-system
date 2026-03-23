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
  Info,
  Award,
  Upload,
  X,
  FileText,
  Building2,
  CreditCard,
  IdCard,
  TrendingUp
} from 'lucide-react';

/**
 * Tier 2 KYC Verification Page
 * 
 * Allows vendors to complete Tier 2 KYC verification with full business documentation
 * Features:
 * - Business information form (business name, CAC, TIN)
 * - Bank account details form
 * - Document upload fields (CAC certificate, bank statement, NIN card)
 * - Drag-and-drop file upload
 * - Upload progress
 * - Pending approval status display
 * 
 * Requirements: 6, NFR5.3
 */

interface UploadedFile {
  file: File;
  preview: string;
  uploading: boolean;
  progress: number;
  url?: string;
  error?: string;
}

export default function Tier2KYCPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [cacNumber, setCacNumber] = useState('');
  const [tin, setTin] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');

  // File upload state
  const [cacCertificate, setCacCertificate] = useState<UploadedFile | null>(null);
  const [bankStatement, setBankStatement] = useState<UploadedFile | null>(null);
  const [ninCard, setNinCard] = useState<UploadedFile | null>(null);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [dragActive, setDragActive] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Handle drag events
  const handleDrag = (e: React.DragEvent, fieldName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(fieldName);
    } else if (e.type === 'dragleave') {
      setDragActive(null);
    }
  };

  // Handle file drop
  const handleDrop = (e: React.DragEvent, fieldName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(null);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0], fieldName);
    }
  };

  // Validate file
  const validateFile = (file: File, fieldName: string): string | null => {
    // Size validation
    const maxSize = fieldName === 'bankStatement' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return `File size exceeds ${maxSize / (1024 * 1024)}MB limit`;
    }

    // Type validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return `File type ${file.type} is not allowed. Please upload JPG, PNG, or PDF`;
    }

    return null;
  };

  // Handle file selection
  const handleFileSelect = (file: File, fieldName: string) => {
    const validationError = validateFile(file, fieldName);
    if (validationError) {
      setError(validationError);
      return;
    }

    const preview = file.type.startsWith('image/') 
      ? URL.createObjectURL(file) 
      : '';

    const uploadedFile: UploadedFile = {
      file,
      preview,
      uploading: false,
      progress: 0,
    };

    if (fieldName === 'cacCertificate') {
      setCacCertificate(uploadedFile);
    } else if (fieldName === 'bankStatement') {
      setBankStatement(uploadedFile);
    } else if (fieldName === 'ninCard') {
      setNinCard(uploadedFile);
    }

    setError(null);
  };

  // Remove file
  const removeFile = (fieldName: string) => {
    if (fieldName === 'cacCertificate') {
      if (cacCertificate?.preview) URL.revokeObjectURL(cacCertificate.preview);
      setCacCertificate(null);
    } else if (fieldName === 'bankStatement') {
      if (bankStatement?.preview) URL.revokeObjectURL(bankStatement.preview);
      setBankStatement(null);
    } else if (fieldName === 'ninCard') {
      if (ninCard?.preview) URL.revokeObjectURL(ninCard.preview);
      setNinCard(null);
    }
  };

  // Upload file to Cloudinary
  const uploadFile = async (uploadedFile: UploadedFile, fieldName: string): Promise<string> => {
    // Update uploading state
    const setFileState = (updater: (prev: UploadedFile | null) => UploadedFile | null) => {
      if (fieldName === 'cacCertificate') {
        setCacCertificate(updater);
      } else if (fieldName === 'bankStatement') {
        setBankStatement(updater);
      } else if (fieldName === 'ninCard') {
        setNinCard(updater);
      }
    };

    setFileState((prev) => prev ? { ...prev, uploading: true, progress: 0 } : null);

    try {
      // Get signed upload parameters
      const signResponse = await fetch('/api/upload/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityType: 'kyc-document',
          entityId: session?.user?.id || 'temp',
        }),
      });

      if (!signResponse.ok) {
        throw new Error('Failed to get signed upload parameters');
      }

      const signData = await signResponse.json();

      // Upload to Cloudinary
      const formData = new FormData();
      formData.append('file', uploadedFile.file);
      formData.append('signature', signData.signature);
      formData.append('timestamp', signData.timestamp.toString());
      formData.append('folder', signData.folder);
      formData.append('api_key', signData.apiKey);

      const xhr = new XMLHttpRequest();

      // Track progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setFileState((prev) => prev ? { ...prev, progress: percentComplete } : null);
        }
      });

      const uploadPromise = new Promise<string>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            const result = JSON.parse(xhr.responseText);
            resolve(result.secure_url);
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.open('POST', signData.uploadUrl);
        xhr.send(formData);
      });

      const url = await uploadPromise;
      setFileState((prev) => prev ? { ...prev, url, uploading: false, progress: 100 } : null);
      return url;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setFileState((prev) => prev ? { ...prev, error: errorMsg, uploading: false } : null);
      throw err;
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!businessName || !cacNumber || !tin || !bankAccountNumber || !bankName || !bankAccountName) {
      setError('Please fill in all required fields');
      return;
    }

    if (!cacCertificate || !bankStatement || !ninCard) {
      setError('Please upload all required documents');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Upload all files
      const [cacUrl, bankStatementUrl, ninCardUrl] = await Promise.all([
        cacCertificate.url || uploadFile(cacCertificate, 'cacCertificate'),
        bankStatement.url || uploadFile(bankStatement, 'bankStatement'),
        ninCard.url || uploadFile(ninCard, 'ninCard'),
      ]);

      // Submit KYC application
      const response = await fetch('/api/vendors/tier2-kyc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessName,
          cacNumber,
          tin,
          bankAccountNumber,
          bankName,
          bankAccountName,
          cacCertificateUrl: cacUrl,
          bankStatementUrl,
          ninCardUrl,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Submission failed');
      }

      // Show success
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#800020] to-[#600018] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#800020] to-[#600018] py-8 px-4">
      <div className="w-full max-w-4xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-white hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4">
            <Award className="w-8 h-8 text-[#800020]" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Tier 2 Verification</h1>
          <p className="text-gray-200">
            Complete business verification to unlock unlimited bidding
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Success State */}
          {submitted ? (
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
                <CheckCircle2 className="w-12 h-12 text-blue-600" />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Application Submitted!
              </h2>
              
              <div className="inline-block bg-yellow-100 text-yellow-800 px-6 py-2 rounded-full font-bold mb-6">
                <Loader2 className="w-5 h-5 inline-block mr-2 animate-spin" />
                Pending Review
              </div>
              
              <p className="text-gray-700 mb-6">
                Your Tier 2 KYC application has been submitted successfully. Our team will review your documents and verify your information.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                <h3 className="font-semibold text-blue-900 mb-2">What Happens Next:</h3>
                <ul className="text-sm text-blue-700 space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Our team will verify your NIN, bank account, and CAC documents</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>You'll receive an SMS and email notification within 24 hours</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Once approved, you can bid on unlimited high-value items</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-left">
                <h3 className="font-semibold text-green-900 mb-2">Tier 2 Benefits:</h3>
                <ul className="text-sm text-green-700 space-y-2">
                  <li className="flex items-start gap-2">
                    <TrendingUp className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span><strong>Unlimited bidding</strong> on high-value items above ₦500,000</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <TrendingUp className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span><strong>Priority support</strong> from our team</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <TrendingUp className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span><strong>Leaderboard eligibility</strong> and recognition</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <TrendingUp className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span><strong>Verified Business badge</strong> on your profile</span>
                  </li>
                </ul>
              </div>
              
              <button
                onClick={() => router.push('/vendor/dashboard')}
                className="w-full bg-[#FFD700] text-[#800020] font-bold py-3 px-4 rounded-lg hover:bg-[#FFC700] transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            <>
              {/* Benefits Section */}
              <div className="bg-gradient-to-r from-[#800020] to-[#600018] p-6 text-white">
                <h2 className="text-xl font-bold mb-4">Tier 2 Benefits</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-[#FFD700] rounded-full flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-5 h-5 text-[#800020]" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Unlimited Bidding</h3>
                      <p className="text-sm text-gray-200">Bid on any item, any value</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-[#FFD700] rounded-full flex items-center justify-center flex-shrink-0">
                      <Award className="w-5 h-5 text-[#800020]" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Leaderboard Access</h3>
                      <p className="text-sm text-gray-200">Compete for top vendor spot</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-[#FFD700] rounded-full flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-[#800020]" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Priority Support</h3>
                      <p className="text-sm text-gray-200">Dedicated assistance</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-[#FFD700] rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-[#800020]" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Verified Badge</h3>
                      <p className="text-sm text-gray-200">Build trust & credibility</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Section */}
              <div className="p-6 sm:p-8">
                {/* Error Message */}
                {error && (
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

                {/* Info Box */}
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-blue-900">Required Documents</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Please have your CAC certificate, bank statement (last 3 months), and NIN card ready. All documents will be encrypted and stored securely.
                    </p>
                  </div>
                </div>

                {/* Application Form */}
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Business Information Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Building2 className="w-5 h-5 text-[#800020]" />
                      <h3 className="text-lg font-bold text-gray-900">Business Information</h3>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Business Name */}
                      <div>
                        <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-2">
                          Business Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="businessName"
                          value={businessName}
                          onChange={(e) => {
                            setBusinessName(e.target.value);
                            setError(null);
                          }}
                          disabled={isSubmitting}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="Enter your registered business name"
                        />
                      </div>

                      {/* CAC Number */}
                      <div>
                        <label htmlFor="cacNumber" className="block text-sm font-medium text-gray-700 mb-2">
                          CAC Registration Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="cacNumber"
                          value={cacNumber}
                          onChange={(e) => {
                            setCacNumber(e.target.value.toUpperCase());
                            setError(null);
                          }}
                          disabled={isSubmitting}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="e.g., RC123456"
                        />
                      </div>

                      {/* TIN */}
                      <div>
                        <label htmlFor="tin" className="block text-sm font-medium text-gray-700 mb-2">
                          Tax Identification Number (TIN) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="tin"
                          value={tin}
                          onChange={(e) => {
                            setTin(e.target.value);
                            setError(null);
                          }}
                          disabled={isSubmitting}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="Enter your TIN"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bank Account Details Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <CreditCard className="w-5 h-5 text-[#800020]" />
                      <h3 className="text-lg font-bold text-gray-900">Bank Account Details</h3>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Bank Name */}
                      <div>
                        <label htmlFor="bankName" className="block text-sm font-medium text-gray-700 mb-2">
                          Bank Name <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="bankName"
                          value={bankName}
                          onChange={(e) => {
                            setBankName(e.target.value);
                            setError(null);
                          }}
                          disabled={isSubmitting}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">Select your bank</option>
                          <option value="Access Bank">Access Bank</option>
                          <option value="Citibank">Citibank</option>
                          <option value="Ecobank">Ecobank</option>
                          <option value="Fidelity Bank">Fidelity Bank</option>
                          <option value="First Bank">First Bank</option>
                          <option value="FCMB">FCMB</option>
                          <option value="GTBank">GTBank</option>
                          <option value="Heritage Bank">Heritage Bank</option>
                          <option value="Keystone Bank">Keystone Bank</option>
                          <option value="Polaris Bank">Polaris Bank</option>
                          <option value="Providus Bank">Providus Bank</option>
                          <option value="Stanbic IBTC">Stanbic IBTC</option>
                          <option value="Standard Chartered">Standard Chartered</option>
                          <option value="Sterling Bank">Sterling Bank</option>
                          <option value="Union Bank">Union Bank</option>
                          <option value="UBA">UBA</option>
                          <option value="Unity Bank">Unity Bank</option>
                          <option value="Wema Bank">Wema Bank</option>
                          <option value="Zenith Bank">Zenith Bank</option>
                        </select>
                      </div>

                      {/* Account Number */}
                      <div>
                        <label htmlFor="bankAccountNumber" className="block text-sm font-medium text-gray-700 mb-2">
                          Account Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="bankAccountNumber"
                          value={bankAccountNumber}
                          onChange={(e) => {
                            const digitsOnly = e.target.value.replace(/\D/g, '');
                            if (digitsOnly.length <= 10) {
                              setBankAccountNumber(digitsOnly);
                              setError(null);
                            }
                          }}
                          disabled={isSubmitting}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="Enter 10-digit account number"
                          maxLength={10}
                          inputMode="numeric"
                        />
                      </div>

                      {/* Account Name */}
                      <div>
                        <label htmlFor="bankAccountName" className="block text-sm font-medium text-gray-700 mb-2">
                          Account Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="bankAccountName"
                          value={bankAccountName}
                          onChange={(e) => {
                            setBankAccountName(e.target.value);
                            setError(null);
                          }}
                          disabled={isSubmitting}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="Account name as registered with bank"
                        />
                        <p className="mt-2 text-sm text-gray-600">
                          Must match your business name
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Document Upload Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="w-5 h-5 text-[#800020]" />
                      <h3 className="text-lg font-bold text-gray-900">Document Uploads</h3>
                    </div>

                    
                    <div className="space-y-6">
                      {/* CAC Certificate Upload */}
                      <FileUploadField
                        label="CAC Certificate"
                        description="Upload your Certificate of Incorporation (PDF or JPG, max 5MB)"
                        file={cacCertificate}
                        fieldName="cacCertificate"
                        icon={<Building2 className="w-8 h-8 text-gray-400" />}
                        dragActive={dragActive === 'cacCertificate'}
                        disabled={isSubmitting}
                        onDrag={(e) => handleDrag(e, 'cacCertificate')}
                        onDrop={(e) => handleDrop(e, 'cacCertificate')}
                        onFileSelect={(file) => handleFileSelect(file, 'cacCertificate')}
                        onRemove={() => removeFile('cacCertificate')}
                      />

                      {/* Bank Statement Upload */}
                      <FileUploadField
                        label="Bank Statement"
                        description="Upload bank statement for last 3 months (PDF, max 10MB)"
                        file={bankStatement}
                        fieldName="bankStatement"
                        icon={<CreditCard className="w-8 h-8 text-gray-400" />}
                        dragActive={dragActive === 'bankStatement'}
                        disabled={isSubmitting}
                        onDrag={(e) => handleDrag(e, 'bankStatement')}
                        onDrop={(e) => handleDrop(e, 'bankStatement')}
                        onFileSelect={(file) => handleFileSelect(file, 'bankStatement')}
                        onRemove={() => removeFile('bankStatement')}
                      />

                      {/* NIN Card Upload */}
                      <FileUploadField
                        label="National ID Card (NIN)"
                        description="Upload your NIN card or slip (JPG or PDF, max 5MB)"
                        file={ninCard}
                        fieldName="ninCard"
                        icon={<IdCard className="w-8 h-8 text-gray-400" />}
                        dragActive={dragActive === 'ninCard'}
                        disabled={isSubmitting}
                        onDrag={(e) => handleDrag(e, 'ninCard')}
                        onDrop={(e) => handleDrop(e, 'ninCard')}
                        onFileSelect={(file) => handleFileSelect(file, 'ninCard')}
                        onRemove={() => removeFile('ninCard')}
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      !businessName ||
                      !cacNumber ||
                      !tin ||
                      !bankAccountNumber ||
                      !bankName ||
                      !bankAccountName ||
                      !cacCertificate ||
                      !bankStatement ||
                      !ninCard ||
                      cacCertificate?.uploading ||
                      bankStatement?.uploading ||
                      ninCard?.uploading
                    }
                    className="w-full bg-[#FFD700] text-[#800020] font-bold py-4 px-4 rounded-lg hover:bg-[#FFC700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        Submitting Application...
                      </>
                    ) : (
                      <>
                        <Shield className="w-6 h-6" />
                        Submit for Review
                      </>
                    )}
                  </button>
                </form>

                {/* Security Notice */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-start gap-3 text-sm text-gray-600">
                    <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-700 mb-1">Your documents are secure</p>
                      <p>
                        All uploaded documents are encrypted with AES-256 encryption and stored securely. Your information is never shared with third parties and complies with NDPR regulations.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Help */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-300">
            Need help with verification?{' '}
            <a href="/contact" className="text-[#FFD700] hover:underline">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * File Upload Field Component
 */
interface FileUploadFieldProps {
  label: string;
  description: string;
  file: UploadedFile | null;
  fieldName: string;
  icon: React.ReactNode;
  dragActive: boolean;
  disabled: boolean;
  onDrag: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
}

function FileUploadField({
  label,
  description,
  file,
  fieldName,
  icon,
  dragActive,
  disabled,
  onDrag,
  onDrop,
  onFileSelect,
  onRemove,
}: FileUploadFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} <span className="text-red-500">*</span>
      </label>
      
      {!file ? (
        <div
          onDragEnter={onDrag}
          onDragLeave={onDrag}
          onDragOver={onDrag}
          onDrop={onDrop}
          className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragActive
              ? 'border-[#800020] bg-[#80002010]'
              : 'border-gray-300 hover:border-gray-400'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <input
            type="file"
            id={fieldName}
            accept="image/jpeg,image/png,image/jpg,application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileSelect(file);
            }}
            disabled={disabled}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          
          <div className="flex flex-col items-center gap-3">
            {icon}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">
                <span className="text-[#800020]">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">{description}</p>
            </div>
            <Upload className="w-5 h-5 text-gray-400" />
          </div>
        </div>
      ) : (
        <div className="border-2 border-gray-300 rounded-lg p-4">
          {/* File Preview */}
          <div className="flex items-start gap-4">
            {/* Preview Image or Icon */}
            <div className="flex-shrink-0">
              {file.preview ? (
                <Image
                  src={file.preview}
                  alt="Preview"
                  width={80}
                  height={80}
                  className="object-cover rounded"
                />
              ) : (
                <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center">
                  <FileText className="w-10 h-10 text-gray-400" />
                </div>
              )}
            </div>

            {/* File Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {file.file.name}
              </p>
              <p className="text-xs text-gray-500">
                {(file.file.size / 1024 / 1024).toFixed(2)} MB
              </p>

              {/* Upload Progress */}
              {file.uploading && (
                <div className="mt-2">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-blue-700">Uploading...</span>
                    <span className="text-xs text-blue-700">{file.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Upload Success */}
              {file.url && !file.uploading && (
                <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Uploaded successfully</span>
                </div>
              )}

              {/* Upload Error */}
              {file.error && (
                <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="w-3 h-3" />
                  <span>{file.error}</span>
                </div>
              )}
            </div>

            {/* Remove Button */}
            {!file.uploading && (
              <button
                type="button"
                onClick={onRemove}
                disabled={disabled}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
