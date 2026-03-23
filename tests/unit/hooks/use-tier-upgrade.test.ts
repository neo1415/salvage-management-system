import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTierUpgrade } from '@/hooks/use-tier-upgrade';

describe('useTierUpgrade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tier 1 vendor', () => {
    it('should allow access to auctions under ₦500k', () => {
      const { result } = renderHook(() =>
        useTierUpgrade({ currentTier: 'tier1_bvn' })
      );

      expect(result.current.canAccessAuction(300000)).toBe(true);
      expect(result.current.canAccessAuction(500000)).toBe(true);
    });

    it('should block access to auctions over ₦500k', () => {
      const { result } = renderHook(() =>
        useTierUpgrade({ currentTier: 'tier1_bvn' })
      );

      expect(result.current.canAccessAuction(500001)).toBe(false);
      expect(result.current.canAccessAuction(750000)).toBe(false);
    });

    it('should show upgrade modal when accessing blocked auction', () => {
      const { result } = renderHook(() =>
        useTierUpgrade({ currentTier: 'tier1_bvn' })
      );

      expect(result.current.showUpgradeModal).toBe(false);

      act(() => {
        result.current.checkAuctionAccess(750000);
      });

      expect(result.current.showUpgradeModal).toBe(true);
      expect(result.current.blockedAuctionValue).toBe(750000);
    });

    it('should call onUpgradeRequired callback when upgrade needed', () => {
      const onUpgradeRequired = vi.fn();
      const { result } = renderHook(() =>
        useTierUpgrade({
          currentTier: 'tier1_bvn',
          onUpgradeRequired,
        })
      );

      act(() => {
        result.current.checkAuctionAccess(750000);
      });

      expect(onUpgradeRequired).toHaveBeenCalledWith(750000);
    });

    it('should not show modal for accessible auctions', () => {
      const { result } = renderHook(() =>
        useTierUpgrade({ currentTier: 'tier1_bvn' })
      );

      act(() => {
        result.current.checkAuctionAccess(300000);
      });

      expect(result.current.showUpgradeModal).toBe(false);
      expect(result.current.blockedAuctionValue).toBeUndefined();
    });

    it('should close modal when closeUpgradeModal is called', () => {
      const { result } = renderHook(() =>
        useTierUpgrade({ currentTier: 'tier1_bvn' })
      );

      act(() => {
        result.current.checkAuctionAccess(750000);
      });

      expect(result.current.showUpgradeModal).toBe(true);

      act(() => {
        result.current.closeUpgradeModal();
      });

      expect(result.current.showUpgradeModal).toBe(false);
      expect(result.current.blockedAuctionValue).toBeUndefined();
    });

    it('should return correct tier limit', () => {
      const { result } = renderHook(() =>
        useTierUpgrade({ currentTier: 'tier1_bvn' })
      );

      expect(result.current.getTierLimit()).toBe(500000);
    });

    it('should correctly identify as Tier 1', () => {
      const { result } = renderHook(() =>
        useTierUpgrade({ currentTier: 'tier1_bvn' })
      );

      expect(result.current.isTier1).toBe(true);
      expect(result.current.isTier2).toBe(false);
    });
  });

  describe('Tier 2 vendor', () => {
    it('should allow access to all auctions regardless of value', () => {
      const { result } = renderHook(() =>
        useTierUpgrade({ currentTier: 'tier2_full' })
      );

      expect(result.current.canAccessAuction(300000)).toBe(true);
      expect(result.current.canAccessAuction(500000)).toBe(true);
      expect(result.current.canAccessAuction(750000)).toBe(true);
      expect(result.current.canAccessAuction(1000000)).toBe(true);
      expect(result.current.canAccessAuction(5000000)).toBe(true);
    });

    it('should never show upgrade modal', () => {
      const { result } = renderHook(() =>
        useTierUpgrade({ currentTier: 'tier2_full' })
      );

      act(() => {
        result.current.checkAuctionAccess(1000000);
      });

      expect(result.current.showUpgradeModal).toBe(false);
      expect(result.current.blockedAuctionValue).toBeUndefined();
    });

    it('should return null tier limit', () => {
      const { result } = renderHook(() =>
        useTierUpgrade({ currentTier: 'tier2_full' })
      );

      expect(result.current.getTierLimit()).toBeNull();
    });

    it('should correctly identify as Tier 2', () => {
      const { result } = renderHook(() =>
        useTierUpgrade({ currentTier: 'tier2_full' })
      );

      expect(result.current.isTier1).toBe(false);
      expect(result.current.isTier2).toBe(true);
    });
  });

  describe('TIER_1_LIMIT constant', () => {
    it('should expose the tier 1 limit constant', () => {
      const { result } = renderHook(() =>
        useTierUpgrade({ currentTier: 'tier1_bvn' })
      );

      expect(result.current.TIER_1_LIMIT).toBe(500000);
    });
  });
});
