'use client';

const OFFLINE_UNLOCK_KEY = 'salvage:offline-unlock:v1';
const DEFAULT_TTL_MS = 72 * 60 * 60 * 1000;

export type OfflineUnlockGrant = {
  userId: string;
  role: 'claims_adjuster';
  fullName: string;
  issuedAt: number;
  expiresAt: number;
};

type OfflineUnlockInput = {
  userId: string;
  role: string;
  fullName?: string | null;
  ttlMs?: number;
};

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function parseGrant(raw: string | null): OfflineUnlockGrant | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<OfflineUnlockGrant>;
    if (
      typeof parsed.userId !== 'string' ||
      parsed.role !== 'claims_adjuster' ||
      typeof parsed.issuedAt !== 'number' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      return null;
    }

    return {
      userId: parsed.userId,
      role: parsed.role,
      fullName: typeof parsed.fullName === 'string' ? parsed.fullName : 'Claims adjuster',
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function getOfflineUnlockGrant(now = Date.now()): OfflineUnlockGrant | null {
  if (!canUseBrowserStorage()) return null;

  const grant = parseGrant(window.localStorage.getItem(OFFLINE_UNLOCK_KEY));
  if (!grant || grant.expiresAt <= now) {
    clearOfflineUnlockGrant();
    return null;
  }

  return grant;
}

export function saveOfflineUnlockGrant(input: OfflineUnlockInput): OfflineUnlockGrant | null {
  if (!canUseBrowserStorage() || input.role !== 'claims_adjuster') return null;

  const issuedAt = Date.now();
  const grant: OfflineUnlockGrant = {
    userId: input.userId,
    role: 'claims_adjuster',
    fullName: input.fullName?.trim() || 'Claims adjuster',
    issuedAt,
    expiresAt: issuedAt + (input.ttlMs ?? DEFAULT_TTL_MS),
  };

  window.localStorage.setItem(OFFLINE_UNLOCK_KEY, JSON.stringify(grant));
  return grant;
}

export function clearOfflineUnlockGrant(): void {
  if (!canUseBrowserStorage()) return;
  window.localStorage.removeItem(OFFLINE_UNLOCK_KEY);
}

export async function refreshOfflineUnlockGrantFromSession(): Promise<OfflineUnlockGrant | null> {
  if (!canUseBrowserStorage()) return null;

  try {
    const response = await fetch('/api/auth/offline-unlock-grant', { cache: 'no-store' });
    if (!response.ok) return null;

    const payload = await response.json() as {
      data?: {
        userId?: string;
        role?: string;
        fullName?: string | null;
        expiresAt?: string;
      };
    };

    const data = payload.data;
    if (!data?.userId || data.role !== 'claims_adjuster') return null;

    const expiresAt = data.expiresAt ? Date.parse(data.expiresAt) : Number.NaN;
    const ttlMs = Number.isFinite(expiresAt) ? Math.max(expiresAt - Date.now(), 0) : DEFAULT_TTL_MS;

    return saveOfflineUnlockGrant({
      userId: data.userId,
      role: data.role,
      fullName: data.fullName,
      ttlMs,
    });
  } catch {
    return null;
  }
}

