'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Script from 'next/script';
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
  Camera,
  Building2,
  FileCheck2,
  MapPin,
  User,
} from 'lucide-react';
import type { KYCStatus } from '@/features/kyc/types/kyc.types';
import { 
  checkCameraPermission, 
  requestCameraPermission, 
  getCameraPermissionInstructions 
} from '@/lib/utils/camera-permissions';
import {
  checkGeolocationPermission,
  requestGeolocationPermission,
  getGeolocationPermissionInstructions,
} from '@/lib/utils/geolocation-permissions';
import { isKycTestingModeClient } from '@/lib/kyc/kyc-testing-mode';
import {
  resolveTier2ApiError,
  resolveTier2WidgetError,
} from '@/lib/kyc/kyc-user-messages';
import {
  isDojahWidgetFinalSuccess,
  isDojahWidgetIntermediateStep,
  isDojahWidgetRecoverableAfterError,
  resolveDojahWidgetReference,
  type DojahWidgetCallbackResponse,
} from '@/lib/kyc/dojah-widget-completion';
import { VerificationSuccessDialog } from '@/components/kyc/verification-success-dialog';
import type { ResolvedVerificationError } from '@/lib/kyc/kyc-user-messages';
import {
  VerificationErrorAlert,
  VerificationErrorDialog,
} from '@/components/kyc/verification-error-dialog';

declare global {
  interface Window {
    Connect: new (options: DojahWidgetOptions) => DojahConnect;
  }
}

interface DojahWidgetOptions {
  app_id: string;
  p_key: string;
  type: string;
  reference_id?: string;
  config?: {
    widget_id?: string;
  };
  user_data?: {
    first_name?: string;
    last_name?: string;
    dob?: string;
    email?: string;
  };
  gov_data?: {
    bvn?: string;
    nin?: string;
    mobile?: string; // Phone number goes here according to Dojah React SDK docs
  };
  metadata?: Record<string, string>;
  onSuccess: (response: DojahWidgetResponse) => void;
  onComplete?: (response: DojahWidgetResponse) => void;
  onError: (err: unknown) => void;
  onClose: () => void;
}

type DojahWidgetResponse = DojahWidgetCallbackResponse;

type Tier2WidgetConfig = {
  appId: string;
  publicKey: string;
  widgetId?: string | null;
  phone?: string;
  dob?: string;
  vendorId?: string;
  workflowSlug?: string;
  verificationReference?: string;
  profile?: {
    fullName?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
    businessName?: string;
    businessType?: string;
    businessRegistrationNumberMasked?: string;
    hasBusinessRegistrationNumber?: boolean;
    bvnAlreadyVerified?: boolean;
    registrationFeePaid?: boolean;
  };
  requirements?: {
    bvnRequiredInThisFlow: boolean;
    businessData: boolean;
    governmentId: boolean;
    liveness: boolean;
    address: boolean;
    amlScreening: boolean;
    duplicateIdentityCheck: boolean;
    manualReview: boolean;
  };
};

interface DojahConnect {
  setup(): void;
  open(): void;
}

type PageState = 'idle' | 'loading_config' | 'ready' | 'verifying' | 'pending_review' | 'approved' | 'rejected' | 'expired' | 'error';

const DOJAH_IFRAME_ALLOW = 'camera; microphone; geolocation; fullscreen; autoplay';
const TIER2_KYC_PROVIDER = process.env.NEXT_PUBLIC_TIER2_KYC_PROVIDER === 'manual' ? 'manual' : 'dojah';

function formatEmbeddedCameraHelp(prefix: string) {
  return [
    prefix,
    'Camera access is requested inside the verification window, so allowing camera for this app may not be enough.',
    'Please allow camera access when the verification window asks.',
    'If it still fails, check your browser site settings for this app URL and the verification window.',
    'Use the secure HTTPS app address for verification.',
  ].join(' ');
}

function isPlainHttpLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  return window.location.protocol === 'http:' && localHosts.has(window.location.hostname);
}

function getHttpsVerificationUrl(): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl?.startsWith('https://')) return null;

  try {
    const url = new URL(appUrl);
    if (typeof window !== 'undefined') {
      url.pathname = window.location.pathname;
      url.search = window.location.search;
      url.hash = window.location.hash;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function isSoftGeolocationPreflightFailure(error?: string): boolean {
  const text = error?.toLowerCase() ?? '';
  return text.includes('timed out') || text.includes('unavailable');
}

function applyDojahIframePermissions() {
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
    iframe.setAttribute('allowfullscreen', 'true');
  });
}

/**
 * Tier 2 KYC Verification Page — Dojah Widget Integration
 *
 * Replaces the old manual document upload form.
 * Uses Dojah's JS widget for NIN, liveness, biometric, and document verification.
 */
export default function Tier2KYCPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const [pageState, setPageState] = useState<PageState>('loading_config');
  const [widgetConfig, setWidgetConfig] = useState<Tier2WidgetConfig | null>(null);
  const [widgetReady, setWidgetReady] = useState(false);
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [verificationError, setVerificationError] = useState<ResolvedVerificationError | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [connect, setConnect] = useState<DojahConnect | null>(null);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);
  const [geolocationPermissionGranted, setGeolocationPermissionGranted] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(false);
  const [registrationFeePaid, setRegistrationFeePaid] = useState<boolean | null>(null);
  const [widgetSessionActive, setWidgetSessionActive] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successModalCopy, setSuccessModalCopy] = useState({ title: '', message: '' });
  const submissionFinishedRef = useRef(false);
  const pendingWidgetCompletionRef = useRef<string | null>(null);

  const goToDashboard = useCallback(() => {
    setSuccessModalOpen(false);
    router.push('/vendor/dashboard');
  }, [router]);

  const showVerificationError = (
    error: ResolvedVerificationError,
    options?: { openDialog?: boolean; nextPageState?: PageState }
  ) => {
    setVerificationError(error);
    if (options?.openDialog) setErrorDialogOpen(true);
    if (options?.nextPageState) setPageState(options.nextPageState);
  };

  const clearVerificationError = () => {
    setVerificationError(null);
    setErrorDialogOpen(false);
  };

  const showSubmissionSuccess = useCallback((status: 'approved' | 'pending_review') => {
    submissionFinishedRef.current = true;
    setVerificationError(null);
    setErrorDialogOpen(false);
    setWidgetSessionActive(false);
    setPageState(status);
    setSuccessModalCopy({
      title: status === 'approved' ? 'Verification approved' : 'Application submitted',
      message:
        status === 'approved'
          ? 'Your full verification is approved. Your account access has been updated.'
          : 'Your documents were received and are under review. You will get an SMS and email update once review is complete.',
    });
    setSuccessModalOpen(true);
  }, []);

  const recoverSubmissionFromServer = useCallback(async () => {
    try {
      const statusRes = await fetch('/api/kyc/status');
      if (!statusRes.ok) return false;
      const status = (await statusRes.json()) as KYCStatus;
      if (status.status === 'approved' || status.status === 'pending_review') {
        showSubmissionSuccess(status.status);
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }, [showSubmissionSuccess]);

  // Redirect if not authenticated
  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login');
    if (authStatus === 'authenticated') {
      // Check if registration fee is paid
      fetch('/api/vendors/registration-fee/status')
        .then(res => res.json())
        .then(data => {
          if (!data?.data?.paid) {
            router.push('/vendor/registration-fee');
          } else if (TIER2_KYC_PROVIDER === 'manual') {
            router.push('/vendor/kyc/tier2-manual');
          } else {
            setRegistrationFeePaid(true);
          }
        })
        .catch(() => {
          setRegistrationFeePaid(false);
        });
    }
  }, [authStatus, router]);

  async function loadWidgetConfig() {
    const configRes = await fetch('/api/kyc/widget-config');
    if (!configRes.ok) {
      setPageState('error');
      showVerificationError(
        resolveTier2ApiError({ error: 'service_unavailable', message: 'Identity verification is not available. Please contact support.' }),
        { nextPageState: 'error' }
      );
      return false;
    }

    const config = await configRes.json();
    setWidgetConfig(config);
    return true;
  }

  // Load current KYC status first. Only create/load a new widget reference when the
  // vendor is actually ready to start or resubmit verification.
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    if (TIER2_KYC_PROVIDER === 'manual') return;

    async function init() {
      try {
        const [statusRes, feeRes] = await Promise.all([
          fetch('/api/kyc/status'),
          fetch('/api/vendors/registration-fee/status'),
        ]);

        // Check registration fee first
        if (feeRes.ok) {
          const feeData = await feeRes.json();
          setRegistrationFeePaid(feeData?.data?.paid ?? false);
          
          // If registration fee not paid, redirect to payment page
          if (!feeData?.data?.paid) {
            router.push('/vendor/registration-fee');
            return;
          }
        }

        if (statusRes.ok) {
          const status: KYCStatus = await statusRes.json();
          setKycStatus(status);

          const allowRetest = Boolean((status as KYCStatus & { kycTestingMode?: boolean }).kycTestingMode);

          if (!allowRetest) {
            if (status.status === 'approved') { setPageState('approved'); return; }
            if (status.status === 'pending_review') { setPageState('pending_review'); return; }
            if (status.status === 'rejected') { setPageState('rejected'); return; }
            if (status.status === 'expired') { setPageState('expired'); return; }
          }
        }

        const configLoaded = await loadWidgetConfig();
        if (!configLoaded) return;
        setPageState('ready');
      } catch {
        setPageState('error');
        showVerificationError(
          resolveTier2ApiError({ message: 'Failed to load verification service. Please try again.' }),
          { nextPageState: 'error' }
        );
      }
    }

    init();
  }, [authStatus, router]);

  // Initialise Dojah widget once script is loaded and config is available
  const initWidget = useCallback(() => {
    if (!widgetConfig || !window.Connect) return;

    const user = session?.user;
    const profile = widgetConfig.profile;
    const firstName = profile?.firstName ?? '';
    const lastName = profile?.lastName ?? '';

    // Build user_data object - only include defined values
    const userData: DojahWidgetOptions['user_data'] = {
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      email: profile?.email ?? user?.email ?? undefined,
    };
    
    // Add DOB if available (from registration) - format: YYYY-MM-DD
    if (widgetConfig.dob) {
      userData.dob = widgetConfig.dob;
    }

    // Build gov_data object - only include defined values
    // According to Dojah docs: phone goes in gov_data.mobile, NOT user_data.phone
    const govData: DojahWidgetOptions['gov_data'] = {};
    
    // Add phone if available (from Tier 1 verification)
    // Phone must be in gov_data.mobile according to Dojah React SDK docs
    if (widgetConfig.phone) {
      govData.mobile = widgetConfig.phone;
    }
    
    const publicKeyMode = widgetConfig.publicKey?.startsWith('prod_')
      ? 'production'
      : widgetConfig.publicKey?.startsWith('test_')
        ? 'test'
        : 'unknown';
    const widgetType = widgetConfig.widgetId ? 'custom' : 'verification';
    const verificationReference = widgetConfig.verificationReference;

    console.info('[Dojah Widget] Initializing', {
      publicKeyMode,
      hasAppId: Boolean(widgetConfig.appId),
      hasWidgetId: Boolean(widgetConfig.widgetId),
      hasVendorId: Boolean(widgetConfig.vendorId),
      hasPhone: Boolean(widgetConfig.phone),
      hasDob: Boolean(widgetConfig.dob),
      hasVerificationReference: Boolean(verificationReference),
      type: widgetType,
      origin: window.location.origin,
    });

    const handleWidgetCompletion = async (response: DojahWidgetResponse | undefined, source: 'success' | 'complete') => {
      const referenceId = resolveDojahWidgetReference(response);
      const isFinal = isDojahWidgetFinalSuccess(response);
      const isIntermediate = isDojahWidgetIntermediateStep(response);

      console.info('[Dojah Widget] Callback received', {
        source,
        hasProviderReference: Boolean(referenceId),
        isFinal,
        isIntermediate,
        verificationStatus: response?.verification_status ?? response?.verificationStatus,
      });

      if (!isFinal) {
        if (source === 'complete' && referenceId) {
          pendingWidgetCompletionRef.current = referenceId;
          console.info('[Dojah Widget] Completion callback captured; waiting for widget close before server verification');
          setWidgetSessionActive(true);
          setPageState('ready');
          return;
        }
        if (isIntermediate) {
          console.info('[Dojah Widget] Ignoring intermediate step — continue in the identity window');
          setWidgetSessionActive(true);
          setPageState('ready');
          return;
        }
        if (source === 'complete') {
          setWidgetSessionActive(false);
          setPageState('ready');
          return;
        }
        showVerificationError(
          resolveTier2ApiError({
            message:
              'Verification finished in the browser, but we could not confirm a completed application. Try again or contact support.',
          }),
          { nextPageState: 'error', openDialog: true }
        );
        return;
      }

      setWidgetSessionActive(false);
      pendingWidgetCompletionRef.current = null;
      if (!referenceId) {
        showVerificationError(
          resolveTier2ApiError({
            message: 'Verification completed but no reference was returned. Please try again.',
          }),
          { openDialog: true, nextPageState: 'ready' }
        );
        return;
      }

      await handleVerificationComplete(referenceId, true);
    };

    const options: DojahWidgetOptions = {
      app_id: widgetConfig.appId,
      p_key: widgetConfig.publicKey,
      type: widgetType,
      reference_id: verificationReference,
      ...(widgetConfig.widgetId && { config: { widget_id: widgetConfig.widgetId } }),
      user_data: userData,
      gov_data: Object.keys(govData).length > 0 ? govData : undefined,
      metadata: { 
        user_id: user?.id ?? '',
        vendor_id: widgetConfig.vendorId ?? '',
        workflow_slug: widgetConfig.workflowSlug ?? 'salvage',
        reference_id: verificationReference ?? '',
        expected_name: profile?.fullName ?? user?.name ?? '',
        expected_business_name: profile?.businessName ?? '',
        expected_business_number_masked: profile?.businessRegistrationNumberMasked ?? '',
        policy_bvn_in_tier2: String(Boolean(widgetConfig.requirements?.bvnRequiredInThisFlow)),
        policy_manual_review: String(Boolean(widgetConfig.requirements?.manualReview ?? true)),
      },
      // onSuccess often fires per step (e.g. liveness) — do not submit until the full workflow completes.
      onSuccess: (response) => {
        if (isDojahWidgetFinalSuccess(response)) {
          void handleWidgetCompletion(response, 'success');
        } else if (isDojahWidgetIntermediateStep(response)) {
          console.info('[Dojah Widget] Step succeeded; waiting for remaining checks');
          setWidgetSessionActive(true);
        }
      },
      onComplete: async (response) => {
        await handleWidgetCompletion(response, 'complete');
      },
      onError: (err) => {
        if (submissionFinishedRef.current) return;

        const errorObj = err as { message?: string; referenceId?: string };
        console.error('[Dojah Widget] Error', {
          message: errorObj?.message ?? 'Unknown Dojah widget error',
          hasReferenceId: Boolean(errorObj?.referenceId),
          publicKeyMode,
          hasWidgetId: Boolean(widgetConfig.widgetId),
          type: widgetType,
          origin: window.location.origin,
        });

        const normalizedMessage = (errorObj.message ?? '').toLowerCase();
        const isCameraPermissionError =
          normalizedMessage.includes('camera') ||
          normalizedMessage.includes('permission') ||
          normalizedMessage.includes('denied') ||
          normalizedMessage.includes('unavailable');

        const widgetError = isCameraPermissionError
          ? resolveTier2WidgetError('camera permission denied')
          : resolveTier2WidgetError(
              errorObj.message === 'Verification Failed' && !errorObj.referenceId
                ? 'verification failed'
                : typeof err === 'object' && err !== null && 'message' in err
                  ? String(err.message)
                  : undefined
            );
        if (isCameraPermissionError) {
          widgetError.message = formatEmbeddedCameraHelp(
            'Camera permission was denied or unavailable in the verification window.'
          );
          showVerificationError(widgetError, { openDialog: true, nextPageState: 'ready' });
          return;
        }

        if (isDojahWidgetRecoverableAfterError(err)) {
          void recoverSubmissionFromServer().then((recovered) => {
            if (!recovered) {
              showVerificationError(
                resolveTier2WidgetError(
                  'Your verification session is still processing. Wait a moment, then refresh this page.'
                ),
                { openDialog: true, nextPageState: 'ready' }
              );
            }
          });
          return;
        }

        showVerificationError(widgetError, { openDialog: true, nextPageState: 'ready' });
      },
      onClose: () => {
        setWidgetSessionActive(false);
        const pendingReference = pendingWidgetCompletionRef.current;
        pendingWidgetCompletionRef.current = null;
        if (pendingReference && !submissionFinishedRef.current) {
          void handleVerificationComplete(pendingReference, true);
          return;
        }
        if (pageState === 'verifying') {
          setPageState('ready');
        }
      },
    };

    try {
      const instance = new window.Connect(options);
      instance.setup();
      setConnect(instance);
      setWidgetReady(true);
    } catch (error) {
      console.error('[Dojah Widget] Initialization failed:', error);
      showVerificationError(
        resolveTier2ApiError({ message: 'Failed to initialize the verification window. Please refresh the page.' }),
        { nextPageState: 'error', openDialog: true }
      );
    }
  }, [widgetConfig, session, pageState]);

  useEffect(() => {
    if (widgetConfig && window.Connect) {
      initWidget();
    }
  }, [widgetConfig, initWidget]);

  useEffect(() => {
    applyDojahIframePermissions();

    const observer = new MutationObserver(() => {
      applyDojahIframePermissions();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  async function handleVerificationComplete(referenceId: string, widgetCompleted = false) {
    setPageState('verifying');
    clearVerificationError();

    try {
      const res = await fetch('/api/kyc/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference_id: referenceId, widget_completed: widgetCompleted }),
      });

      const rawText = await res.text();
      let data: { error?: string; message?: string; status?: string } = {};
      try {
        data = rawText ? (JSON.parse(rawText) as typeof data) : {};
      } catch {
        showVerificationError(
          resolveTier2ApiError({
            message: 'The server returned an unexpected response. Please try again in a moment.',
          }),
          { openDialog: true, nextPageState: 'ready' }
        );
        return;
      }

      if (!res.ok) {
        const resolved = resolveTier2ApiError({
          error: data.error,
          message: data.message,
        });
        showVerificationError(resolved, {
          openDialog: true,
          nextPageState: 'ready',
        });
        return;
      }

      if (data.status === 'approved') {
        showSubmissionSuccess('approved');
      } else {
        showSubmissionSuccess('pending_review');
      }
    } catch (err) {
      const recovered = await recoverSubmissionFromServer();
      if (recovered) return;
      const aborted = err instanceof Error && err.name === 'AbortError';
      showVerificationError(
        resolveTier2ApiError({
          error: aborted ? 'verification_pending' : 'network_error',
          message: aborted
            ? 'The request was interrupted. If the identity window is still open, finish all steps there first.'
            : 'We could not reach the server to process your verification. Wait a moment and try again.',
        }),
        { openDialog: true, nextPageState: 'ready' }
      );
    }
  }

  function handleStartVerification() {
    if (!connect) {
      showVerificationError(
        resolveTier2ApiError({ message: 'Verification is not ready yet. Please refresh the page.' }),
        { openDialog: true }
      );
      return;
    }
    
    // Check camera permission before opening widget
    handleCameraPermissionCheck();
  }

  async function handleCameraPermissionCheck() {
    setCheckingPermissions(true);
    clearVerificationError();
    const requiresCamera = widgetConfig?.requirements?.liveness !== false || widgetConfig?.requirements?.governmentId !== false;
    const requiresLocation = widgetConfig?.requirements?.address !== false;

    try {
      if (requiresCamera && isPlainHttpLocalhost()) {
        const httpsUrl = getHttpsVerificationUrl();
        showVerificationError(
          {
            title: 'Use HTTPS for camera verification',
            message: [
              'Camera verification runs inside Dojah\'s secure identity window.',
              'Your browser may allow camera for localhost, but still block the embedded Dojah camera request from a plain HTTP page.',
              httpsUrl
                ? `Open this page through your HTTPS app URL (${httpsUrl}) and start verification again.`
                : 'Open this page through the secure HTTPS app address and start verification again.',
            ].join(' '),
            source: 'app',
          },
          { openDialog: true }
        );
        setCheckingPermissions(false);
        return;
      }

      // First check camera permission
      if (requiresCamera) {
        const cameraCheckResult = await checkCameraPermission();
      
        if (cameraCheckResult.granted) {
          setCameraPermissionGranted(true);
        } else if (cameraCheckResult.error && !cameraCheckResult.needsPrompt) {
          // Camera permission is denied or there's a hard error
          {
            const err = resolveTier2WidgetError('camera permission denied');
            err.message = formatEmbeddedCameraHelp(`${cameraCheckResult.error} ${getCameraPermissionInstructions()}`);
            showVerificationError(err, { openDialog: true });
          }
          setCheckingPermissions(false);
          return;
        } else if (cameraCheckResult.needsPrompt) {
          // Need to request camera permission
          const cameraRequestResult = await requestCameraPermission();
          
          if (cameraRequestResult.granted) {
            setCameraPermissionGranted(true);
          } else {
            console.warn('Camera permission request failed, but continuing to geolocation check');
          }
        }
      } else {
        setCameraPermissionGranted(false);
      }

      if (!requiresLocation) {
        setCheckingPermissions(false);
        openDojahWidget();
        return;
      }

      // Now check geolocation permission
      const geoCheckResult = await checkGeolocationPermission();
      
      if (geoCheckResult.granted) {
        setGeolocationPermissionGranted(true);
        setCheckingPermissions(false);
        openDojahWidget();
        return;
      }

      if (geoCheckResult.error && !geoCheckResult.needsPrompt) {
        // Geolocation permission is denied or there's a hard error
        if (isSoftGeolocationPreflightFailure(geoCheckResult.error)) {
          console.warn('[KYC] Continuing after non-blocking location preflight issue', {
            reason: geoCheckResult.error,
          });
          setGeolocationPermissionGranted(false);
          setCheckingPermissions(false);
          openDojahWidget();
          return;
        }

        const instructions = getGeolocationPermissionInstructions();
        showVerificationError(
          {
            title: 'Location access needed',
            message: `Location permission is required for verification. ${geoCheckResult.error}. ${instructions} After allowing location, please try again.`,
            source: 'app',
          },
          { openDialog: true }
        );
        setCheckingPermissions(false);
        return;
      }

      // Need to request geolocation permission
      const geoRequestResult = await requestGeolocationPermission();
      
      if (geoRequestResult.granted) {
        setGeolocationPermissionGranted(true);
        setCheckingPermissions(false);
        openDojahWidget();
      } else {
        if (isSoftGeolocationPreflightFailure(geoRequestResult.error)) {
          console.warn('[KYC] Continuing after non-blocking location request issue', {
            reason: geoRequestResult.error,
          });
          setGeolocationPermissionGranted(false);
          setCheckingPermissions(false);
          openDojahWidget();
          return;
        }

        // Show clear message about location requirement
        const instructions = getGeolocationPermissionInstructions();
        showVerificationError(
          {
            title: 'Location access needed',
            message: `Location permission is required for verification. ${geoRequestResult.error || 'Please allow location access'}. ${instructions} After allowing location, please try again.`,
            source: 'app',
          },
          { openDialog: true }
        );
        setCheckingPermissions(false);
      }
    } catch (error) {
      console.error('Permission check failed:', error);
      // Show error but allow user to retry
      showVerificationError(
        resolveTier2WidgetError(
          'Unable to check permissions. Please ensure your browser allows camera and location access for this site, then try again.'
        ),
        { openDialog: true }
      );
      setCheckingPermissions(false);
    }
  }

  function openDojahWidget() {
    if (!connect) {
      showVerificationError(
        resolveTier2ApiError({ message: 'Verification is not ready yet. Please refresh the page.' }),
        { openDialog: true }
      );
      return;
    }
    setWidgetSessionActive(true);
    setPageState('verifying');
    applyDojahIframePermissions();
    connect.open();
    window.setTimeout(applyDojahIframePermissions, 250);
    window.setTimeout(applyDojahIframePermissions, 1000);
  }

  if (authStatus === 'loading' || pageState === 'loading_config') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-hover)] flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" />
          <p>Loading verification service...</p>
        </div>
      </div>
    );
  }

  const requirements = widgetConfig?.requirements;
  const profile = widgetConfig?.profile;
  const requiredChecks = [
    requirements?.bvnRequiredInThisFlow ? 'BVN if requested in the identity window' : null,
    requirements?.governmentId !== false ? 'Government ID or NIN' : null,
    requirements?.businessData !== false ? 'Business registration details' : null,
    requirements?.liveness !== false ? 'Camera liveness check' : null,
    requirements?.address !== false ? 'Address or location confirmation' : null,
    requirements?.amlScreening !== false ? 'AML and watchlist screening' : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <>
      <VerificationErrorDialog
        open={errorDialogOpen}
        onOpenChange={setErrorDialogOpen}
        error={verificationError}
      />
      <VerificationSuccessDialog
        open={successModalOpen}
        title={successModalCopy.title}
        message={successModalCopy.message}
        onRedirect={goToDashboard}
      />
      {/* Load Dojah widget script */}
      <Script
        src="https://widget.dojah.io/widget.js"
        strategy="lazyOnload"
        onLoad={initWidget}
      />

      <div className="min-h-screen bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-hover)] py-8 px-4">
        <div className="w-full max-w-2xl mx-auto">
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
            {isKycTestingModeClient() && (
              <p className="text-xs text-amber-100 bg-amber-900/40 border border-amber-400/50 rounded-lg px-3 py-2 mt-4 max-w-md mx-auto">
                KYC testing mode — Tier 2 state resets when you load this page so you can verify again with the same NIN and company details.
              </p>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Approved */}
            {pageState === 'approved' && (
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                  <CheckCircle2 className="w-12 h-12 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Tier 2 Verified!</h2>
                <p className="text-gray-600 mb-2">Your account access has been updated.</p>
                {kycStatus?.expiresAt && (
                  <p className="text-sm text-gray-500 mb-6">
                    Verification valid until {new Date(kycStatus.expiresAt).toLocaleDateString()}
                  </p>
                )}
                <button
                  onClick={() => router.push('/vendor/dashboard')}
                  className="w-full bg-[var(--brand-accent)] text-[var(--brand-primary)] font-bold py-3 rounded-lg hover:bg-[var(--brand-accent-hover)] transition-colors"
                >
                  Go to Dashboard
                </button>
              </div>
            )}

            {/* Pending review */}
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

            {/* Rejected */}
            {pageState === 'rejected' && (
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
                  <XCircle className="w-12 h-12 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Not Approved</h2>
                {kycStatus?.rejectionReason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
                    <p className="text-sm font-semibold text-red-900">Reason:</p>
                    <p className="text-sm text-red-700">{kycStatus.rejectionReason}</p>
                  </div>
                )}
                {kycStatus?.rejectedSections?.length ? (
                  <div className="bg-white border border-red-200 rounded-lg p-4 mb-6 text-left">
                    <p className="text-sm font-semibold text-red-900 mb-2">Sections to correct:</p>
                    <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                      {kycStatus.rejectedSections.map((section) => (
                        <li key={section}>{section}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <p className="text-gray-600 mb-6 text-sm">
                  Please correct the requested items and resubmit. Verification will restart as a new attempt.
                </p>
                <button
                  onClick={() => {
                    setPageState('ready');
                    void loadWidgetConfig();
                  }}
                  className="w-full bg-[var(--brand-primary)] text-white font-bold py-3 rounded-lg hover:bg-[var(--brand-primary-hover)] transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            )}

            {/* Expired */}
            {pageState === 'expired' && (
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-100 rounded-full mb-6">
                  <Clock className="w-12 h-12 text-orange-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Expired</h2>
                <p className="text-gray-600 mb-6">Your full verification has expired. Please re-verify to restore full access.</p>
                <button
                  onClick={() => setPageState('ready')}
                  className="w-full bg-[var(--brand-accent)] text-[var(--brand-primary)] font-bold py-3 rounded-lg hover:bg-[var(--brand-accent-hover)] transition-colors"
                >
                  Re-verify Now
                </button>
              </div>
            )}

            {/* Error */}
            {pageState === 'error' && (
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
                  <AlertCircle className="w-12 h-12 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
                {verificationError ? (
                  <VerificationErrorAlert error={verificationError} className="mb-6 text-left" />
                ) : (
                  <p className="text-gray-600 mb-6">An unexpected error occurred.</p>
                )}
                <button
                  onClick={() => router.refresh()}
                  className="w-full bg-[var(--brand-primary)] text-white font-bold py-3 rounded-lg hover:bg-[var(--brand-primary-hover)] transition-colors"
                >
                  Refresh Page
                </button>
              </div>
            )}

            {/* Verifying in progress */}
            {pageState === 'verifying' && (
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
                  <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Verification</h2>
                <p className="text-gray-600">Please wait while we process your verification (30-60 seconds)...</p>
              </div>
            )}

            {/* Ready to start */}
            {pageState === 'ready' && (
              <div className="p-6 sm:p-8">
                {/* Verification preflight */}
                <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <div className="flex items-start gap-3">
                    <Shield className="mt-1 h-5 w-5 text-[var(--brand-primary)]" />
                    <div>
                      <h2 className="text-xl font-bold text-gray-950">Full vendor verification</h2>
                      <p className="mt-2 text-sm leading-6 text-gray-600">
                        Complete the identity window once. Your submission will be reviewed before full access is updated.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Profile and requirements */}
                <div className="mb-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <User className="mb-3 h-5 w-5 text-gray-500" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Representative</p>
                    <p className="mt-1 font-semibold text-gray-950">{profile?.fullName || session?.user?.name || 'Your profile name'}</p>
                    <p className="mt-1 text-xs text-gray-500">{profile?.email || session?.user?.email || 'Email on profile'}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <Building2 className="mb-3 h-5 w-5 text-gray-500" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Business</p>
                    <p className="mt-1 font-semibold text-gray-950">{profile?.businessName || 'Business details will be collected'}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {profile?.businessRegistrationNumberMasked
                        ? `Registration ${profile.businessRegistrationNumberMasked}`
                        : 'Registration number requested during verification'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <FileCheck2 className="mb-3 h-5 w-5 text-gray-500" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Review</p>
                    <p className="mt-1 font-semibold text-gray-950">Manual decision</p>
                    <p className="mt-1 text-xs text-gray-500">A reviewer checks the evidence before approval.</p>
                  </div>
                </div>

                <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <h3 className="font-semibold text-blue-950">Checks in this verification</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {requiredChecks.map((item) => (
                      <div key={item} className="flex items-center gap-2 text-sm text-blue-900">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-blue-600" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                  {profile?.bvnAlreadyVerified && !requirements?.bvnRequiredInThisFlow && (
                    <p className="mt-3 text-xs text-blue-800">
                      Your basic identity check is already on file, so this step focuses on business, document, liveness, address, and risk review.
                    </p>
                  )}
                </div>

                {/* Cost estimate */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-sm text-gray-600">
                  <Shield className="w-4 h-4 inline mr-1 text-gray-500" />
                  Estimated provider cost: <strong>NGN 510-630</strong>. Final approval is handled by the review team.
                </div>

                {/* Error message */}
                {verificationError && (
                  <VerificationErrorAlert error={verificationError} className="mb-4" />
                )}

                {widgetSessionActive && !verificationError && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
                    Identity checks are in progress. Complete every step in the verification window (NIN, documents,
                    liveness, business details). A step may show as submitted - that is normal; only the full flow
                    finishes your application.
                  </div>
                )}

                <button
                  onClick={handleStartVerification}
                  disabled={!widgetReady || checkingPermissions}
                  aria-label="Start Tier 2 identity verification"
                  className="w-full bg-[var(--brand-primary)] text-white font-bold py-4 rounded-lg hover:bg-[var(--brand-primary-hover)] hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg min-h-[56px]"
                >
                  {checkingPermissions ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Checking permissions...</>
                  ) : !widgetReady ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Loading...</>
                  ) : (
                    <><Shield className="w-5 h-5" /> Start Verification</>
                  )}
                </button>

                <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-start gap-2 text-xs text-gray-700">
                    <Camera className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
                    <p>
                      The verification window may ask for camera access{requirements?.address !== false ? ' and location access' : ''}.
                      Allow the prompt in that window to continue.
                    </p>
                  </div>
                  {requirements?.address !== false && (
                    <div className="mt-2 flex items-start gap-2 text-xs text-gray-700">
                      <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
                      <p>Location is used for verification only. Exact coordinates are not shown in the vendor interface.</p>
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-500 text-center mt-3">
                  Your data is encrypted and processed securely. Verification typically takes 2–5 minutes.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-300">
              Need help?{' '}
              <a href="/contact" className="text-[var(--brand-accent)] hover:underline">Contact Support</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
