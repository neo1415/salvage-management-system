'use client';

import { useState, useEffect, useCallback } from 'react';
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

interface DojahWidgetResponse {
  reference_id?: string;
  referenceId?: string;
  reference?: string;
  verification_reference?: string;
  workflow_reference?: string;
  data?: {
    reference_id?: string;
    referenceId?: string;
    reference?: string;
  };
}

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
    'For local testing, use an HTTPS ngrok or cloudflared URL if localhost blocks embedded camera access.',
  ].join(' ');
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
  const [widgetConfig, setWidgetConfig] = useState<{ 
    appId: string; 
    publicKey: string; 
    widgetId?: string;
    phone?: string;
    dob?: string;
    vendorId?: string;
    workflowSlug?: string;
    verificationReference?: string;
  } | null>(null);
  const [widgetReady, setWidgetReady] = useState(false);
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connect, setConnect] = useState<DojahConnect | null>(null);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);
  const [geolocationPermissionGranted, setGeolocationPermissionGranted] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(false);
  const [registrationFeePaid, setRegistrationFeePaid] = useState<boolean | null>(null);

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
      setErrorMessage('KYC service is not available. Please contact support.');
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

          if (status.status === 'approved') { setPageState('approved'); return; }
          if (status.status === 'pending_review') { setPageState('pending_review'); return; }
          if (status.status === 'rejected') { setPageState('rejected'); return; }
          if (status.status === 'expired') { setPageState('expired'); return; }
        }

        const configLoaded = await loadWidgetConfig();
        if (!configLoaded) return;
        setPageState('ready');
      } catch {
        setPageState('error');
        setErrorMessage('Failed to load verification service. Please try again.');
      }
    }

    init();
  }, [authStatus, router]);

  // Initialise Dojah widget once script is loaded and config is available
  const initWidget = useCallback(() => {
    if (!widgetConfig || !window.Connect) return;

    const user = session?.user;
    
    // Parse full name - first word is first name, rest is last name
    // User can edit these in the widget if needed
    const nameParts = (user?.name ?? '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Build user_data object - only include defined values
    const userData: DojahWidgetOptions['user_data'] = {
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      email: user?.email ?? undefined,
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

    const resolveReferenceId = (response?: DojahWidgetResponse) =>
      response?.reference_id ||
      response?.referenceId ||
      response?.reference ||
      response?.verification_reference ||
      response?.workflow_reference ||
      response?.data?.reference_id ||
      response?.data?.referenceId ||
      response?.data?.reference ||
      verificationReference;

    const handleWidgetCompletion = async (response: DojahWidgetResponse | undefined, source: 'success' | 'complete') => {
      const referenceId = resolveReferenceId(response);

      console.info('[Dojah Widget] Completion callback received', {
        source,
        hasProviderReference: Boolean(referenceId),
        usedStoredReference: Boolean(referenceId && referenceId === verificationReference),
      });

      if (!referenceId) {
        setErrorMessage('Verification completed, but the app could not identify the verification reference. Please contact support.');
        setPageState('error');
        return;
      }

      await handleVerificationComplete(referenceId);
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
      },
      onSuccess: async (response) => handleWidgetCompletion(response, 'success'),
      onComplete: async (response) => handleWidgetCompletion(response, 'complete'),
      onError: (err) => {
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

        if (isCameraPermissionError) {
          setErrorMessage(
            formatEmbeddedCameraHelp('Camera permission was denied or unavailable in the verification window.')
          );
        } else if (errorObj.message === 'Verification Failed' && !errorObj.referenceId) {
          setErrorMessage(
            'Verification failed before a reference was returned. Please try again. ' +
            'If this continues locally, confirm the verification widget settings and allowed local origin.'
          );
        } else {
          const errorMsg = typeof err === 'object' && err !== null && 'message' in err 
            ? String(err.message) 
            : 'Verification encountered an error. Please try again.';
          setErrorMessage(errorMsg);
        }
        
        setPageState('ready');
      },
      onClose: () => {
        if (pageState === 'verifying') setPageState('ready');
      },
    };

    try {
      const instance = new window.Connect(options);
      instance.setup();
      setConnect(instance);
      setWidgetReady(true);
    } catch (error) {
      console.error('[Dojah Widget] Initialization failed:', error);
      setErrorMessage('Failed to initialize verification widget. Please refresh the page.');
      setPageState('error');
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

  async function handleVerificationComplete(referenceId: string) {
    setPageState('verifying');
    setErrorMessage(null);

    try {
      const res = await fetch('/api/kyc/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference_id: referenceId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? 'Verification processing failed. Please try again.');
        setPageState('ready');
        return;
      }

      if (data.status === 'approved') {
        setPageState('approved');
      } else {
        setPageState('pending_review');
      }
    } catch {
      setErrorMessage('Network error. Please check your connection and try again.');
      setPageState('ready');
    }
  }

  function handleStartVerification() {
    if (!connect) {
      setErrorMessage('Verification widget is not ready. Please refresh the page.');
      return;
    }
    
    // Check camera permission before opening widget
    handleCameraPermissionCheck();
  }

  async function handleCameraPermissionCheck() {
    setCheckingPermissions(true);
    setErrorMessage(null);

    try {
      // First check camera permission
      const cameraCheckResult = await checkCameraPermission();
      
      if (cameraCheckResult.granted) {
        setCameraPermissionGranted(true);
      } else if (cameraCheckResult.error && !cameraCheckResult.needsPrompt) {
        // Camera permission is denied or there's a hard error
        setErrorMessage(formatEmbeddedCameraHelp(`${cameraCheckResult.error} ${getCameraPermissionInstructions()}`));
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
        const instructions = getGeolocationPermissionInstructions();
        setErrorMessage(
          `Location permission is required for verification. ${geoCheckResult.error}. ${instructions} After allowing location, please try again.`
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
        // Show clear message about location requirement
        const instructions = getGeolocationPermissionInstructions();
        setErrorMessage(
          `Location permission is required for verification. ${geoRequestResult.error || 'Please allow location access'}. ${instructions} After allowing location, please try again.`
        );
        setCheckingPermissions(false);
      }
    } catch (error) {
      console.error('Permission check failed:', error);
      // Show error but allow user to retry
      setErrorMessage(
        'Unable to check permissions. Please ensure your browser allows camera and location access for this site, then try again.'
      );
      setCheckingPermissions(false);
    }
  }

  function openDojahWidget() {
    if (!connect) {
      setErrorMessage('Verification widget is not ready. Please refresh the page.');
      return;
    }
    setPageState('verifying');
    applyDojahIframePermissions();
    connect.open();
    window.setTimeout(applyDojahIframePermissions, 250);
    window.setTimeout(applyDojahIframePermissions, 1000);
  }

  if (authStatus === 'loading' || pageState === 'loading_config') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#800020] to-[#600018] flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" />
          <p>Loading verification service...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Load Dojah widget script */}
      <Script
        src="https://widget.dojah.io/widget.js"
        strategy="lazyOnload"
        onLoad={initWidget}
      />

      <div className="min-h-screen bg-gradient-to-br from-[#800020] to-[#600018] py-8 px-4">
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
              <Award className="w-8 h-8 text-[#800020]" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Tier 2 Verification</h1>
            <p className="text-gray-200">Complete identity verification to unlock unlimited bidding</p>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Approved */}
            {pageState === 'approved' && (
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                  <CheckCircle2 className="w-12 h-12 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Tier 2 Verified!</h2>
                <p className="text-gray-600 mb-2">You now have unlimited bidding access.</p>
                {kycStatus?.expiresAt && (
                  <p className="text-sm text-gray-500 mb-6">
                    Verification valid until {new Date(kycStatus.expiresAt).toLocaleDateString()}
                  </p>
                )}
                <button
                  onClick={() => router.push('/vendor/dashboard')}
                  className="w-full bg-[#FFD700] text-[#800020] font-bold py-3 rounded-lg hover:bg-[#FFC700] transition-colors"
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
                  Your application is being reviewed by our team. You'll receive an SMS and email notification within 24–48 hours.
                </p>
                <button
                  onClick={() => router.push('/vendor/dashboard')}
                  className="w-full bg-[#FFD700] text-[#800020] font-bold py-3 rounded-lg hover:bg-[#FFC700] transition-colors"
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
                  className="w-full bg-[#800020] text-white font-bold py-3 rounded-lg hover:bg-[#600018] transition-colors flex items-center justify-center gap-2"
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
                <p className="text-gray-600 mb-6">Your Tier 2 verification has expired. Please re-verify to restore unlimited bidding access.</p>
                <button
                  onClick={() => setPageState('ready')}
                  className="w-full bg-[#FFD700] text-[#800020] font-bold py-3 rounded-lg hover:bg-[#FFC700] transition-colors"
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
                <p className="text-gray-600 mb-6">{errorMessage ?? 'An unexpected error occurred.'}</p>
                <button
                  onClick={() => router.refresh()}
                  className="w-full bg-[#800020] text-white font-bold py-3 rounded-lg hover:bg-[#600018] transition-colors"
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
                <p className="text-gray-600">Please wait while we process your verification (30–60 seconds)...</p>
              </div>
            )}

            {/* Ready to start */}
            {pageState === 'ready' && (
              <div className="p-6 sm:p-8">
                {/* Benefits */}
                <div className="bg-gradient-to-r from-[#800020] to-[#600018] rounded-xl p-5 text-white mb-6">
                  <h2 className="text-lg font-bold mb-3">Tier 2 Benefits</h2>
                  <ul className="space-y-2 text-sm text-gray-200">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#FFD700]" /> Unlimited bidding on all auctions</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#FFD700]" /> Leaderboard eligibility</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#FFD700]" /> Tier 2 Verified badge on your profile</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#FFD700]" /> Priority support</li>
                  </ul>
                </div>

                {/* What you'll need */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-blue-900 mb-2">What you'll need:</h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Your NIN (National Identification Number)</li>
                    <li>• A government-issued photo ID</li>
                    <li>• A selfie for verification</li>
                    <li>• A recent utility bill</li>
                  </ul>
                </div>

                {/* Cost estimate */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-sm text-gray-600">
                  <Shield className="w-4 h-4 inline mr-1 text-gray-500" />
                  Estimated verification cost: <strong>₦510–630</strong> (charged to your account)
                </div>

                {/* Test credentials warning */}
                {widgetConfig?.publicKey?.startsWith('test_') && (
                  <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-semibold mb-1">Test Mode Active - Limited Functionality</p>
                      <p className="mb-2">You're using test credentials which have significant limitations:</p>
                      <ul className="list-disc list-inside space-y-1 mb-2">
                        <li>Only simplified face verification (no real biometric check)</li>
                        <li>No document verification or OCR</li>
                        <li>No AML screening against real databases</li>
                        <li>No NIN verification against NIMC database</li>
                        <li>May return incomplete data or fail randomly</li>
                      </ul>
                      <p className="font-semibold">To enable full verification, configure production verification credentials.</p>
                    </div>
                  </div>
                )}

                {/* Error message */}
                {errorMessage && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{errorMessage}</p>
                  </div>
                )}

                <button
                  onClick={handleStartVerification}
                  disabled={!widgetReady || checkingPermissions}
                  aria-label="Start Tier 2 identity verification"
                  className="w-full bg-gradient-to-r from-[#800020] to-[#FFD700] text-white font-bold py-4 rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg min-h-[56px]"
                >
                  {checkingPermissions ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Checking permissions...</>
                  ) : !widgetReady ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Loading...</>
                  ) : (
                    <><Shield className="w-5 h-5" /> Start Verification</>
                  )}
                </button>

                {/* Camera and location permission info */}
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                  <Camera className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800">
                    This verification requires camera and location access. Your browser will ask for these permissions before starting. Location is used for identity verification only and coordinates are not stored.
                  </p>
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
              <a href="/contact" className="text-[#FFD700] hover:underline">Contact Support</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
