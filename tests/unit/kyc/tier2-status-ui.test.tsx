import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KYCStatusCard } from '@/components/vendor/kyc-status-card';
import { isPendingTier2Review } from '@/features/kyc/utils/tier2-status';
import { applyKycTestingStatusOverride } from '@/lib/kyc/kyc-testing-mode';

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

  it('does not let an old submitted date override a manager rejection', () => {
    expect(
      isPendingTier2Review({
        status: 'rejected',
        submittedAt: '2026-06-08T08:11:58.000Z',
      })
    ).toBe(false);
  });

  it('does not hide final manager rejection in KYC testing mode', () => {
    const overridden = applyKycTestingStatusOverride({
      status: 'rejected',
      submittedAt: '2026-06-08T08:11:58.000Z',
      rejectionReason: 'Business document did not match.',
    });

    expect(overridden.status).toBe('rejected');
    expect(isPendingTier2Review(overridden)).toBe(false);
  });

  it('does not hide an active pending review in KYC testing mode', () => {
    const overridden = applyKycTestingStatusOverride({
      status: 'pending_review',
      submittedAt: '2026-06-08T08:11:58.000Z',
    });

    expect(overridden.status).toBe('pending_review');
    expect(isPendingTier2Review(overridden)).toBe(true);
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

  it('shows the rejected card instead of under review when a manager rejects the application', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/kyc/status') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: 'rejected',
                tier: 'tier1_bvn',
                submittedAt: '2026-06-08T08:11:58.000Z',
                rejectionReason: 'Government ID was unclear.',
                rejectedSections: ['Government ID'],
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
      expect(screen.getByText(/Tier 2 Application Not Approved/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Government ID was unclear/i)).toBeInTheDocument();
    expect(screen.queryByText(/Tier 2 Application Under Review/i)).not.toBeInTheDocument();
  });

  it('refreshes a visible dashboard card so pending does not stay stuck after rejection', async () => {
    let statusPayload: Record<string, unknown> = {
      status: 'pending_review',
      tier: 'tier1_bvn',
      submittedAt: '2026-06-08T08:11:58.000Z',
    };

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/kyc/status') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(statusPayload),
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

    statusPayload = {
      status: 'rejected',
      tier: 'tier1_bvn',
      submittedAt: '2026-06-08T08:11:58.000Z',
      rejectionReason: 'Business document did not match.',
      rejectedSections: ['Business Data'],
    };

    fireEvent.focus(window);

    await waitFor(() => {
      expect(screen.getByText(/Tier 2 Application Not Approved/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Business document did not match/i)).toBeInTheDocument();
    expect(screen.queryByText(/Tier 2 Application Under Review/i)).not.toBeInTheDocument();
  });

  it('shows Tier 2 active when approval has been applied even before dashboard data refreshes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/kyc/status') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: 'approved',
                tier: 'tier2_full',
                submittedAt: '2026-06-08T08:11:58.000Z',
                approvedAt: '2026-06-08T09:11:58.000Z',
                expiresAt: '2027-06-08T09:11:58.000Z',
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
      expect(screen.getByText(/Tier 2 Verified/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Full bidding access/i)).toBeInTheDocument();
    expect(screen.queryByText(/Complete Full Verification/i)).not.toBeInTheDocument();
  });
});
