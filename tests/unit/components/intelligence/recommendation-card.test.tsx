/**
 * Unit Tests for RecommendationCard Component
 * Phase 10.2: Tasks 10.2.2, 10.2.3, 10.2.5
 * 
 * Test coverage:
 * - Match score badge with color coding
 * - Reason codes as colored tags
 * - Asset information display
 * - "View Auction" button
 * - "Not Interested" button
 * - Responsive design
 * - Accessibility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecommendationCard } from '@/components/intelligence/recommendation-card';

// Mock fetch
global.fetch = vi.fn();

describe('RecommendationCard Component', () => {
  const defaultProps = {
    auctionId: 'auction-123',
    matchScore: 85,
    reasonCodes: ['High win rate in this category', 'Similar to previous wins', 'Trending asset'],
    auctionDetails: {
      assetType: 'vehicle',
      assetDetails: {
        year: 2020,
        make: 'Toyota',
        model: 'Camry',
      },
      marketValue: 5000000,
      reservePrice: 4000000,
      currentBid: 4500000,
      watchingCount: 12,
      endTime: new Date(Date.now() + 86400000), // 1 day from now
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);
  });

  describe('Match Score Display', () => {
    it('should display match score as percentage', () => {
      render(<RecommendationCard {...defaultProps} />);

      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    it('should display "Match" label', () => {
      render(<RecommendationCard {...defaultProps} />);

      expect(screen.getByText('Match')).toBeInTheDocument();
    });

    it('should color high match score (>=80) in green', () => {
      const { container } = render(<RecommendationCard {...defaultProps} matchScore={85} />);

      const scoreElement = screen.getByText('85%');
      expect(scoreElement.className).toContain('green');
    });

    it('should color medium match score (60-79) in blue', () => {
      const { container } = render(<RecommendationCard {...defaultProps} matchScore={70} />);

      const scoreElement = screen.getByText('70%');
      expect(scoreElement.className).toContain('blue');
    });

    it('should color low match score (<60) in yellow', () => {
      const { container } = render(<RecommendationCard {...defaultProps} matchScore={50} />);

      const scoreElement = screen.getByText('50%');
      expect(scoreElement.className).toContain('yellow');
    });
  });

  describe('Reason Codes Display', () => {
    it('should display reason codes as colored tags', () => {
      render(<RecommendationCard {...defaultProps} />);

      expect(screen.getByText('High win rate in this category')).toBeInTheDocument();
      expect(screen.getByText('Similar to previous wins')).toBeInTheDocument();
      expect(screen.getByText('Trending asset')).toBeInTheDocument();
    });

    it('should limit displayed reason codes to 3', () => {
      render(
        <RecommendationCard
          {...defaultProps}
          reasonCodes={[
            'Reason 1',
            'Reason 2',
            'Reason 3',
            'Reason 4',
            'Reason 5',
          ]}
        />
      );

      expect(screen.getByText('Reason 1')).toBeInTheDocument();
      expect(screen.getByText('Reason 2')).toBeInTheDocument();
      expect(screen.getByText('Reason 3')).toBeInTheDocument();
      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('should color win rate reasons in green', () => {
      const { container } = render(
        <RecommendationCard
          {...defaultProps}
          reasonCodes={['High win rate']}
        />
      );

      const tag = screen.getByText('High win rate');
      expect(tag.className).toContain('green');
    });

    it('should color similarity reasons in blue', () => {
      const { container } = render(
        <RecommendationCard
          {...defaultProps}
          reasonCodes={['Similar to previous bids']}
        />
      );

      const tag = screen.getByText('Similar to previous bids');
      expect(tag.className).toContain('blue');
    });

    it('should color trending reasons in purple', () => {
      const { container } = render(
        <RecommendationCard
          {...defaultProps}
          reasonCodes={['Trending in your region']}
        />
      );

      const tag = screen.getByText('Trending in your region');
      expect(tag.className).toContain('purple');
    });
  });

  describe('Asset Information Display', () => {
    it('should display vehicle asset name', () => {
      render(<RecommendationCard {...defaultProps} />);

      expect(screen.getByText('2020 Toyota Camry')).toBeInTheDocument();
    });

    it('should display electronics asset name', () => {
      render(
        <RecommendationCard
          {...defaultProps}
          auctionDetails={{
            ...defaultProps.auctionDetails,
            assetType: 'electronics',
            assetDetails: { brand: 'Samsung', model: 'Galaxy S21' },
          }}
        />
      );

      expect(screen.getByText('Samsung Galaxy S21')).toBeInTheDocument();
    });

    it('should display machinery asset name', () => {
      render(
        <RecommendationCard
          {...defaultProps}
          auctionDetails={{
            ...defaultProps.auctionDetails,
            assetType: 'machinery',
            assetDetails: { manufacturer: 'Caterpillar', model: 'D6T' },
          }}
        />
      );

      expect(screen.getByText('Caterpillar D6T')).toBeInTheDocument();
    });

    it('should display current bid with currency formatting', () => {
      render(<RecommendationCard {...defaultProps} />);

      expect(screen.getByText('₦4,500,000')).toBeInTheDocument();
    });

    it('should display "No bids yet" when no current bid', () => {
      render(
        <RecommendationCard
          {...defaultProps}
          auctionDetails={{
            ...defaultProps.auctionDetails,
            currentBid: null,
          }}
        />
      );

      expect(screen.getByText('No bids yet')).toBeInTheDocument();
    });

    it('should display market value', () => {
      render(<RecommendationCard {...defaultProps} />);

      expect(screen.getByText('₦5,000,000')).toBeInTheDocument();
    });

    it('should display watching count', () => {
      render(<RecommendationCard {...defaultProps} />);

      expect(screen.getByText('12 watching')).toBeInTheDocument();
    });

    it('should display time remaining', () => {
      render(<RecommendationCard {...defaultProps} />);

      expect(screen.getByText(/\d+h \d+m left/)).toBeInTheDocument();
    });
  });

  describe('"View Auction" Button', () => {
    it('should render "View Auction" button', () => {
      render(<RecommendationCard {...defaultProps} />);

      expect(screen.getByText('View Auction')).toBeInTheDocument();
    });

    it('should link to auction details page', () => {
      render(<RecommendationCard {...defaultProps} />);

      const link = screen.getByText('View Auction').closest('a');
      expect(link).toHaveAttribute('href', '/vendor/auctions/auction-123');
    });
  });

  describe('"Not Interested" Button', () => {
    it('should render "Not Interested" button', () => {
      render(<RecommendationCard {...defaultProps} />);

      const button = screen.getByRole('button', { name: /not interested/i });
      expect(button).toBeInTheDocument();
    });

    it('should hide card when "Not Interested" is clicked', async () => {
      const { container } = render(<RecommendationCard {...defaultProps} />);

      const button = screen.getByRole('button', { name: /not interested/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });

    it('should call onNotInterested callback', async () => {
      const onNotInterested = vi.fn();
      render(<RecommendationCard {...defaultProps} onNotInterested={onNotInterested} />);

      const button = screen.getByRole('button', { name: /not interested/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(onNotInterested).toHaveBeenCalledWith('auction-123');
      });
    });

    it('should track feedback via API', async () => {
      render(<RecommendationCard {...defaultProps} />);

      const button = screen.getByRole('button', { name: /not interested/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/intelligence/interactions',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('recommendation_dismissed'),
          })
        );
      });
    });

    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));

      render(<RecommendationCard {...defaultProps} />);

      const button = screen.getByRole('button', { name: /not interested/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Responsive Design', () => {
    it('should render on mobile viewport', () => {
      global.innerWidth = 375;
      render(<RecommendationCard {...defaultProps} />);

      expect(screen.getByText('2020 Toyota Camry')).toBeInTheDocument();
    });

    it('should render on desktop viewport', () => {
      global.innerWidth = 1920;
      render(<RecommendationCard {...defaultProps} />);

      expect(screen.getByText('2020 Toyota Camry')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible "Not Interested" button', () => {
      render(<RecommendationCard {...defaultProps} />);

      const button = screen.getByRole('button', { name: /not interested/i });
      expect(button).toHaveAttribute('aria-label', 'Not interested');
    });

    it('should have accessible link to auction', () => {
      render(<RecommendationCard {...defaultProps} />);

      const link = screen.getByRole('link', { name: /2020 Toyota Camry/i });
      expect(link).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(<RecommendationCard {...defaultProps} />);

      const button = screen.getByRole('button', { name: /not interested/i });
      button.focus();

      expect(document.activeElement).toBe(button);
    });
  });
});
