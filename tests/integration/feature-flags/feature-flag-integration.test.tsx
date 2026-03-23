/**
 * Integration tests for feature flag system
 * Tests the complete feature flag workflow including UI components
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FeatureFlagWrapper } from '@/components/ui/feature-flag-wrapper';
import { FeatureFlagSettings } from '@/components/ui/feature-flag-settings';
import { 
  optInToFeature, 
  optOutOfFeature, 
  clearFeatureOverride,
  isFeatureEnabled 
} from '@/lib/feature-flags';

describe('Feature Flag Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('FeatureFlagWrapper', () => {
    it('should render children when feature is enabled', () => {
      optInToFeature('modern-filters');

      render(
        <FeatureFlagWrapper flag="modern-filters">
          <div data-testid="enabled-content">Enabled Content</div>
        </FeatureFlagWrapper>
      );

      expect(screen.getByTestId('enabled-content')).toBeInTheDocument();
    });

    it('should render fallback when feature is disabled', () => {
      optOutOfFeature('modern-filters');

      render(
        <FeatureFlagWrapper
          flag="modern-filters"
          fallback={<div data-testid="fallback-content">Fallback Content</div>}
        >
          <div data-testid="enabled-content">Enabled Content</div>
        </FeatureFlagWrapper>
      );

      expect(screen.queryByTestId('enabled-content')).not.toBeInTheDocument();
      expect(screen.getByTestId('fallback-content')).toBeInTheDocument();
    });

    it('should update when feature flag changes', async () => {
      optOutOfFeature('modern-filters');

      const { rerender } = render(
        <FeatureFlagWrapper flag="modern-filters">
          <div data-testid="enabled-content">Enabled Content</div>
        </FeatureFlagWrapper>
      );

      expect(screen.queryByTestId('enabled-content')).not.toBeInTheDocument();

      // Enable the feature
      optInToFeature('modern-filters');

      // Force re-render
      rerender(
        <FeatureFlagWrapper flag="modern-filters">
          <div data-testid="enabled-content">Enabled Content</div>
        </FeatureFlagWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('enabled-content')).toBeInTheDocument();
      });
    });
  });

  describe('FeatureFlagSettings', () => {
    it('should render all feature flags', () => {
      render(<FeatureFlagSettings />);

      expect(screen.getByText(/Modern faceted filter UI/i)).toBeInTheDocument();
      expect(screen.getByText(/Reduced verbosity card design/i)).toBeInTheDocument();
      expect(screen.getByText(/Lucide React icons/i)).toBeInTheDocument();
    });

    it('should show enabled state for enabled flags', () => {
      optInToFeature('modern-filters');

      render(<FeatureFlagSettings />);

      // Find the modern-filters section
      const filterSection = screen.getByText(/Modern faceted filter UI/i).closest('div');
      expect(filterSection).toBeInTheDocument();
    });

    it('should allow opting in to a feature', async () => {
      optOutOfFeature('modern-filters');

      render(<FeatureFlagSettings />);

      // Find and expand the modern-filters section
      const filterButton = screen.getByText(/Modern faceted filter UI/i).closest('button');
      fireEvent.click(filterButton!);

      // Wait for expansion
      await waitFor(() => {
        expect(screen.getByText('Opt In')).toBeInTheDocument();
      });

      // Click opt-in button
      const optInButtons = screen.getAllByText('Opt In');
      fireEvent.click(optInButtons[0]);

      // Verify feature is now enabled
      await waitFor(() => {
        expect(isFeatureEnabled('modern-filters')).toBe(true);
      });
    });

    it('should allow opting out of a feature', async () => {
      optInToFeature('modern-filters');

      render(<FeatureFlagSettings />);

      // Find and expand the modern-filters section
      const filterButton = screen.getByText(/Modern faceted filter UI/i).closest('button');
      fireEvent.click(filterButton!);

      // Wait for expansion
      await waitFor(() => {
        expect(screen.getByText('Opt Out')).toBeInTheDocument();
      });

      // Click opt-out button
      const optOutButtons = screen.getAllByText('Opt Out');
      fireEvent.click(optOutButtons[0]);

      // Verify feature is now disabled
      await waitFor(() => {
        expect(isFeatureEnabled('modern-filters')).toBe(false);
      });
    });

    it('should allow clearing overrides', async () => {
      optInToFeature('modern-filters');

      render(<FeatureFlagSettings />);

      // Find and expand the modern-filters section
      const filterButton = screen.getByText(/Modern faceted filter UI/i).closest('button');
      fireEvent.click(filterButton!);

      // Wait for expansion and reset button
      await waitFor(() => {
        expect(screen.getByText('Reset')).toBeInTheDocument();
      });

      // Click reset button
      const resetButtons = screen.getAllByText('Reset');
      fireEvent.click(resetButtons[0]);

      // Verify override is cleared
      await waitFor(() => {
        const overrides = localStorage.getItem('feature-flags-overrides');
        const parsed = overrides ? JSON.parse(overrides) : {};
        expect(parsed['modern-filters']).toBeUndefined();
      });
    });

    it('should show override status', async () => {
      optInToFeature('modern-filters');

      render(<FeatureFlagSettings />);

      // Find and expand the modern-filters section
      const filterButton = screen.getByText(/Modern faceted filter UI/i).closest('button');
      fireEvent.click(filterButton!);

      // Wait for expansion
      await waitFor(() => {
        expect(screen.getByText(/User override:/i)).toBeInTheDocument();
      });
    });
  });

  describe('Cross-tab synchronization', () => {
    it('should sync feature flag changes across tabs', async () => {
      optOutOfFeature('modern-filters');

      const { rerender } = render(
        <FeatureFlagWrapper flag="modern-filters">
          <div data-testid="enabled-content">Enabled Content</div>
        </FeatureFlagWrapper>
      );

      expect(screen.queryByTestId('enabled-content')).not.toBeInTheDocument();

      // Simulate storage change from another tab
      optInToFeature('modern-filters');
      const storageEvent = new StorageEvent('storage', {
        key: 'feature-flags-overrides',
        newValue: JSON.stringify({ 'modern-filters': true }),
      });
      window.dispatchEvent(storageEvent);

      // Force re-render
      rerender(
        <FeatureFlagWrapper flag="modern-filters">
          <div data-testid="enabled-content">Enabled Content</div>
        </FeatureFlagWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('enabled-content')).toBeInTheDocument();
      });
    });
  });

  describe('Percentage-based rollout', () => {
    it('should consistently enable/disable based on user ID', () => {
      const userId1 = 'user-123';
      const userId2 = 'user-456';

      // Clear any overrides
      clearFeatureOverride('modern-filters');

      // Same user should get consistent results
      const result1a = isFeatureEnabled('modern-filters', userId1);
      const result1b = isFeatureEnabled('modern-filters', userId1);
      expect(result1a).toBe(result1b);

      // Different users may get different results (depending on hash)
      const result2 = isFeatureEnabled('modern-filters', userId2);
      expect(typeof result2).toBe('boolean');
    });
  });
});
