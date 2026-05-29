import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

/**
 * Auth Layout
 * Layout for authentication pages (login, register, verify-otp)
 * Provides consistent styling and structure for auth flows
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'linear-gradient(135deg, var(--brand-primary), var(--brand-primary-hover))',
      }}
    >
      {children}
    </div>
  );
}
