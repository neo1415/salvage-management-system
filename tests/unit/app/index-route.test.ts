import { describe, expect, it } from 'vitest';
import { POST } from '@/app/index/route';

describe('/index route', () => {
  it('returns a non-cacheable 404 for malformed public POST probes', () => {
    const response = POST();

    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Allow')).toBe('GET, HEAD');
  });
});
