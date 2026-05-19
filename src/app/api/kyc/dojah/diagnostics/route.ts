import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { getDojahService, DojahVerificationLookupError } from '@/features/kyc/services/dojah.service';
import {
  hasProviderVerificationStorage,
  PROVIDER_VERIFICATION_MIGRATION_MISSING,
} from '@/features/kyc/services/provider-verification-readiness';

export const dynamic = 'force-dynamic';

const SENSITIVE_KEY_PATTERN = /(bvn|nin|password|secret|token|signature|raw|payload|base64)/i;
const URL_KEY_PATTERN = /(url|image|photo|selfie|document|file)/i;
const IDENTIFIER_KEY_PATTERN = /(number|id|reference|tracking)/i;

function maskValue(value: string, visibleTail = 4): string {
  if (value.length <= visibleTail) return '*'.repeat(value.length);
  return `${'*'.repeat(Math.max(0, value.length - visibleTail))}${value.slice(-visibleTail)}`;
}

function redactForDiagnostics(value: unknown, key = '', depth = 0): unknown {
  if (depth > 8) return '[truncated]';
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    if (SENSITIVE_KEY_PATTERN.test(key)) return '[redacted]';
    if (/^https?:\/\//i.test(value) || URL_KEY_PATTERN.test(key)) {
      try {
        const url = new URL(value);
        return `[url:${url.hostname}]`;
      } catch {
        return '[url]';
      }
    }
    if (IDENTIFIER_KEY_PATTERN.test(key) && value.length > 8) return maskValue(value);
    return value.length > 500 ? `${value.slice(0, 500)}...` : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactForDiagnostics(item, key, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        redactForDiagnostics(childValue, childKey, depth + 1),
      ])
    );
  }

  return String(value);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'salvage_manager' && session.user.role !== 'system_admin') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const storageReady = await hasProviderVerificationStorage();
  if (!storageReady) {
    return NextResponse.json(
      { ok: false, error: PROVIDER_VERIFICATION_MIGRATION_MISSING },
      { status: 503 }
    );
  }

  const referenceId = request.nextUrl.searchParams.get('reference_id')?.trim();
  const includePayload = request.nextUrl.searchParams.get('include_payload') === '1';
  const env = {
    hasAppId: Boolean(process.env.DOJAH_APP_ID),
    hasPrivateKey: Boolean(
      process.env.DOJAH_API_KEY ||
      process.env.DOJAH_PROD_PRIVATE_API_KEY ||
      process.env.DOJAH_API_TOKEN ||
      process.env.DOJAH_SECRET_KEY
    ),
    baseUrl: process.env.DOJAH_BASE_URL || 'https://api.dojah.io',
  };

  if (!referenceId) {
    return NextResponse.json({ ok: true, storageReady, env });
  }

  try {
    const dojah = getDojahService();
    const sourceDiagnostics = await dojah.diagnoseVerificationSources(referenceId);
    const result = await dojah.getVerificationResult(referenceId);
    const debugPayload = includePayload
      ? await dojah.getVerificationDebugPayload(referenceId)
      : null;
    return NextResponse.json({
      ok: true,
      storageReady,
      env,
      sourceDiagnostics,
      reference_id: result.reference_id ?? result.referenceId ?? result.reference ?? referenceId,
      providerStatus: result.verification_status ?? result.verificationStatus ?? null,
      hasData: Boolean(result.data),
      hasAml: Boolean(result.aml),
      topLevelKeys: Object.keys(result),
      redactedPayload: debugPayload
        ? {
            detailsCandidate: redactForDiagnostics(debugPayload.detailsCandidate),
            listMatch: redactForDiagnostics(debugPayload.listMatch),
            resolved: redactForDiagnostics(debugPayload.resolved),
          }
        : undefined,
    });
  } catch (error) {
    if (error instanceof DojahVerificationLookupError) {
      return NextResponse.json(
        {
          ok: false,
          storageReady,
          env,
          reference_id: referenceId,
          reason: error.reason,
          diagnostic: error.diagnostic,
        },
        { status: error.reason === 'not_found_or_invalid_reference' ? 404 : 502 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        storageReady,
        env,
        reference_id: referenceId,
        error: error instanceof Error ? error.message : 'Dojah diagnostic failed',
      },
      { status: 502 }
    );
  }
}
