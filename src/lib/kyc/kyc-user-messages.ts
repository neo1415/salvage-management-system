/**
 * User-facing copy for KYC / identity verification (no third-party provider names).
 */

export type VerificationErrorSource = 'app' | 'identity_provider' | 'network' | 'validation';

export const GENERIC_NAME_BVN_ORDER_EXAMPLE = 'Chidi Emeka Nwosu';

export interface ResolvedVerificationError {
  title: string;
  message: string;
  detail?: string;
  source: VerificationErrorSource;
  mismatches?: string[];
}

const PROVIDER_NAME_PATTERN = /\b(dojah|paystack|termii|resend)\b/gi;

const TECHNICAL_MESSAGE_PATTERN =
  /^(4\d{2}|5\d{2})\b|axios|fetch failed|network error|econnrefused|timeout|undefined|null/i;

export function sanitizeVerificationUserMessage(raw: string | undefined | null): string {
  if (!raw?.trim()) return '';

  let message = raw.trim().replace(PROVIDER_NAME_PATTERN, 'verification service');
  if (TECHNICAL_MESSAGE_PATTERN.test(message)) {
    return '';
  }
  if (message.length > 280) {
    return '';
  }
  return message;
}

function isLikelyProviderFailure(errorCode: string | undefined, rawMessage: string): boolean {
  if (errorCode === 'identity_verification_failed' || errorCode === 'provider_unavailable') {
    return true;
  }
  const lower = rawMessage.toLowerCase();
  return (
    lower.includes('service unavailable') ||
    lower.includes('unavailable') ||
    lower.includes('could not verify') ||
    lower.includes('verification service') ||
    lower.includes('api server') ||
    lower.includes('network error')
  );
}

export function resolveTier1VerificationError(payload: {
  error?: string;
  message?: string;
  errorSource?: VerificationErrorSource;
  mismatches?: string[];
}): ResolvedVerificationError {
  const mismatches = payload.mismatches?.filter(Boolean);

  if (payload.error === 'BVN details do not match' || (mismatches && mismatches.length > 0)) {
    return {
      title: 'Details do not match your records',
      message:
        payload.message ??
        'The name, date of birth, or phone number on your account does not match this BVN. Update your profile to match your BVN exactly (first name, middle name if any, then surname), then try again.',
      source: 'app',
      mismatches,
    };
  }

  if (payload.error === 'BVN already verified') {
    return {
      title: 'Already verified',
      message:
        payload.message ??
        'This account has already completed Tier 1 identity verification.',
      source: 'app',
    };
  }

  if (payload.error === 'network_error' || payload.errorSource === 'network') {
    return {
      title: 'Connection problem',
      message:
        payload.message ??
        'We could not reach the server. Check your internet connection and try again.',
      source: 'network',
    };
  }

  if (payload.error === 'Invalid BVN format. BVN must be exactly 11 digits.') {
    return {
      title: 'Invalid BVN',
      message: 'Enter a valid 11-digit Bank Verification Number.',
      source: 'validation',
    };
  }

  const sanitized = sanitizeVerificationUserMessage(payload.message ?? payload.error);
  const likelyProvider =
    payload.errorSource === 'identity_provider' ||
    isLikelyProviderFailure(payload.error, sanitized || payload.message || '');

  if (likelyProvider) {
    return {
      title: 'Identity check could not be completed',
      message:
        'Our identity verification partner could not complete this check right now. Wait a few minutes and try again. If it keeps failing, contact support.',
      detail: sanitized || undefined,
      source: 'identity_provider',
    };
  }

  return {
    title: 'Verification could not be completed',
    message:
      sanitized ||
      payload.message ||
      'We could not verify your BVN. Check your details and try again, or contact support if the problem continues.',
    source: payload.errorSource ?? 'app',
  };
}

export function resolveTier2WidgetError(rawMessage: string | undefined): ResolvedVerificationError {
  const normalized = (rawMessage ?? '').toLowerCase();
  const sanitized = sanitizeVerificationUserMessage(rawMessage);

  if (
    normalized.includes('camera') ||
    normalized.includes('permission') ||
    normalized.includes('denied') ||
    normalized.includes('unavailable')
  ) {
    return {
      title: 'Camera or location access needed',
      message:
        'Allow camera and location access when the verification window asks. If you blocked access earlier, enable it in your browser settings for this site, then try again.',
      detail: sanitized || undefined,
      source: 'app',
    };
  }

  if (normalized.includes('verification failed') || normalized.includes('failed')) {
    return {
      title: 'Identity verification did not complete',
      message:
        'The verification session ended before we received a result. Check your documents and connection, then start again.',
      detail: sanitized || undefined,
      source: 'identity_provider',
    };
  }

  if (sanitized) {
    return {
      title: 'Verification interrupted',
      message: sanitized,
      source: 'identity_provider',
    };
  }

  return {
    title: 'Verification interrupted',
    message: 'Something went wrong during verification. Please try again.',
    source: 'identity_provider',
  };
}

export function resolveTier2ApiError(payload: {
  error?: string;
  message?: string;
  status?: string;
}): ResolvedVerificationError {
  if (payload.error === 'network_error') {
    return {
      title: 'Connection problem',
      message:
        payload.message ??
        'We could not reach the server. Check your internet connection and try again.',
      source: 'network',
    };
  }

  if (payload.error?.includes('already in progress')) {
    return {
      title: 'Verification in progress',
      message: 'A verification is already being processed. Wait about a minute, then try again.',
      source: 'app',
    };
  }

  const sanitized = sanitizeVerificationUserMessage(payload.message ?? payload.error);

  if (payload.status === 'pending_review' || payload.message?.includes('under review')) {
    return {
      title: 'Submitted for review',
      message:
        payload.message ??
        'Your documents were received and are being reviewed. You will be notified by SMS and email within 24–48 hours.',
      source: 'app',
    };
  }

  if (isLikelyProviderFailure(payload.error, sanitized)) {
    return {
      title: 'Could not process verification',
      message:
        'We received your verification session but could not process the full result yet. You may be placed under manual review, or you can try again shortly.',
      detail: sanitized || undefined,
      source: 'identity_provider',
    };
  }

  return {
    title: 'Could not process verification',
    message:
      sanitized ||
      payload.message ||
      payload.error ||
      'We could not finish processing your verification. Try again or contact support.',
    source: 'app',
  };
}

export function sourceHint(source: VerificationErrorSource): string {
  switch (source) {
    case 'identity_provider':
      return 'This usually comes from the external identity check (not from your account settings).';
    case 'network':
      return 'Check your internet connection and try again.';
    case 'validation':
      return 'Fix the highlighted information and submit again.';
    default:
      return 'Review your profile details and try again, or contact support.';
  }
}
