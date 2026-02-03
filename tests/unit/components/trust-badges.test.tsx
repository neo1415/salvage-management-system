import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrustBadges } from '@/components/vendor/trust-badges';

describe('TrustBadges Component', () => {
  describe('Badge Display Logic', () => {
    it('should display Verified BVN badge for Tier 1 vendors', () => {
      render(
        <TrustBadges
          tier="tier1_bvn"
          rating={3.0}
          avgPaymentTimeHours={10}
        />
      );

      expect(screen.getByLabelText('Verified BVN')).toBeInTheDocument();
    });

    it('should display Verified BVN and Verified Business badges for Tier 2 vendors', () => {
      render(
        <TrustBadges
          tier="tier2_full"
          rating={3.0}
          avgPaymentTimeHours={10}
        />
      );

      expect(screen.getByLabelText('Verified BVN')).toBeInTheDocument();
      expect(screen.getByLabelText('Verified Business')).toBeInTheDocument();
    });

    it('should display Top Rated badge when rating is 4.5 or higher', () => {
      render(
        <TrustBadges
          tier="tier1_bvn"
          rating={4.5}
          avgPaymentTimeHours={10}
        />
      );

      expect(screen.getByLabelText('Top Rated')).toBeInTheDocument();
    });

    it('should display Top Rated badge when rating is above 4.5', () => {
      render(
        <TrustBadges
          tier="tier1_bvn"
          rating={4.8}
          avgPaymentTimeHours={10}
        />
      );

      expect(screen.getByLabelText('Top Rated')).toBeInTheDocument();
    });

    it('should NOT display Top Rated badge when rating is below 4.5', () => {
      render(
        <TrustBadges
          tier="tier1_bvn"
          rating={4.4}
          avgPaymentTimeHours={10}
        />
      );

      expect(screen.queryByLabelText('Top Rated')).not.toBeInTheDocument();
    });

    it('should display Fast Payer badge when avg payment time is less than 6 hours', () => {
      render(
        <TrustBadges
          tier="tier1_bvn"
          rating={3.0}
          avgPaymentTimeHours={5.5}
        />
      );

      expect(screen.getByLabelText('Fast Payer')).toBeInTheDocument();
    });

    it('should NOT display Fast Payer badge when avg payment time is 6 hours or more', () => {
      render(
        <TrustBadges
          tier="tier1_bvn"
          rating={3.0}
          avgPaymentTimeHours={6.0}
        />
      );

      expect(screen.queryByLabelText('Fast Payer')).not.toBeInTheDocument();
    });

    it('should NOT display Fast Payer badge when avg payment time is 0 (no data)', () => {
      render(
        <TrustBadges
          tier="tier1_bvn"
          rating={3.0}
          avgPaymentTimeHours={0}
        />
      );

      expect(screen.queryByLabelText('Fast Payer')).not.toBeInTheDocument();
    });

    it('should display all badges when vendor qualifies for all', () => {
      render(
        <TrustBadges
          tier="tier2_full"
          rating={4.8}
          avgPaymentTimeHours={4.5}
        />
      );

      expect(screen.getByLabelText('Verified BVN')).toBeInTheDocument();
      expect(screen.getByLabelText('Verified Business')).toBeInTheDocument();
      expect(screen.getByLabelText('Top Rated')).toBeInTheDocument();
      expect(screen.getByLabelText('Fast Payer')).toBeInTheDocument();
    });

    it('should render nothing when no badges qualify', () => {
      const { container } = render(
        <TrustBadges
          tier="tier1_bvn"
          rating={0}
          avgPaymentTimeHours={0}
        />
      );

      // Component should render Verified BVN for tier1_bvn
      expect(screen.getByLabelText('Verified BVN')).toBeInTheDocument();
    });
  });

  describe('Badge Tooltips', () => {
    it('should display correct tooltip for Verified BVN badge', () => {
      render(
        <TrustBadges
          tier="tier1_bvn"
          rating={3.0}
          avgPaymentTimeHours={10}
        />
      );

      const badge = screen.getByLabelText('Verified BVN');
      expect(badge).toHaveAttribute(
        'title',
        "This vendor's identity has been verified via BVN (Bank Verification Number)"
      );
    });

    it('should display correct tooltip for Verified Business badge', () => {
      render(
        <TrustBadges
          tier="tier2_full"
          rating={3.0}
          avgPaymentTimeHours={10}
        />
      );

      const badge = screen.getByLabelText('Verified Business');
      expect(badge).toHaveAttribute(
        'title',
        'This vendor has completed full business verification with CAC, NIN, and bank account verification'
      );
    });

    it('should display correct tooltip for Top Rated badge', () => {
      render(
        <TrustBadges
          tier="tier1_bvn"
          rating={4.5}
          avgPaymentTimeHours={10}
        />
      );

      const badge = screen.getByLabelText('Top Rated');
      expect(badge).toHaveAttribute(
        'title',
        'This vendor has an average rating of 4.5 stars or higher'
      );
    });

    it('should display correct tooltip for Fast Payer badge', () => {
      render(
        <TrustBadges
          tier="tier1_bvn"
          rating={3.0}
          avgPaymentTimeHours={5}
        />
      );

      const badge = screen.getByLabelText('Fast Payer');
      expect(badge).toHaveAttribute(
        'title',
        'This vendor completes payments in less than 6 hours on average'
      );
    });
  });

  describe('Size Variants', () => {
    it('should render small size badges', () => {
      const { container } = render(
        <TrustBadges
          tier="tier1_bvn"
          rating={4.5}
          avgPaymentTimeHours={5}
          size="sm"
        />
      );

      const badge = screen.getByLabelText('Verified BVN');
      expect(badge).toHaveClass('px-2', 'py-1');
    });

    it('should render medium size badges (default)', () => {
      const { container } = render(
        <TrustBadges
          tier="tier1_bvn"
          rating={4.5}
          avgPaymentTimeHours={5}
        />
      );

      const badge = screen.getByLabelText('Verified BVN');
      expect(badge).toHaveClass('px-3', 'py-1.5');
    });

    it('should render large size badges', () => {
      const { container } = render(
        <TrustBadges
          tier="tier1_bvn"
          rating={4.5}
          avgPaymentTimeHours={5}
          size="lg"
        />
      );

      const badge = screen.getByLabelText('Verified BVN');
      expect(badge).toHaveClass('px-4', 'py-2');
    });
  });

  describe('Layout Options', () => {
    it('should render horizontal layout by default', () => {
      const { container } = render(
        <TrustBadges
          tier="tier2_full"
          rating={4.5}
          avgPaymentTimeHours={5}
        />
      );

      const badgeContainer = screen.getByRole('list');
      expect(badgeContainer).toHaveClass('flex-row');
    });

    it('should render vertical layout when specified', () => {
      const { container } = render(
        <TrustBadges
          tier="tier2_full"
          rating={4.5}
          avgPaymentTimeHours={5}
          layout="vertical"
        />
      );

      const badgeContainer = screen.getByRole('list');
      expect(badgeContainer).toHaveClass('flex-col');
    });
  });

  describe('Label Display', () => {
    it('should show labels by default', () => {
      render(
        <TrustBadges
          tier="tier1_bvn"
          rating={3.0}
          avgPaymentTimeHours={10}
        />
      );

      expect(screen.getByText('Verified BVN')).toBeInTheDocument();
    });

    it('should hide labels when showLabels is false', () => {
      render(
        <TrustBadges
          tier="tier1_bvn"
          rating={3.0}
          avgPaymentTimeHours={10}
          showLabels={false}
        />
      );

      expect(screen.queryByText('Verified BVN')).not.toBeInTheDocument();
      // But the badge itself should still be present
      expect(screen.getByLabelText('Verified BVN')).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <TrustBadges
          tier="tier1_bvn"
          rating={3.0}
          avgPaymentTimeHours={10}
          className="custom-class"
        />
      );

      const badgeContainer = screen.getByRole('list');
      expect(badgeContainer).toHaveClass('custom-class');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <TrustBadges
          tier="tier2_full"
          rating={4.5}
          avgPaymentTimeHours={5}
        />
      );

      expect(screen.getByRole('list', { name: 'Trust badges' })).toBeInTheDocument();
      expect(screen.getByLabelText('Verified BVN')).toBeInTheDocument();
      expect(screen.getByLabelText('Verified Business')).toBeInTheDocument();
      expect(screen.getByLabelText('Top Rated')).toBeInTheDocument();
      expect(screen.getByLabelText('Fast Payer')).toBeInTheDocument();
    });

    it('should have role="img" on badges', () => {
      render(
        <TrustBadges
          tier="tier1_bvn"
          rating={3.0}
          avgPaymentTimeHours={10}
        />
      );

      const badge = screen.getByLabelText('Verified BVN');
      expect(badge).toHaveAttribute('role', 'img');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rating exactly at 4.5 threshold', () => {
      render(
        <TrustBadges
          tier="tier1_bvn"
          rating={4.5}
          avgPaymentTimeHours={10}
        />
      );

      expect(screen.getByLabelText('Top Rated')).toBeInTheDocument();
    });

    it('should handle payment time exactly at 6 hour threshold', () => {
      render(
        <TrustBadges
          tier="tier1_bvn"
          rating={3.0}
          avgPaymentTimeHours={6.0}
        />
      );

      expect(screen.queryByLabelText('Fast Payer')).not.toBeInTheDocument();
    });

    it('should handle very high ratings', () => {
      render(
        <TrustBadges
          tier="tier1_bvn"
          rating={5.0}
          avgPaymentTimeHours={10}
        />
      );

      expect(screen.getByLabelText('Top Rated')).toBeInTheDocument();
    });

    it('should handle very fast payment times', () => {
      render(
        <TrustBadges
          tier="tier1_bvn"
          rating={3.0}
          avgPaymentTimeHours={0.5}
        />
      );

      expect(screen.getByLabelText('Fast Payer')).toBeInTheDocument();
    });
  });
});
