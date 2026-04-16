/**
 * Vendor Segments Pie Chart Component Tests
 * 
 * Tests for VendorSegmentsPieChart component
 * Task: 15.1.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { VendorSegmentsPieChart } from '@/components/intelligence/admin/vendor-segments-pie-chart';

// Mock fetch
global.fetch = vi.fn();

const mockSegmentData = {
  segments: [
    { segment: 'High-Value', count: 45, avgBidAmount: 5000000, avgWinRate: 0.35 },
    { segment: 'Active', count: 120, avgBidAmount: 3000000, avgWinRate: 0.25 },
    { segment: 'Occasional', count: 80, avgBidAmount: 2000000, avgWinRate: 0.15 },
    { segment: 'New', count: 30, avgBidAmount: 1500000, avgWinRate: 0.10 },
    { segment: 'Inactive', count: 25, avgBidAmount: 500000, avgWinRate: 0.05 },
  ],
  total: 300,
};

describe('VendorSegmentsPieChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render loading state initially', () => {
    (global.fetch as any).mockImplementation(() => 
      new Promise(() => {}) // Never resolves
    );

    render(<VendorSegmentsPieChart />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should fetch and display segment data', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSegmentData,
    });

    render(<VendorSegmentsPieChart />);

    await waitFor(() => {
      expect(screen.getByText('Vendor Segments')).toBeInTheDocument();
    });

    expect(screen.getByText('300 total vendors')).toBeInTheDocument();
  });

  it('should display all segment names', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSegmentData,
    });

    render(<VendorSegmentsPieChart />);

    await waitFor(() => {
      expect(screen.getByText('High-Value')).toBeInTheDocument();
    });

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Occasional')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('should display segment counts', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSegmentData,
    });

    render(<VendorSegmentsPieChart />);

    await waitFor(() => {
      expect(screen.getByText('45')).toBeInTheDocument();
    });

    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('should display segment percentages', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSegmentData,
    });

    render(<VendorSegmentsPieChart />);

    await waitFor(() => {
      expect(screen.getByText('15.0%')).toBeInTheDocument(); // High-Value: 45/300
    });

    expect(screen.getByText('40.0%')).toBeInTheDocument(); // Active: 120/300
    expect(screen.getByText('26.7%')).toBeInTheDocument(); // Occasional: 80/300
    expect(screen.getByText('10.0%')).toBeInTheDocument(); // New: 30/300
    expect(screen.getByText('8.3%')).toBeInTheDocument(); // Inactive: 25/300
  });

  it('should handle empty data gracefully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ segments: [], total: 0 }),
    });

    render(<VendorSegmentsPieChart />);

    await waitFor(() => {
      expect(screen.getByText('No segment data available')).toBeInTheDocument();
    });
  });

  it('should handle API error gracefully', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('API Error'));

    render(<VendorSegmentsPieChart />);

    await waitFor(() => {
      expect(screen.getByText('No segment data available')).toBeInTheDocument();
    });
  });

  it('should call correct API endpoint', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSegmentData,
    });

    render(<VendorSegmentsPieChart />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/intelligence/admin/vendor-segments');
    });
  });

  it('should render segment details table', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSegmentData,
    });

    render(<VendorSegmentsPieChart />);

    await waitFor(() => {
      expect(screen.getByText('High-Value')).toBeInTheDocument();
    });

    // Check that all segments are in the details table
    const segments = ['High-Value', 'Active', 'Occasional', 'New', 'Inactive'];
    segments.forEach(segment => {
      expect(screen.getByText(segment)).toBeInTheDocument();
    });
  });

  it('should handle missing segments in response', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    render(<VendorSegmentsPieChart />);

    await waitFor(() => {
      expect(screen.getByText('No segment data available')).toBeInTheDocument();
    });
  });
});
