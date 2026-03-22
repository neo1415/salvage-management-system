/**
 * useVirtualizedList Hook
 * 
 * Manages paginated data fetching for virtualized lists
 * Handles infinite scroll with TanStack Query
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

interface VirtualizedListOptions<T> {
  queryKey: string[];
  fetchFn: (page: number) => Promise<{ data: T[]; hasMore: boolean }>;
  pageSize?: number;
}

export function useVirtualizedList<T>({
  queryKey,
  fetchFn,
  pageSize = 50,
}: VirtualizedListOptions<T>) {
  const [page, setPage] = useState(1);
  const [allItems, setAllItems] = useState<T[]>([]);
  
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...queryKey, page],
    queryFn: () => fetchFn(page),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  useEffect(() => {
    if (data?.data) {
      setAllItems(prev => page === 1 ? data.data : [...prev, ...data.data]);
    }
  }, [data, page]);
  
  const loadMore = useCallback(() => {
    if (data?.hasMore && !isFetching) {
      setPage(p => p + 1);
    }
  }, [data?.hasMore, isFetching]);
  
  const reset = useCallback(() => {
    setPage(1);
    setAllItems([]);
  }, []);
  
  return {
    items: allItems,
    isLoading,
    isFetching,
    hasMore: data?.hasMore ?? false,
    loadMore,
    reset,
  };
}
