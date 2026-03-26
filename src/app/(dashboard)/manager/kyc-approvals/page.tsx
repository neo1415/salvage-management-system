'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2, AlertCircle, Clock, Shield, ChevronRight, AlertTriangle } from 'lucide-react';
import type { PendingApproval } from '@/features/kyc/types/kyc.types';

export default function KYCApprovalsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'High' | 'Medium' | 'Low'>('all');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/kyc/approvals')
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((data) => { setApprovals(data.approvals ?? []); setLoading(false); })
      .catch(() => { setError('Failed to load applications'); setLoading(false); });
  }, [status]);

  const filtered = filter === 'all' ? approvals : approvals.filter((a) => a.amlRiskLevel === filter);

  const riskBadge = (level?: string) => {
    if (level === 'High') return <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">High Risk</span>;
    if (level === 'Medium') return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">Medium Risk</span>;
    return <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Low Risk</span>;
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#800020]" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-[#800020]" />
        <h1 className="text-2xl font-bold text-gray-900">Tier 2 KYC Approvals</h1>
        <span className="ml-auto bg-[#800020] text-white text-sm font-semibold px-3 py-1 rounded-full">
          {approvals.length} pending
        </span>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'High', 'Medium', 'Low'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-[#800020] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'All' : `${f} Risk`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">No pending applications</p>
          <p className="text-sm">All Tier 2 KYC applications have been reviewed.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((approval) => (
            <button
              key={approval.vendorId}
              onClick={() => router.push(`/manager/kyc-approvals/${approval.vendorId}`)}
              className="w-full bg-white border border-gray-200 rounded-xl p-4 hover:border-[#800020] hover:shadow-md transition-all text-left flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-gray-900 truncate">{approval.vendorName}</p>
                  {riskBadge(approval.amlRiskLevel)}
                </div>
                <p className="text-sm text-gray-500">
                  Submitted {new Date(approval.submittedAt).toLocaleDateString()} ·{' '}
                  {approval.vendorEmail}
                </p>
                {approval.flaggedReasons.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3 h-3 text-orange-500" />
                    <p className="text-xs text-orange-600 truncate">
                      {approval.flaggedReasons.slice(0, 2).join(' · ')}
                    </p>
                  </div>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
