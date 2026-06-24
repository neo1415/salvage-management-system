'use client';

import Link, { type LinkProps } from 'next/link';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { forwardRef, useCallback, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useNavigation } from '@/components/navigation/navigation-provider';

type AppLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children: ReactNode;
  };

function hrefToString(href: LinkProps['href']): string {
  if (typeof href === 'string') return href;
  const path = href.pathname ?? '';
  const query = href.search ?? '';
  const hash = href.hash ?? '';
  return `${path}${query}${hash}`;
}

export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(function AppLink(
  { href, className, onClick, children, prefetch = true, ...props },
  ref
) {
  const router = useRouter();
  const { isNavigating, pendingHref, startNavigation } = useNavigation();
  const hrefString = hrefToString(href);
  const isPending = isNavigating && pendingHref === hrefString;

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      startNavigation(hrefString);
    },
    [onClick, startNavigation, hrefString]
  );

  const handleMouseEnter = useCallback(() => {
    if (prefetch) router.prefetch(hrefString);
  }, [prefetch, router, hrefString]);

  return (
    <Link
      ref={ref}
      href={href}
      prefetch={prefetch}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      className={cn(className, isPending && 'opacity-60')}
      aria-busy={isPending || undefined}
      {...props}
    >
      {children}
    </Link>
  );
});
