'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * First fetch → `loading` (full skeleton). Later fetches → `isRefreshing` (keep prior data visible).
 */
export function useReportFetchState() {
  const hasDataRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startFetch = useCallback(() => {
    if (!hasDataRef.current) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
  }, []);

  const endFetch = useCallback(() => {
    setLoading(false);
    setIsRefreshing(false);
  }, []);

  const markHasData = useCallback(() => {
    hasDataRef.current = true;
  }, []);

  const clearData = useCallback(() => {
    hasDataRef.current = false;
  }, []);

  return {
    loading,
    isRefreshing,
    startFetch,
    endFetch,
    markHasData,
    clearData,
    isBusy: loading || isRefreshing,
  };
}
