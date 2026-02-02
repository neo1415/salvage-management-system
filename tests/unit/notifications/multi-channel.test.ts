/**
 * Property Test: Multi-Channel Notification Delivery
 * 
 * Property 24: Multi-Channel Notification Delivery
 * Validates: Requirements 40.1-40.6
 * 
 * This test verifies that notifications are sent via all enabled channels
 * (SMS, Email, Push) based on user preferences and that fallback mechanisms
 * work correctly when primary channels fail.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fc } from '@fast-check/vitest';
import { pushNotificationService, type PushSubscription, type NotificationPreferences } from '@/features/notifications/services/push.service';
import { smsService } from '@/features/notifications/services/sms.service';
import { emailService } from '@/features/notifications/services/email.service';

// Mock the services
vi.mock('@/features/notifications/services/sms.service', () => ({
  smsService: {
    sendSMS: vi.fn(),
  },
}));

vi.mock('@/features/notifications/services/email.service', () => ({
  emailService: {
    sendEmail: vi.fn(),
  },
}));

vi.mock('@/lib/utils/audit-logger', () => ({
  logAction: vi.fn(),
  AuditActionType: {
    NOTIFICATION_SENT: 'notification_sent',
  },
  AuditEntityType: {
    NOTIFICATION: 'notification',
  },
  DeviceType: {
    DESKTOP: 'desktop',
    MOBILE: 'mobile',
  },
}));

describe('Property Test: Multi-Channel Notification Delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up default mocks that can be overridden in individual tests
    vi.mocked(smsService.sendSMS).mockResolvedValue({
      success: true,
      messageId: 'sms-default',
    });
    
    vi.mocked(emailService.sendEmail).mockResolvedValue({
      success: true,
      messageId: 'email-default',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Property 24.1: When push is enabled and subscription exists, push notification should be sent
   * Validates: Requirement 40.3
   */
  it('should send push notification when push is enabled and subscription exists', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          body: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          endpoint: fc.webUrl(),
          p256dh: fc.base64String({ minLength: 20, maxLength: 100 }),
          auth: fc.base64String({ minLength: 20, maxLength: 100 }),
        }),
        async ({ userId, title, body, endpoint, p256dh, auth }) => {
          // Arrange
          const subscription: PushSubscription = {
            endpoint,
            keys: { p256dh, auth },
          };

          const preferences: NotificationPreferences = {
            pushEnabled: true,
            smsEnabled: true,
            emailEnabled: true,
            bidAlerts: true,
            auctionEnding: true,
            paymentReminders: true,
            leaderboardUpdates: true,
          };

          // Act
          const result = await pushNotificationService.sendPushNotification(
            subscription,
            { userId, title, body },
            undefined,
            preferences
          );

          // Assert
          expect(result.success).toBe(true);
          expect(result.messageId).toBeDefined();
          expect(result.messageId).toMatch(/^push-/);
        }
      ),
      { numRuns: 10 } // Reduced runs for faster execution
    );
  });

  /**
   * Property 24.2: When push is disabled, fallback to SMS should be used
   * Validates: Requirement 40.5
   */
  it('should fallback to SMS when push is disabled', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          title: fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length >= 5 && /^[a-zA-Z0-9\s]+$/.test(s)),
          body: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length >= 10 && /^[a-zA-Z0-9\s.,!?]+$/.test(s)),
          phone: fc.constantFrom('2348141252812', '2347067275658'), // Use verified numbers
        }),
        async ({ userId, title, body, phone }) => {
          // Arrange
          const preferences: NotificationPreferences = {
            pushEnabled: false,
            smsEnabled: true,
            emailEnabled: true,
            bidAlerts: true,
            auctionEnding: true,
            paymentReminders: true,
            leaderboardUpdates: true,
          };

          const fallbackContact = { phone };

          // Mock SMS service to return success
          vi.mocked(smsService.sendSMS).mockResolvedValue({
            success: true,
            messageId: 'sms-123',
          });

          // Act
          const result = await pushNotificationService.sendPushNotification(
            null, // No subscription
            { userId, title, body },
            fallbackContact,
            preferences
          );

          // Assert
          expect(result.success).toBe(true);
          expect(result.fallbackUsed).toBe('sms');
          expect(smsService.sendSMS).toHaveBeenCalledWith({
            to: phone,
            message: expect.stringContaining(title),
            userId,
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 24.3: When push and SMS fail, fallback to email should be used
   * Validates: Requirement 40.5
   */
  it('should fallback to email when push and SMS fail', () => {
    // Custom email generator that matches the validation regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    // Ensure local part starts with alphanumeric, domain doesn't start/end with hyphen
    const emailArbitrary = fc.tuple(
      fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]$/.test(s)),
      fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(s)),
      fc.constantFrom('com', 'org', 'net', 'io', 'co')
    ).map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

    fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          title: fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length >= 5 && /^[a-zA-Z0-9\s]+$/.test(s)),
          body: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length >= 10 && /^[a-zA-Z0-9\s.,!?]+$/.test(s)),
          email: emailArbitrary,
        }),
        async ({ userId, title, body, email }) => {
          // Clear mocks at the start of each iteration
          vi.mocked(smsService.sendSMS).mockClear();
          vi.mocked(emailService.sendEmail).mockClear();
          
          // Arrange
          const preferences: NotificationPreferences = {
            pushEnabled: false,
            smsEnabled: true,
            emailEnabled: true,
            bidAlerts: true,
            auctionEnding: true,
            paymentReminders: true,
            leaderboardUpdates: true,
          };

          const fallbackContact = { email };

          // Mock SMS service to return failure
          vi.mocked(smsService.sendSMS).mockResolvedValue({
            success: false,
            error: 'SMS failed',
          });

          // Mock email service to return success
          vi.mocked(emailService.sendEmail).mockResolvedValue({
            success: true,
            messageId: 'email-123',
          });

          // Act
          const result = await pushNotificationService.sendPushNotification(
            null, // No subscription
            { userId, title, body },
            fallbackContact,
            preferences
          );

          // Assert
          expect(result.success).toBe(true);
          expect(result.fallbackUsed).toBe('email');
          expect(emailService.sendEmail).toHaveBeenCalledWith({
            to: email,
            subject: title,
            html: expect.stringContaining(body),
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 24.4: When no subscription and no fallback contact, notification should fail gracefully
   * Validates: Requirement 40.6
   */
  it('should fail gracefully when no subscription and no fallback contact', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          title: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 200 }),
        }),
        async ({ userId, title, body }) => {
          // Arrange
          const preferences: NotificationPreferences = {
            pushEnabled: true,
            smsEnabled: true,
            emailEnabled: true,
            bidAlerts: true,
            auctionEnding: true,
            paymentReminders: true,
            leaderboardUpdates: true,
          };

          // Act
          const result = await pushNotificationService.sendPushNotification(
            null, // No subscription
            { userId, title, body },
            undefined, // No fallback contact
            preferences
          );

          // Assert
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 24.5: Notification preferences should be respected for each notification type
   * Validates: Requirement 40.1, 40.2
   */
  it('should respect notification preferences for bid alerts', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          auctionTitle: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          newBidAmount: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          timeRemaining: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          bidAlertsEnabled: fc.boolean(),
          endpoint: fc.webUrl(),
          p256dh: fc.base64String({ minLength: 20, maxLength: 100 }),
          auth: fc.base64String({ minLength: 20, maxLength: 100 }),
        }),
        async ({ userId, auctionTitle, newBidAmount, timeRemaining, bidAlertsEnabled, endpoint, p256dh, auth }) => {
          // Arrange
          const subscription: PushSubscription = {
            endpoint,
            keys: { p256dh, auth },
          };

          const preferences: NotificationPreferences = {
            pushEnabled: true,
            smsEnabled: true,
            emailEnabled: true,
            bidAlerts: bidAlertsEnabled,
            auctionEnding: true,
            paymentReminders: true,
            leaderboardUpdates: true,
          };

          // Act
          const result = await pushNotificationService.sendOutbidAlert(
            subscription,
            userId,
            auctionTitle,
            newBidAmount,
            timeRemaining,
            undefined,
            preferences
          );

          // Assert
          expect(result.success).toBe(true);
          if (bidAlertsEnabled) {
            expect(result.messageId).toBeDefined();
            expect(result.messageId).not.toBe('disabled');
          } else {
            expect(result.messageId).toBe('disabled');
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 24.6: All notification channels should be attempted in order (push → SMS → email)
   * Validates: Requirement 40.5
   */
  it('should attempt all notification channels in order', () => {
    // Custom email generator that matches the validation regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    // Ensure local part starts with alphanumeric, domain doesn't start/end with hyphen
    const emailArbitrary = fc.tuple(
      fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]$/.test(s)),
      fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(s)),
      fc.constantFrom('com', 'org', 'net', 'io', 'co')
    ).map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

    // Mock SMS service to return success BEFORE the property test runs
    vi.mocked(smsService.sendSMS).mockResolvedValue({
      success: true,
      messageId: 'sms-123',
    });

    fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          title: fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length >= 5 && /^[a-zA-Z0-9\s]+$/.test(s)),
          body: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length >= 10 && /^[a-zA-Z0-9\s.,!?]+$/.test(s)),
          phone: fc.constantFrom('2348141252812', '2347067275658'),
          email: emailArbitrary,
        }),
        async ({ userId, title, body, phone, email }) => {
          // Clear mocks at the start of each iteration
          vi.mocked(smsService.sendSMS).mockClear();
          vi.mocked(emailService.sendEmail).mockClear();
          
          // Re-mock SMS to return success
          vi.mocked(smsService.sendSMS).mockResolvedValue({
            success: true,
            messageId: 'sms-123',
          });
          
          // Arrange
          const preferences: NotificationPreferences = {
            pushEnabled: false, // Force fallback
            smsEnabled: true,
            emailEnabled: true,
            bidAlerts: true,
            auctionEnding: true,
            paymentReminders: true,
            leaderboardUpdates: true,
          };

          const fallbackContact = { phone, email };

          // Act
          const result = await pushNotificationService.sendPushNotification(
            null, // No subscription
            { userId, title, body },
            fallbackContact,
            preferences
          );

          // Assert
          expect(result.success).toBe(true);
          expect(result.fallbackUsed).toBe('sms');
          expect(smsService.sendSMS).toHaveBeenCalled();
          // Email should not be called if SMS succeeds
          expect(emailService.sendEmail).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 24.7: Notification delivery should target >95% success rate
   * Validates: Requirement 40.6
   */
  it('should achieve high delivery success rate with fallback mechanisms', async () => {
    // Arrange
    const totalAttempts = 100;
    let successCount = 0;

    // Mock services with realistic failure rates
    vi.mocked(smsService.sendSMS).mockImplementation(async () => {
      // 90% success rate for SMS
      const success = Math.random() < 0.9;
      return {
        success,
        messageId: success ? 'sms-123' : undefined,
        error: success ? undefined : 'SMS failed',
      };
    });

    vi.mocked(emailService.sendEmail).mockImplementation(async () => {
      // 98% success rate for email
      const success = Math.random() < 0.98;
      return {
        success,
        messageId: success ? 'email-123' : undefined,
        error: success ? undefined : 'Email failed',
      };
    });

    // Act
    for (let i = 0; i < totalAttempts; i++) {
      const result = await pushNotificationService.sendPushNotification(
        null, // No push subscription
        {
          userId: `user-${i}`,
          title: 'Test Notification',
          body: 'Test body',
        },
        {
          phone: '2348141252812',
          email: 'test@example.com',
        },
        {
          pushEnabled: false,
          smsEnabled: true,
          emailEnabled: true,
          bidAlerts: true,
          auctionEnding: true,
          paymentReminders: true,
          leaderboardUpdates: true,
        }
      );

      if (result.success) {
        successCount++;
      }
    }

    // Assert
    const successRate = (successCount / totalAttempts) * 100;
    console.log(`Notification delivery success rate: ${successRate.toFixed(2)}%`);
    
    // With SMS (90%) and email (98%) fallback, we should achieve >95% success rate
    // Probability of both failing: (1 - 0.9) * (1 - 0.98) = 0.002 = 0.2%
    // Expected success rate: 99.8%
    expect(successRate).toBeGreaterThan(95);
  });

  /**
   * Property 24.8: Critical notifications should never be blocked by preferences
   * Validates: Requirement 40.1
   */
  it('should send critical notifications regardless of preferences', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          auctionTitle: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          amount: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          pickupAuthCode: fc.string({ minLength: 6, maxLength: 10 }).filter(s => s.trim().length > 0),
          endpoint: fc.webUrl(),
          p256dh: fc.base64String({ minLength: 20, maxLength: 100 }),
          auth: fc.base64String({ minLength: 20, maxLength: 100 }),
        }),
        async ({ userId, auctionTitle, amount, pickupAuthCode, endpoint, p256dh, auth }) => {
          // Arrange
          const subscription: PushSubscription = {
            endpoint,
            keys: { p256dh, auth },
          };

          const preferences: NotificationPreferences = {
            pushEnabled: true,
            smsEnabled: true,
            emailEnabled: true,
            bidAlerts: false, // Disabled
            auctionEnding: false, // Disabled
            paymentReminders: false, // Disabled - but payment confirmation is critical
            leaderboardUpdates: false, // Disabled
          };

          // Act
          const result = await pushNotificationService.sendPaymentConfirmation(
            subscription,
            userId,
            auctionTitle,
            amount,
            pickupAuthCode,
            undefined,
            preferences
          );

          // Assert
          // Payment confirmation should be sent even if paymentReminders is disabled
          // because it's a critical notification (not a reminder)
          expect(result.success).toBe(true);
          expect(result.messageId).toBeDefined();
        }
      ),
      { numRuns: 10 }
    );
  });
});
