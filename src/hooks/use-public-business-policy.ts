'use client';

import { useEffect, useState } from 'react';
import type { PublicBusinessPolicy } from '@/features/business-policy/types';

type PublicPolicyState = {
  policy: PublicBusinessPolicy | null;
  loading: boolean;
};

export function usePublicBusinessPolicy(): PublicPolicyState {
  const [state, setState] = useState<PublicPolicyState>({
    policy: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    fetch('/api/business-policy/public', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return;
        setState({
          policy: data?.policy ?? null,
          loading: false,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          policy: null,
          loading: false,
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
