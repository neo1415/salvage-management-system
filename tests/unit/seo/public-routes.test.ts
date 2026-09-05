import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';

describe('public search discovery', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://nemsalvage.com/');
    vi.stubEnv('NEXTAUTH_URL', 'https://salvagebridge.com');
    vi.stubEnv('VERCEL_URL', 'preview.vercel.app');
    vi.stubEnv('NODE_ENV', 'production');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('uses the configured public domain for every sitemap entry', () => {
    const entries = sitemap();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every(entry => new URL(entry.url).origin === 'https://nemsalvage.com')).toBe(true);
  });

  it('only advertises existing public routes', () => {
    expect(sitemap().map(entry => new URL(entry.url).pathname)).toEqual([
      '/', '/register', '/login', '/cookies', '/ndpr', '/privacy', '/terms',
    ]);
  });

  it('uses the same domain in robots and allows rendering assets', () => {
    const result = robots();
    expect(result.sitemap).toBe('https://nemsalvage.com/sitemap.xml');
    expect(result.rules).toEqual([{ userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard/'] }]);
  });

  it('supports a different white-label domain without NEM hardcoding', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://another-insurer.example');
    expect(sitemap()[0].url).toBe('https://another-insurer.example');
    expect(robots().sitemap).toBe('https://another-insurer.example/sitemap.xml');
  });

  it('fails explicitly instead of advertising Salvage Bridge when unconfigured', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', undefined);
    vi.stubEnv('NEXTAUTH_URL', undefined);
    vi.stubEnv('VERCEL_URL', undefined);
    expect(() => sitemap()).toThrow('Application URL is not configured');
    expect(() => robots()).toThrow('Application URL is not configured');
  });
});
