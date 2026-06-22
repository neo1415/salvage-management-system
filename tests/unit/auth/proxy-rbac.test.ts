import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

const getTokenMock = vi.hoisted(() => vi.fn());

vi.mock('next-auth/jwt', () => ({
  getToken: getTokenMock,
}));

vi.mock('@/lib/auth/jwt-token', () => ({
  getAuthJwtParams: (request: NextRequest) => ({ req: request }),
}));

describe('proxy RBAC for direct vendor routes', () => {
  it('redirects direct Tier 2 page access to login when no token exists', async () => {
    getTokenMock.mockResolvedValueOnce(null);

    const request = new NextRequest('https://example.com/vendor/kyc/tier2');
    const response = await proxy(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toBe('https://example.com/login?callbackUrl=%2Fvendor%2Fkyc%2Ftier2');
  });

  it('redirects non-vendor roles away from vendor Tier 2 pages', async () => {
    getTokenMock.mockResolvedValueOnce({ role: 'salvage_manager' });

    const request = new NextRequest('https://example.com/vendor/kyc/tier2-manual');
    const response = await proxy(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toBe('https://example.com/unauthorized?from=%2Fvendor%2Fkyc%2Ftier2-manual');
  });
});

describe('proxy RBAC for manager case details', () => {
  it('allows salvage managers to open manager case detail routes', async () => {
    getTokenMock.mockResolvedValueOnce({ role: 'salvage_manager' });

    const request = new NextRequest('https://example.com/manager/cases/3112b1c3-5f4d-412d-8000-6a31b46c61e3');
    const response = await proxy(request);

    expect(response.status).toBe(200);
  });

  it('redirects legacy salvage manager adjuster case links to manager case details', async () => {
    getTokenMock.mockResolvedValueOnce({ role: 'salvage_manager' });

    const request = new NextRequest('https://example.com/adjuster/cases/3112b1c3-5f4d-412d-8000-6a31b46c61e3');
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://example.com/manager/cases/3112b1c3-5f4d-412d-8000-6a31b46c61e3'
    );
  });

  it('still keeps salvage managers out of adjuster case creation routes', async () => {
    getTokenMock.mockResolvedValueOnce({ role: 'salvage_manager' });

    const request = new NextRequest('https://example.com/adjuster/cases/new');
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://example.com/unauthorized?from=%2Fadjuster%2Fcases%2Fnew'
    );
  });
});
