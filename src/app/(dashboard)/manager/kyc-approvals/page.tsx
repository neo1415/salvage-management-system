'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Legacy route — Tier 2 queue lives on Vendor Management.
 */
export default function KYCApprovalsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/manager/vendors?tier=tier2&status=pending');
  }, [router]);

  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-[#800020]" />
    </div>
  );
}
