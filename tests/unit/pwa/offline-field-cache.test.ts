import { describe, expect, it } from 'vitest';
import { offlineFieldCacheInternals } from '@/lib/pwa/offline-field-cache';

describe('offline field cache helper', () => {
  it('extracts same-origin Next static assets from route HTML', () => {
    const html = `
      <script src="/_next/static/chunks/app/login/page-abc123.js"></script>
      <link rel="stylesheet" href="/_next/static/css/app/layout-def456.css">
      <script src="https://example.com/_next/static/chunks/external.js"></script>
    `;

    expect(offlineFieldCacheInternals.collectNextStaticAssets(html)).toEqual([
      '/_next/static/chunks/app/login/page-abc123.js',
      '/_next/static/css/app/layout-def456.css',
    ]);
  });

  it('deduplicates repeated assets', () => {
    const html = `
      <script src="/_next/static/chunks/app/offline-field/page-abc123.js"></script>
      <script src="/_next/static/chunks/app/offline-field/page-abc123.js"></script>
    `;

    expect(offlineFieldCacheInternals.collectNextStaticAssets(html)).toEqual([
      '/_next/static/chunks/app/offline-field/page-abc123.js',
    ]);
  });
});
