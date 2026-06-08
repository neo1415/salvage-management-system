import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KYCStatusCard } from '@/components/vendor/kyc-status-card';
import { isPendingTier2Review } from '@/features/kyc/utils/tier2-status';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/use-public-business-policy', () => ({
  usePublicBusinessPolicy: () => ({
    policy: {
      onboarding: {
        registrationFeeRequired: true,
      },
    },
  }),
}));

describe('Tier 2 pending review UI guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('treats saved manual evidence as pending review even when the legacy status is stale', () => {
    expect(
      isPendingTier2Review({
        status: 'not_started',
        submittedAt: '2026-06-08T08:11:58.000Z',
      })
    ).toBe(true);
  });

  it('does not show the upgrade card after Tier 2 evidence has been submitted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/kyc/status') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: 'not_started',
                tier: 'tier1_bvn',
                submittedAt: '2026-06-08T08:11:58.000Z',
              }),
          });
        }

        if (url === '/api/vendors/registration-fee/status') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { paid: true } }),
          });
        }

        return Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
      })
    );

    render(<KYCStatusCard currentTier="tier1_bvn" bidLimit={500000} />);

    await waitFor(() => {
      expect(screen.getByText(/Tier 2 Application Under Review/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Complete Full Verification/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Upgrade Now/i })).not.toBeInTheDocument();
  });
});
