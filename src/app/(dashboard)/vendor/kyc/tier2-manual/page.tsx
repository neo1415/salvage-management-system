'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import imageCompression from 'browser-image-compression';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  Building,
  CheckCircle2,
  Clock,
  FileText,
  Home,
  Loader2,
  RefreshCw,
  Shield,
  User,
  XCircle,
} from 'lucide-react';

type PageState = 'idle' | 'loading' | 'submitting' | 'pending_review' | 'approved' | 'rejected';
type CheckState = 'idle' | 'checking' | 'verified' | 'review' | 'unavailable' | 'failed';
type BusinessType = 'individual' | 'business_name' | 'incorporated_company' | 'limited_company';
type BusinessDocumentType = 'cac_certificate' | 'memorandum_articles' | 'business_registration';
type GovernmentIdType = 'nin_slip' | 'drivers_license' | 'passport' | 'voters_card' | 'national_id';

interface FormDataState {
  businessName: string;
  businessType: BusinessType;
  cacNumber: string;
  address: string;
  city: string;
  state: string;
  nin: string;
  bvn: string;
  businessDocumentType: BusinessDocumentType;
  governmentIdType: GovernmentIdType;
  businessDocument: File | null;
  governmentIdDocument: File | null;
  addressProof: File | null;
}

interface VerificationCheck {
  state: CheckState;
  message: string;
}

const initialCheck: VerificationCheck = { state: 'idle', message: 'Not checked yet' };

const businessDocumentOptions: Array<{ value: BusinessDocumentType; label: string }> = [
  { value: 'cac_certificate', label: 'CAC certificate' },
  { value: 'memorandum_articles', label: 'Memorandum and Articles' },
  { value: 'business_registration', label: 'Business registration document' },
];

const governmentIdOptions: Array<{ value: GovernmentIdType; label: string }> = [
  { value: 'nin_slip', label: 'NIN slip' },
  { value: 'drivers_license', label: "Driver's license" },
  { value: 'passport', label: 'International passport' },
  { value: 'voters_card', label: "Voter's card" },
  { value: 'national_id', label: 'National ID card' },
];

function checkTone(state: CheckState): string {
  if (state === 'verified') return 'border-green-200 bg-green-50 text-green-800';
  if (state === 'review') return 'border-yellow-200 bg-yellow-50 text-yellow-800';
  if (state === 'failed') return 'border-red-200 bg-red-50 text-red-800';
  if (state === 'unavailable') return 'border-blue-200 bg-blue-50 text-blue-800';
  return 'border-gray-200 bg-gray-50 text-gray-600';
}

function normalizeDigits(value: string, maxLength = 11): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

export default function Tier2ManualKYCPage() {
  const router = useRouter();
  const { status: authStatus } = useSession();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bvnAlreadyVerified, setBvnAlreadyVerified] = useState(false);
  const [checks, setChecks] = useState<Record<'bvn' | 'nin' | 'cac', VerificationCheck>>({
    bvn: initialCheck,
    nin: initialCheck,
    cac: initialCheck,
  });
  const [formData, setFormData] = useState<FormDataState>({
    businessName: '',
    businessType: 'business_name',
    cacNumber: '',
    address: '',
    city: '',
    state: '',
    nin: '',
    bvn: '',
    businessDocumentType: 'cac_certificate',
    governmentIdType: 'nin_slip',
    businessDocument: null,
    governmentIdDocument: null,
    addressProof: null,
  });

  const isSubmittingKyc = pageState === 'submitting';
  const needsBusinessDocument = formData.businessType !== 'individual';
  const needsBvn = !bvnAlreadyVerified;
  const canCheckCac = needsBusinessDocument && formData.cacNumber.trim().length >= 4 && formData.businessName.trim().length >= 2;
  const canCheckNin = /^\d{11}$/.test(formData.nin);
  const canCheckBvn = needsBvn && /^\d{11}$/.test(formData.bvn);

  const documents = useMemo(
    () => [
      {
        key: 'businessDocument' as const,
        label: formData.businessDocumentType === 'memorandum_articles'
          ? 'Memorandum and Articles'
          : formData.businessDocumentType === 'business_registration'
            ? 'Business registration document'
            : 'CAC certificate',
        required: needsBusinessDocument,
      },
      {
        key: 'governmentIdDocument' as const,
        label: governmentIdOptions.find((option) => option.value === formData.governmentIdType)?.label ?? 'Government ID',
        required: true,
      },
      {
        key: 'addressProof' as const,
        label: 'Proof of address / utility bill',
        required: true,
      },
    ],
    [formData.businessDocumentType, formData.governmentIdType, needsBusinessDocument]
  );

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login');
    if (authStatus !== 'authenticated') return;

    async function loadState() {
      try {
        const feeRes = await fetch('/api/vendors/registration-fee/status');
        const feeData = await feeRes.json();
        if (!feeData?.data?.paid) {
          router.push('/vendor/registration-fee');
          return;
        }

        const [statusRes, profileRes] = await Promise.all([
          fetch('/api/kyc/status'),
          fetch('/api/settings/profile'),
        ]);

        const statusData = await statusRes.json();
        const profileData = await profileRes.json().catch(() => null);
        const vendor = profileData?.vendor;

        if (vendor) {
          setBvnAlreadyVerified(Boolean(vendor.bvnVerifiedAt));
          setFormData((prev) => ({
            ...prev,
            businessName: vendor.businessName ?? prev.businessName,
            businessType: (vendor.businessType as BusinessType | null) ?? prev.businessType,
            cacNumber: vendor.cacNumber ?? prev.cacNumber,
          }));
          if (vendor.bvnVerifiedAt) {
            setChecks((prev) => ({
              ...prev,
              bvn: { state: 'verified', message: 'BVN already verified from Tier 1.' },
            }));
          }
        }

        if (statusData?.status === 'pending_review') setPageState('pending_review');
        else if (statusData?.status === 'approved') setPageState('approved');
        else if (statusData?.status === 'rejected') setPageState('rejected');
        else setPageState('idle');
      } catch {
        setPageState('idle');
      }
    }

    void loadState();
  }, [authStatus, router]);

  const handleFileChange = async (field: keyof FormDataState, file: File | null) => {
    if (!file) {
      setFormData((prev) => ({ ...prev, [field]: null }));
      return;
    }

    if (file.type.startsWith('image/')) {
      try {
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.8,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: file.type,
        });
        setFormData((prev) => ({
          ...prev,
          [field]: new File([compressed], compressed.name || file.name, {
            type: compressed.type || file.type,
            lastModified: compressed.lastModified || Date.now(),
          }),
        }));
        return;
      } catch (error) {
        console.error('Image compression failed:', error);
      }
    }

    setFormData((prev) => ({ ...prev, [field]: file }));
  };

  const handleInputChange = (field: keyof FormDataState, value: string) => {
    const nextValue = field === 'nin' || field === 'bvn' ? normalizeDigits(value) : value;
    setFormData((prev) => ({ ...prev, [field]: nextValue }));
    if (field === 'nin') setChecks((prev) => ({ ...prev, nin: initialCheck }));
    if (field === 'bvn') setChecks((prev) => ({ ...prev, bvn: initialCheck }));
    if (field === 'cacNumber' || field === 'businessName') setChecks((prev) => ({ ...prev, cac: initialCheck }));
  };

  const runCheck = async (type: 'bvn' | 'nin' | 'cac') => {
    setChecks((prev) => ({ ...prev, [type]: { state: 'checking', message: 'Checking with verification provider...' } }));
    const payload = {
      type,
      bvn: formData.bvn,
      nin: formData.nin,
      cacNumber: formData.cacNumber,
      businessName: formData.businessName,
      businessType: formData.businessType,
    };

    try {
      const res = await fetch('/api/kyc/manual/verify-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setChecks((prev) => ({
        ...prev,
        [type]: {
          state: data.state ?? (res.ok ? 'review' : 'failed'),
          message: data.message ?? 'Verification check completed.',
        },
      }));
    } catch {
      setChecks((prev) => ({
        ...prev,
        [type]: { state: 'unavailable', message: 'Provider check is unavailable. Managers can still review the uploaded evidence.' },
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPageState('submitting');
    setErrorMessage(null);

    try {
      const submitData = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (value && !(value instanceof File)) submitData.append(key, value.toString());
      });

      for (const { key } of documents) {
        const file = formData[key];
        if (file) submitData.append(key, file);
      }

      const res = await fetch('/api/kyc/manual/submit', { method: 'POST', body: submitData });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.details ? `${data.error}\n\n${data.details}` : data.error ?? 'Submission failed. Please try again.');
        setPageState('idle');
        return;
      }

      setPageState('pending_review');
    } catch {
      setErrorMessage('Network error. Please check your connection and try again.');
      setPageState('idle');
    }
  };

  if (authStatus === 'loading' || pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-hover)] flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" />
          <p>Loading verification...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-hover)] py-8 px-4">
      <div className="w-full max-w-4xl mx-auto">
        <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-white hover:text-gray-200 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4">
            <Award className="w-8 h-8 text-[var(--brand-primary)]" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Tier 2 Verification</h1>
          <p className="text-gray-200">Upload business, identity, and address evidence for manager review.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {pageState === 'pending_review' && (
            <StatusPanel
              icon={<Clock className="w-12 h-12 text-yellow-600" />}
              iconClass="bg-yellow-100"
              title="Under Review"
              text="Your application is being reviewed. You will receive an SMS and email notification once a decision is made."
              onClick={() => router.push('/vendor/dashboard')}
            />
          )}

          {pageState === 'approved' && (
            <StatusPanel
              icon={<CheckCircle2 className="w-12 h-12 text-green-600" />}
              iconClass="bg-green-100"
              title="Approved"
              text="Your full verification has been approved. Your account access has been updated."
              onClick={() => router.push('/vendor/dashboard')}
            />
          )}

          {pageState === 'rejected' && (
            <StatusPanel
              icon={<XCircle className="w-12 h-12 text-red-600" />}
              iconClass="bg-red-100"
              title="Application Rejected"
              text="Your application was not approved. You may resubmit after 24 hours. Contact support for assistance."
              onClick={() => router.push('/vendor/dashboard')}
            />
          )}

          {pageState === 'submitting' && (
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Submitting Your Application</h2>
              <p className="text-gray-600 mb-4">Uploading documents, encrypting sensitive fields, and running available provider checks...</p>
              <p className="text-xs text-gray-500 mt-4">Please do not close this page.</p>
            </div>
          )}

          {pageState === 'idle' && (
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-7">
              <div className="bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-hover)] rounded-xl p-5 text-white">
                <h2 className="text-lg font-bold mb-3">Controlled Tier 2 Review</h2>
                <p className="mb-3 text-sm text-gray-100">
                  NEM Salvage collects your evidence directly, runs available Dojah checks, and sends the full file to the review team.
                </p>
                <ul className="space-y-2 text-sm text-gray-200">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[var(--brand-accent)]" /> Provider checks support the review but do not hide your application inside a third-party widget.</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[var(--brand-accent)]" /> Uploaded documents are stored privately for authorized manager review.</li>
                </ul>
              </div>

              {errorMessage && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 whitespace-pre-line">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{errorMessage}</p>
                </div>
              )}

              <section>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Business Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextField label="Business Name" required value={formData.businessName} onChange={(v) => handleInputChange('businessName', v)} />
                  <SelectField
                    label="Business Type"
                    required
                    value={formData.businessType}
                    onChange={(v) => handleInputChange('businessType', v)}
                    options={[
                      { value: 'business_name', label: 'Business name' },
                      { value: 'incorporated_company', label: 'Incorporated company' },
                      { value: 'limited_company', label: 'Limited company' },
                      { value: 'individual', label: 'Individual bidder' },
                    ]}
                  />
                  {needsBusinessDocument && (
                    <>
                      <div>
                        <TextField label="CAC / RC Number" required value={formData.cacNumber} onChange={(v) => handleInputChange('cacNumber', v)} />
                        <CheckMessage check={checks.cac} />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          disabled={!canCheckCac || checks.cac.state === 'checking'}
                          onClick={() => runCheck('cac')}
                          className="w-full px-4 py-3 rounded-lg border border-[var(--brand-primary)] text-[var(--brand-primary)] font-semibold hover:bg-[var(--brand-primary)] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {checks.cac.state === 'checking' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          Check CAC
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Home className="w-5 h-5" />
                  Address
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  <TextField label="Street Address" required value={formData.address} onChange={(v) => handleInputChange('address', v)} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <TextField label="City" required value={formData.city} onChange={(v) => handleInputChange('city', v)} />
                    <TextField label="State" required value={formData.state} onChange={(v) => handleInputChange('state', v)} />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Identity Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <TextField label="NIN" required inputMode="numeric" maxLength={11} value={formData.nin} onChange={(v) => handleInputChange('nin', v)} />
                    <CheckMessage check={checks.nin} />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={!canCheckNin || checks.nin.state === 'checking'}
                      onClick={() => runCheck('nin')}
                      className="w-full px-4 py-3 rounded-lg border border-[var(--brand-primary)] text-[var(--brand-primary)] font-semibold hover:bg-[var(--brand-primary)] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {checks.nin.state === 'checking' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Check NIN
                    </button>
                  </div>

                  {needsBvn ? (
                    <>
                      <div>
                        <TextField label="BVN" required inputMode="numeric" maxLength={11} value={formData.bvn} onChange={(v) => handleInputChange('bvn', v)} />
                        <CheckMessage check={checks.bvn} />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          disabled={!canCheckBvn || checks.bvn.state === 'checking'}
                          onClick={() => runCheck('bvn')}
                          className="w-full px-4 py-3 rounded-lg border border-[var(--brand-primary)] text-[var(--brand-primary)] font-semibold hover:bg-[var(--brand-primary)] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {checks.bvn.state === 'checking' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          Check BVN
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="md:col-span-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                      BVN is already verified from Tier 1, so you do not need to enter it again.
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Documents
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {needsBusinessDocument && (
                    <SelectField
                      label="Business Document Type"
                      value={formData.businessDocumentType}
                      onChange={(v) => handleInputChange('businessDocumentType', v)}
                      options={businessDocumentOptions}
                    />
                  )}
                  <SelectField
                    label="Government ID Type"
                    value={formData.governmentIdType}
                    onChange={(v) => handleInputChange('governmentIdType', v)}
                    options={governmentIdOptions}
                  />
                </div>
                <div className="space-y-4">
                  {documents.map(({ key, label, required }) => (
                    <div key={key} className="border border-gray-300 rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {label} {required && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type="file"
                        required={required}
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileChange(key, e.target.files?.[0] || null)}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--brand-primary)] file:text-white hover:file:bg-[var(--brand-primary-hover)]"
                      />
                      {formData[key] && (
                        <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          {(formData[key] as File).name}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                <strong>Liveness note:</strong> A normal uploaded selfie is not treated as a liveness check. If NEM enables a Dojah liveness-only step, that provider result will be linked to this application before final approval.
              </div>

              <button
                type="submit"
                disabled={isSubmittingKyc}
                className="w-full bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-accent)] text-white font-bold py-4 rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
              >
                {isSubmittingKyc ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</> : <><Shield className="w-5 h-5" /> Submit for Review</>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPanel({
  icon,
  iconClass,
  title,
  text,
  onClick,
}: {
  icon: ReactNode;
  iconClass: string;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <div className="p-8 text-center">
      <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${iconClass}`}>{icon}</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-600 mb-6">{text}</p>
      <button
        onClick={onClick}
        className="w-full bg-[var(--brand-accent)] text-[var(--brand-primary)] font-bold py-3 rounded-lg hover:bg-[var(--brand-accent-hover)] transition-colors"
      >
        Back to Dashboard
      </button>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  maxLength,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  maxLength?: number;
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="text"
        required={required}
        maxLength={maxLength}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
      />
    </div>
  );
}

function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

function CheckMessage({ check }: { check: VerificationCheck }) {
  return (
    <div className={`mt-2 rounded-md border px-3 py-2 text-xs ${checkTone(check.state)}`}>
      {check.state === 'checking' ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
      {check.message}
    </div>
  );
}
