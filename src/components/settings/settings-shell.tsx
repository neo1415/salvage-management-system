'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ReactNode } from 'react';
import {
  User,
  Bell,
  Shield,
  KeyRound,
  Camera,
  Receipt,
} from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  href: string;
  icon: ReactNode;
  roles?: string[];
}

const BASE_TABS: Tab[] = [
  { id: 'profile', label: 'Profile', href: '/settings/profile', icon: <User className="w-5 h-5" /> },
  {
    id: 'notifications',
    label: 'Notifications',
    href: '/settings/notifications',
    icon: <Bell className="w-5 h-5" />,
  },
  {
    id: 'security',
    label: 'Security',
    href: '/settings/security',
    icon: <Shield className="w-5 h-5" />,
  },
  {
    id: 'password',
    label: 'Password',
    href: '/settings/change-password',
    icon: <KeyRound className="w-5 h-5" />,
  },
  {
    id: 'photo',
    label: 'Profile photo',
    href: '/settings/profile-picture',
    icon: <Camera className="w-5 h-5" />,
  },
  {
    id: 'transactions',
    label: 'Transactions',
    href: '/settings/transactions',
    icon: <Receipt className="w-5 h-5" />,
    roles: ['vendor'],
  },
];

export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role || '';

  const tabs = BASE_TABS.filter((tab) => !tab.roles || tab.roles.includes(role));

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Manage your account, notifications, and security</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-56 flex-shrink-0">
          <nav className="bg-white rounded-lg shadow-md p-2 space-y-1 hidden lg:block">
            {tabs.map((tab) => {
              const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#800020] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className={active ? 'text-white' : 'text-gray-500'}>{tab.icon}</span>
                  {tab.label}
                </Link>
              );
            })}
          </nav>
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-2">
            {tabs.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                    active ? 'bg-[#800020] text-white' : 'bg-white text-gray-700 shadow'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
