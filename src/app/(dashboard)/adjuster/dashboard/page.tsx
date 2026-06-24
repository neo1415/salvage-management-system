'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useAppRouter } from '@/hooks/use-app-router';
import { AppLink } from '@/components/navigation/app-link';
import { Camera, FileText, Send } from 'lucide-react';
import { DataLoadingState } from '@/components/ui/loading-states';

export default function AdjusterDashboardPage() {
  const { data: session, status } = useSession();
  const { push } = useAppRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      push('/login');
      return;
    }

    const userRole = session?.user?.role;
    if (userRole !== 'claims_adjuster') {
      if (userRole === 'vendor') push('/vendor/dashboard');
      else if (userRole === 'salvage_manager') push('/manager/dashboard');
      else if (userRole === 'finance_officer') push('/finance/dashboard');
      else if (userRole === 'system_admin' || userRole === 'admin') push('/admin/dashboard');
      else push('/login');
    }
  }, [session, status, push]);

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 min-w-0">
        <div className="rounded-lg border border-gray-200 bg-white p-5 min-w-0 overflow-hidden">
          <Camera className="mb-3 h-7 w-7 text-[var(--brand-primary)]" />
          <p className="font-semibold text-gray-900">Capture evidence</p>
          <p className="mt-1 text-sm text-gray-600">Photograph the salvage asset and record site details.</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 min-w-0 overflow-hidden">
          <FileText className="mb-3 h-7 w-7 text-[var(--brand-primary)]" />
          <p className="font-semibold text-gray-900">Complete case details</p>
          <p className="mt-1 text-sm text-gray-600">Add claim reference, insurance class, asset category, and location.</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 min-w-0 overflow-hidden">
          <Send className="mb-3 h-7 w-7 text-[var(--brand-primary)]" />
          <p className="font-semibold text-gray-900">Submit for review</p>
          <p className="mt-1 text-sm text-gray-600">Upload photos, capture location, and add notes so the case is ready for review.</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 min-w-0 overflow-hidden">
        <h2 className="text-xl font-bold text-gray-900">Case Submission</h2>
        <p className="mt-2 text-sm text-gray-600">
          Open a new salvage report from the field. Your submission moves into review, auction scheduling, and recovery tracking once saved.
        </p>

        <AppLink
          href="/adjuster/cases/new"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-[var(--brand-primary-hover)]"
        >
          <FileText className="h-5 w-5" />
          Create New Case
        </AppLink>
      </div>
    </div>
  );
}
