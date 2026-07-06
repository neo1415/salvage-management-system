import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadPickupEvidenceFiles } from '@/features/pickups/client/pickup-evidence-upload';

describe('uploadPickupEvidenceFiles', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('preserves file order and limits concurrent uploads', async () => {
    let activeUploads = 0;
    let maximumConcurrentUploads = 0;
    const progress: number[] = [];

    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input) === '/api/upload/sign') {
        return new Response(JSON.stringify({
          signature: 'signature',
          timestamp: 123,
          folder: 'pickup-evidence',
          apiKey: 'public-key',
          uploadUrl: 'https://upload.example.test',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      const formData = init?.body as FormData;
      const file = formData.get('file') as File;
      activeUploads += 1;
      maximumConcurrentUploads = Math.max(maximumConcurrentUploads, activeUploads);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeUploads -= 1;

      return new Response(JSON.stringify({ secure_url: `https://cdn.example.test/${file.name}` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    const files = ['one.jpg', 'two.jpg', 'three.jpg', 'four.jpg', 'five.jpg']
      .map((name) => new File(['image'], name, { type: 'image/jpeg' }));

    const urls = await uploadPickupEvidenceFiles('auction-id', files, (uploaded, total) => {
      progress.push(Math.round((uploaded / total) * 100));
    });

    expect(urls).toEqual(files.map((file) => `https://cdn.example.test/${file.name}`));
    expect(maximumConcurrentUploads).toBe(3);
    expect(progress).toEqual([20, 40, 60, 80, 100]);
  });
});
