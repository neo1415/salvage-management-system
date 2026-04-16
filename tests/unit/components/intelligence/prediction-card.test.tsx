/**
 * Unit Tests for PredictionCard Component
 * Phase 10.1: Tasks 10.1.1, 10.1.2, 10.1.3
 * 
 * Test coverage:
 * - Price range display with currency formatting
 * - Confidence indicators (High/Medium/Low with colors)
 * - Expandable "How is this calculated?" section
 * - Metadata display (similar auctions, competition level)
 * - Warnings and notes display
 * - Responsive design (mobile/desktop)
 * - Accessibility (ARIA labels, keyboard navigation)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PredictionCard } from '@/components/intelligence/prediction-card';

describe('PredictionCard Component', () => {
  const defaultProps = {
    auctionId: 'auction-123',
    predictedPrice: 5000000,
    lowerBound: 4500000,
    upperBound: 5500000,
    confidenceScore: 0.85,
    confidenceLevel: 'High' as const,
    method: 'historical',
    sampleSize: 15,
  };

  beforeEach(() => {
    // Reset any state between tests
  });

  describe('Price Display', () => {
    it('should display predicted price with currency formatting', () => {
      render(<PredictionCard {...defaultProps} />);

      expect(screen.getByText('₦5,000,000')).toBeInTheDocument();
    });

    it('should display price range with lower and upper bounds', () => {
      render(<PredictionCard {...defaultProps} />);

      expect(screen.getByText(/₦4,500,000 - ₦5,500,000/)).toBeInTheDocument();
    });

    it('should format large numbers correctly', () => {
      render(
        <PredictionCard
          {...defaultProps}
          predictedPrice={15000000}
          lowerBound={14000000}
          upperBound={16000000}
        />
      );

      expect(screen.getByText('₦15,000,000')).toBeInTheDocument();
    });
  });

  describe('Confidence Indicators', () => {
    it('should display High confidence badge with green color', () => {
      render(<PredictionCard {...defaultProps} confidenceLevel="High" />);

      const badge = screen.getByText('High Confidence');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('green');
    });

    it('should display Medium confidence badge with yellow color', () => {
      render(
        <PredictionCard
          {...defaultProps}
          confidenceLevel="Medium"
          confidenceScore={0.65}
        />
      );

      const badge = screen.getByText('Medium Confidence');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('yellow');
    });

    it('should display Low confidence badge with orange color', () => {
      render(
        <PredictionCard
          {...defaultProps}
          confidenceLevel="Low"
          confidenceScore={0.45}
        />
      );

      const badge = screen.getByText('Low Confidence');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('orange');
    });

    it('should display confidence score as percentage', () => {
      render(<PredictionCard {...defaultProps} confidenceScore={0.85} />);

      expect(screen.getByText('85.0%')).toBeInTheDocument();
    });

    it('should display confidence progress bar', () => {
      const { container } = render(<PredictionCard {...defaultProps} />);

      const progressBar = container.querySelector('[style*="width: 85%"]');
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe('Expandable Explanation Section', () => {
    it('should show "How is this calculated?" button', () => {
      render(<PredictionCard {...defaultProps} />);

      expect(screen.getByText('How is this calculated?')).toBeInTheDocument();
    });

    it('should expand explanation when button is clicked', () => {
      render(<PredictionCard {...defaultProps} />);

      const button = screen.getByText('How is this calculated?');
      fireEvent.click(button);

      expect(screen.getByText('Prediction Method')).toBeInTheDocument();
      expect(screen.getByText('Data Points')).toBeInTheDocument();
    });

    it('should collapse explanation when button is clicked again', () => {
      render(<PredictionCard {...defaultProps} />);

      const button = screen.getByText('How is this calculated?');
      
      // Expand
      fireEvent.click(button);
      expect(screen.getByText('Prediction Method')).toBeInTheDocument();

      // Collapse
      fireEvent.click(button);
      expect(screen.queryByText('Prediction Method')).not.toBeInTheDocument();
    });

    it('should display prediction method explanation', () => {
      render(<PredictionCard {...defaultProps} method="historical" />);

      const button = screen.getByText('How is this calculated?');
      fireEvent.click(button);

      expect(
        screen.getByText(/Based on historical auction data from similar assets/)
      ).toBeInTheDocument();
    });

    it('should display sample size in explanation', () => {
      render(<PredictionCard {...defaultProps} sampleSize={15} />);

      const button = screen.getByText('How is this calculated?');
      fireEvent.click(button);

      expect(screen.getByText(/Analysis based on 15 similar auctions/)).toBeInTheDocument();
    });
  });

  describe('Metadata Display', () => {
    it('should display similar auctions count', () => {
      render(
        <PredictionCard
          {...defaultProps}
          metadata={{ similarAuctions: 12 }}
        />
      );

      expect(screen.getByText('Similar Auctions')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    it('should display competition level', () => {
      render(
        <PredictionCard
          {...defaultProps}
          metadata={{ competitionLevel: 'high_competition' }}
        />
      );

      expect(screen.getByText('Competition')).toBeInTheDocument();
      expect(screen.getByText('High competition')).toBeInTheDocument();
    });

    it('should display market adjustment in expanded section', () => {
      render(
        <PredictionCard
          {...defaultProps}
          metadata={{ marketAdjustment: 1.05 }}
        />
      );

      const button = screen.getByText('How is this calculated?');
      fireEvent.click(button);

      expect(screen.getByText(/Applied 5.0% adjustment/)).toBeInTheDocument();
    });

    it('should display seasonal factor', () => {
      render(
        <PredictionCard
          {...defaultProps}
          metadata={{ marketAdjustment: 1.03, seasonalFactor: 1.02 }}
        />
      );

      const button = screen.getByText('How is this calculated?');
      fireEvent.click(button);

      expect(screen.getByText(/seasonal trends/)).toBeInTheDocument();
    });
  });

  describe('Warnings and Notes', () => {
    it('should display warnings in expanded section', () => {
      render(
        <PredictionCard
          {...defaultProps}
          metadata={{
            warnings: ['Limited historical data', 'High market volatility'],
          }}
        />
      );

      const button = screen.getByText('How is this calculated?');
      fireEvent.click(button);

      expect(screen.getByText('⚠️ Warnings')).toBeInTheDocument();
      expect(screen.getByText('Limited historical data')).toBeInTheDocument();
      expect(screen.getByText('High market volatility')).toBeInTheDocument();
    });

    it('should display notes in expanded section', () => {
      render(
        <PredictionCard
          {...defaultProps}
          metadata={{
            notes: ['Based on recent market trends', 'Adjusted for regional demand'],
          }}
        />
      );

      const button = screen.getByText('How is this calculated?');
      fireEvent.click(button);

      expect(screen.getByText('Notes')).toBeInTheDocument();
      expect(screen.getByText('Based on recent market trends')).toBeInTheDocument();
      expect(screen.getByText('Adjusted for regional demand')).toBeInTheDocument();
    });

    it('should style warnings with yellow background', () => {
      const { container } = render(
        <PredictionCard
          {...defaultProps}
          metadata={{ warnings: ['Test warning'] }}
        />
      );

      const button = screen.getByText('How is this calculated?');
      fireEvent.click(button);

      const warningSection = container.querySelector('.bg-yellow-50');
      expect(warningSection).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should render on mobile viewport', () => {
      global.innerWidth = 375;
      render(<PredictionCard {...defaultProps} />);

      expect(screen.getByText('Price Prediction')).toBeInTheDocument();
    });

    it('should render on desktop viewport', () => {
      global.innerWidth = 1920;
      render(<PredictionCard {...defaultProps} />);

      expect(screen.getByText('Price Prediction')).toBeInTheDocument();
    });

    it('should use responsive padding classes', () => {
      const { container } = render(<PredictionCard {...defaultProps} />);

      const card = container.firstChild;
      expect(card?.className).toMatch(/p-4|md:p-6/);
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(<PredictionCard {...defaultProps} />);

      const heading = screen.getByText('Price Prediction');
      expect(heading.tagName).toBe('H3');
    });

    it('should have accessible button for expansion', () => {
      render(<PredictionCard {...defaultProps} />);

      const button = screen.getByRole('button', { name: /How is this calculated?/i });
      expect(button).toBeInTheDocument();
    });

    it('should support keyboard navigation for expand button', () => {
      render(<PredictionCard {...defaultProps} />);

      const button = screen.getByText('How is this calculated?');
      button.focus();
      
      expect(document.activeElement).toBe(button);
    });

    it('should have semantic HTML structure', () => {
      const { container } = render(<PredictionCard {...defaultProps} />);

      // Should have proper div structure
      expect(container.querySelector('.bg-white')).toBeInTheDocument();
    });
  });

  describe('Different Prediction Methods', () => {
    it('should display salvage value method explanation', () => {
      render(<PredictionCard {...defaultProps} method="salvage_value" />);

      const button = screen.getByText('How is this calculated?');
      fireEvent.click(button);

      expect(screen.getByText(/Based on estimated salvage value/)).toBeInTheDocument();
    });

    it('should display market value calculation method', () => {
      render(<PredictionCard {...defaultProps} method="market_value_calc" />);

      const button = screen.getByText('How is this calculated?');
      fireEvent.click(button);

      expect(
        screen.getByText(/Calculated from market value and damage assessment/)
      ).toBeInTheDocument();
    });

    it('should display reserve price estimate method', () => {
      render(<PredictionCard {...defaultProps} method="reserve_price_estimate" />);

      const button = screen.getByText('How is this calculated?');
      fireEvent.click(button);

      expect(screen.getByText(/Estimated from reserve price/)).toBeInTheDocument();
    });
  });

  describe('Visual Range Indicator', () => {
    it('should display visual range bar', () => {
      const { container } = render(<PredictionCard {...defaultProps} />);

      const rangeBar = container.querySelector('.h-2.bg-gray-200');
      expect(rangeBar).toBeInTheDocument();
    });

    it('should show lower and upper labels', () => {
      render(<PredictionCard {...defaultProps} />);

      expect(screen.getByText('Lower')).toBeInTheDocument();
      expect(screen.getByText('Upper')).toBeInTheDocument();
    });
  });
});
