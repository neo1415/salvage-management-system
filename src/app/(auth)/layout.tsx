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
    <div className="min-h-screen bg-gradient-to-br from-[#800020] to-[#600018]">
      {children}
    </div>
  );
}
