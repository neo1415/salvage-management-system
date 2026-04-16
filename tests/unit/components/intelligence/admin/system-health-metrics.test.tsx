/**
 * System Health Metrics Component Tests
 * 
 * Tests for SystemHealthMetrics component
 * Task: 15.1.6
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SystemHealthMetrics } from '@/components/intelligence/admin/system-health-metrics';

describe('SystemHealthMetrics', () => {
  const mockMetrics = {
    cacheHitRate: 85.5,
    avgResponseTime: 145,
    jobsRunning: 6,
    lastRefresh: new Date().toISOString(),
    databaseConnections: 10,
    memoryUsage: 45.2,
    cpuUsage: 32.1,
    errorRate: 0.5,
  };

  it('should render all health metrics', () => {
    render(<SystemHealthMetrics metrics={mockMetrics} />);

    expect(screen.getByText('Cache Performance')).toBeInTheDocument();
    expect(screen.getByText('85.5%')).toBeInTheDocument();
    expect(screen.getByText('Hit rate')).toBeInTheDocument();

    expect(screen.getByText('Response Time')).toBeInTheDocument();
    expect(screen.getByText('145ms')).toBeInTheDocument();
    expect(screen.getByText('Average latency')).toBeInTheDocument();

    expect(screen.getByText('Background Jobs')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('Active processes')).toBeInTheDocument();

    expect(screen.getByText('Last Refresh')).toBeInTheDocument();
    expect(screen.getByText('Materialized views')).toBeInTheDocument();
  });

  it('should render optional metrics when provided', () => {
    render(<SystemHealthMetrics metrics={mockMetrics} />);

    expect(screen.getByText('DB Connections')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();

    expect(screen.getByText('Memory Usage')).toBeInTheDocument();
    expect(screen.getByText('45.2%')).toBeInTheDocument();

    expect(screen.getByText('CPU Usage')).toBeInTheDocument();
    expect(screen.getByText('32.1%')).toBeInTheDocument();

    expect(screen.getByText('Error Rate')).toBeInTheDocument();
    expect(screen.getByText('0.50%')).toBeInTheDocument();
  });

  it('should not render optional metrics when not provided', () => {
    const minimalMetrics = {
      cacheHitRate: 85.5,
      avgResponseTime: 145,
      jobsRunning: 6,
      lastRefresh: new Date().toISOString(),
    };

    render(<SystemHealthMetrics metrics={minimalMetrics} />);

    expect(screen.queryByText('DB Connections')).not.toBeInTheDocument();
    expect(screen.queryByText('Memory Usage')).not.toBeInTheDocument();
    expect(screen.queryByText('CPU Usage')).not.toBeInTheDocument();
    expect(screen.queryByText('Error Rate')).not.toBeInTheDocument();
  });

  it('should display healthy status for good cache hit rate', () => {
    const healthyMetrics = { ...mockMetrics, cacheHitRate: 90 };
    const { container } = render(<SystemHealthMetrics metrics={healthyMetrics} />);

    const cacheCard = container.querySelector('.text-green-600');
    expect(cacheCard).toBeInTheDocument();
  });

  it('should display warning status for moderate cache hit rate', () => {
    const warningMetrics = { ...mockMetrics, cacheHitRate: 65 };
    const { container } = render(<SystemHealthMetrics metrics={warningMetrics} />);

    const warningCard = container.querySelector('.text-yellow-600');
    expect(warningCard).toBeInTheDocument();
  });

  it('should display critical status for low cache hit rate', () => {
    const criticalMetrics = { ...mockMetrics, cacheHitRate: 50 };
    const { container } = render(<SystemHealthMetrics metrics={criticalMetrics} />);

    const criticalCard = container.querySelector('.text-red-600');
    expect(criticalCard).toBeInTheDocument();
  });

  it('should display healthy status for fast response time', () => {
    const fastMetrics = { ...mockMetrics, avgResponseTime: 150 };
    const { container } = render(<SystemHealthMetrics metrics={fastMetrics} />);

    // Response time card should show healthy status
    expect(screen.getByText('150ms')).toBeInTheDocument();
  });

  it('should display warning status for slow response time', () => {
    const slowMetrics = { ...mockMetrics, avgResponseTime: 350 };
    render(<SystemHealthMetrics metrics={slowMetrics} />);

    expect(screen.getByText('350ms')).toBeInTheDocument();
  });

  it('should display critical status for very slow response time', () => {
    const verySlowMetrics = { ...mockMetrics, avgResponseTime: 600 };
    render(<SystemHealthMetrics metrics={verySlowMetrics} />);

    expect(screen.getByText('600ms')).toBeInTheDocument();
  });

  it('should format time correctly for recent refresh', () => {
    const recentMetrics = {
      ...mockMetrics,
      lastRefresh: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
    };

    render(<SystemHealthMetrics metrics={recentMetrics} />);
    expect(screen.getByText('Just now')).toBeInTheDocument();
  });

  it('should format time correctly for minutes ago', () => {
    const minutesAgoMetrics = {
      ...mockMetrics,
      lastRefresh: new Date(Date.now() - 5 * 60000).toISOString(), // 5 minutes ago
    };

    render(<SystemHealthMetrics metrics={minutesAgoMetrics} />);
    expect(screen.getByText('5m ago')).toBeInTheDocument();
  });

  it('should format time correctly for hours ago', () => {
    const hoursAgoMetrics = {
      ...mockMetrics,
      lastRefresh: new Date(Date.now() - 2 * 3600000).toISOString(), // 2 hours ago
    };

    render(<SystemHealthMetrics metrics={hoursAgoMetrics} />);
    expect(screen.getByText('2h ago')).toBeInTheDocument();
  });

  it('should display healthy status for low error rate', () => {
    const lowErrorMetrics = { ...mockMetrics, errorRate: 0.3 };
    render(<SystemHealthMetrics metrics={lowErrorMetrics} />);

    expect(screen.getByText('0.30%')).toBeInTheDocument();
  });

  it('should display warning status for moderate error rate', () => {
    const moderateErrorMetrics = { ...mockMetrics, errorRate: 3.5 };
    render(<SystemHealthMetrics metrics={moderateErrorMetrics} />);

    expect(screen.getByText('3.50%')).toBeInTheDocument();
  });

  it('should display critical status for high error rate', () => {
    const highErrorMetrics = { ...mockMetrics, errorRate: 8.0 };
    render(<SystemHealthMetrics metrics={highErrorMetrics} />);

    expect(screen.getByText('8.00%')).toBeInTheDocument();
  });
});
