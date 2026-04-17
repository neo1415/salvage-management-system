'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard,
  Users,
  FileText,
  Gavel,
  CreditCard,
  Wallet,
  Trophy,
  AlertTriangle,
  ClipboardList,
  BarChart3,
  LogOut,
  Menu,
  X,
  History,
  Settings,
  ChevronDown,
  ChevronRight,
  User as UserIcon,
  TrendingUp,
  Brain,
  Database,
} from 'lucide-react';
import NotificationBell from '@/components/notifications/notification-bell';

interface SubMenuItem {
  name: string;
  href: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  submenu?: SubMenuItem[];
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
  // {
  //   label: 'Market Insights',
  //   href: '/vendor/market-insights',
  //   icon: TrendingUp,
  //   roles: ['vendor'],
  // },
  {
    label: 'Wallet',
    href: '/vendor/wallet',
    icon: Wallet,
    roles: ['vendor'],
  },
  {
    label: 'Documents',
    href: '/vendor/documents',
    icon: FileText,
    roles: ['vendor'],
  },
  {
    label: 'Leaderboard',
    href: '/vendor/leaderboard',
    icon: Trophy,
    roles: ['vendor'],
  },
  {
    label: 'Settings',
    href: '/vendor/settings/profile',
    icon: Settings,
    roles: ['vendor'],
    submenu: [
      { name: 'Profile', href: '/vendor/settings/profile' },
      { name: 'Notifications', href: '/vendor/settings/notifications' },
      { name: 'Change Password', href: '/vendor/settings/change-password' },
    ],
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
    label: 'Bid History',
    href: '/bid-history',
    icon: History,
    roles: ['salvage_manager'],
  },
  {
    label: 'Vendors',
    href: '/manager/vendors',
    icon: Users,
    roles: ['salvage_manager'],
  },
  {
    label: 'Fraud Alerts',
    href: '/admin/fraud',
    icon: AlertTriangle,
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
  {
    label: 'My Cases',
    href: '/adjuster/my-cases',
    icon: ClipboardList,
    roles: ['claims_adjuster'],
  },
  {
    label: 'Bid History',
    href: '/bid-history',
    icon: History,
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
  {
    label: 'Payment Transactions',
    href: '/finance/payment-transactions',
    icon: Wallet,
    roles: ['finance_officer'],
  },
  {
    label: 'Auction Management',
    href: '/admin/auctions',
    icon: Gavel,
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
    label: 'Auction Config',
    href: '/admin/auction-config',
    icon: Settings,
    roles: ['system_admin', 'admin'],
  },
  // {
  //   label: 'Intelligence',
  //   href: '/admin/intelligence',
  //   icon: Brain,
  //   roles: ['system_admin', 'admin'],
  //   submenu: [
  //     { name: 'Overview', href: '/admin/intelligence' },
  //     { name: 'Analytics', href: '/admin/intelligence/analytics' },
  //     { name: 'Configuration', href: '/admin/intelligence/config' },
  //     { name: 'Data Export', href: '/admin/intelligence/export' },
  //   ],
  // },
  {
    label: 'Users',
    href: '/admin/users',
    icon: Users,
    roles: ['system_admin', 'admin'],
  },
  {
    label: 'Bid History',
    href: '/bid-history',
    icon: History,
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
  {
    label: 'Reports',
    href: '/reports',
    icon: BarChart3,
    roles: ['salvage_manager', 'system_admin', 'admin', 'finance_officer', 'claims_adjuster'],
  },
];

export default function DashboardSidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});

  const userRole = session?.user?.role || 'vendor';

  // Filter navigation items based on user role
  const filteredNavItems = navigationItems.filter((item) =>
    item.roles.includes(userRole)
  );

  const toggleSubmenu = (href: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [href]: !prev[href],
    }));
  };

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
        const isActive = pathname === item.href || item.submenu?.some(sub => pathname === sub.href);
        const isExpanded = expandedMenus[item.href];
        const hasSubmenu = item.submenu && item.submenu.length > 0;

        return (
          <div key={item.href}>
            {hasSubmenu ? (
              <>
                <button
                  onClick={() => toggleSubmenu(item.href)}
                  className={`flex items-center justify-between w-full px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-[#800020] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
                {isExpanded && item.submenu && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.submenu.map((subItem) => {
                      const isSubActive = pathname === subItem.href;
                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${
                            isSubActive
                              ? 'bg-[#800020] text-white'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <span>{subItem.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <Link
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
            )}
          </div>
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
      <div className="lg:hidden fixed top-0 left-0 right-0 z-45 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
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

        {/* Top Right: Notification Bell + Profile Picture */}
        <div className="flex items-center gap-3">
          <NotificationBell />
          <Link 
            href="/settings/profile-picture"
            className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 hover:border-[#800020] transition-colors"
          >
            {session?.user?.profilePictureUrl ? (
              <Image
                src={session.user.profilePictureUrl}
                alt={session.user.name || 'User'}
                fill
                className="object-cover rounded-full"
                sizes="40px"
              />
            ) : (
              <div className="w-full h-full bg-[#800020] flex items-center justify-center rounded-full">
                <UserIcon className="w-5 h-5 text-white" />
              </div>
            )}
          </Link>
        </div>
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
        className={`lg:hidden fixed top-0 left-0 bottom-0 w-64 bg-white z-45 transform transition-transform duration-300 overflow-y-auto ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-gray-200">
          {/* Header: Company Info on LEFT, Notification Bell + Profile Picture on RIGHT */}
          <div className="flex items-center justify-between mb-4">
            {/* Left: User Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-[#800020]">NEM Salvage</h2>
              <p className="text-sm text-gray-600 truncate">
                {session?.user?.name || 'User'}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {userRole.replace('_', ' ')}
              </p>
            </div>
            
            {/* Right: Notification Bell + Profile Picture */}
            <div className="flex items-center gap-3 ml-3">
              <NotificationBell />
              <Link 
                href="/settings/profile-picture"
                className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200 hover:border-[#800020] transition-colors flex-shrink-0"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {session?.user?.profilePictureUrl ? (
                  <Image
                    src={session.user.profilePictureUrl}
                    alt={session.user.name || 'User'}
                    fill
                    className="object-cover rounded-full"
                    sizes="48px"
                  />
                ) : (
                  <div className="w-full h-full bg-[#800020] flex items-center justify-center rounded-full">
                    <UserIcon className="w-6 h-6 text-white" />
                  </div>
                )}
              </Link>
            </div>
          </div>
        </div>

        <nav className="p-4 flex flex-col gap-2">
          <NavLinks />
        </nav>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed top-0 left-0 bottom-0 w-64 bg-white border-r border-gray-200 z-30 overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-[#800020]">NEM Salvage</h2>
          <p className="text-sm text-gray-600 mt-2 truncate">
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
