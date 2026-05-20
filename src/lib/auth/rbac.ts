/**
 * Server-side role-based access control.
 * Enforced in proxy via signed JWT (httpOnly) — client/UI cannot override role.
 */

export type AppRole =
  | 'vendor'
  | 'salvage_manager'
  | 'claims_adjuster'
  | 'finance_officer'
  | 'system_admin';

export const APP_ROLES: AppRole[] = [
  'vendor',
  'salvage_manager',
  'claims_adjuster',
  'finance_officer',
  'system_admin',
];

/** Paths any signed-in dashboard user may visit */
const AUTHENTICATED_COMMON_PREFIXES = [
  '/dashboard',
  '/unauthorized',
  '/forbidden',
  '/notifications',
];

const ROLE_PAGE_PREFIXES: Record<AppRole, string[]> = {
  vendor: [
    '/vendor',
    '/receipt',
    ...AUTHENTICATED_COMMON_PREFIXES,
  ],
  salvage_manager: [
    '/manager',
    '/bid-history',
    '/reports',
    ...AUTHENTICATED_COMMON_PREFIXES,
  ],
  claims_adjuster: [
    '/adjuster',
    '/bid-history',
    '/reports',
    ...AUTHENTICATED_COMMON_PREFIXES,
  ],
  finance_officer: [
    '/finance',
    '/reports',
    ...AUTHENTICATED_COMMON_PREFIXES,
  ],
  system_admin: [
    '/admin',
    '/manager',
    '/bid-history',
    '/reports',
    ...AUTHENTICATED_COMMON_PREFIXES,
  ],
};

/** Dashboard routes that require a session */
export const PROTECTED_PAGE_PREFIXES = [
  '/vendor',
  '/admin',
  '/manager',
  '/adjuster',
  '/finance',
  '/bid-history',
  '/reports',
  '/notifications',
  '/dashboard',
  '/receipt',
];

/** API prefixes restricted by role (JWT verified server-side) */
export const API_ROLE_RULES: { prefix: string; roles: AppRole[] }[] = [
  { prefix: '/api/admin/', roles: ['system_admin'] },
  { prefix: '/api/dashboard/admin', roles: ['system_admin'] },
  { prefix: '/api/dashboard/manager', roles: ['salvage_manager'] },
  { prefix: '/api/dashboard/adjuster', roles: ['claims_adjuster'] },
  { prefix: '/api/dashboard/finance', roles: ['finance_officer'] },
  { prefix: '/api/dashboard/vendor', roles: ['vendor'] },
];

export function normalizeRole(role: string | undefined | null): AppRole | null {
  if (!role) return null;
  if (role === 'admin') return 'system_admin';
  return APP_ROLES.includes(role as AppRole) ? (role as AppRole) : null;
}

export function getDashboardPathForRole(role: string | undefined | null): string {
  switch (normalizeRole(role)) {
    case 'vendor':
      return '/vendor/dashboard';
    case 'salvage_manager':
      return '/manager/dashboard';
    case 'claims_adjuster':
      return '/adjuster/dashboard';
    case 'finance_officer':
      return '/finance/dashboard';
    case 'system_admin':
      return '/admin/dashboard';
    default:
      return '/login';
  }
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PAGE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isPathAllowedForRole(pathname: string, role: string | undefined | null): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;

  const prefixes = ROLE_PAGE_PREFIXES[normalized];
  return prefixes.some((prefix) => matchesPrefix(pathname, prefix));
}

export function getApiRolesAllowed(pathname: string): AppRole[] | null {
  for (const rule of API_ROLE_RULES) {
    if (matchesPrefix(pathname, rule.prefix)) {
      return rule.roles;
    }
  }
  return null;
}

export function isApiAllowedForRole(pathname: string, role: string | undefined | null): boolean {
  const allowedRoles = getApiRolesAllowed(pathname);
  if (!allowedRoles) return true;
  const normalized = normalizeRole(role);
  return Boolean(normalized && allowedRoles.includes(normalized));
}
