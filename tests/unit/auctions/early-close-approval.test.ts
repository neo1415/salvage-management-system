import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createNotification, sendEmail } = vi.hoisted(() => ({
  createNotification: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('@/features/notifications/services/notification.service', () => ({ createNotification }));
vi.mock('@/features/notifications/services/email.service', () => ({
  emailService: { sendEmail },
}));
vi.mock('@/features/notifications/templates/email-branding', () => ({
  getEmailBranding: vi.fn().mockResolvedValue({ primaryColor: '#111111' }),
}));
vi.mock('@/features/notifications/templates/wrap-professional-email', () => ({
  wrapProfessionalEmail: vi.fn(async (_title: string, body: string) => body),
}));
vi.mock('@/features/notifications/templates/email-urls', () => ({
  appPath: (path: string) => `https://salvagebridge.com${path}`,
}));

import { notifyManagingDirectorsOfEarlyClose } from '@/features/auctions/services/early-close-approval.service';

describe('early closure approval delivery', () => {
  beforeEach(() => {
    createNotification.mockReset().mockResolvedValue({ id: 'notification-1' });
    sendEmail.mockReset().mockResolvedValue({ success: true, messageId: 'email-1' });
  });

  it('delivers a critical email and in-app notification with the exact request deep link', async () => {
    const result = await notifyManagingDirectorsOfEarlyClose({
      recipients: [{ id: 'admin-1', email: 'director@example.com', fullName: 'Director' }],
      requestId: 'request-123',
      auctionId: 'auction-456',
      claimReference: 'CLM-789',
      requesterName: 'Salvage Manager',
      reason: 'The reserve has been met and the leading bid is commercially acceptable.',
    });

    expect(result).toEqual({ delivered: 1, failed: 0 });
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'admin-1',
      data: expect.objectContaining({ url: '/auction-closure-requests/request-123' }),
    }));
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'director@example.com',
      critical: true,
      html: expect.stringContaining('https://salvagebridge.com/auction-closure-requests/request-123'),
    }));
  });

  it('reports a resolved email failure instead of claiming full delivery', async () => {
    sendEmail.mockResolvedValue({ success: false, error: 'network unavailable' });

    const result = await notifyManagingDirectorsOfEarlyClose({
      recipients: [{ id: 'admin-1', email: 'director@example.com', fullName: 'Director' }],
      requestId: 'request-123',
      auctionId: 'auction-456',
      claimReference: 'CLM-789',
      requesterName: 'Salvage Manager',
      reason: 'The reserve has been met and the leading bid is commercially acceptable.',
    });

    expect(result).toEqual({ delivered: 0, failed: 1 });
  });
});
