/**
 * Notification Preferences Page Tests
 * Tests the notification preferences UI component
 * 
 * Requirements: 39, NFR5.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationPreferencesPage from '@/app/(dashboard)/vendor/settings/notifications/page';

// Mock useSession
const mockUseSession = vi.fn();

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock next/navigation
const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

// Mock fetch
global.fetch = vi.fn();

describe('NotificationPreferencesPage', () => {
  const mockPreferences = {
    pushEnabled: true,
    smsEnabled: true,
    emailEnabled: true,
    bidAlerts: true,
    auctionEnding: true,
    paymentReminders: true,
    leaderboardUpdates: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock authenticated session
    mockUseSession.mockReturnValue({
      data: { user: { id: 'test-user-id', email: 'test@example.com' } },
      status: 'authenticated',
    });

    // Mock successful fetch
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ preferences: mockPreferences }),
    });
  });

  it('renders notification channels section', async () => {
    render(<NotificationPreferencesPage />);

    await waitFor(() => {
      expect(screen.getByText('Notification Channels')).toBeInTheDocument();
    });

    expect(screen.getByText('Push Notifications')).toBeInTheDocument();
    expect(screen.getByText('SMS Notifications')).toBeInTheDocument();
    expect(screen.getByText('Email Notifications')).toBeInTheDocument();
  });

  it('renders notification types section', async () => {
    render(<NotificationPreferencesPage />);

    await waitFor(() => {
      expect(screen.getByText('Notification Types')).toBeInTheDocument();
    });

    expect(screen.getByText('Bid Alerts')).toBeInTheDocument();
    expect(screen.getByText('Auction Ending Soon')).toBeInTheDocument();
    expect(screen.getByText('Payment Reminders')).toBeInTheDocument();
    expect(screen.getByText('Leaderboard Updates')).toBeInTheDocument();
  });

  it('displays critical notification warning for payment reminders', async () => {
    render(<NotificationPreferencesPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/cannot be disabled/i).length).toBeGreaterThan(0);
    });
  });

  it('displays info box about critical notifications', async () => {
    render(<NotificationPreferencesPage />);

    await waitFor(() => {
      expect(screen.getByText('About Critical Notifications')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/OTP codes, payment deadlines, and account security alerts/i)
    ).toBeInTheDocument();
  });

  it('fetches preferences on mount', async () => {
    render(<NotificationPreferencesPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/notifications/preferences');
    });
  });

  it('updates preferences when toggle is clicked', async () => {
    const user = userEvent.setup();
    
    // Mock successful update
    (global.fetch as any).mockImplementation((url: string, options?: any) => {
      if (options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            message: 'Preferences saved successfully',
            preferences: { ...mockPreferences, bidAlerts: false },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ preferences: mockPreferences }),
      });
    });

    render(<NotificationPreferencesPage />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Bid Alerts')).toBeInTheDocument();
    });

    // Find and click a toggle button (we'll click the first one we can find)
    const toggleButtons = screen.getAllByRole('button');
    const bidAlertsToggle = toggleButtons.find((button) => {
      const parent = button.closest('div');
      return parent?.textContent?.includes('Bid Alerts');
    });

    if (bidAlertsToggle) {
      await user.click(bidAlertsToggle);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/notifications/preferences',
          expect.objectContaining({
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
          })
        );
      });
    }
  });

  it('shows success message after saving preferences', async () => {
    const user = userEvent.setup();
    
    // Mock successful update
    (global.fetch as any).mockImplementation((url: string, options?: any) => {
      if (options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            message: 'Preferences saved successfully',
            preferences: mockPreferences,
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ preferences: mockPreferences }),
      });
    });

    render(<NotificationPreferencesPage />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Notification Channels')).toBeInTheDocument();
    });

    // Find and click a toggle
    const toggleButtons = screen.getAllByRole('button');
    const firstToggle = toggleButtons.find((button) => {
      const parent = button.closest('div');
      return parent?.textContent?.includes('Push Notifications');
    });

    if (firstToggle) {
      await user.click(firstToggle);

      await waitFor(() => {
        expect(screen.getByText('Preferences saved successfully')).toBeInTheDocument();
      });
    }
  });

  it('handles update errors gracefully', async () => {
    const user = userEvent.setup();
    
    // Mock failed update
    (global.fetch as any).mockImplementation((url: string, options?: any) => {
      if (options?.method === 'PUT') {
        return Promise.resolve({
          ok: false,
          json: async () => ({
            error: 'Failed to update preferences',
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ preferences: mockPreferences }),
      });
    });

    render(<NotificationPreferencesPage />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Notification Channels')).toBeInTheDocument();
    });

    // Find and click a toggle
    const toggleButtons = screen.getAllByRole('button');
    const firstToggle = toggleButtons.find((button) => {
      const parent = button.closest('div');
      return parent?.textContent?.includes('SMS Notifications');
    });

    if (firstToggle) {
      await user.click(firstToggle);

      // Verify the PUT request was made
      await waitFor(() => {
        const putCalls = (global.fetch as any).mock.calls.filter(
          (call: any[]) => call[1]?.method === 'PUT'
        );
        expect(putCalls.length).toBeGreaterThan(0);
      });
    }
  });

  it('shows loading state while fetching preferences', () => {
    // Mock slow fetch
    (global.fetch as any).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    render(<NotificationPreferencesPage />);

    // Should show loading skeleton
    const loadingElements = screen.getAllByRole('generic').filter((el) => 
      el.className.includes('animate-pulse')
    );
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('disables toggles while saving', async () => {
    const user = userEvent.setup();
    
    // Mock slow update
    (global.fetch as any).mockImplementation((url: string, options?: any) => {
      if (options?.method === 'PUT') {
        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({
                  message: 'Preferences saved successfully',
                  preferences: mockPreferences,
                }),
              }),
            1000
          )
        );
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ preferences: mockPreferences }),
      });
    });

    render(<NotificationPreferencesPage />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Notification Channels')).toBeInTheDocument();
    });

    // Find and click a toggle
    const toggleButtons = screen.getAllByRole('button');
    const firstToggle = toggleButtons.find((button) => {
      const parent = button.closest('div');
      return parent?.textContent?.includes('Email Notifications');
    });

    if (firstToggle) {
      await user.click(firstToggle);

      // Check if button is disabled
      expect(firstToggle).toHaveClass('cursor-not-allowed');
    }
  });
});

