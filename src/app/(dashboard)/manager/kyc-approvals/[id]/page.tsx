'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import {
  Loader2, ArrowLeft, CheckCircle2, XCircle, AlertTriangle,
  Shield, User, FileText, Eye
} from 'lucide-react';
import type { PendingApproval } from '@/features/kyc/types/kyc.types';

export default function KYCApprovalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { status } = useSession();
  const vendorId = params.id as string;

  const [approval, setApproval] = useState<PendingApproval | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/kyc/approvals')
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((data) => {
        const found = (data.approvals as PendingApproval[]).find((a) => a.vendorId === vendorId);
        setApproval(found ?? null);
        setLoading(false);
      })
      .catch(() => { setError('Failed to load application'); setLoading(false); });
  }, [status, vendorId]);

  async function handleDecision(decision: 'approve' | 'reject') {
    if (decision === 'reject' && !rejectReason.trim()) {
      setError('Please provide a rejection reason');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/kyc/approvals/${vendorId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Decision failed');
      setDone(decision);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit decision');
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading' || loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-[#800020]" /></div>;
  }

  if (done) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${done === 'approved' ? 'bg-green-100' : 'bg-red-100'}`}>
          {done === 'approved' ? <CheckCircle2 className="w-12 h-12 text-green-600" /> : <XCircle className="w-12 h-12 text-red-600" />}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {done === 'approved' ? 'Application Approved' : 'Application Rejected'}
        </h2>
        <p className="text-gray-600 mb-6">The vendor has been notified via SMS and email.</p>
        <button onClick={() => router.push('/manager/kyc-approvals')} className="px-6 py-3 bg-[#800020] text-white font-semibold rounded-lg hover:bg-[#600018] transition-colors">
          Back to Approvals
        </button>
      </div>
    );
  }

  if (!approval) {
    return <div className="p-6 text-center text-gray-500">Application not found or already reviewed.</div>;
  }

  const scoreColor = (score?: number, threshold = 80) =>
    score === undefined ? 'text-gray-500' : score >= threshold ? 'text-green-600' : 'text-red-600';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
        <ArrowLeft className="w-5 h-5" /> Back to Approvals
      </button>

      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-[#800020]" />
        <h1 className="text-2xl font-bold text-gray-900">KYC Review: {approval.vendorName}</h1>
        {approval.amlRiskLevel === 'High' && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">High Risk</span>}
        {approval.amlRiskLevel === 'Medium' && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">Medium Risk</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Vendor info */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Vendor Details</h2>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">Name</dt><dd className="font-medium">{approval.vendorName}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Email</dt><dd className="font-medium">{approval.vendorEmail || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Submitted</dt><dd className="font-medium">{new Date(approval.submittedAt).toLocaleString()}</dd></div>
          </dl>
        </div>

        {/* Verification scores */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Verification Scores</h2>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Liveness Score</dt>
              <dd className={`font-semibold ${scoreColor(approval.livenessScore, 50)}`}>
                {approval.livenessScore !== undefined ? `${approval.livenessScore}%` : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Biometric Match</dt>
              <dd className={`font-semibold ${scoreColor(approval.biometricMatchScore, 80)}`}>
                {approval.biometricMatchScore !== undefined ? `${approval.biometricMatchScore}%` : '—'}
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

      {/* Flagged reasons */}
      {approval.flaggedReasons.length > 0 && (
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

      {/* Document previews */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Documents</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Selfie', url: approval.selfieUrl },
            { label: `Photo ID (${approval.photoIdType ?? 'ID'})`, url: approval.photoIdUrl },
            { label: 'Address Proof', url: approval.addressProofUrl },
          ].map(({ label, url }) => (
            <div key={label} className="text-center">
              <p className="text-xs text-gray-500 mb-2">{label}</p>
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-[#800020] transition-colors">
                    <Image src={url} alt={label} fill className="object-cover" />
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center">
                      <Eye className="w-5 h-5 text-white opacity-0 hover:opacity-100" />
                    </div>
                  </div>
                </a>
              ) : (
                <div className="w-full aspect-square rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs">
                  Not provided
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Reject form */}
      {showRejectForm && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-red-900 mb-3">Rejection Reason (required)</h3>
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
      <div className="flex gap-3">
        {!showRejectForm ? (
          <>
            <button
              onClick={() => handleDecision('approve')}
              disabled={submitting}
              className="flex-1 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Approve
            </button>
            <button
              onClick={() => setShowRejectForm(true)}
              disabled={submitting}
              className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" /> Reject
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => handleDecision('reject')}
              disabled={submitting || !rejectReason.trim()}
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
    </div>
  );
}
