'use client';

import { useState, useEffect, useCallback } from 'react';
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

type CompletedPickup = {
  auctionId: string;
  pickupConfirmedAt: string | null;
  pickupConfirmedVendor: boolean;
  pickupConfirmedAdmin: boolean;
  case: {
    claimReference: string;
    assetType: string;
    assetDetails: Record<string, unknown>;
  };
};

type HistoryPeriod = 'all' | '30d' | '90d';

export default function VendorPickupsPage() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useVendorDashboard();
  const [forms, setForms] = useState<Record<string, FormState>>({});

  const pickups = data?.pendingPickupConfirmations || [];
  const [historyFilter, setHistoryFilter] = useState<HistoryPeriod>('all');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPickups, setHistoryPickups] = useState<CompletedPickup[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const HISTORY_PER_PAGE = 10;

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(historyPage),
        limit: String(HISTORY_PER_PAGE),
        period: historyFilter,
      });
      const response = await fetch(`/api/vendor/pickups/completed?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to load pickup history');
      }
      const payload = await response.json();
      setHistoryPickups(payload.pickups || []);
      setHistoryTotalPages(payload.pagination?.totalPages || 1);
    } catch (historyError) {
      console.error(historyError);
      setHistoryPickups([]);
      setHistoryTotalPages(1);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyFilter, historyPage]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyFilter]);

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
      await loadHistory();
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
              const evidenceSubmitted = pickup.pickupEvidence?.submitted ?? false;
              return (
                <section key={pickup.auctionId} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary)]">
                        <ClipboardCheck className="h-4 w-4" />
                        Pickup authorization
                        {evidenceSubmitted && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            Under review
                          </span>
                        )}
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

                  {evidenceSubmitted ? (
                    <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      <p className="font-semibold">Pickup evidence submitted</p>
                      <p className="mt-1 text-amber-800">
                        Staff are reviewing your photos. Resubmission is disabled until pickup is confirmed.
                        {pickup.pickupEvidence?.submittedAt
                          ? ` Submitted ${new Date(pickup.pickupEvidence.submittedAt).toLocaleString()}.`
                          : ''}
                      </p>
                    </div>
                  ) : (
                  <>
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
                  </>
                  )}
                </section>
              );
            })}
          </div>
        )}

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Pickup history</h2>
              <p className="text-sm text-gray-600">Completed pickups confirmed by staff.</p>
            </div>
            <div className="flex gap-2">
              {(['all', '30d', '90d'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setHistoryFilter(filter)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    historyFilter === filter
                      ? 'bg-[var(--brand-primary)] text-white'
                      : 'bg-white text-gray-600 border border-gray-300'
                  }`}
                >
                  {filter === 'all' ? 'All' : filter === '30d' ? 'Last 30 days' : 'Last 90 days'}
                </button>
              ))}
            </div>
          </div>

          {historyLoading ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
              Loading pickup history...
            </div>
          ) : historyPickups.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
              No staff-confirmed pickups with submitted evidence in this period.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {historyPickups.map((pickup) => (
                <article key={pickup.auctionId} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Completed</p>
                      <h3 className="mt-1 text-lg font-bold text-gray-900">
                        {assetLabel(pickup.case.assetType, pickup.case.assetDetails)}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">{pickup.case.claimReference}</p>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  </div>
                  <p className="mt-3 text-sm text-gray-600">
                    Picked up: {pickup.pickupConfirmedAt
                      ? new Date(pickup.pickupConfirmedAt).toLocaleString()
                      : 'Date unavailable'}
                  </p>
                  <Link
                    href={`/vendor/auctions/${pickup.auctionId}`}
                    className="mt-3 inline-flex text-sm font-semibold text-[var(--brand-primary)]"
                  >
                    View auction details
                  </Link>
                </article>
              ))}
            </div>
          )}

          {historyTotalPages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-xs text-gray-500">
                Page {historyPage} of {historyTotalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={historyPage <= 1 || historyLoading}
                  onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                  className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={historyPage >= historyTotalPages || historyLoading}
                  onClick={() => setHistoryPage((page) => page + 1)}
                  className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
