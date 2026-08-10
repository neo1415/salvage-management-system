import { describe, expect, it } from 'vitest';
import { SerperApiClient, serperApi } from '@/lib/integrations/serper-api';

describe('unit-test provider isolation', () => {
  it('keeps the real Serper client type available for isolated client tests', () => {
    expect(SerperApiClient).toBeTypeOf('function');
  });

  it('blocks singleton search calls unless real-provider tests are explicitly enabled', async () => {
    expect(process.env.RUN_REAL_AI_PROVIDER_TESTS).not.toBe('true');

    await expect(serperApi.search('must not reach the network')).rejects.toThrow(
      'External Serper calls are disabled in unit tests'
    );
  });
});
