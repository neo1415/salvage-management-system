'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Loader2, ArrowLeft, CheckCircle2, XCircle, AlertTriangle,
  Shield, User, FileText, Eye, Download, RefreshCw, LockKeyhole, BadgeCheck
} from 'lucide-react';
import type { PendingApproval } from '@/features/kyc/types/kyc.types';
import type { DojahEvidenceSections } from '@/features/kyc/utils/provider-evidence-display';
import { formatReasonCode } from '@/features/kyc/utils/provider-evidence-display';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';

function EvidenceSectionGrid({ title, fields }: { title: string; fields: Record<string, string> }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 shadow-sm">
      <h3 className="mb-4 border-b border-gray-200 pb-2 text-lg font-bold text-gray-950">
        {title}
      </h3>
      <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
        {Object.entries(fields).map(([label, value]) => (
          <div key={label} className="rounded-lg bg-white p-3 ring-1 ring-gray-100">
            <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
            <dd className="font-medium text-gray-900 break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

type ApprovalDocument = {
  key: string;
  label: string;
  url?: string;
  type?: string;
  sourceKey?: string;
};

const REJECTION_SECTIONS = [
  'Business Data',
  'Business ID / Documents',
  'Government Data',
  'Government ID',
  'Liveness',
  'Address',
  'AML / PEP / Watchlist',
  'IP / Device',
  'Other',
];

function addDocument(
  documents: ApprovalDocument[],
  seen: Set<string>,
  document: ApprovalDocument
) {
  if (!document.url) return;
  const key = document.url;
  if (seen.has(key)) return;
  seen.add(key);
  documents.push(document);
}

function getApprovalDocuments(approval: PendingApproval): ApprovalDocument[] {
  const documents: ApprovalDocument[] = [];
  const seen = new Set<string>();

  addDocument(documents, seen, { key: 'photo-id', label: 'Photo ID', url: approval.photoIdUrl, type: 'photo_id' });
  addDocument(documents, seen, { key: 'nin-card', label: 'NIN / government ID', url: approval.ninCardUrl, type: 'photo_id' });
  addDocument(documents, seen, { key: 'address-proof', label: 'Address proof', url: approval.addressProofUrl, type: 'address_proof' });
  addDocument(documents, seen, { key: 'business-registration', label: 'CAC / business registration', url: approval.cacCertificateUrl, type: 'cac_certificate' });
  addDocument(documents, seen, { key: 'selfie', label: 'Selfie / liveness image', url: approval.selfieUrl, type: 'selfie' });

  for (const [index, providerDocument] of (approval.providerDocuments ?? []).entries()) {
    addDocument(documents, seen, { ...providerDocument, key: `provider-${index}` });
  }

  return documents;
}

function valueFrom(fields: Record<string, string> | undefined | null, label: string, fallback = 'Not available') {
  const value = fields?.[label]?.trim();
  return value && value !== 'â€”' ? value : fallback;
}

function humanRisk(value?: string | null) {
  if (!value) return 'Low';
  const normalized = value.toLowerCase();
  if (normalized === 'high' || normalized === 'critical') return 'High';
  if (normalized === 'medium') return 'Medium';
  return 'Low';
}

function reviewStatusLabel(status: 'pending' | 'approved' | 'rejected') {
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  return 'Awaiting manager review';
}

function cleanFlags(reasons: string[] | undefined) {
  return (reasons ?? [])
    .map((reason) => reason?.trim())
    .filter((reason): reason is string => Boolean(reason && reason !== 'â€¢' && reason !== '•'));
}

function cardTone(value: string) {
  if (/failed|flagged|mismatch|rejected|high/i.test(value)) return 'border-red-200 bg-red-50 text-red-900';
  if (/pending|review|unavailable|not completed/i.test(value)) return 'border-yellow-200 bg-yellow-50 text-yellow-900';
  return 'border-green-200 bg-green-50 text-green-900';
}

export default function KYCApprovalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session, status } = useSession();
  const vendorId = params.id as string;

  const [approval, setApproval] = useState<PendingApproval | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectedSections, setRejectedSections] = useState<string[]>([]);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [rejectionReasonStored, setRejectionReasonStored] = useState<string | null>(null);
  const [decisionNotice, setDecisionNotice] = useState<string | null>(null);
  const decisionInFlight = useRef(false);
  const [exportingEvidence, setExportingEvidence] = useState(false);
  const [evidenceSections, setEvidenceSections] = useState<DojahEvidenceSections | null>(null);
  const [verificationSource, setVerificationSource] = useState<'dojah' | 'manual_hybrid' | 'legacy_manual' | 'unknown'>('unknown');
  const [refreshingEvidence, setRefreshingEvidence] = useState(false);
  const [confirmDecision, setConfirmDecision] = useState<'approve' | 'reject' | null>(null);
  const viewerRole = session?.user?.role;
  const canDecide = viewerRole === 'salvage_manager';

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  async function loadApproval(refresh = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/kyc/approvals/${vendorId}${refresh ? '?refresh=1' : ''}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to load application');
      }
      const data = await res.json();
      setApproval(data.approval as PendingApproval);
      setEvidenceSections((data.evidenceSections as DojahEvidenceSections | null) ?? null);
      setVerificationSource((data.verificationSource as typeof verificationSource) ?? 'unknown');
      setReviewStatus((data.reviewStatus as typeof reviewStatus) ?? 'pending');
      setRejectionReasonStored((data.rejectionReason as string | undefined) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load application');
      setApproval(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status !== 'authenticated') return;
    void loadApproval(false);
  }, [status, vendorId]);

  async function handleRefreshProviderEvidence() {
    setRefreshingEvidence(true);
    setError(null);
    try {
      const res = await fetch(`/api/kyc/approvals/${vendorId}/refresh-evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to refresh evidence');
      if (data.approval) {
        setApproval(data.approval as PendingApproval);
        if (data.evidenceSections) {
          setEvidenceSections(data.evidenceSections as DojahEvidenceSections);
        } else {
          await loadApproval(false);
        }
      } else if (!data.reconcile?.synced) {
        setError('Could not refresh the completed verification result for the stored reference. If a different reference was used, ask an admin to refresh with that reference.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh evidence');
    } finally {
      setRefreshingEvidence(false);
    }
  }

  async function handleDecision(decision: 'approve' | 'reject') {
    if (decisionInFlight.current) return;
    if (reviewStatus !== 'pending') return;

    if (decision === 'reject' && !rejectReason.trim()) {
      setError('Please provide a rejection reason');
      return;
    }
    if (decision === 'reject' && rejectedSections.length === 0) {
      setError('Select at least one rejected KYC section');
      return;
    }

    decisionInFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/kyc/approvals/${vendorId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reason: rejectReason,
          rejectedSections: decision === 'reject' ? rejectedSections : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Decision failed');

      const outcome = data.decision === 'approve' ? 'approved' : 'rejected';
      setConfirmDecision(null);
      setShowRejectForm(false);
      setReviewStatus(outcome);
      setDecisionNotice(
        outcome === 'approved'
          ? 'Application approved. The vendor has been notified by email and SMS where enabled.'
          : 'Application rejected. The vendor has been notified by email and SMS where enabled.'
      );
      await loadApproval(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit decision');
    } finally {
      setSubmitting(false);
      decisionInFlight.current = false;
    }
  }

  function toggleRejectedSection(section: string) {
    setRejectedSections((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section]
    );
  }

  function requestDecisionConfirmation(decision: 'approve' | 'reject') {
    if (decision === 'reject' && !rejectReason.trim()) {
      setError('Please provide a rejection reason');
      return;
    }
    if (decision === 'reject' && rejectedSections.length === 0) {
      setError('Select at least one rejected KYC section');
      return;
    }
    setError(null);
    setConfirmDecision(decision);
  }

  async function handleEvidenceExport() {
    setExportingEvidence(true);
    setError(null);
    try {
      const response = await fetch(`/api/kyc/approvals/${vendorId}/evidence/export`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to export evidence packet');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] || `vendor-verification-evidence-${vendorId.slice(0, 8)}.csv`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to export evidence packet');
    } finally {
      setExportingEvidence(false);
    }
  }

  if (status === 'loading' || loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-primary)]" /></div>;
  }

  if (!approval) {
    return <div className="p-6 text-center text-gray-500">Application not found.</div>;
  }

  const isReviewFinalized = reviewStatus === 'approved' || reviewStatus === 'rejected';

  const scoreColor = (score?: number, threshold = 80) =>
    score === undefined ? 'text-gray-500' : score >= threshold ? 'text-green-600' : 'text-red-600';

  const normalized = (approval.providerEvidence?.normalizedResult ?? {}) as Record<string, unknown>;
  const displayLiveness =
    approval.livenessScore ??
    (typeof normalized.livenessScore === 'number' ? normalized.livenessScore : undefined);
  const displayBiometric =
    approval.biometricMatchScore ??
    (typeof normalized.biometricMatchScore === 'number' ? normalized.biometricMatchScore : undefined);
  const scoreUnavailable = verificationSource === 'dojah' || verificationSource === 'manual_hybrid'
    ? 'Not available in this verification'
    : '—';
  const documents = getApprovalDocuments(approval);
  const manualScore = typeof (approval.ninVerificationData as Record<string, unknown> | undefined)?.score === 'number'
    ? (approval.ninVerificationData as Record<string, number>).score
    : null;
  const manualRecommendation = typeof (approval.ninVerificationData as Record<string, unknown> | undefined)?.recommendation === 'string'
    ? String((approval.ninVerificationData as Record<string, unknown>).recommendation)
    : null;
  const managerDecision = (normalized.managerDecision ?? {}) as Record<string, unknown>;
  const managerDecisionReviewedAt = managerDecision.reviewedAt
    ? String(managerDecision.reviewedAt)
    : null;
  const managerDecisionReason = managerDecision.reason ? String(managerDecision.reason) : null;
  const decisionMade = isReviewFinalized || Boolean(managerDecision.decision);
  const businessFields = evidenceSections?.business ?? {};
  const identityFields = evidenceSections?.governmentData ?? {};
  const livenessFields = evidenceSections?.liveness ?? {};
  const addressFields = evidenceSections?.address ?? {};
  const amlFields = evidenceSections?.aml ?? {};
  const ipDeviceFields = evidenceSections?.ipDevice ?? {};
  const riskLevel = humanRisk(approval.providerEvidence?.riskLevel ?? approval.amlRiskLevel);
  const livenessStatus = displayLiveness !== undefined
    ? `${displayLiveness}%`
    : valueFrom(livenessFields, 'Liveness status', 'Pending');
  const amlScreening = valueFrom(amlFields, 'AML screening', 'Not completed');
  const amlCompleted = approval.providerEvidence?.checksCompleted?.includes('aml_screening') ?? false;
  const amlHasDisplayResult = !/unavailable|not completed|pending/i.test(amlScreening);
  const amlUnavailable = !amlHasDisplayResult && !amlCompleted;
  const pepHits = valueFrom(amlFields, 'PEP hits', amlUnavailable ? 'Not completed' : 'No');
  const sanctionsHits = valueFrom(amlFields, 'Sanctions hits', amlUnavailable ? 'Not completed' : 'No');
  const adverseHits = valueFrom(amlFields, 'Adverse media hits', amlUnavailable ? 'Not completed' : 'No');
  const amlDecision =
    amlUnavailable
      ? approval.providerEvidence?.reasonCodes?.includes('dojah_aml_unavailable')
        ? 'Verification service unavailable'
        : 'Not completed'
      : /yes/i.test(`${pepHits} ${sanctionsHits} ${adverseHits}`)
      ? 'Needs review'
      : 'No matches found';
  const attentionReasons = cleanFlags([
    ...approval.flaggedReasons,
    ...((approval.providerEvidence?.reasonCodes ?? []).map(formatReasonCode)),
  ]);
  const showLegacyTechnicalEvidence: boolean = false;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => router.push('/manager/vendors?tier=tier2')}
        className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Vendors
      </button>

      {reviewStatus === 'approved' && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-green-900">Tier 2 application approved</p>
              {decisionNotice && <p className="text-sm text-green-800 mt-1">{decisionNotice}</p>}
            </div>
            {decisionNotice && (
              <button
                type="button"
                onClick={() => setDecisionNotice(null)}
                className="ml-auto text-sm font-medium text-green-800 hover:text-green-900"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      {reviewStatus === 'rejected' && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-900">Tier 2 application rejected</p>
              {decisionNotice && <p className="text-sm text-red-800 mt-1">{decisionNotice}</p>}
              {rejectionReasonStored && (
                <p className="text-sm text-red-800 mt-2">Reason: {rejectionReasonStored}</p>
              )}
            </div>
            {decisionNotice && (
              <button
                type="button"
                onClick={() => setDecisionNotice(null)}
                className="ml-auto text-sm font-medium text-red-800 hover:text-red-900"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-[var(--brand-primary)]" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vendor Verification Review</h1>
            <p className="text-sm text-gray-600">{approval.vendorName}</p>
          </div>
          {riskLevel === 'High' && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">High Risk</span>}
          {riskLevel === 'Medium' && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">Medium Risk</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {verificationSource === 'dojah' && (
            <button
              onClick={handleRefreshProviderEvidence}
              disabled={refreshingEvidence}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {refreshingEvidence ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh Evidence
            </button>
          )}
          <button
            onClick={handleEvidenceExport}
            disabled={exportingEvidence}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-[var(--brand-primary)] text-[var(--brand-primary)] font-semibold rounded-lg hover:bg-[var(--brand-primary)] hover:text-white transition-colors disabled:opacity-50"
          >
            {exportingEvidence ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export Evidence CSV
          </button>
        </div>
      </div>

      {decisionMade && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 text-sm">
          <p className="font-semibold text-gray-900">
            Manager decision: <span className="capitalize">{String(managerDecision.decision)}</span>
          </p>
          {managerDecisionReviewedAt && (
            <p className="text-gray-600">Reviewed at {new Date(managerDecisionReviewedAt).toLocaleString()}</p>
          )}
          {managerDecisionReason && <p className="mt-2 text-gray-700">Reason: {managerDecisionReason}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Vendor info */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Application Summary</h2>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-gray-500">Business</dt><dd className="font-medium text-right">{approval.vendorName}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Email</dt><dd className="font-medium">{approval.vendorEmail || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Submitted</dt><dd className="font-medium">{new Date(approval.submittedAt).toLocaleString()}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Status</dt><dd className="font-semibold">{reviewStatusLabel(reviewStatus)}</dd></div>
          </dl>
        </div>

        {/* Review status */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Review Snapshot</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className={`rounded-lg border p-3 ${cardTone(riskLevel)}`}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Risk level</p>
              <p className="mt-1 font-bold">{riskLevel}</p>
            </div>
            <div className={`rounded-lg border p-3 ${cardTone(livenessStatus)}`}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Liveness</p>
              <p className="mt-1 font-bold">{livenessStatus}</p>
            </div>
            <div className={`rounded-lg border p-3 sm:col-span-2 ${cardTone(amlDecision)}`}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">AML / watchlist</p>
              <p className="mt-1 font-bold">{amlDecision}</p>
            </div>
          </div>
          <dl className="hidden" aria-hidden="true">
            <div className="flex justify-between">
              <dt className="text-gray-500">Liveness Score</dt>
              <dd className={`font-semibold ${scoreColor(displayLiveness, 50)}`}>
                {displayLiveness !== undefined ? `${displayLiveness}%` : scoreUnavailable}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Biometric Match</dt>
              <dd className={`font-semibold ${scoreColor(displayBiometric, 80)}`}>
                {displayBiometric !== undefined ? `${displayBiometric}%` : scoreUnavailable}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">AML Risk Level</dt>
              <dd className={`font-semibold ${approval.amlRiskLevel === 'High' ? 'text-red-600' : approval.amlRiskLevel === 'Medium' ? 'text-yellow-600' : 'text-green-600'}`}>
                {approval.amlRiskLevel ?? 'Low'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Fraud Score</dt>
              <dd className={`font-semibold ${scoreColor(approval.fraudRiskScore ? 100 - approval.fraudRiskScore : undefined, 70)}`}>
                {approval.fraudRiskScore !== undefined ? `${approval.fraudRiskScore}/100` : '—'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {attentionReasons.length > 0 ? (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            <h2 className="font-semibold text-orange-900">Needs Attention</h2>
          </div>
          <ul className="space-y-1">
            {attentionReasons.map((reason, index) => (
              <li key={`${reason}-${index}`} className="text-sm text-orange-800 flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-orange-500" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-green-600" />
            <p className="text-sm font-semibold text-green-900">No high-risk automated flags were found. Continue with document and identity review.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 mb-6 lg:grid-cols-2">
        <EvidenceSectionGrid
          title="Identity"
          fields={{
            'Submitted name': valueFrom(evidenceSections?.providerSummary, 'Submitted name', 'Not provided'),
            'Verified name': valueFrom(identityFields, 'Verified name', valueFrom(identityFields, 'Provider name', 'Not returned')),
            'Date of birth': valueFrom(identityFields, 'Date of birth', valueFrom(identityFields, 'Date of birth match', 'Not returned')),
            Gender: valueFrom(identityFields, 'Gender', 'Not returned'),
            NIN: valueFrom(identityFields, 'Identity number', valueFrom(identityFields, 'NIN', 'Stored securely')),
            BVN: valueFrom(identityFields, 'BVN', valueFrom(identityFields, 'BVN check', 'Stored securely')),
          }}
        />
        <EvidenceSectionGrid
          title="Business"
          fields={{
            'Business name': valueFrom(businessFields, 'Submitted business name', valueFrom(evidenceSections?.providerSummary, 'Submitted business', approval.vendorName)),
            'Business type': valueFrom(businessFields, 'Submitted business type', 'Not provided'),
            'Registration number': valueFrom(businessFields, 'Submitted registration number', valueFrom(evidenceSections?.providerSummary, 'Submitted business number', 'Not provided')),
            'Registry name': valueFrom(businessFields, 'Registry business name', valueFrom(businessFields, 'Provider business name', 'Not returned')),
            'Registry result': valueFrom(businessFields, 'Registry lookup', valueFrom(businessFields, 'Provider lookup', 'Not completed')),
            'Registration date': valueFrom(businessFields, 'Registration date', 'Not returned'),
            'Name match': valueFrom(businessFields, 'Business name match', 'Needs manager review'),
          }}
        />
        <EvidenceSectionGrid
          title="Address"
          fields={{
            Address: valueFrom(addressFields, 'Submitted address', 'Not provided'),
            City: valueFrom(addressFields, 'City', 'Not provided'),
            State: valueFrom(addressFields, 'State', 'Not provided'),
            'Proof of address': valueFrom(addressFields, 'Address proof', 'Not uploaded'),
          }}
        />
        <EvidenceSectionGrid
          title="AML And Watchlist"
          fields={{
            Screening: amlDecision,
            'PEP hits': pepHits,
            'Sanctions hits': sanctionsHits,
            'Adverse media hits': adverseHits,
          }}
        />
        <EvidenceSectionGrid
          title="Submission Device"
          fields={{
            'Capture status': valueFrom(ipDeviceFields, 'Capture status', 'Not captured'),
            'IP address': valueFrom(ipDeviceFields, 'IP address', 'Not captured'),
            'Device type': valueFrom(ipDeviceFields, 'Device type', 'Not captured'),
            OS: valueFrom(ipDeviceFields, 'OS', 'Not captured'),
            Browser: valueFrom(ipDeviceFields, 'Browser', 'Not captured'),
            'Browser version': valueFrom(ipDeviceFields, 'Browser version', 'Not captured'),
            Model: valueFrom(ipDeviceFields, 'Model', 'Not captured'),
            Platform: valueFrom(ipDeviceFields, 'Platform', 'Web'),
            'Device signal': valueFrom(ipDeviceFields, 'Device signal', 'Local capture only'),
            'IP screening': valueFrom(ipDeviceFields, 'IP screening', 'Not completed'),
            'Screened IP': valueFrom(ipDeviceFields, 'Screened IP', 'Not returned'),
            Country: valueFrom(ipDeviceFields, 'Country', 'Not returned'),
            Region: valueFrom(ipDeviceFields, 'Region', 'Not returned'),
            City: valueFrom(ipDeviceFields, 'City', 'Not returned'),
            Latitude: valueFrom(ipDeviceFields, 'Latitude', 'Not returned'),
            Longitude: valueFrom(ipDeviceFields, 'Longitude', 'Not returned'),
            ISP: valueFrom(ipDeviceFields, 'ISP', 'Not returned'),
            ASN: valueFrom(ipDeviceFields, 'ASN', 'Not returned'),
            VPN: valueFrom(ipDeviceFields, 'VPN', 'Not returned'),
            Proxy: valueFrom(ipDeviceFields, 'Proxy', 'Not returned'),
            Hosting: valueFrom(ipDeviceFields, 'Hosting', 'Not returned'),
            Tor: valueFrom(ipDeviceFields, 'Tor', 'Not returned'),
            'Risk score': valueFrom(ipDeviceFields, 'Risk score', 'Not returned'),
          }}
        />
      </div>

      {/* Legacy technical evidence is kept out of the default staff view; use CSV export for audit details. */}
      {showLegacyTechnicalEvidence && approval.flaggedReasons.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            <h2 className="font-semibold text-orange-900">Flagged Reasons</h2>
          </div>
          <ul className="space-y-1">
            {approval.flaggedReasons.map((r, i) => (
              <li key={i} className="text-sm text-orange-800 flex items-start gap-2">
                <span className="text-orange-500 mt-0.5">•</span> {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showLegacyTechnicalEvidence && approval.providerEvidence && evidenceSections && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-[var(--brand-primary)]" />
            <h2 className="font-semibold text-gray-900">Verification Evidence</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
            <div>
              <p className="text-gray-500">Source</p>
              <p className="font-semibold">
                {verificationSource === 'manual_hybrid' ? 'Manual verification' : 'Identity verification'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Verification status</p>
              <p className="font-semibold capitalize">{approval.providerEvidence.status.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-gray-500">Risk</p>
              <p className={`font-semibold capitalize ${
                approval.providerEvidence.riskLevel === 'critical' || approval.providerEvidence.riskLevel === 'high'
                  ? 'text-red-600'
                  : approval.providerEvidence.riskLevel === 'medium'
                    ? 'text-yellow-600'
                    : 'text-green-600'
              }`}>
                {approval.providerEvidence.riskLevel}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-gray-500">Reference</p>
              <p className="font-mono text-xs text-gray-800 break-all">
                {approval.providerEvidence.providerReference || approval.providerEvidence.workflowReference || 'Not available'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Updated</p>
              <p className="font-medium">
                {approval.providerEvidence.updatedAt ? new Date(approval.providerEvidence.updatedAt).toLocaleString() : 'Not available'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium text-gray-700 mb-2">Completed Checks</p>
              <div className="flex flex-wrap gap-2">
                {approval.providerEvidence.checksCompleted.length ? approval.providerEvidence.checksCompleted.map((check) => (
                  <span key={check} className="px-2 py-1 rounded-full bg-green-50 text-green-700 text-xs">{formatReasonCode(check)}</span>
                )) : <span className="text-gray-400">None yet</span>}
              </div>
            </div>
            <div>
              <p className="font-medium text-gray-700 mb-2">Pending Checks</p>
              <div className="flex flex-wrap gap-2">
                {approval.providerEvidence.pendingChecks.length ? approval.providerEvidence.pendingChecks.map((check) => (
                  <span key={check} className="px-2 py-1 rounded-full bg-yellow-50 text-yellow-700 text-xs">{formatReasonCode(check)}</span>
                )) : <span className="text-gray-400">None</span>}
              </div>
            </div>
            <div>
              <p className="font-medium text-gray-700 mb-2">Failed Checks</p>
              <div className="flex flex-wrap gap-2">
                {approval.providerEvidence.failedChecks.length ? approval.providerEvidence.failedChecks.map((check) => (
                  <span key={check} className="px-2 py-1 rounded-full bg-red-50 text-red-700 text-xs">{formatReasonCode(check)}</span>
                )) : <span className="text-gray-400">None</span>}
              </div>
            </div>
          </div>
          {approval.providerEvidence.displayMessage && (
            <p className="mt-4 text-sm text-gray-600">{approval.providerEvidence.displayMessage}</p>
          )}
          {evidenceSections && (
            <div className="mt-6 grid gap-5 border-t border-gray-100 pt-6">
              <EvidenceSectionGrid title="Verification Overview" fields={evidenceSections.providerSummary} />
              {verificationSource !== 'dojah' && (
                <EvidenceSectionGrid title="Pending Reason" fields={evidenceSections.pendingReason} />
              )}
              <EvidenceSectionGrid title="Business Data" fields={evidenceSections.business} />
              <EvidenceSectionGrid title="Government Data" fields={evidenceSections.governmentData} />
              <EvidenceSectionGrid title="Liveness" fields={evidenceSections.liveness} />
              <EvidenceSectionGrid title="Address" fields={evidenceSections.address} />
              <EvidenceSectionGrid title="Government ID" fields={evidenceSections.governmentId} />
              <EvidenceSectionGrid title="Business ID" fields={evidenceSections.businessId} />
              {viewerRole === 'system_admin' && <EvidenceSectionGrid title="IP/Device" fields={evidenceSections.ipDevice} />}
              <EvidenceSectionGrid title="Documents" fields={evidenceSections.documents} />
              <EvidenceSectionGrid title="AML" fields={evidenceSections.aml} />
            </div>
          )}
        </div>
      )}

      {/* AI Verification Results (for manual KYC) */}
      {approval.ninVerificationData && manualScore !== null && manualRecommendation && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-blue-600" />
            <h2 className="font-semibold text-blue-900">AI Verification Results</h2>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Overall Score</p>
                <p className={`text-2xl font-bold ${manualScore >= 80 ? 'text-green-600' : manualScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {manualScore}/100
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Recommendation</p>
                <p className={`text-lg font-semibold capitalize ${manualRecommendation === 'approve' ? 'text-green-600' : manualRecommendation === 'reject' ? 'text-red-600' : 'text-yellow-600'}`}>
                  {manualRecommendation}
                </p>
              </div>
            </div>
            {(approval.ninVerificationData as any).findings && (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Document Quality:</span>
                  <span className="ml-2 text-gray-600">{(approval.ninVerificationData as any).findings.documentQuality}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Data Consistency:</span>
                  <span className="ml-2 text-gray-600">{(approval.ninVerificationData as any).findings.dataConsistency}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Authenticity:</span>
                  <span className="ml-2 text-gray-600">{(approval.ninVerificationData as any).findings.authenticity}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document previews */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Documents</h2>
        </div>
        {documents.length ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {documents.map((document) => {
              const protectedDocumentUrl = `/api/kyc/approvals/${vendorId}/documents/${encodeURIComponent(document.key)}`;
              return (
              <div key={`${document.label}-${document.url}`} className="text-center">
                <p className="text-xs text-gray-500 mb-2">{document.label}</p>
                <a href={protectedDocumentUrl} target="_blank" rel="noopener noreferrer" className="block group">
                  <div className="relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 text-gray-700 transition-colors hover:border-[var(--brand-primary)] hover:bg-orange-50/40">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-200">
                      <LockKeyhole className="h-5 w-5 text-[var(--brand-primary)]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Protected file</p>
                      <p className="mt-1 text-xs text-gray-500">Open with manager access</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-primary)] opacity-0 transition-opacity group-hover:opacity-100">
                      <Eye className="h-3.5 w-3.5" />
                      View securely
                    </span>
                  </div>
                </a>
                {viewerRole === 'system_admin' && document.sourceKey && (
                  <p className="mt-1 text-[11px] text-gray-400 break-all">{document.sourceKey}</p>
                )}
              </div>
            );})}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
            No document file was returned or imported for this verification.
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Reject form */}
      {canDecide && !isReviewFinalized && showRejectForm && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-red-900 mb-3">Rejection Reason (required)</h3>
          <div className="mb-4">
            <p className="text-sm font-medium text-red-900 mb-2">Rejected sections</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {REJECTION_SECTIONS.map((section) => (
                <label key={section} className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-900">
                  <input
                    type="checkbox"
                    checked={rejectedSections.includes(section)}
                    onChange={() => toggleRejectedSection(section)}
                    className="h-4 w-4 rounded border-red-300 text-[var(--brand-primary)] focus:ring-[var(--brand-focus-ring)]"
                  />
                  {section}
                </label>
              ))}
            </div>
          </div>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            placeholder="Explain why this application is being rejected..."
          />
        </div>
      )}

      {/* Action buttons */}
      {canDecide && !isReviewFinalized ? (
      <div className="flex gap-3">
        {!showRejectForm ? (
          <>
            <button
              onClick={() => requestDecisionConfirmation('approve')}
              disabled={submitting || decisionMade}
              className="flex-1 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Approve
            </button>
            <button
              onClick={() => setShowRejectForm(true)}
              disabled={submitting || decisionMade}
              className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" /> Reject
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => requestDecisionConfirmation('reject')}
              disabled={submitting || decisionMade || !rejectReason.trim() || rejectedSections.length === 0}
              className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Confirm Rejection
            </button>
            <button
              onClick={() => { setShowRejectForm(false); setRejectReason(''); }}
              className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </>
        )}
      </div>
      ) : (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          System admins can view the verification evidence package, but only salvage managers can approve or reject Tier 2 applications.
        </div>
      )}
      <ConfirmationModal
        isOpen={confirmDecision !== null}
        onClose={() => setConfirmDecision(null)}
        onConfirm={() => {
          if (confirmDecision) void handleDecision(confirmDecision);
        }}
        title={confirmDecision === 'approve' ? 'Approve Tier 2 Application?' : 'Reject Tier 2 Application?'}
        message={
          confirmDecision === 'approve'
            ? `This will upgrade ${approval.vendorName} to Tier 2 and notify the vendor by SMS and email.`
            : `This will reject ${approval.vendorName}'s Tier 2 application and send the rejection reason to the vendor.\n\nRejected sections: ${rejectedSections.join(', ')}\nReason: ${rejectReason}`
        }
        confirmText={confirmDecision === 'approve' ? 'Yes, Approve' : 'Yes, Reject'}
        cancelText="Cancel"
        type={confirmDecision === 'approve' ? 'success' : 'danger'}
        isLoading={submitting}
      />
    </div>
  );
}
