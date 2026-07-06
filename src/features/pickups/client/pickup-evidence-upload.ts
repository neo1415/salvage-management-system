'use client';

const MAX_CONCURRENT_UPLOADS = 3;

async function uploadPickupEvidenceFile(auctionId: string, file: File): Promise<string> {
  const signResponse = await fetch('/api/upload/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entityType: 'pickup-evidence',
      entityId: auctionId,
      transformation: 'compressed',
    }),
  });

  if (!signResponse.ok) {
    throw new Error('Could not prepare pickup evidence upload.');
  }

  const signData = await signResponse.json();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('signature', signData.signature);
  formData.append('timestamp', String(signData.timestamp));
  formData.append('folder', signData.folder);
  formData.append('api_key', signData.apiKey);
  if (signData.transformation) {
    formData.append('transformation', signData.transformation);
  }

  const uploadResponse = await fetch(signData.uploadUrl, {
    method: 'POST',
    body: formData,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload failed for ${file.name}.`);
  }

  const uploadResult = await uploadResponse.json();
  if (typeof uploadResult.secure_url !== 'string') {
    throw new Error(`Upload response for ${file.name} did not include a secure URL.`);
  }

  return uploadResult.secure_url;
}

export async function uploadPickupEvidenceFiles(
  auctionId: string,
  files: File[],
  onProgress?: (uploaded: number, total: number) => void
): Promise<string[]> {
  const results = new Array<string>(files.length);
  let nextIndex = 0;
  let completed = 0;

  const worker = async () => {
    while (nextIndex < files.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await uploadPickupEvidenceFile(auctionId, files[index]);
      completed += 1;
      onProgress?.(completed, files.length);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENT_UPLOADS, files.length) },
      () => worker()
    )
  );

  return results;
}
