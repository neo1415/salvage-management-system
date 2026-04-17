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

declare global {
  interface Window {
    Connect: new (options: DojahWidgetOptions) => DojahConnect;
  }
}

interface DojahWidgetOptions {
  app_id: string;
  p_key: string;
  type: string;
  widget_id?: string;
  user_data?: {
    first_name?: string;
    last_name?: string;
    dob?: string;
    email?: string;
  };
  metadata?: Record<string, string>;
  onSuccess: (response: { reference_id?: string }) => void;
  onError: (err: unknown) => void;
  onClose: () => void;
}

interface DojahConnect {
  setup(): void;
  open(): void;
}

type PageState = 'idle' | 'loading_config' | 'ready' | 'verifying' | 'pending_review' | 'approved' | 'rejected' | 'expired' | 'error';

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
  const [widgetConfig, setWidgetConfig] = useState<{ appId: string; publicKey: string; widgetId?: string } | null>(null);
  const [widgetReady, setWidgetReady] = useState(false);
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connect, setConnect] = useState<DojahConnect | null>(null);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login');
  }, [authStatus, router]);

  // Load widget config and current KYC status
  useEffect(() => {
    if (authStatus !== 'authenticated') return;

    async function init() {
      try {
        const [configRes, statusRes] = await Promise.all([
          fetch('/api/kyc/widget-config'),
          fetch('/api/kyc/status'),
        ]);

        if (!configRes.ok) {
          setPageState('error');
          setErrorMessage('KYC service is not available. Please contact support.');
          return;
        }

        const config = await configRes.json();
        setWidgetConfig(config);

        if (statusRes.ok) {
          const status: KYCStatus = await statusRes.json();
          setKycStatus(status);

          if (status.status === 'approved') { setPageState('approved'); return; }
          if (status.status === 'pending_review') { setPageState('pending_review'); return; }
          if (status.status === 'rejected') { setPageState('rejected'); return; }
          if (status.status === 'expired') { setPageState('expired'); return; }
        }

        setPageState('ready');
      } catch {
        setPageState('error');
        setErrorMessage('Failed to load verification service. Please try again.');
      }
    }

    init();
  }, [authStatus]);

  // Initialise Dojah widget once script is loaded and config is available
  const initWidget = useCallback(() => {
    if (!widgetConfig || !window.Connect) return;

    const user = session?.user;
    const nameParts = (user?.name ?? '').split(' ');

    const options: DojahWidgetOptions = {
      app_id: widgetConfig.appId,
      p_key: widgetConfig.publicKey,
      type: widgetConfig.widgetId ? 'custom' : 'verification',
      ...(widgetConfig.widgetId && { widget_id: widgetConfig.widgetId }),
      user_data: {
        first_name: nameParts[0],
        last_name: nameParts.slice(1).join(' ') || undefined,
        email: user?.email ?? undefined,
      },
      metadata: { user_id: user?.id ?? '' },
      onSuccess: async (response) => {
        const referenceId = response?.reference_id;
        if (!referenceId) {
          setErrorMessage('Verification completed but no reference ID received. Please contact support.');
          setPageState('error');
          return;
        }
        await handleVerificationComplete(referenceId);
      },
      onError: (err) => {
        console.error('[Dojah Widget] Error', err);
        
        // Check if this is a test credential limitation
        const errorObj = err as { message?: string; referenceId?: string };
        if (errorObj.message === 'Verification Failed' && !errorObj.referenceId) {
          setErrorMessage(
            'Verification failed. This may be due to test credential limitations. ' +
            'Test credentials have limited functionality and may not support full verification. ' +
            'Please contact support to upgrade to production credentials for real verification.'
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
      // First check if permission is already granted
      const checkResult = await checkCameraPermission();
      
      if (checkResult.granted) {
        setCameraPermissionGranted(true);
        setCheckingPermissions(false);
        openDojahWidget();
        return;
      }

      if (checkResult.error && !checkResult.needsPrompt) {
        // Permission is denied or there's a hard error
        setErrorMessage(checkResult.error + ' ' + getCameraPermissionInstructions());
        setCheckingPermissions(false);
        return;
      }

      // Need to request permission
      const requestResult = await requestCameraPermission();
      
      if (requestResult.granted) {
        setCameraPermissionGranted(true);
        setCheckingPermissions(false);
        openDojahWidget();
      } else {
        // Even if permission request failed, still try to open widget
        // Dojah will handle its own permission prompts
        console.warn('Pre-check camera permission failed, but opening widget anyway');
        setCheckingPermissions(false);
        openDojahWidget();
      }
    } catch (error) {
      console.error('Permission check failed:', error);
      // Don't block the widget from opening - let Dojah handle it
      setCheckingPermissions(false);
      openDojahWidget();
    }
  }

  function openDojahWidget() {
    if (!connect) {
      setErrorMessage('Verification widget is not ready. Please refresh the page.');
      return;
    }
    setPageState('verifying');
    connect.open();
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
                <p className="text-gray-600 mb-6 text-sm">You may resubmit after 24 hours. Contact support if you need assistance.</p>
                <button
                  onClick={() => setPageState('ready')}
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
                    <li>• A government-issued photo ID (Passport, Voter's Card, or Driver's License)</li>
                    <li>• A selfie for liveness and biometric verification</li>
                    <li>• A recent utility bill (within 3 months)</li>
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
                      <p className="font-semibold mb-1">Test Mode Active</p>
                      <p>You're using test credentials which have limited functionality. Verification may fail or return mock data. Contact support to upgrade to production credentials for real verification.</p>
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
                    <><Loader2 className="w-5 h-5 animate-spin" /> Checking camera access...</>
                  ) : !widgetReady ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Loading...</>
                  ) : (
                    <><Shield className="w-5 h-5" /> Start Verification</>
                  )}
                </button>

                {/* Camera permission info */}
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                  <Camera className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800">
                    This verification requires camera access for selfie and liveness checks. You'll be prompted to allow camera access when you start.
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
