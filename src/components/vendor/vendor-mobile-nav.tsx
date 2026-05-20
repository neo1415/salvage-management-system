'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Gavel, Wallet, User } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/vendor/auctions', label: 'Auctions', icon: Gavel },
  { href: '/vendor/wallet', label: 'Wallet', icon: Wallet },
  { href: '/vendor/settings/profile', label: 'Profile', icon: User },
] as const;

/**
 * Fixed bottom navigation for vendor mobile — compact, does not obscure content.
 */
export function VendorMobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 safe-area-pb"
      aria-label="Vendor navigation"
    >
      <div className="mx-auto flex h-14 max-w-lg items-stretch justify-around px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium transition-colors ${
                active ? 'text-[#800020]' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-[#800020]' : ''}`} strokeWidth={active ? 2.25 : 2} />
              <span className="hidden min-[380px]:inline truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
