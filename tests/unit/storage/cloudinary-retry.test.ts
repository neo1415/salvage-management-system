import { describe, expect, it } from 'vitest';
import { isRetryableCloudinaryError } from '@/lib/storage/cloudinary';

describe('Cloudinary upload retry classification', () => {
  it('retries transient and opaque network errors', () => {
    expect(isRetryableCloudinaryError(new Error('ECONNRESET'))).toBe(true);
    expect(isRetryableCloudinaryError({ error: { message: 'Unknown error' } })).toBe(true);
    expect(isRetryableCloudinaryError({ http_code: 503, message: 'Unavailable' })).toBe(true);
  });

  it('does not retry configuration or invalid-file errors', () => {
    expect(isRetryableCloudinaryError({ http_code: 401, message: 'Invalid API key' })).toBe(false);
    expect(isRetryableCloudinaryError({ http_code: 413, message: 'File size too large' })).toBe(false);
    expect(isRetryableCloudinaryError(new Error('Unsupported file format'))).toBe(false);
  });
});
