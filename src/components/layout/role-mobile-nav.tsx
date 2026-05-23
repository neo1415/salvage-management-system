'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Gavel,
  Wallet,
  User,
  ClipboardList,
  Users,
  History,
  FileText,
  CreditCard,
  Database,
  Settings,
  AlertTriangle,
} from 'lucide-react';
import type { AppRole } from '@/lib/auth/rbac';
import { normalizeRole } from '@/lib/auth/rbac';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match?: (pathname: string) => boolean;
}

const ROLE_NAV: Record<AppRole, NavItem[]> = {
  vendor: [
    { href: '/vendor/dashboard', label: 'Home', icon: Home },
    { href: '/vendor/auctions', label: 'Auctions', icon: Gavel },
    { href: '/vendor/wallet', label: 'Wallet', icon: Wallet },
    {
      href: '/settings/profile',
      label: 'Settings',
      icon: User,
      match: (p) => p.startsWith('/settings') || p.startsWith('/vendor/settings'),
    },
  ],
  salvage_manager: [
    { href: '/manager/dashboard', label: 'Home', icon: Home },
    { href: '/manager/approvals', label: 'Approvals', icon: ClipboardList },
    { href: '/manager/vendors', label: 'Vendors', icon: Users },
    {
      href: '/settings/profile',
      label: 'Settings',
      icon: User,
      match: (p) => p.startsWith('/settings'),
    },
  ],
  claims_adjuster: [
    { href: '/adjuster/dashboard', label: 'Home', icon: Home },
    { href: '/adjuster/cases/new', label: 'New', icon: FileText },
    { href: '/adjuster/my-cases', label: 'Cases', icon: ClipboardList },
    {
      href: '/settings/profile',
      label: 'Settings',
      icon: User,
      match: (p) => p.startsWith('/settings'),
    },
  ],
  finance_officer: [
    { href: '/finance/dashboard', label: 'Home', icon: Home },
    { href: '/finance/payments', label: 'Payments', icon: CreditCard },
    {
      href: '/settings/profile',
      label: 'Settings',
      icon: User,
      match: (p) => p.startsWith('/settings'),
    },
  ],
  system_admin: [
    { href: '/admin/dashboard', label: 'Home', icon: Home },
    { href: '/admin/users', label: 'Users', icon: Users },
    {
      href: '/settings/profile',
      label: 'Settings',
      icon: User,
      match: (p) => p.startsWith('/settings'),
    },
  ],
};

function isActive(pathname: string, item: NavItem): boolean {
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * Fixed bottom navigation — role-specific items only (max 4 per role).
 */
export function RoleMobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = normalizeRole(session?.user?.role);
  if (!role) return null;

  const items = ROLE_NAV[role];
  if (!items.length) return null;

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 safe-area-pb"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-14 max-w-lg items-stretch justify-around px-2">
        {items.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-medium transition-colors sm:text-xs ${
                active ? 'text-[#800020]' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${active ? 'text-[#800020]' : ''}`}
                strokeWidth={active ? 2.25 : 2}
              />
              <span className="truncate max-w-[4.5rem]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
