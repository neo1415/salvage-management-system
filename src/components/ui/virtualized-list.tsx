/**
 * VirtualizedList Component
 * 
 * Renders large lists efficiently using @tanstack/react-virtual
 * Only renders visible items + overscan buffer
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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
  const [viewport, setViewport] = useState({ height: 0, scrollTop: 0 });
  const visibleIndexes = useMemo(() => {
    if (items.length === 0) return [];

    const first = Math.max(0, Math.floor(viewport.scrollTop / estimateSize) - overscan);
    const visibleCount = Math.ceil(viewport.height / estimateSize);
    const last = Math.min(items.length - 1, first + visibleCount + (overscan * 2));
    return Array.from({ length: last - first + 1 }, (_, offset) => first + offset);
  }, [estimateSize, items.length, overscan, viewport.height, viewport.scrollTop]);

  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;

    const updateHeight = () => {
      setViewport((current) => ({
        ...current,
        height: element.clientHeight,
      }));
    };
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  
  // Load more when scrolled near bottom
  useEffect(() => {
    const lastIndex = visibleIndexes.at(-1);
    if (lastIndex === undefined) return;
    
    if (
      lastIndex >= items.length - 1 &&
      hasMore &&
      !isLoading &&
      onLoadMore
    ) {
      onLoadMore();
    }
  }, [hasMore, isLoading, onLoadMore, items.length, visibleIndexes]);
  
  return (
    <div
      ref={parentRef}
      onScroll={(event) => {
        const element = event.currentTarget;
        setViewport({
          height: element.clientHeight,
          scrollTop: element.scrollTop,
        });
      }}
      className={`h-full overflow-auto ${className}`}
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: `${items.length * estimateSize}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {visibleIndexes.map((index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${estimateSize}px`,
              transform: `translateY(${index * estimateSize}px)`,
            }}
          >
            {renderItem(items[index], index)}
          </div>
        ))}
      </div>
      
      {isLoading && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-primary)]" aria-label="Loading more items"></div>
        </div>
      )}
    </div>
  );
}
