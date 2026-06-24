'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';

type NavigationContextValue = {
  isNavigating: boolean;
  pendingHref: string | null;
  startNavigation: (href?: string) => void;
  endNavigation: () => void;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const endNavigation = useCallback(() => {
    setIsNavigating(false);
    setPendingHref(null);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startNavigation = useCallback((href?: string) => {
    setIsNavigating(true);
    setPendingHref(href ?? null);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      endNavigation();
    }, 20000);
  }, [endNavigation]);

  useEffect(() => {
    endNavigation();
  }, [pathname, endNavigation]);

  return (
    <NavigationContext.Provider value={{ isNavigating, pendingHref, startNavigation, endNavigation }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    return {
      isNavigating: false,
      pendingHref: null,
      startNavigation: () => {},
      endNavigation: () => {},
    };
  }
  return ctx;
}
