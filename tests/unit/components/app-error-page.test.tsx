import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppErrorPage } from '@/components/errors/app-error-page';
import { PublicBusinessPolicyProvider } from '@/hooks/public-business-policy-context';
import { DEFAULT_BUSINESS_POLICY } from '@/features/business-policy/default-policy';

vi.mock('next/navigation', () => ({
  useRouter: () => {
    throw new Error('router context unavailable');
  },
  useSearchParams: () => {
    throw new Error('search params unavailable');
  },
}));

vi.mock('@/hooks/use-app-router', () => ({
  useAppRouter: () => {
    throw new Error('navigation provider unavailable');
  },
}));

vi.mock('next-auth/react', async () => {
  const actual = await vi.importActual<typeof import('next-auth/react')>('next-auth/react');
  return {
    ...actual,
    useSession: () => undefined,
  };
});

function renderErrorPage() {
  return render(<AppErrorPage variant="not-found" />);
}

describe('AppErrorPage', () => {
  it('renders without SessionProvider', () => {
    renderErrorPage();

    expect(screen.getByRole('heading', { name: /page not found/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /my dashboard/i }).getAttribute('href')).toBe('/dashboard');
  });

  it('renders without branding provider', () => {
    render(<AppErrorPage variant="forbidden" />);

    expect(screen.getByRole('heading', { name: /access denied/i })).toBeTruthy();
    expect(screen.getByText(DEFAULT_BUSINESS_POLICY.branding.brandName)).toBeTruthy();
  });

  it('does not call fragile provider-dependent hooks when session result is unavailable', () => {
    expect(() => renderErrorPage()).not.toThrow();
    expect(screen.getByText('404')).toBeTruthy();
  });

  it('renders normally inside provider-backed app context', () => {
    render(
      <PublicBusinessPolicyProvider initialPolicy={DEFAULT_BUSINESS_POLICY}>
        <AppErrorPage variant="unauthorized" />
      </PublicBusinessPolicyProvider>
    );

    expect(screen.getByRole('heading', { name: /not authorized/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /my dashboard/i }).getAttribute('href')).toBe('/dashboard');
  });
});
