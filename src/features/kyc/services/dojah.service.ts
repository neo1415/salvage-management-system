import {
  DojahVerificationResultSchema,
  DojahAMLResultSchema,
  DojahCACResultSchema,
  DojahNINAdvancedResultSchema,
  DojahBVNValidationResultSchema,
  type DojahVerificationResult,
  type DojahAMLResult,
  type DojahCACResult,
  type DojahNINAdvancedResult,
  type DojahBVNValidationResult,
  DojahBVNEntitySchema,
  type DojahBVNEntity,
} from '../schemas/dojah.schemas';

interface DojahConfig {
  apiKey: string;
  appId: string;
  publicKey: string;
  baseUrl: string;
  easyDetectIngestKey?: string;
}

export class DojahVerificationLookupError extends Error {
  constructor(
    message: string,
    public readonly referenceId: string,
    public readonly reason: 'not_found_or_invalid_reference' | 'unexpected_response',
    public readonly diagnostic?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DojahVerificationLookupError';
  }
}

/**
 * DojahService
 *
 * Centralised service for all Dojah API interactions.
 * - Widget-first: primary flow uses getVerificationResult() after widget onSuccess
 * - Direct API methods for AML screening, advanced NIN, CAC lookup
 * - Exponential backoff retry (1s, 2s, 4s) with 30s timeout
 * - 60s wait on HTTP 429
 * - Never logs NIN or BVN values
 */
export class DojahService {
  private readonly config: DojahConfig;

  constructor(config?: Partial<DojahConfig>) {
    const apiKey = config?.apiKey ??
      process.env.DOJAH_API_KEY ??
      process.env.DOJAH_PROD_PRIVATE_API_KEY ??
      process.env.DOJAH_API_TOKEN ??
      process.env.DOJAH_SECRET_KEY;
    const appId = config?.appId ?? process.env.DOJAH_APP_ID;
    const publicKey = config?.publicKey ?? process.env.DOJAH_PUBLIC_KEY;
    const baseUrl = config?.baseUrl ?? process.env.DOJAH_BASE_URL ?? 'https://api.dojah.io';
    const easyDetectIngestKey = config?.easyDetectIngestKey ?? process.env.DOJAH_EASYDETECT_INGEST_KEY;

    if (!apiKey) throw new Error('DOJAH_API_KEY is not set');
    if (!appId) throw new Error('DOJAH_APP_ID is not set');
    if (!publicKey) throw new Error('DOJAH_PUBLIC_KEY is not set');

    this.config = { apiKey, appId, publicKey, baseUrl, easyDetectIngestKey };
  }

  /** Common headers for all Dojah API requests */
  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: this.config.apiKey,
      AppId: this.config.appId,
    };
  }

  /**
   * Fetch full verification result after widget completion.
   * Called server-side with the reference_id from widget onSuccess.
   */
  async getVerificationResult(referenceId: string): Promise<DojahVerificationResult> {
    const url = `${this.config.baseUrl}/api/v1/kyc/verification?reference_id=${encodeURIComponent(referenceId)}`;
    console.log('[DojahService] getVerificationResult', { referenceId });

    const res = await this.fetchWithRetry(url, { method: 'GET', headers: this.headers });
    const json = await res.json();
    const candidate = getVerificationCandidate(json);

    const parsed = DojahVerificationResultSchema.safeParse(candidate);
    const hasVerificationData = Boolean(
      candidate?.reference_id ||
      candidate?.referenceId ||
      candidate?.verification_status ||
      candidate?.verificationStatus ||
      candidate?.data ||
      candidate?.aml
    );
    if (parsed.success && !hasVerificationData) {
      const fallback = await this.findVerificationFromList(referenceId);
      if (fallback) return fallback;
      const diagnostic = buildDojahDiagnostic(json, candidate, res.status, referenceId);
      console.warn('[DojahService] getVerificationResult missing details', diagnostic);
      throw new DojahVerificationLookupError(
        'Dojah did not return verification details for this reference.',
        referenceId,
        'not_found_or_invalid_reference',
        diagnostic
      );
    }
    if (!parsed.success) {
      if (hasRichVerificationEvidence(candidate)) {
        const diagnostic = buildDojahDiagnostic(json, candidate, res.status, referenceId);
        console.warn('[DojahService] preserving rich verification details despite parse mismatch', {
          referenceId,
          ...diagnostic,
          validation: parsed.error.flatten(),
        });
        return candidate as DojahVerificationResult;
      }

      const fallback = await this.findVerificationFromList(referenceId);
      if (fallback) return fallback;
      const diagnostic = buildDojahDiagnostic(json, candidate, res.status, referenceId);
      console.error('[DojahService] getVerificationResult parse error', {
        referenceId,
        hasVerificationData,
        ...diagnostic,
        validation: parsed.error.flatten(),
      });
      throw new DojahVerificationLookupError(
        hasVerificationData
          ? 'Dojah returned an unexpected verification response shape.'
          : 'Dojah did not return verification details for this reference.',
        referenceId,
        hasVerificationData ? 'unexpected_response' : 'not_found_or_invalid_reference',
        diagnostic
      );
    }
    const enrichedResult = preserveRawVerificationShape(candidate, parsed.data);

    if (!hasRichVerificationEvidence(enrichedResult)) {
      const fallback = await this.findVerificationFromList(referenceId);
      if (fallback && hasRichVerificationEvidence(fallback)) {
        return mergeVerificationResults(enrichedResult, fallback);
      }
    }

    return enrichedResult;
  }

  async listVerifications(input: { term?: string; status?: string; start?: string; end?: string } = {}): Promise<DojahVerificationResult[]> {
    const params = new URLSearchParams();
    if (input.term) params.set('term', input.term);
    if (input.status) params.set('status', input.status);
    if (input.start) params.set('start', input.start);
    if (input.end) params.set('end', input.end);

    const query = params.toString();
    const url = `${this.config.baseUrl}/api/v1/kyc/verifications${query ? `?${query}` : ''}`;
    const res = await this.fetchWithRetry(url, { method: 'GET', headers: this.headers });
    const json = await res.json();
    const rows = getVerificationListCandidates(json);

    const results: DojahVerificationResult[] = [];
    for (const row of rows) {
      const parsed = DojahVerificationResultSchema.safeParse(row);
      if (parsed.success) results.push(parsed.data);
    }
    return results;
  }

  async diagnoseVerificationSources(referenceId: string): Promise<Record<string, unknown>> {
    const detailsUrl = `${this.config.baseUrl}/api/v1/kyc/verification?reference_id=${encodeURIComponent(referenceId)}`;
    const detailsRes = await this.fetchWithRetry(detailsUrl, { method: 'GET', headers: this.headers }, 1);
    const detailsJson = await detailsRes.json().catch(() => ({}));
    const detailsCandidate = getVerificationCandidate(detailsJson);
    const list = await this.listVerifications({ term: referenceId }).catch(() => []);
    const listMatch = list.find((item) => getReferenceFromCandidate(item) === referenceId) ?? null;

    return {
      referenceId,
      details: {
        httpStatus: detailsRes.status,
        ...buildDojahDiagnostic(detailsJson, detailsCandidate, detailsRes.status, referenceId),
        hasRichEvidence: hasRichVerificationEvidence(detailsCandidate),
        mediaCandidates: countMediaCandidates(detailsCandidate),
      },
      listFallback: {
        found: Boolean(listMatch),
        hasRichEvidence: listMatch ? hasRichVerificationEvidence(listMatch) : false,
        mediaCandidates: listMatch ? countMediaCandidates(listMatch) : 0,
        topLevelKeys: listMatch ? Object.keys(listMatch) : [],
      },
    };
  }

  async getVerificationDebugPayload(referenceId: string): Promise<{
    detailsCandidate: Record<string, unknown>;
    listMatch: Record<string, unknown> | null;
    resolved: DojahVerificationResult;
  }> {
    const detailsUrl = `${this.config.baseUrl}/api/v1/kyc/verification?reference_id=${encodeURIComponent(referenceId)}`;
    const detailsRes = await this.fetchWithRetry(detailsUrl, { method: 'GET', headers: this.headers }, 1);
    const detailsJson = await detailsRes.json().catch(() => ({}));
    const detailsCandidate = getVerificationCandidate(detailsJson);
    const verifications = await this.listVerifications({ term: referenceId }).catch(() => []);
    const listMatch = verifications.find((item) => getReferenceFromCandidate(item) === referenceId) ?? null;
    const resolved = await this.getVerificationResult(referenceId);

    return { detailsCandidate, listMatch: listMatch as Record<string, unknown> | null, resolved };
  }

  private async findVerificationFromList(referenceId: string): Promise<DojahVerificationResult | null> {
    try {
      const verifications = await this.listVerifications({ term: referenceId });
      return verifications.find((item) => getReferenceFromCandidate(item) === referenceId) ?? null;
    } catch (error) {
      console.warn('[DojahService] list verifications fallback failed', {
        referenceId,
        message: error instanceof Error ? error.message : 'Unknown fallback error',
      });
      return null;
    }
  }

  /**
   * Advanced NIN lookup — returns detailed address, employment, education data.
   * Only called after Salvage Manager approval (higher cost).
   */
  async verifyNINAdvanced(nin: string): Promise<DojahNINAdvancedResult> {
    const url = `${this.config.baseUrl}/api/v1/kyc/nin?nin=${encodeURIComponent(nin)}&advanced=true`;
    console.log('[DojahService] verifyNINAdvanced called');

    const res = await this.fetchWithRetry(url, { method: 'GET', headers: this.headers });
    const json = await res.json();

    const parsed = DojahNINAdvancedResultSchema.safeParse(json);
    if (!parsed.success) {
      console.error('[DojahService] verifyNINAdvanced parse error', parsed.error.flatten());
      throw new Error('Dojah advanced NIN result failed schema validation');
    }
    return parsed.data;
  }

  /**
   * BVN match validation through Dojah.
   * Dojah expects plain header Authorization (secret key), not Bearer auth.
   */
  async validateBVN(input: {
    bvn: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    dateOfBirth?: string;
    customerReference?: string;
  }): Promise<DojahBVNValidationResult> {
    const params = new URLSearchParams({ bvn: input.bvn });
    if (input.firstName) params.set('first_name', input.firstName);
    if (input.middleName) params.set('middle_name', input.middleName);
    if (input.lastName) params.set('last_name', input.lastName);
    if (input.dateOfBirth) params.set('dob', input.dateOfBirth);
    if (input.customerReference) params.set('customer_reference', input.customerReference);

    const url = `${this.config.baseUrl}/api/v1/kyc/bvn?${params.toString()}`;
    console.log('[DojahService] validateBVN called', { customerReference: input.customerReference });

    const res = await this.fetchWithRetry(url, { method: 'GET', headers: this.headers });
    const json = await res.json();

    const parsed = DojahBVNValidationResultSchema.safeParse(json);
    if (!parsed.success) {
      console.error('[DojahService] validateBVN parse error', parsed.error.flatten());
      throw new Error('Dojah BVN result failed schema validation');
    }
    return parsed.data;
  }

  /** BVN lookup (no name params) — returns phone, DOB, and legal name on record. */
  async lookupBVN(bvn: string): Promise<{ entity: DojahBVNEntity }> {
    const url = `${this.config.baseUrl}/api/v1/kyc/bvn?${new URLSearchParams({ bvn }).toString()}`;
    console.log('[DojahService] lookupBVN called');

    const res = await this.fetchWithRetry(url, { method: 'GET', headers: this.headers });
    const json = await res.json();
    const parsed = DojahBVNEntitySchema.safeParse(
      normalizeDojahBvnLookupEntity((json as { entity?: unknown })?.entity)
    );
    if (!parsed.success) {
      console.error('[DojahService] lookupBVN parse error', parsed.error.flatten());
      throw new Error('Dojah BVN lookup failed schema validation');
    }
    return { entity: parsed.data };
  }

  /**
   * AML Screening v2 — screens vendor against PEP, sanctions, adverse media lists.
   */
  async screenAML(fullName: string, dateOfBirth: string): Promise<DojahAMLResult> {
    const url = `${this.config.baseUrl}/api/v1/aml/screening`;
    console.log('[DojahService] screenAML called');

    const res = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ full_name: fullName, date_of_birth: dateOfBirth }),
    });
    const json = await res.json();

    const parsed = DojahAMLResultSchema.safeParse(json);
    if (!parsed.success) {
      console.error('[DojahService] screenAML parse error', parsed.error.flatten());
      throw new Error('Dojah AML result failed schema validation');
    }
    return parsed.data;
  }

  /**
   * CAC Lookup — verifies company registration status.
   */
  async verifyCAC(rcNumber: string, companyName?: string): Promise<DojahCACResult> {
    const params = new URLSearchParams({ rc_number: rcNumber });
    if (companyName?.trim()) {
      params.set('company_name', companyName.trim());
    }

    const url = `${this.config.baseUrl}/api/v1/kyc/cac?${params.toString()}`;
    console.log('[DojahService] verifyCAC called', {
      rcNumber: maskIdentifier(rcNumber),
      hasCompanyName: Boolean(companyName?.trim()),
    });

    const res = await this.fetchWithRetry(url, { method: 'GET', headers: this.headers });
    const json = await res.json();

    const parsed = DojahCACResultSchema.safeParse(json);
    if (!parsed.success) {
      console.error('[DojahService] verifyCAC parse error', parsed.error.flatten());
      throw new Error('Dojah CAC result failed schema validation');
    }
    return parsed.data;
  }

  /**
   * Optional EasyDetect onboarding event.
   * Non-blocking callers should catch errors so KYC flow is not dependent on fraud telemetry.
   */
  async sendEasyDetectOnboardingEvent(event: {
    userId: string;
    email?: string;
    name?: string;
    mobile?: string;
    registrationTime: string;
    tier?: string;
    ipAddress?: string;
    deviceType?: string;
  }): Promise<unknown | null> {
    if (!this.config.easyDetectIngestKey) {
      console.warn('[DojahService] EasyDetect ingest key not configured; skipping onboarding event');
      return null;
    }

    const res = await this.fetchWithRetry('https://ingest.dojah.io/api/ingest', {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        key: this.config.easyDetectIngestKey,
        type: 'onboarding',
        event: {
          user: {
            user_id: event.userId,
            user_type: 'business',
            registration_time: event.registrationTime,
            email: event.email,
            name: event.name,
            mobile: event.mobile,
            tier: event.tier,
          },
          device: {
            type: event.deviceType,
            ip_address: event.ipAddress,
          },
        },
      }),
    }, 1);

    return res.json().catch(() => null);
  }

  /**
   * Lightweight connectivity check — used by health endpoint.
   */
  async ping(): Promise<boolean> {
    try {
      const url = `${this.config.baseUrl}/api/v1/kyc/nin?nin=00000000000`;
      const res = await this.fetchWithRetry(url, { method: 'GET', headers: this.headers }, 1);
      // Any response (even 4xx) means the service is reachable
      return res.status < 500;
    } catch {
      return false;
    }
  }

  /**
   * Internal fetch with exponential backoff retry.
   * Retries on network errors and 5xx responses.
   * Waits 60s on 429 before one retry.
   * Timeout: 30 seconds per attempt.
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = 3
  ): Promise<Response> {
    const TIMEOUT_MS = 30_000;
    const BACKOFF_MS = [1000, 2000, 4000];

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timer);

        if (res.status === 429) {
          console.warn('[DojahService] Rate limited (429), waiting 60s');
          await sleep(60_000);
          continue;
        }

        if (res.status >= 500) {
          const body = await res.text().catch(() => '');
          console.error(`[DojahService] Server error ${res.status}`, { url: redactDojahUrl(url), body });
          lastError = new Error(`Dojah API server error: ${res.status}`);
          if (attempt < retries - 1) {
            await sleep(BACKOFF_MS[attempt] ?? 4000);
          }
          continue;
        }

        return res;
      } catch (err) {
        clearTimeout(timer);
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[DojahService] Network error (attempt ${attempt + 1})`, { url: redactDojahUrl(url), msg });
        lastError = new Error(`Dojah API network error: ${msg}`);
        if (attempt < retries - 1) {
          await sleep(BACKOFF_MS[attempt] ?? 4000);
        }
      }
    }

    throw lastError ?? new Error('Dojah API request failed after retries');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maskIdentifier(value: string): string {
  if (!value) return '';
  return value.length <= 4 ? '****' : `${'*'.repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getVerificationCandidate(json: unknown): Record<string, unknown> {
  if (!isRecord(json)) return {};
  if (isRecord(json.entity)) {
    if (isRecord(json.entity.verification)) return json.entity.verification;
    if (isRecord(json.entity.data) && (json.entity.data.reference_id || json.entity.data.verification_status || json.entity.data.verificationStatus)) {
      return json.entity.data;
    }
    return json.entity;
  }
  if (isRecord(json.data) && (json.data.reference_id || json.data.verification_status || json.data.verificationStatus)) {
    return json.data;
  }
  return json;
}

function getVerificationListCandidates(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json.filter(isRecord);
  if (!isRecord(json)) return [];

  const candidates = [
    json.entity,
    json.data,
    isRecord(json.entity) ? json.entity.data : undefined,
    isRecord(json.entity) ? json.entity.verifications : undefined,
    isRecord(json.data) ? json.data.data : undefined,
    isRecord(json.data) ? json.data.verifications : undefined,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter(isRecord);
  }

  return [];
}

function getReferenceFromCandidate(candidate: Record<string, unknown>): string | undefined {
  const reference = candidate.reference_id ?? candidate.referenceId ?? candidate.reference;
  return typeof reference === 'string' ? reference : undefined;
}

function hasRichVerificationEvidence(candidate: Record<string, unknown>): boolean {
  const richKeys = [
    'government_data',
    'governmentData',
    'liveness',
    'selfie',
    'address',
    'government_id',
    'governmentId',
    'business_data',
    'businessData',
    'business_id',
    'businessId',
    'ip_device',
    'ipDevice',
    'aml',
    'selfie_url',
    'selfieUrl',
    'id_url',
    'idUrl',
    'document_url',
    'documentUrl',
    'image_url',
    'imageUrl',
    'verification_url',
    'verificationUrl',
  ];

  if (richKeys.some((key) => candidate[key] !== undefined && candidate[key] !== null)) {
    return true;
  }

  const data = isRecord(candidate.data) ? candidate.data : {};
  return richKeys.some((key) => data[key] !== undefined && data[key] !== null);
}

function countMediaCandidates(value: unknown): number {
  if (Array.isArray(value)) return value.reduce((total, item) => total + countMediaCandidates(item), 0);
  if (!isRecord(value)) return 0;
  return Object.entries(value).reduce((total, [key, child]) => {
    const isUrl = typeof child === 'string' && /^https:\/\//i.test(child) && /(url|image|photo|selfie|document|file)/i.test(key);
    return total + (isUrl ? 1 : countMediaCandidates(child));
  }, 0);
}

function mergeVerificationResults(
  primary: DojahVerificationResult,
  fallback: DojahVerificationResult
): DojahVerificationResult {
  return {
    ...fallback,
    ...primary,
    data: {
      ...((fallback.data as Record<string, unknown> | null) ?? {}),
      ...((primary.data as Record<string, unknown> | null) ?? {}),
    } as DojahVerificationResult['data'],
    metadata: {
      ...((fallback.metadata as Record<string, unknown> | null) ?? {}),
      ...((primary.metadata as Record<string, unknown> | null) ?? {}),
    } as DojahVerificationResult['metadata'],
  };
}

function preserveRawVerificationShape(
  raw: Record<string, unknown>,
  parsed: DojahVerificationResult
): DojahVerificationResult {
  return {
    ...parsed,
    ...raw,
    data: mergeRecords(parsed.data, raw.data) as DojahVerificationResult['data'],
    metadata: mergeRecords(parsed.metadata, raw.metadata) as DojahVerificationResult['metadata'],
    aml: mergeRecords(parsed.aml, raw.aml) as DojahVerificationResult['aml'],
  };
}

function mergeRecords(base: unknown, override: unknown): unknown {
  if (!isRecord(base)) return override ?? base;
  if (!isRecord(override)) return base;

  const merged: Record<string, unknown> = { ...base, ...override };
  for (const key of Object.keys(merged)) {
    if (isRecord(base[key]) && isRecord(override[key])) {
      merged[key] = mergeRecords(base[key], override[key]);
    }
  }
  return merged;
}

function buildDojahDiagnostic(
  raw: unknown,
  candidate: Record<string, unknown>,
  httpStatus: number,
  referenceId: string
): Record<string, unknown> {
  const rawRecord = isRecord(raw) ? raw : {};
  return {
    httpStatus,
    referenceId,
    topLevelKeys: Object.keys(rawRecord),
    candidateKeys: Object.keys(candidate),
    message: typeof rawRecord.message === 'string' ? rawRecord.message : undefined,
    error: typeof rawRecord.error === 'string' ? rawRecord.error : undefined,
    hasEntity: isRecord(rawRecord.entity) || Array.isArray(rawRecord.entity),
    hasData: isRecord(rawRecord.data) || Array.isArray(rawRecord.data),
    hasReferenceId: Boolean(getReferenceFromCandidate(candidate)),
  };
}

/** Dojah returns match objects for validate; lookup uses plain strings — normalize both. */
function normalizeDojahBvnLookupEntity(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const e = raw as Record<string, unknown>;
  const pickString = (v: unknown): string | undefined =>
    typeof v === 'string' ? v : undefined;
  const pickFromMatch = (v: unknown): string | undefined => {
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object' && 'value' in v) {
      const val = (v as { value?: unknown }).value;
      return typeof val === 'string' ? val : undefined;
    }
    return undefined;
  };

  return {
    bvn: pickFromMatch(e.bvn) ?? pickString(e.bvn),
    first_name: pickString(e.first_name) ?? pickFromMatch(e.first_name),
    last_name: pickString(e.last_name) ?? pickFromMatch(e.last_name),
    middle_name: pickString(e.middle_name) ?? pickFromMatch(e.middle_name),
    date_of_birth: pickString(e.date_of_birth) ?? pickString(e.dob as string | undefined),
    phone_number1: pickString(e.phone_number1),
    gender: pickString(e.gender),
  };
}

function redactDojahUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of ['bvn', 'nin', 'rc_number', 'first_name', 'last_name', 'dob', 'customer_reference', 'term']) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, '[REDACTED]');
      }
    }
    return parsed.toString();
  } catch {
    return '[REDACTED_DOJAH_URL]';
  }
}

/** Singleton — lazily created */
let _instance: DojahService | null = null;

export function getDojahService(): DojahService {
  if (!_instance) {
    _instance = new DojahService();
  }
  return _instance;
}
