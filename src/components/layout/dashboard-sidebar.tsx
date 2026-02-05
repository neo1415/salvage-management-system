'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  Gavel,
  CreditCard,
  Wallet,
  Trophy,
  Bell,
  AlertTriangle,
  ClipboardList,
  BarChart3,
  LogOut,
  Menu,
  X,
  ChevronLeft,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

const navigationItems: NavItem[] = [
  // Vendor Navigation
  {
    label: 'Dashboard',
    href: '/vendor/dashboard',
    icon: LayoutDashboard,
    roles: ['vendor'],
  },
  {
    label: 'Auctions',
    href: '/vendor/auctions',
    icon: Gavel,
    roles: ['vendor'],
  },
  {
    label: 'Wallet',
    href: '/vendor/wallet',
    icon: Wallet,
    roles: ['vendor'],
  },
  {
    label: 'Leaderboard',
    href: '/vendor/leaderboard',
    icon: Trophy,
    roles: ['vendor'],
  },
  {
    label: 'KYC Tier 1',
    href: '/vendor/kyc/tier1',
    icon: FileText,
    roles: ['vendor'],
  },
  {
    label: 'KYC Tier 2',
    href: '/vendor/kyc/tier2',
    icon: FileText,
    roles: ['vendor'],
  },
  {
    label: 'Notifications',
    href: '/vendor/settings/notifications',
    icon: Bell,
    roles: ['vendor'],
  },

  // Manager Navigation
  {
    label: 'Dashboard',
    href: '/manager/dashboard',
    icon: LayoutDashboard,
    roles: ['salvage_manager'],
  },
  {
    label: 'Approvals',
    href: '/manager/approvals',
    icon: ClipboardList,
    roles: ['salvage_manager'],
  },
  {
    label: 'Vendors',
    href: '/manager/vendors',
    icon: Users,
    roles: ['salvage_manager'],
  },
  {
    label: 'Reports',
    href: '/manager/reports',
    icon: BarChart3,
    roles: ['salvage_manager'],
  },

  // Adjuster Navigation
  {
    label: 'Dashboard',
    href: '/adjuster/dashboard',
    icon: LayoutDashboard,
    roles: ['claims_adjuster'],
  },
  {
    label: 'New Case',
    href: '/adjuster/cases/new',
    icon: FileText,
    roles: ['claims_adjuster'],
  },

  // Finance Navigation
  {
    label: 'Dashboard',
    href: '/finance/dashboard',
    icon: LayoutDashboard,
    roles: ['finance_officer'],
  },
  {
    label: 'Payments',
    href: '/finance/payments',
    icon: CreditCard,
    roles: ['finance_officer'],
  },

  // Admin Navigation
  {
    label: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    roles: ['system_admin', 'admin'],
  },
  {
    label: 'Users',
    href: '/admin/users',
    icon: Users,
    roles: ['system_admin', 'admin'],
  },
  {
    label: 'Fraud Alerts',
    href: '/admin/fraud',
    icon: AlertTriangle,
    roles: ['system_admin', 'admin'],
  },
  {
    label: 'Audit Logs',
    href: '/admin/audit-logs',
    icon: ClipboardList,
    roles: ['system_admin', 'admin'],
  },
];

export default function DashboardSidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const userRole = session?.user?.role || 'vendor';

  // Filter navigation items based on user role
  const filteredNavItems = navigationItems.filter((item) =>
    item.roles.includes(userRole)
  );

  const handleLogout = async () => {
    try {
      // Use NextAuth's built-in signOut function with redirect
      // This will clear the session and redirect to login
      await signOut({ 
        callbackUrl: '/login',
        redirect: true 
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Fallback: force navigation to login
      window.location.href = '/login';
    }
  };

  const NavLinks = () => (
    <>
      {filteredNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive
                ? 'bg-[#800020] text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </Link>
        );
      })}

      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors w-full mt-4"
      >
        <LogOut className="w-5 h-5" />
        <span className="font-medium">Logout</span>
      </button>
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          {isMobileMenuOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </button>

        <h1 className="text-lg font-bold text-[#800020]">
          NEM Salvage
        </h1>

        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 w-64 bg-white z-50 transform transition-transform duration-300 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-[#800020]">NEM Salvage</h2>
          <p className="text-sm text-gray-600 mt-1">
            {session?.user?.name || 'User'}
          </p>
          <p className="text-xs text-gray-500 capitalize">
            {userRole.replace('_', ' ')}
          </p>
        </div>

        <nav className="p-4 flex flex-col gap-2">
          <NavLinks />
        </nav>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed top-0 left-0 bottom-0 w-64 bg-white border-r border-gray-200 z-30">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-[#800020]">NEM Salvage</h2>
          <p className="text-sm text-gray-600 mt-2">
            {session?.user?.name || 'User'}
          </p>
          <p className="text-xs text-gray-500 capitalize mt-1">
            {userRole.replace('_', ' ')}
          </p>
        </div>

        <nav className="p-4 flex flex-col gap-2">
          <NavLinks />
        </nav>
      </aside>
    </>
  );
}
