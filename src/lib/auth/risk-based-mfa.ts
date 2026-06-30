import { createHash } from 'crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, withRetry } from '@/lib/db/drizzle';
import { loginRiskEvents, userTrustedLoginContexts } from '@/lib/db/schema/trusted-login';

export const RISK_BASED_MFA_ENABLED = process.env.RISK_BASED_MFA_ENABLED !== 'false';
const TRUSTED_LOGIN_THRESHOLD = Number(process.env.TRUSTED_LOGIN_THRESHOLD || 5);

export type RiskMfaDecision = {
  required: boolean;
  reason: 'disabled' | 'trusted_context' | 'new_login_context' | 'changed_login_context';
  riskScore: number;
  deviceFingerprintHash: string;
  ipPrefixHash: string;
  userAgentHash: string;
};

export type RiskMfaInput = {
  userId: string;
  ipAddress: string;
  userAgent: string;
};

let riskStorageWarningLogged = false;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function logRiskStorageUnavailable(error: unknown): void {
  if (riskStorageWarningLogged) return;
  riskStorageWarningLogged = true;

  const message = error instanceof Error ? error.message : String(error);
  console.warn('[Risk MFA] Login context storage unavailable; risk step-up is temporarily bypassed.', {
    error: message,
  });
}

function normalizeIpPrefix(ipAddress: string): string {
  const ip = (ipAddress || 'unknown').split(',')[0]?.trim().toLowerCase() || 'unknown';
  if (ip.includes(':')) {
    return ip.split(':').slice(0, 4).join(':') || ip;
  }

  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }

  return ip;
}

function normalizeUserAgent(userAgent: string): string {
  return (userAgent || 'unknown')
    .toLowerCase()
    .replace(/\d+(\.\d+)+/g, 'x')
    .slice(0, 300);
}

export function getLoginContextHashes(input: RiskMfaInput) {
  const normalizedAgent = normalizeUserAgent(input.userAgent);
  const ipPrefix = normalizeIpPrefix(input.ipAddress);

  return {
    deviceFingerprintHash: sha256(normalizedAgent),
    ipPrefixHash: sha256(ipPrefix),
    userAgentHash: sha256(normalizedAgent),
  };
}

export async function evaluateRiskBasedMfa(input: RiskMfaInput): Promise<RiskMfaDecision> {
  const hashes = getLoginContextHashes(input);

  if (!RISK_BASED_MFA_ENABLED) {
    return {
      required: false,
      reason: 'disabled',
      riskScore: 0,
      ...hashes,
    };
  }

  const context = await withRetry(async () => {
    return db.query.userTrustedLoginContexts.findFirst({
      where: and(
        eq(userTrustedLoginContexts.userId, input.userId),
        eq(userTrustedLoginContexts.deviceFingerprintHash, hashes.deviceFingerprintHash),
        eq(userTrustedLoginContexts.ipPrefixHash, hashes.ipPrefixHash),
        isNull(userTrustedLoginContexts.revokedAt)
      ),
      orderBy: [desc(userTrustedLoginContexts.lastSeenAt)],
    });
  }).catch((error) => {
    logRiskStorageUnavailable(error);
    return undefined;
  });

  if (!context && riskStorageWarningLogged) {
    return {
      required: false,
      reason: 'disabled',
      riskScore: 0,
      ...hashes,
    };
  }

  if (context?.trusted) {
    return {
      required: false,
      reason: 'trusted_context',
      riskScore: 10,
      ...hashes,
    };
  }

  return {
    required: true,
    reason: context ? 'changed_login_context' : 'new_login_context',
    riskScore: context ? 70 : 80,
    ...hashes,
  };
}

export async function recordLoginRiskDecision(input: RiskMfaInput, decision: RiskMfaDecision): Promise<void> {
  if (!RISK_BASED_MFA_ENABLED || decision.reason === 'disabled') return;

  await withRetry(async () => {
    await db.insert(loginRiskEvents).values({
      userId: input.userId,
      deviceFingerprintHash: decision.deviceFingerprintHash,
      ipPrefixHash: decision.ipPrefixHash,
      userAgentHash: decision.userAgentHash,
      riskType: decision.reason,
      riskScore: decision.riskScore,
      decision: decision.required ? 'mfa_required' : 'allowed',
    });
  }).catch((error) => {
    logRiskStorageUnavailable(error);
  });
}

export async function recordSuccessfulRiskLogin(input: RiskMfaInput): Promise<void> {
  if (!RISK_BASED_MFA_ENABLED) return;

  const hashes = getLoginContextHashes(input);
  const now = new Date();

  await withRetry(async () => {
    const existing = await db.query.userTrustedLoginContexts.findFirst({
      where: and(
        eq(userTrustedLoginContexts.userId, input.userId),
        eq(userTrustedLoginContexts.deviceFingerprintHash, hashes.deviceFingerprintHash),
        eq(userTrustedLoginContexts.ipPrefixHash, hashes.ipPrefixHash),
        isNull(userTrustedLoginContexts.revokedAt)
      ),
    });

    if (!existing) {
      await db.insert(userTrustedLoginContexts).values({
        userId: input.userId,
        successfulLoginCount: 1,
        trusted: TRUSTED_LOGIN_THRESHOLD <= 1,
        trustedAt: TRUSTED_LOGIN_THRESHOLD <= 1 ? now : null,
        lastSeenAt: now,
        updatedAt: now,
        ...hashes,
      });
      return;
    }

    const nextCount = existing.successfulLoginCount + 1;
    const shouldTrust = existing.trusted || nextCount >= TRUSTED_LOGIN_THRESHOLD;

    await db
      .update(userTrustedLoginContexts)
      .set({
        successfulLoginCount: nextCount,
        trusted: shouldTrust,
        trustedAt: shouldTrust && !existing.trustedAt ? now : existing.trustedAt,
        lastSeenAt: now,
        updatedAt: now,
        userAgentHash: hashes.userAgentHash,
      })
      .where(eq(userTrustedLoginContexts.id, existing.id));
  }).catch((error) => {
    logRiskStorageUnavailable(error);
  });
}
