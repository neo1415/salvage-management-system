'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Camera, CheckCircle2, ClipboardCheck, Loader2, PackageCheck, UploadCloud } from 'lucide-react';
import { useAuth } from '@/lib/auth/use-auth';
import { useVendorDashboard } from '@/hooks/queries/use-vendor-dashboard';
import { formatAssetName } from '@/lib/utils/asset-name';
import { collectImageFilesMetadata } from '@/features/media/client-image-metadata';

type FormState = {
  pickupAuthCode: string;
  notes: string;
  files: File[];
  submitting: boolean;
  message: string | null;
  error: string | null;
};

const emptyForm: FormState = {
  pickupAuthCode: '',
  notes: '',
  files: [],
  submitting: false,
  message: null,
  error: null,
};

function assetLabel(assetType: string, details: Record<string, unknown>) {
  return formatAssetName(assetType, details, 'Auction item');
}

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
  if (!uploadResult.secure_url) {
    throw new Error(`Upload response for ${file.name} did not include a secure URL.`);
  }

  return uploadResult.secure_url;
}

export default function VendorPickupsPage() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useVendorDashboard();
  const [forms, setForms] = useState<Record<string, FormState>>({});

  const pickups = data?.pendingPickupConfirmations || [];

  const formFor = (auctionId: string) => forms[auctionId] || emptyForm;
  const updateForm = (auctionId: string, patch: Partial<FormState>) => {
    setForms((current) => ({
      ...current,
      [auctionId]: {
        ...formFor(auctionId),
        ...patch,
      },
    }));
  };

  const submitEvidence = async (pickup: (typeof pickups)[number]) => {
    const form = formFor(pickup.auctionId);
    const pickupAuthCode = form.pickupAuthCode.trim();

    if (!user?.vendorId) {
      updateForm(pickup.auctionId, { error: 'Vendor account is not loaded yet.', message: null });
      return;
    }

    if (pickupAuthCode.length < 6) {
      updateForm(pickup.auctionId, { error: 'Enter the pickup authorization code first.', message: null });
      return;
    }

    if (form.files.length < 3) {
      updateForm(pickup.auctionId, { error: 'Upload at least 3 pickup photos from different angles.', message: null });
      return;
    }

    try {
      updateForm(pickup.auctionId, { submitting: true, error: null, message: null });
      const photoMetadata = await collectImageFilesMetadata(form.files, 'browser_camera_input');
      const photoUrls = [];
      for (const file of form.files) {
        photoUrls.push(await uploadPickupEvidenceFile(pickup.auctionId, file));
      }

      const response = await fetch(`/api/auctions/${pickup.auctionId}/pickup-evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: user.vendorId,
          pickupAuthCode,
          photoUrls,
          photoMetadata,
          notes: form.notes,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Pickup evidence submission failed.');
      }

      updateForm(pickup.auctionId, {
        submitting: false,
        message: result.message || 'Pickup evidence submitted.',
        error: null,
        files: [],
      });
      await refetch();
    } catch (submitError) {
      updateForm(pickup.auctionId, {
        submitting: false,
        error: submitError instanceof Error ? submitError.message : 'Pickup evidence submission failed.',
        message: null,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-6xl">
          <div className="h-8 w-52 animate-pulse rounded bg-gray-200" />
          <div className="mt-6 grid gap-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-44 animate-pulse rounded-lg bg-white shadow-sm" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
          Could not load pickups. Please refresh and try again.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pickups</h1>
          <p className="mt-2 text-gray-600">Submit pickup evidence for paid auctions awaiting handoff confirmation.</p>
        </div>

        {pickups.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
            <PackageCheck className="mx-auto h-10 w-10 text-gray-400" />
            <h2 className="mt-4 text-lg font-semibold text-gray-900">No pickups awaiting evidence</h2>
            <p className="mt-2 text-sm text-gray-600">Won auctions will appear here after payment and pickup authorization are ready.</p>
            <Link href="/vendor/auctions" className="mt-5 inline-flex rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white">
              View auctions
            </Link>
          </div>
        ) : (
          <div className="grid gap-5">
            {pickups.map((pickup) => {
              const form = formFor(pickup.auctionId);
              return (
                <section key={pickup.auctionId} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary)]">
                        <ClipboardCheck className="h-4 w-4" />
                        Pickup authorization
                      </div>
                      <h2 className="mt-2 text-xl font-bold text-gray-900">
                        {assetLabel(pickup.case.assetType, pickup.case.assetDetails)}
                      </h2>
                      <p className="mt-1 text-sm capitalize text-gray-500">{pickup.case.assetType.replace(/_/g, ' ')}</p>
                    </div>
                    <Link href={`/vendor/auctions/${pickup.auctionId}`} className="text-sm font-semibold text-[var(--brand-primary)]">
                      View auction
                    </Link>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Pickup authorization code</label>
                      <input
                        value={form.pickupAuthCode}
                        onChange={(event) => updateForm(pickup.auctionId, { pickupAuthCode: event.target.value })}
                        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
                        placeholder="Enter code from pickup document"
                      />

                      <label className="mt-4 block text-sm font-medium text-gray-700">Notes</label>
                      <textarea
                        value={form.notes}
                        onChange={(event) => updateForm(pickup.auctionId, { notes: event.target.value })}
                        className="mt-2 min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
                        placeholder="Optional handoff notes"
                      />
                    </div>

                    <div className="rounded-lg border border-dashed border-gray-300 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                        <Camera className="h-4 w-4" />
                        Pickup photos
                      </div>
                      <p className="mt-1 text-xs text-gray-500">Upload at least 3 photos from different angles. Staff will review the private comparison.</p>
                      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg bg-gray-50 px-4 py-8 text-center hover:bg-gray-100">
                        <UploadCloud className="h-8 w-8 text-gray-500" />
                        <span className="mt-2 text-sm font-medium text-gray-800">Choose photos</span>
                        <span className="mt-1 text-xs text-gray-500">{form.files.length} selected</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          multiple
                          className="sr-only"
                          onChange={(event) => {
                            const files = Array.from(event.target.files || []).slice(0, 12);
                            updateForm(pickup.auctionId, { files, error: null, message: null });
                          }}
                        />
                      </label>

                      {form.files.length > 0 && (
                        <div className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
                          {form.files.map((file, index) => (
                            <div key={`${file.name}-${index}`} className="truncate rounded bg-gray-50 px-2 py-1">
                              {index + 1}. {file.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {form.error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</p>}
                  {form.message && (
                    <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      {form.message}
                    </p>
                  )}

                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={() => submitEvidence(pickup)}
                      disabled={form.submitting}
                      className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {form.submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                      {form.submitting ? 'Submitting evidence' : 'Submit evidence'}
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
