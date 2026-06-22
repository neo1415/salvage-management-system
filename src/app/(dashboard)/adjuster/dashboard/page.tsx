'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Camera, FileText, Send } from 'lucide-react';
import { DataLoadingState } from '@/components/ui/loading-states';

export default function AdjusterDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    const userRole = session?.user?.role;
    if (userRole !== 'claims_adjuster') {
      if (userRole === 'vendor') router.push('/vendor/dashboard');
      else if (userRole === 'salvage_manager') router.push('/manager/dashboard');
      else if (userRole === 'finance_officer') router.push('/finance/dashboard');
      else if (userRole === 'system_admin' || userRole === 'admin') router.push('/admin/dashboard');
      else router.push('/login');
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return <DataLoadingState label="Dashboard" variant="page" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Claims Adjuster Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Capture salvage evidence and submit it to the salvage manager for assessment, pricing, and auction approval.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <Camera className="mb-3 h-7 w-7 text-[var(--brand-primary)]" />
          <p className="font-semibold text-gray-900">Capture evidence</p>
          <p className="mt-1 text-sm text-gray-600">Photograph the salvage asset and record site details.</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <FileText className="mb-3 h-7 w-7 text-[var(--brand-primary)]" />
          <p className="font-semibold text-gray-900">Complete case details</p>
          <p className="mt-1 text-sm text-gray-600">Add claim reference, insurance class, asset category, and location.</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <Send className="mb-3 h-7 w-7 text-[var(--brand-primary)]" />
          <p className="font-semibold text-gray-900">Submit for review</p>
          <p className="mt-1 text-sm text-gray-600">The salvage manager handles AI review, approval, auction, and recovery actions.</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-xl font-bold text-gray-900">Case Submission</h2>
        <p className="mt-2 text-sm text-gray-600">
          Start a new salvage report. Manager-only controls such as portfolios, recovery value, bid history, approvals, and auction progress are intentionally hidden from this role.
        </p>

        <Link
          href="/adjuster/cases/new"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-[var(--brand-primary-hover)]"
        >
          <FileText className="h-5 w-5" />
          Create New Case
        </Link>
      </div>
    </div>
  );
}
