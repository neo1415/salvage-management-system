'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAppRouter } from '@/hooks/use-app-router';
import { useSession } from 'next-auth/react';
import Script from 'next/script';
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
  Shield,
  User,
  XCircle,
} from 'lucide-react';
import {
  isDojahWidgetFinalSuccess,
  isDojahWidgetIntermediateStep,
  resolveDojahWidgetReference,
  type DojahWidgetCallbackResponse,
} from '@/lib/kyc/dojah-widget-completion';
import { isPendingTier2Review, type Tier2StatusLike } from '@/features/kyc/utils/tier2-status';
import { VERIFICATION_COPY, verificationTeamLabel } from '@/lib/kyc/verification-copy';
import { usePublicBranding } from '@/hooks/use-public-branding';
import { usePublicBusinessPolicy } from '@/hooks/use-public-business-policy';
import { kycVerificationPageTitle } from '@/lib/vendor/onboarding-policy-ui';

type PageState =
  | 'idle'
  | 'loading'
  | 'submitting'
  | 'liveness'
  | 'liveness_pending'
  | 'liveness_submitted'
  | 'pending_review'
  | 'approved'
  | 'rejected';
type CheckState = 'idle' | 'checking' | 'verified' | 'review' | 'unavailable' | 'failed';
type BusinessType =
  | 'individual'
  | 'business_name'
  | 'incorporated_company'
  | 'limited_company'
  | 'private_limited_company'
  | 'public_limited_company'
  | 'company_limited_by_shares'
  | 'company_limited_by_guarantee'
  | 'unlimited_company'
  | 'incorporated_trustees'
  | 'limited_liability_partnership'
  | 'limited_partnership';
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

interface DojahConnect {
  setup(): void;
  open(): void;
}

interface DojahWidgetOptions {
  app_id: string;
  p_key: string;
  type: string;
  reference_id?: string;
  config?: { widget_id?: string };
  user_data?: {
    first_name?: string;
    last_name?: string;
    dob?: string;
    email?: string;
  };
  gov_data?: { mobile?: string };
  metadata?: Record<string, string>;
  onSuccess: (response: DojahWidgetCallbackResponse) => void;
  onComplete?: (response: DojahWidgetCallbackResponse) => void;
  onError: (err: unknown) => void;
  onClose: () => void;
}

type LivenessWidgetConfig = {
  appId: string;
  publicKey: string;
  widgetId?: string | null;
  verificationReference?: string;
  phone?: string;
  dob?: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
};

const initialCheck: VerificationCheck = { state: 'idle', message: 'Not checked yet' };
const DOJAH_IFRAME_ALLOW = 'camera; microphone; geolocation; fullscreen; autoplay';

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

function getDojahConnectConstructor() {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { Connect?: new (options: DojahWidgetOptions) => DojahConnect }).Connect ?? null;
}

export default function Tier2ManualKYCPage() {
  const router = useAppRouter();
  const { status: authStatus } = useSession();
  const { branding } = usePublicBranding();
  const { policy } = usePublicBusinessPolicy();
  const pageTitle = policy ? kycVerificationPageTitle(policy) : 'Complete your KYC';
  const reviewTeam = verificationTeamLabel(branding.brandName);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bvnAlreadyVerified, setBvnAlreadyVerified] = useState(false);
  const [livenessConfig, setLivenessConfig] = useState<LivenessWidgetConfig | null>(null);
  const [livenessReady, setLivenessReady] = useState(false);
  const [livenessAvailable, setLivenessAvailable] = useState(false);
  const [livenessConfigMessage, setLivenessConfigMessage] = useState<string | null>(null);
  const [connect, setConnect] = useState<DojahConnect | null>(null);
  const manualReferenceRef = useRef<string | null>(null);
  const pendingLivenessReferenceRef = useRef<string | null>(null);
  const lastAutoCheckKeyRef = useRef<Record<'bvn' | 'nin' | 'cac', string>>({
    bvn: '',
    nin: '',
    cac: '',
  });
  const runningCheckKeyRef = useRef<Set<string>>(new Set());
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
        const feeRequired = feeData?.data?.required ?? true;
        if (feeRequired && !feeData?.data?.paid) {
          router.push('/vendor/registration-fee');
          return;
        }

        const [statusRes, profileRes] = await Promise.all([
          fetch('/api/kyc/status'),
          fetch('/api/settings/profile'),
        ]);

        const statusData = (await statusRes.json().catch(() => null)) as Tier2StatusLike | null;
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

        if (statusData?.status === 'rejected') setPageState('rejected');
        else if (statusData?.status === 'approved') {
          router.replace('/vendor/dashboard');
          return;
        }
        if (statusData?.livenessReferenceId) {
          pendingLivenessReferenceRef.current = statusData.livenessReferenceId;
        }

        if (statusData?.status === 'liveness_submitted') setPageState('liveness_submitted');
        else if (statusData?.status === 'liveness_pending') setPageState('liveness_pending');
        else if (isPendingTier2Review(statusData)) setPageState('pending_review');
        else setPageState('idle');

        fetch('/api/kyc/widget-config?mode=liveness')
          .then(async (res) => {
            if (!res.ok) {
              setLivenessAvailable(false);
              const data = await res.json().catch(() => null) as { message?: unknown; error?: unknown } | null;
              const message = typeof data?.message === 'string'
                ? data.message
                : typeof data?.error === 'string'
                  ? data.error
                  : 'Face check is not available right now. Please contact support if this continues.';
              setLivenessConfigMessage(message);
              return null;
            }
            const config = (await res.json()) as LivenessWidgetConfig;
            setLivenessConfig(config);
            setLivenessAvailable(Boolean(config.widgetId && config.verificationReference));
            setLivenessConfigMessage(null);
            return config;
          })
          .catch(() => {
            setLivenessAvailable(false);
            setLivenessConfigMessage('Face check could not load. Check your connection and try again.');
          });
      } catch {
        setPageState('idle');
      }
    }

    void loadState();
  }, [authStatus, router]);

  const applyDojahIframePermissions = useCallback(() => {
    if (typeof document === 'undefined') return;
    const iframes = document.querySelectorAll<HTMLIFrameElement>(
      'iframe[src*="dojah.io"], iframe[src*="identity.dojah.io"], iframe[src*="widget.dojah.io"]'
    );
    iframes.forEach((iframe) => {
      const existingAllow = iframe.getAttribute('allow') ?? '';
      const allowParts = new Set(
        `${existingAllow}; ${DOJAH_IFRAME_ALLOW}`
          .split(';')
          .map((part) => part.trim())
          .filter(Boolean)
      );
      iframe.setAttribute('allow', Array.from(allowParts).join('; '));
    });
  }, []);

  const completeLiveness = useCallback(async (referenceId: string) => {
    setPageState('liveness');
    try {
      const res = await fetch('/api/kyc/manual/liveness/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference_id: referenceId,
          manual_reference: manualReferenceRef.current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(data.error ?? 'Face check is finalizing. Your documents are saved, and you can retry in a moment if this does not update.');
        setPageState('liveness_submitted');
        return;
      }
      setPageState('pending_review');
    } catch {
      setErrorMessage('Network dropped while linking the face check. Your documents are saved, and you can retry the face check.');
      setPageState('liveness_pending');
    }
  }, []);

  const openLivenessWidget = useCallback(() => {
    if (!connect || !livenessReady) {
      setErrorMessage(livenessConfigMessage ?? 'Face check is still loading. Please wait a moment and try again.');
      return;
    }
    setPageState('liveness');
    applyDojahIframePermissions();
    connect.open();
    window.setTimeout(applyDojahIframePermissions, 250);
    window.setTimeout(applyDojahIframePermissions, 1000);
  }, [applyDojahIframePermissions, connect, livenessReady]);

  const initLivenessWidget = useCallback(() => {
    const Connect = getDojahConnectConstructor();
    if (!livenessConfig || !Connect || !livenessConfig.widgetId) return;

    const handleCompletion = async (response: DojahWidgetCallbackResponse | undefined) => {
      const referenceId = resolveDojahWidgetReference(response) ?? livenessConfig.verificationReference;
      if (!referenceId) {
        setErrorMessage(VERIFICATION_COPY.livenessReferenceMissing);
        setPageState('liveness_pending');
        return;
      }
      if (pendingLivenessReferenceRef.current === `completed:${referenceId}`) return;
      pendingLivenessReferenceRef.current = `completed:${referenceId}`;
      await completeLiveness(referenceId);
    };

    const instance = new Connect({
      app_id: livenessConfig.appId,
      p_key: livenessConfig.publicKey,
      type: 'custom',
      reference_id: livenessConfig.verificationReference,
      config: { widget_id: livenessConfig.widgetId },
      user_data: {
        first_name: livenessConfig.profile?.firstName,
        last_name: livenessConfig.profile?.lastName,
        dob: livenessConfig.dob,
        email: livenessConfig.profile?.email,
      },
      gov_data: {
        mobile: livenessConfig.phone,
      },
      metadata: {
        flow: 'nem_hybrid_liveness',
      },
      onSuccess: (response) => {
        const referenceId = resolveDojahWidgetReference(response);
        if (referenceId) {
          pendingLivenessReferenceRef.current = referenceId;
        }

        if (isDojahWidgetFinalSuccess(response) || referenceId) {
          void handleCompletion(response);
        } else if (isDojahWidgetIntermediateStep(response)) {
          setPageState('liveness');
        }
      },
      onComplete: (response) => {
        const referenceId = resolveDojahWidgetReference(response);
        if (referenceId) {
          pendingLivenessReferenceRef.current = referenceId;
        }
      },
      onError: (err) => {
        console.error('[Manual KYC Liveness] Widget error', err);
        setErrorMessage('Face check could not be completed. Your documents are saved, and you can retry the face check.');
        setPageState('liveness_pending');
      },
      onClose: () => {
        const pendingReference = pendingLivenessReferenceRef.current;
        pendingLivenessReferenceRef.current = null;
        if (pendingReference && !pendingReference.startsWith('completed:')) {
          void completeLiveness(pendingReference);
        } else if (pageState === 'liveness') {
          setPageState('liveness_pending');
        }
      },
    });
    instance.setup();
    setConnect(instance);
    setLivenessReady(true);
  }, [completeLiveness, livenessConfig, pageState]);

  useEffect(() => {
    if (livenessConfig && getDojahConnectConstructor()) {
      initLivenessWidget();
    }
  }, [initLivenessWidget, livenessConfig]);

  useEffect(() => {
    applyDojahIframePermissions();
    const observer = new MutationObserver(applyDojahIframePermissions);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [applyDojahIframePermissions]);

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

  useEffect(() => {
    if (pageState !== 'idle') return;

    const timeout = window.setTimeout(() => {
      if (needsBusinessDocument && formData.cacNumber.trim().length >= 4) {
        if (formData.businessName.trim().length < 2) {
          setChecks((prev) => ({
            ...prev,
            cac: { state: 'failed', message: 'Enter the business name so the CAC/RC number can be checked against it.' },
          }));
        } else {
          const key = `${formData.businessName.trim().toLowerCase()}|${formData.cacNumber.trim().toLowerCase()}`;
          if (lastAutoCheckKeyRef.current.cac !== key) {
            lastAutoCheckKeyRef.current.cac = key;
            void runCheck('cac', key);
          }
        }
      }

      if (/^\d{11}$/.test(formData.nin)) {
        const key = formData.nin;
        if (lastAutoCheckKeyRef.current.nin !== key) {
          lastAutoCheckKeyRef.current.nin = key;
          void runCheck('nin', key);
        }
      }

      if (needsBvn && /^\d{11}$/.test(formData.bvn)) {
        const key = formData.bvn;
        if (lastAutoCheckKeyRef.current.bvn !== key) {
          lastAutoCheckKeyRef.current.bvn = key;
          void runCheck('bvn', key);
        }
      }
    }, 800);

    return () => window.clearTimeout(timeout);
    // runCheck intentionally reads current form state; this effect is the debouncer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.businessName,
    formData.cacNumber,
    formData.nin,
    formData.bvn,
    needsBusinessDocument,
    needsBvn,
    pageState,
  ]);

  const runCheck = async (type: 'bvn' | 'nin' | 'cac', dedupeKey?: string) => {
    const requestKey = `${type}:${dedupeKey ?? Date.now()}`;
    if (runningCheckKeyRef.current.has(requestKey)) return;
    runningCheckKeyRef.current.add(requestKey);
    setChecks((prev) => ({ ...prev, [type]: { state: 'checking', message: VERIFICATION_COPY.checkingDetails } }));
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
        [type]: { state: 'unavailable', message: VERIFICATION_COPY.checkUnavailableManagerReview },
      }));
    } finally {
      runningCheckKeyRef.current.delete(requestKey);
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

      manualReferenceRef.current = typeof data.providerReference === 'string' ? data.providerReference : null;
      if (data.livenessRequired !== false && livenessAvailable && connect && livenessReady) {
        openLivenessWidget();
        return;
      }

      setErrorMessage('Your documents were saved, but the face check is not available right now. Please try again in a moment.');
      setPageState('liveness_pending');
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
      <Script
        src="https://widget.dojah.io/widget.js"
        strategy="lazyOnload"
        onLoad={initLivenessWidget}
      />
      <div className="w-full max-w-4xl mx-auto">
        <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-white hover:text-gray-200 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4">
            <Award className="w-8 h-8 text-[var(--brand-primary)]" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{pageTitle}</h1>
          <p className="text-gray-200">
            {policy?.onboarding.mode === 'single_full_kyc'
              ? 'Upload business, identity, and address evidence for review.'
              : 'Upload business, identity, and address evidence for manager review.'}
          </p>
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

          {pageState === 'liveness_pending' && (
            <StatusPanel
              icon={<User className="w-12 h-12 text-blue-600" />}
              iconClass="bg-blue-100"
              title="Face Check Pending"
              text="Your documents are saved. Complete the face check so the review team can finish the application."
              primaryAction="Continue Face Check"
              onPrimaryClick={openLivenessWidget}
              onClick={() => router.push('/vendor/dashboard')}
            />
          )}

          {pageState === 'liveness_submitted' && (
            <StatusPanel
              icon={<Clock className="w-12 h-12 text-yellow-600" />}
              iconClass="bg-yellow-100"
              title="Face Check Finalizing"
              text="Your face check was submitted. We are waiting for the verification result so the review team can finish the application."
              primaryAction="Retry Status Check"
              onPrimaryClick={() => {
                const reference = pendingLivenessReferenceRef.current?.replace(/^completed:/, '');
                if (reference) {
                  void completeLiveness(reference);
                } else {
                  openLivenessWidget();
                }
              }}
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
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
                <XCircle className="w-12 h-12 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Not Approved</h2>
              <p className="text-gray-600 mb-6 text-sm">
                Please correct the requested items and resubmit. You can start a new submission right away.
              </p>
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    await fetch('/api/kyc/prepare-resubmit', { method: 'POST' });
                    setPageState('idle');
                  })();
                }}
                className="w-full bg-[var(--brand-primary)] text-white font-bold py-3 rounded-lg hover:bg-[var(--brand-primary-hover)] transition-colors mb-3"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={() => router.push('/vendor/dashboard')}
                className="w-full border border-gray-300 text-gray-700 font-semibold py-3 rounded-lg hover:bg-gray-50 transition-colors"
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
              <p className="text-gray-600 mb-4">{VERIFICATION_COPY.submittingDocuments}</p>
              <p className="text-xs text-gray-500 mt-4">Please do not close this page.</p>
            </div>
          )}

          {pageState === 'liveness' && (
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Complete Liveness Check</h2>
              <p className="text-gray-600 mb-4">{VERIFICATION_COPY.finishFaceCheck}</p>
              <p className="text-xs text-gray-500 mt-4">If the window closes, your application will remain under review.</p>
            </div>
          )}

          {pageState === 'idle' && (
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-7">
              <div className="bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-hover)] rounded-xl p-5 text-white">
                <h2 className="text-lg font-bold mb-3">{branding.brandName} verification review</h2>
                <p className="mb-3 text-sm text-gray-100">
                  Your evidence is collected on {branding.brandName}, checked against official records where available, and sent to the {reviewTeam}.
                </p>
                <ul className="space-y-2 text-sm text-gray-200">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[var(--brand-accent)]" /> Automated checks support the review without sending you through an external portal.</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[var(--brand-accent)]" /> Uploaded documents are stored privately for authorized review.</li>
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
                      { value: 'private_limited_company', label: 'Private limited company' },
                      { value: 'public_limited_company', label: 'Public limited company / PLC' },
                      { value: 'company_limited_by_shares', label: 'Company limited by shares' },
                      { value: 'company_limited_by_guarantee', label: 'Company limited by guarantee' },
                      { value: 'business_name', label: 'Business name' },
                      { value: 'incorporated_company', label: 'Incorporated company' },
                      { value: 'unlimited_company', label: 'Unlimited company' },
                      { value: 'incorporated_trustees', label: 'Incorporated trustees' },
                      { value: 'limited_liability_partnership', label: 'Limited liability partnership' },
                      { value: 'limited_partnership', label: 'Limited partnership' },
                      { value: 'individual', label: 'Individual bidder' },
                    ]}
                  />
                  {needsBusinessDocument && (
                    <>
                      <div className="md:col-span-2">
                        <TextField label="CAC / RC Number" required value={formData.cacNumber} onChange={(v) => handleInputChange('cacNumber', v)} />
                        <CheckMessage check={checks.cac} />
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
                  <div className="md:col-span-2">
                    <TextField label="NIN" required inputMode="numeric" maxLength={11} value={formData.nin} onChange={(v) => handleInputChange('nin', v)} />
                    <CheckMessage check={checks.nin} />
                  </div>

                  {needsBvn ? (
                    <>
                      <div className="md:col-span-2">
                        <TextField label="BVN" required inputMode="numeric" maxLength={11} value={formData.bvn} onChange={(v) => handleInputChange('bvn', v)} />
                        <CheckMessage check={checks.bvn} />
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
  primaryAction,
  onPrimaryClick,
}: {
  icon: ReactNode;
  iconClass: string;
  title: string;
  text: string;
  onClick: () => void;
  primaryAction?: string;
  onPrimaryClick?: () => void;
}) {
  return (
    <div className="p-8 text-center">
      <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${iconClass}`}>{icon}</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-600 mb-6">{text}</p>
      {primaryAction && onPrimaryClick ? (
        <button
          onClick={onPrimaryClick}
          className="mb-3 w-full bg-[var(--brand-primary)] text-white font-bold py-3 rounded-lg hover:bg-[var(--brand-primary-hover)] transition-colors"
        >
          {primaryAction}
        </button>
      ) : null}
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
