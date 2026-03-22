/**
 * Search Progress Indicator Component Tests
 * 
 * Tests for the search progress indicator component used during
 * internet search operations in case creation.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchProgressIndicator, useSearchProgress } from '@/components/ui/search-progress-indicator';

describe('SearchProgressIndicator', () => {
  const mockOnCancel = jest.fn();
  const mockOnRetry = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when stage is idle', () => {
    const { container } = render(
      <SearchProgressIndicator
        progress={{ stage: 'idle', message: '' }}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders market search progress correctly', () => {
    render(
      <SearchProgressIndicator
        progress={{
          stage: 'market_search',
          message: 'Searching for market prices...',
          searchQuery: 'Toyota Camry 2021 used price Nigeria',
          progress: 30,
        }}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
      />
    );

    expect(screen.getByText('Searching for market prices...')).toBeInTheDocument();
    expect(screen.getByText('Searching: "Toyota Camry 2021 used price Nigeria"')).toBeInTheDocument();
    expect(screen.getByText('30% complete')).toBeInTheDocument();
    expect(screen.getByText('🔍 Searching Google for market prices...')).toBeInTheDocument();
  });

  it('renders AI processing progress correctly', () => {
    render(
      <SearchProgressIndicator
        progress={{
          stage: 'ai_processing',
          message: 'AI analyzing photos with market data...',
          progress: 60,
        }}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
      />
    );

    expect(screen.getByText('AI analyzing photos with market data...')).toBeInTheDocument();
    expect(screen.getByText('60% complete')).toBeInTheDocument();
    expect(screen.getByText('🤖 AI analyzing photos with market data...')).toBeInTheDocument();
  });

  it('renders part search progress correctly', () => {
    render(
      <SearchProgressIndicator
        progress={{
          stage: 'part_search',
          message: 'Searching prices for 3 damaged parts...',
          progress: 45,
        }}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
      />
    );

    expect(screen.getByText('Searching prices for 3 damaged parts...')).toBeInTheDocument();
    expect(screen.getByText('45% complete')).toBeInTheDocument();
    expect(screen.getByText('🔧 Finding part prices for salvage calculation...')).toBeInTheDocument();
  });

  it('renders completion state correctly', () => {
    render(
      <SearchProgressIndicator
        progress={{
          stage: 'complete',
          message: 'Search completed successfully',
          confidence: 85,
          dataSource: 'internet',
        }}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
      />
    );

    expect(screen.getByText('Search completed successfully')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('🌐 Internet')).toBeInTheDocument();
    expect(screen.getByText('✅ Search completed successfully')).toBeInTheDocument();
  });

  it('renders error state correctly', () => {
    render(
      <SearchProgressIndicator
        progress={{
          stage: 'error',
          message: 'Search failed',
          error: 'Network timeout occurred',
        }}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
      />
    );

    expect(screen.getByText('Search failed')).toBeInTheDocument();
    expect(screen.getByText('Network timeout occurred')).toBeInTheDocument();
    expect(screen.getByText('❌ Search failed - using fallback data')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(
      <SearchProgressIndicator
        progress={{
          stage: 'market_search',
          message: 'Searching...',
          progress: 30,
        }}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onRetry when retry button is clicked', () => {
    render(
      <SearchProgressIndicator
        progress={{
          stage: 'error',
          message: 'Search failed',
          error: 'Network error',
        }}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
      />
    );

    fireEvent.click(screen.getByText('Retry'));
    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it('shows timeout warning for long-running searches', async () => {
    // Mock Date.now to simulate time passing
    const originalDateNow = Date.now;
    let mockTime = 1000;
    Date.now = jest.fn(() => mockTime);

    const { rerender } = render(
      <SearchProgressIndicator
        progress={{
          stage: 'market_search',
          message: 'Searching...',
          progress: 30,
        }}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
      />
    );

    // Simulate 11 seconds passing
    mockTime += 11000;
    
    rerender(
      <SearchProgressIndicator
        progress={{
          stage: 'market_search',
          message: 'Searching...',
          progress: 30,
        }}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Search is taking longer than expected/)).toBeInTheDocument();
    });

    // Restore original Date.now
    Date.now = originalDateNow;
  });

  it('displays confidence levels with appropriate colors', () => {
    const { rerender } = render(
      <SearchProgressIndicator
        progress={{
          stage: 'complete',
          message: 'Search completed',
          confidence: 90,
        }}
      />
    );

    // High confidence (90%) should be green
    expect(screen.getByText('90%')).toHaveClass('bg-green-100', 'text-green-800');

    rerender(
      <SearchProgressIndicator
        progress={{
          stage: 'complete',
          message: 'Search completed',
          confidence: 70,
        }}
      />
    );

    // Medium confidence (70%) should be yellow
    expect(screen.getByText('70%')).toHaveClass('bg-yellow-100', 'text-yellow-800');

    rerender(
      <SearchProgressIndicator
        progress={{
          stage: 'complete',
          message: 'Search completed',
          confidence: 40,
        }}
      />
    );

    // Low confidence (40%) should be red
    expect(screen.getByText('40%')).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('displays data source with appropriate colors', () => {
    const { rerender } = render(
      <SearchProgressIndicator
        progress={{
          stage: 'complete',
          message: 'Search completed',
          dataSource: 'internet',
        }}
      />
    );

    expect(screen.getByText('🌐 Internet')).toHaveClass('bg-blue-100', 'text-blue-800');

    rerender(
      <SearchProgressIndicator
        progress={{
          stage: 'complete',
          message: 'Search completed',
          dataSource: 'database',
        }}
      />
    );

    expect(screen.getByText('💾 Database')).toHaveClass('bg-green-100', 'text-green-800');

    rerender(
      <SearchProgressIndicator
        progress={{
          stage: 'complete',
          message: 'Search completed',
          dataSource: 'cache',
        }}
      />
    );

    expect(screen.getByText('⚡ Cache')).toHaveClass('bg-yellow-100', 'text-yellow-800');
  });
});

describe('useSearchProgress', () => {
  it('initializes with idle state', () => {
    let hookResult: any;
    
    function TestComponent() {
      hookResult = useSearchProgress();
      return null;
    }

    render(<TestComponent />);

    expect(hookResult.progress.stage).toBe('idle');
    expect(hookResult.progress.message).toBe('');
  });

  it('updates progress correctly', () => {
    let hookResult: any;
    
    function TestComponent() {
      hookResult = useSearchProgress();
      return null;
    }

    render(<TestComponent />);

    // Start market search
    hookResult.startMarketSearch('Toyota Camry 2021');
    expect(hookResult.progress.stage).toBe('market_search');
    expect(hookResult.progress.message).toBe('Searching for market prices...');
    expect(hookResult.progress.searchQuery).toBe('Toyota Camry 2021');

    // Start AI processing
    hookResult.startAIProcessing();
    expect(hookResult.progress.stage).toBe('ai_processing');
    expect(hookResult.progress.message).toBe('AI analyzing photos with market data...');

    // Start part search
    hookResult.startPartSearch(3);
    expect(hookResult.progress.stage).toBe('part_search');
    expect(hookResult.progress.message).toBe('Searching prices for 3 damaged parts...');

    // Set complete
    hookResult.setComplete(85, 'internet');
    expect(hookResult.progress.stage).toBe('complete');
    expect(hookResult.progress.confidence).toBe(85);
    expect(hookResult.progress.dataSource).toBe('internet');

    // Set error
    hookResult.setError('Network error');
    expect(hookResult.progress.stage).toBe('error');
    expect(hookResult.progress.error).toBe('Network error');

    // Reset
    hookResult.reset();
    expect(hookResult.progress.stage).toBe('idle');
  });
});