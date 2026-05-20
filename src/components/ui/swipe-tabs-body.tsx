'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

const DEFAULT_THRESHOLD = 56;
const HORIZONTAL_RATIO = 1.25;
const SWIPE_COMMIT_RATIO = 0.18;

export interface SwipeTabsBodyProps<T extends string> {
  tabs: readonly T[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  enabled?: boolean;
  threshold?: number;
  className?: string;
  children: ReactNode;
}

/**
 * Tab panel wrapper with follow-finger drag. Uses CSS transforms only (no exit
 * animations) so route changes do not fight React DOM reconciliation.
 */
export function SwipeTabsBody<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  enabled = true,
  threshold = DEFAULT_THRESHOLD,
  className,
  children,
}: SwipeTabsBodyProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const start = useRef<{ x: number; y: number; decided: boolean } | null>(null);
  const widthRef = useRef(320);

  const activeIndex = tabs.indexOf(activeTab);

  const changeTab = useCallback(
    (tab: T) => {
      setDragX(0);
      setIsDragging(false);
      onTabChange(tab);
    },
    [onTabChange]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    const onTouchMove = (e: TouchEvent) => {
      if (!start.current || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const dx = touch.clientX - start.current.x;
      const dy = touch.clientY - start.current.y;

      if (!start.current.decided) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        start.current.decided = true;
        if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) {
          start.current = null;
          return;
        }
      }

      e.preventDefault();
      setIsDragging(true);
      widthRef.current = el.offsetWidth || widthRef.current;

      let offset = dx;
      const max = widthRef.current * 0.42;
      if (activeIndex <= 0 && offset > 0) offset *= 0.28;
      if (activeIndex >= tabs.length - 1 && offset < 0) offset *= 0.28;
      setDragX(Math.max(-max, Math.min(max, offset)));
    };

    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, [enabled, activeIndex, tabs.length]);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || e.touches.length !== 1) return;
      const el = containerRef.current;
      if (el) widthRef.current = el.offsetWidth;
      start.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        decided: false,
      };
    },
    [enabled]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !start.current) return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - start.current.x;
      const dy = touch.clientY - start.current.y;
      start.current = null;
      setIsDragging(false);

      const width = widthRef.current;
      const commit = width * SWIPE_COMMIT_RATIO;

      if (Math.abs(dx) >= threshold && Math.abs(dx) >= Math.abs(dy) * HORIZONTAL_RATIO) {
        if (dx < -commit && activeIndex < tabs.length - 1) {
          changeTab(tabs[activeIndex + 1]);
          return;
        }
        if (dx > commit && activeIndex > 0) {
          changeTab(tabs[activeIndex - 1]);
          return;
        }
      }

      setDragX(0);
    },
    [enabled, threshold, tabs, activeIndex, changeTab]
  );

  const onTouchCancel = useCallback(() => {
    start.current = null;
    setIsDragging(false);
    setDragX(0);
  }, []);

  const panelStyle: React.CSSProperties = isDragging
    ? {
        transform: `translate3d(${dragX}px, 0, 0)`,
        transition: 'none',
      }
    : {
        transform: 'translate3d(0, 0, 0)',
        transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
      };

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden touch-pan-y', className)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div
        key={activeTab}
        className="w-full will-change-transform"
        style={panelStyle}
      >
        {children}
      </div>
    </div>
  );
}
