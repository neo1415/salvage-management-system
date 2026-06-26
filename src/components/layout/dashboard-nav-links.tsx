'use client';

import { memo } from 'react';
import type { ComponentType } from 'react';
import { AppLink } from '@/components/navigation/app-link';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface DashboardNavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  submenu?: { name: string; href: string }[];
}

interface DashboardNavLinksProps {
  items: DashboardNavItem[];
  pathname: string;
  primaryColor: string;
  expandedMenus: Record<string, boolean>;
  onToggleSubmenu: (href: string) => void;
  onNavigate?: () => void;
}

/**
 * Stable sidebar nav links — must live in a separate module so React does not
 * treat the component type as new on every parent re-render (that breaks client navigation).
 */
export const DashboardNavLinks = memo(function DashboardNavLinks({
  items,
  pathname,
  primaryColor,
  expandedMenus,
  onToggleSubmenu,
  onNavigate,
}: DashboardNavLinksProps) {
  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href || item.submenu?.some((sub) => pathname === sub.href);
        const isExpanded = expandedMenus[item.href];
        const hasSubmenu = item.submenu && item.submenu.length > 0;

        return (
          <div key={item.href}>
            {hasSubmenu ? (
              <>
                <button
                  type="button"
                  onClick={() => onToggleSubmenu(item.href)}
                  className={`flex items-center justify-between w-full px-4 py-3 rounded-lg transition-colors ${
                    isActive ? 'text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  style={isActive ? { backgroundColor: primaryColor } : undefined}
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
                        <AppLink
                          key={subItem.href}
                          href={subItem.href}
                          prefetch
                          onClick={onNavigate}
                          className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${
                            isSubActive ? 'text-white' : 'text-gray-600 hover:bg-gray-100'
                          }`}
                          style={isSubActive ? { backgroundColor: primaryColor } : undefined}
                        >
                          <span>{subItem.name}</span>
                        </AppLink>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <AppLink
                href={item.href}
                prefetch
                onClick={onNavigate}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive ? 'text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
                style={isActive ? { backgroundColor: primaryColor } : undefined}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </AppLink>
            )}
          </div>
        );
      })}
    </>
  );
});
