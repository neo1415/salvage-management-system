import { describe, expect, it } from 'vitest';
import { collectUrls, FILTER_TABLES, isProtectedEmail, RETAIN_TABLES, shouldDeleteCloudinaryAsset, shouldDeleteKycObject, validateResetTables, WIPE_TABLES } from '../../../scripts/lib/handover-reset-plan';

describe('handover reset safety', () => {
  it('retains all six case-insensitive substring matches and no unrelated accounts', () => {
    for (const email of ['Adetimilehin502@gmail.com', 'adedaniel502@gmail.com', 'ADNEO502@gmail.com',
      'neowalker502@gmail.com', 'alaade482@gmail.com', 'gbengamayadenu@gmail.com']) {
      expect(isProtectedEmail(email)).toBe(true);
    }
    expect(isProtectedEmail('test-admin@example.com')).toBe(false);
    expect(isProtectedEmail(null)).toBe(false);
  });

  it('refuses unclassified or missing database tables', () => {
    const tables = [...RETAIN_TABLES, ...FILTER_TABLES, ...WIPE_TABLES];
    expect(() => validateResetTables(tables)).not.toThrow();
    expect(() => validateResetTables([...tables, 'new_kyc_table'])).toThrow('Schema changed');
    expect(() => validateResetTables(tables.filter(table => table !== 'users'))).toThrow('Missing: users');
    expect(new Set(tables).size).toBe(tables.length);
  });

  it('collects referenced media from nested KYC and branding without mutating them', () => {
    const data = { selfie: 'https://example.com/selfie.jpg', branding: { logo: 'https://example.com/logo.png' },
      docs: ['https://example.com/selfie.jpg'], secret: 'encrypted-value' };
    expect([...collectUrls(data)]).toEqual(['https://example.com/selfie.jpg', 'https://example.com/logo.png']);
  });

  it('preserves referenced transformed KYC files and protected owner folders', () => {
    const asset = { public_id: 'kyc_images/legacy-selfie', format: 'jpg' };
    expect(shouldDeleteCloudinaryAsset(asset, ['https://res.cloudinary.com/app/image/upload/w_300/v12/kyc_images/legacy-selfie.jpg'], [])).toBe(false);
    expect(shouldDeleteCloudinaryAsset({ public_id: 'kyc-documents/kept/nin', format: 'jpg' }, [], ['kept'])).toBe(false);
    expect(shouldDeleteCloudinaryAsset({ public_id: 'salvage-cases/kept/photo', format: 'jpg' }, [], ['kept'])).toBe(true);
    expect(shouldDeleteCloudinaryAsset({ public_id: 'brand-assets/logo', format: 'png' }, [], [])).toBe(false);
    expect(shouldDeleteCloudinaryAsset({ public_id: 'samples/demo', format: 'jpg' }, [], [])).toBe(false);
  });

  it('preserves Supabase KYC references even when stored under a legacy owner id', () => {
    expect(shouldDeleteKycObject('kept/id.jpg', [], ['kept'])).toBe(false);
    expect(shouldDeleteKycObject('legacy/id.jpg', ['https://app.supabase.co/storage/v1/object/public/kyc-documents/legacy/id.jpg'], [])).toBe(false);
    expect(shouldDeleteKycObject('deleted/id.jpg', [], ['kept'])).toBe(true);
  });
});
