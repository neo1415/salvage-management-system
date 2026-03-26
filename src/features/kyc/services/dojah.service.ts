import {
  DojahVerificationResultSchema,
  DojahAMLResultSchema,
  DojahCACResultSchema,
  DojahNINAdvancedResultSchema,
  type DojahVerificationResult,
  type DojahAMLResult,
  type DojahCACResult,
  type DojahNINAdvancedResult,
} from '../schemas/dojah.schemas';

interface DojahConfig {
  apiKey: string;
  appId: string;
  publicKey: string;
  baseUrl: string;
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
    const apiKey = config?.apiKey ?? process.env.DOJAH_API_KEY;
    const appId = config?.appId ?? process.env.DOJAH_APP_ID;
    const publicKey = config?.publicKey ?? process.env.DOJAH_PUBLIC_KEY;
    const baseUrl = config?.baseUrl ?? process.env.DOJAH_BASE_URL ?? 'https://api.dojah.io';

    if (!apiKey) throw new Error('DOJAH_API_KEY is not set');
    if (!appId) throw new Error('DOJAH_APP_ID is not set');
    if (!publicKey) throw new Error('DOJAH_PUBLIC_KEY is not set');

    this.config = { apiKey, appId, publicKey, baseUrl };
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

    const parsed = DojahVerificationResultSchema.safeParse(json);
    if (!parsed.success) {
      console.error('[DojahService] getVerificationResult parse error', parsed.error.flatten());
      throw new Error('Dojah verification result failed schema validation');
    }
    return parsed.data;
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
   * AML Screening v2 — screens vendor against PEP, sanctions, adverse media lists.
   */
  async screenAML(fullName: string, dateOfBirth: string): Promise<DojahAMLResult> {
    const url = `${this.config.baseUrl}/api/v1/aml/screening`;
    console.log('[DojahService] screenAML', { fullName, dateOfBirth });

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
  async verifyCAC(rcNumber: string): Promise<DojahCACResult> {
    const url = `${this.config.baseUrl}/api/v1/kyc/cac?rc_number=${encodeURIComponent(rcNumber)}`;
    console.log('[DojahService] verifyCAC', { rcNumber });

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
          console.error(`[DojahService] Server error ${res.status}`, { url, body });
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
        console.error(`[DojahService] Network error (attempt ${attempt + 1})`, { url, msg });
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

/** Singleton — lazily created */
let _instance: DojahService | null = null;

export function getDojahService(): DojahService {
  if (!_instance) {
    _instance = new DojahService();
  }
  return _instance;
}
