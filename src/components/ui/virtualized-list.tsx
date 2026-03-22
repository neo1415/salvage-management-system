/**
 * VirtualizedList Component
 * 
 * Renders large lists efficiently using @tanstack/react-virtual
 * Only renders visible items + overscan buffer
 */

'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useEffect } from 'react';

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateSize?: number;
  overscan?: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  className?: string;
}

export function VirtualizedList<T>({
  items,
  renderItem,
  estimateSize = 200,
  overscan = 5,
  onLoadMore,
  hasMore,
  isLoading,
  className = '',
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });
  
  const virtualItems = virtualizer.getVirtualItems();
  
  // Load more when scrolled near bottom
  useEffect(() => {
    const [lastItem] = [...virtualItems].reverse();
    
    if (!lastItem) return;
    
    if (
      lastItem.index >= items.length - 1 &&
      hasMore &&
      !isLoading &&
      onLoadMore
    ) {
      onLoadMore();
    }
  }, [hasMore, isLoading, onLoadMore, items.length, virtualItems]);
  
  return (
    <div
      ref={parentRef}
      className={`h-full overflow-auto ${className}`}
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
      
      {isLoading && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#800020]" aria-label="Loading more items"></div>
        </div>
      )}
    </div>
  );
}
