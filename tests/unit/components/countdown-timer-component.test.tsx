/**
 * Component Tests for Countdown Timer
 * 
 * Tests the React component rendering and behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CountdownTimer, CountdownTimerCard, InlineCountdownTimer } from '@/components/ui/countdown-timer';

describe('CountdownTimer Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render countdown timer with correct format', () => {
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
    render(<CountdownTimer endTime={futureTime} />);

    const timer = screen.getByTestId('countdown-timer');
    expect(timer).toBeInTheDocument();
    expect(timer.textContent).toMatch(/\d+h \d+m \d+s/);
  });

  it('should apply green color when >24h remaining', () => {
    const futureTime = new Date(Date.now() + 30 * 60 * 60 * 1000); // 30 hours from now
    render(<CountdownTimer endTime={futureTime} />);

    const timer = screen.getByTestId('countdown-timer');
    expect(timer).toHaveClass('text-green-600');
  });

  it('should apply yellow color when 1-24h remaining', () => {
    const futureTime = new Date(Date.now() + 5 * 60 * 60 * 1000); // 5 hours from now
    render(<CountdownTimer endTime={futureTime} />);

    const timer = screen.getByTestId('countdown-timer');
    expect(timer).toHaveClass('text-yellow-600');
  });

  it('should apply red color when <1h remaining', () => {
    const futureTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
    render(<CountdownTimer endTime={futureTime} />);

    const timer = screen.getByTestId('countdown-timer');
    expect(timer).toHaveClass('text-red-600');
  });

  it('should pulse when <1h remaining', () => {
    const futureTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
    render(<CountdownTimer endTime={futureTime} />);

    const timer = screen.getByTestId('countdown-timer');
    expect(timer).toHaveClass('animate-pulse');
  });

  it('should not pulse when >1h remaining', () => {
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
    render(<CountdownTimer endTime={futureTime} />);

    const timer = screen.getByTestId('countdown-timer');
    expect(timer).not.toHaveClass('animate-pulse');
  });

  it('should show "Expired" when time is up', () => {
    const pastTime = new Date(Date.now() - 1000); // 1 second ago
    render(<CountdownTimer endTime={pastTime} />);

    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('should call onComplete when countdown reaches zero', async () => {
    const onComplete = vi.fn();
    const pastTime = new Date(Date.now() - 1000); // Already expired

    render(<CountdownTimer endTime={pastTime} onComplete={onComplete} />);

    // onComplete should be called immediately for expired time
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('should call onOneHourRemaining when 1 hour left', () => {
    const onOneHourRemaining = vi.fn();
    const futureTime = new Date(Date.now() + 59 * 60 * 1000); // 59 minutes from now

    render(<CountdownTimer endTime={futureTime} onOneHourRemaining={onOneHourRemaining} />);

    // Should be called on initial render since time is < 1 hour
    expect(onOneHourRemaining).toHaveBeenCalledTimes(1);
  });

  it('should call onThirtyMinutesRemaining when 30 minutes left', () => {
    const onThirtyMinutesRemaining = vi.fn();
    const futureTime = new Date(Date.now() + 29 * 60 * 1000); // 29 minutes from now

    render(<CountdownTimer endTime={futureTime} onThirtyMinutesRemaining={onThirtyMinutesRemaining} />);

    // Should be called on initial render since time is < 30 minutes
    expect(onThirtyMinutesRemaining).toHaveBeenCalledTimes(1);
  });

  it('should update every second', () => {
    const futureTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
    render(<CountdownTimer endTime={futureTime} />);

    const timer = screen.getByTestId('countdown-timer');
    expect(timer).toBeInTheDocument();
    // Just verify it renders - actual timing tested in property tests
  });

  it('should accept ISO string as endTime', () => {
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    render(<CountdownTimer endTime={futureTime} />);

    const timer = screen.getByTestId('countdown-timer');
    expect(timer).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    render(<CountdownTimer endTime={futureTime} className="custom-class" />);

    const timer = screen.getByTestId('countdown-timer');
    expect(timer).toHaveClass('custom-class');
  });

  it('should render compact format', () => {
    const futureTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days from now
    render(<CountdownTimer endTime={futureTime} compact={true} />);

    const timer = screen.getByTestId('countdown-timer');
    // Compact format should not include seconds
    expect(timer.textContent).toMatch(/\d+d \d+h/);
    expect(timer.textContent).not.toMatch(/s$/);
  });
});

describe('CountdownTimerCard Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render with default label', () => {
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    render(<CountdownTimerCard endTime={futureTime} />);

    expect(screen.getByText('Time Remaining')).toBeInTheDocument();
  });

  it('should render with custom label', () => {
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    render(<CountdownTimerCard endTime={futureTime} label="Auction Ends In" />);

    expect(screen.getByText('Auction Ends In')).toBeInTheDocument();
  });

  it('should show icon by default', () => {
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const { container } = render(<CountdownTimerCard endTime={futureTime} />);

    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('should hide icon when showIcon is false', () => {
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const { container } = render(<CountdownTimerCard endTime={futureTime} showIcon={false} />);

    const icon = container.querySelector('svg');
    expect(icon).not.toBeInTheDocument();
  });
});

describe('InlineCountdownTimer Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render in compact format', () => {
    const futureTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days from now
    render(<InlineCountdownTimer endTime={futureTime} />);

    const timer = screen.getByTestId('countdown-timer');
    expect(timer).toHaveClass('text-sm');
  });
});
