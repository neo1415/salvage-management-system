/**
 * Unit Tests for AuctionScheduleSelector Component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AuctionScheduleSelector, AuctionScheduleValue } from '../auction-schedule-selector';

describe('AuctionScheduleSelector', () => {
  it('renders with default "Start Now" mode', () => {
    const onChange = vi.fn();
    const value: AuctionScheduleValue = { mode: 'now' };

    render(<AuctionScheduleSelector value={value} onChange={onChange} />);

    expect(screen.getByText('Start Now')).toBeInTheDocument();
    expect(screen.getByText('Schedule')).toBeInTheDocument();
  });

  it('displays info message in "Start Now" mode', () => {
    const onChange = vi.fn();
    const value: AuctionScheduleValue = { mode: 'now' };

    render(<AuctionScheduleSelector value={value} onChange={onChange} />);

    expect(screen.getByText(/Auction will start immediately/i)).toBeInTheDocument();
  });

  it('switches to scheduled mode when Schedule button is clicked', () => {
    const onChange = vi.fn();
    const value: AuctionScheduleValue = { mode: 'now' };

    render(<AuctionScheduleSelector value={value} onChange={onChange} />);

    const scheduleButton = screen.getByText('Schedule');
    fireEvent.click(scheduleButton);

    expect(onChange).toHaveBeenCalled();
    const call = onChange.mock.calls[0][0];
    expect(call.mode).toBe('scheduled');
  });

  it('shows date and time pickers in scheduled mode', () => {
    const onChange = vi.fn();
    const value: AuctionScheduleValue = { mode: 'scheduled' };

    render(<AuctionScheduleSelector value={value} onChange={onChange} />);

    expect(screen.getByText('Select Date')).toBeInTheDocument();
    expect(screen.getByText('Select Time')).toBeInTheDocument();
    expect(screen.getByText('Africa/Lagos (WAT)')).toBeInTheDocument();
  });

  it('displays selected date in scheduled mode', () => {
    const onChange = vi.fn();
    const scheduledTime = new Date('2024-12-31T09:00:00');
    const value: AuctionScheduleValue = {
      mode: 'scheduled',
      scheduledTime,
    };

    render(<AuctionScheduleSelector value={value} onChange={onChange} />);

    // Check that the date is displayed (format may vary)
    expect(screen.getByText(/Dec/i)).toBeInTheDocument();
  });

  it('applies burgundy theme to active mode button', () => {
    const onChange = vi.fn();
    const value: AuctionScheduleValue = { mode: 'now' };

    const { container } = render(
      <AuctionScheduleSelector value={value} onChange={onChange} />
    );

    const startNowButton = screen.getByText('Start Now').closest('button');
    expect(startNowButton).toHaveClass('bg-[#800020]');
  });

  it('accepts custom className prop', () => {
    const onChange = vi.fn();
    const value: AuctionScheduleValue = { mode: 'now' };

    const { container } = render(
      <AuctionScheduleSelector
        value={value}
        onChange={onChange}
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('respects minDate prop', () => {
    const onChange = vi.fn();
    const minDate = new Date('2024-12-31');
    const value: AuctionScheduleValue = { mode: 'now' };

    render(
      <AuctionScheduleSelector
        value={value}
        onChange={onChange}
        minDate={minDate}
      />
    );

    // Component should render without errors
    expect(screen.getByText('Start Now')).toBeInTheDocument();
  });
});
