import { afterEach, describe, expect, it, vi } from 'vitest';
import { DojahService } from '@/features/kyc/services/dojah.service';

function service() {
  return new DojahService({
    apiKey: 'test-secret',
    appId: 'test-app',
    publicKey: 'test-public',
    baseUrl: 'https://api.dojah.io',
  });
}

describe('Dojah identity response contracts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not turn a BVN provider error into an identity mismatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'BVN not found' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        })
      )
    );

    await expect(
      service().validateBVN({
        bvn: '22222222222',
        firstName: 'Test',
        lastName: 'Person',
        dateOfBirth: '1990-01-01',
      })
    ).rejects.toThrow('Dojah BVN request failed with status 400');
  });

  it('rejects an empty successful BVN response instead of reporting a name mismatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ status: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );

    await expect(
      service().validateBVN({
        bvn: '22222222222',
        firstName: 'Test',
        lastName: 'Person',
        dateOfBirth: '1990-01-01',
      })
    ).rejects.toThrow('Dojah BVN result did not include a validation decision');
  });

  it('rejects an empty successful NIN response instead of reporting a name mismatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ status: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );

    await expect(service().verifyNINAdvanced('12345678901')).rejects.toThrow(
      'Dojah advanced NIN result did not include identity data'
    );
  });
});
