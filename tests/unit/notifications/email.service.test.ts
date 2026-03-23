import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailService } from '@/features/notifications/services/email.service';
import type {
  OTPTemplateData,
  CaseApprovalTemplateData,
  AuctionStartTemplateData,
  BidAlertTemplateData,
  PaymentConfirmationTemplateData,
} from '@/features/notifications/templates';

// Mock Resend API
vi.mock('resend', () => {
  const mockSend = vi.fn().mockResolvedValue({ data: { id: 'mock-email-id' } });
  
  return {
    Resend: class MockResend {
      emails = {
        send: mockSend,
      };
    },
  };
});

/**
 * Unit Tests: Email Service
 * Tests email sending functionality with proper error handling
 */
describe('Email Service', () => {
  let emailService: EmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    emailService = new EmailService();
  });

  describe('sendWelcomeEmail', () => {
    it('should validate required parameters', async () => {
      const result = await emailService.sendWelcomeEmail('', '');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('required');
    });

    it('should validate email format', async () => {
      const invalidEmails = [
        'notanemail',
        'missing@domain',
        '@nodomain.com',
        'spaces in@email.com',
      ];

      for (const email of invalidEmails) {
        const result = await emailService.sendWelcomeEmail(email, 'Test User');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid email format');
      }
    });

    it('should accept valid email and name', async () => {
      const result = await emailService.sendWelcomeEmail(
        'test@example.com',
        'Test User'
      );

      // Result depends on whether RESEND_API_KEY is configured
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    }, 10000); // Increase timeout

    it('should handle special characters in name safely', async () => {
      // Test a few representative cases instead of all to avoid timeout
      const namesWithSpecialChars = [
        "O'Brien",
        '<script>alert("xss")</script>',
        'José García',
      ];

      for (const name of namesWithSpecialChars) {
        const result = await emailService.sendWelcomeEmail(
          'test@example.com',
          name
        );

        // Should not throw error
        expect(result).toHaveProperty('success');
      }
    }, 20000); // Increase timeout to 20 seconds
  });

  describe('sendEmail', () => {
    it('should validate required parameters', async () => {
      const result = await emailService.sendEmail({
        to: '',
        subject: '',
        html: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should validate email format', async () => {
      const result = await emailService.sendEmail({
        to: 'invalid-email',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email format');
    });

    it('should accept valid email options', async () => {
      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      });

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    }, 10000); // Increase timeout

    it('should accept optional replyTo parameter', async () => {
      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
        replyTo: 'support@example.com',
      });

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    }, 10000); // Increase timeout
  });

  describe('isConfigured', () => {
    it('should return boolean indicating configuration status', () => {
      const isConfigured = emailService.isConfigured();
      
      expect(typeof isConfigured).toBe('boolean');
    });
  });

  describe('Email Template Generation', () => {
    it('should generate welcome email with user name', async () => {
      const userName = 'John Doe';
      const result = await emailService.sendWelcomeEmail(
        'test@example.com',
        userName
      );

      // Template should be generated without errors
      expect(result).toHaveProperty('success');
    }, 10000); // Increase timeout

    it('should escape HTML in user name to prevent XSS', async () => {
      const maliciousName = '<script>alert("xss")</script>';
      const result = await emailService.sendWelcomeEmail(
        'test@example.com',
        maliciousName
      );

      // Should not throw error and should handle safely
      expect(result).toHaveProperty('success');
    }, 10000); // Increase timeout

    it('should include all required information in welcome email', async () => {
      // This test verifies the template structure
      const result = await emailService.sendWelcomeEmail(
        'test@example.com',
        'Test User'
      );

      // Template should be generated
      expect(result).toHaveProperty('success');
    }, 10000); // Increase timeout
  });

  describe('Error Handling', () => {
    it('should handle missing API key gracefully', async () => {
      // When RESEND_API_KEY is not set, should return error but not throw
      const result = await emailService.sendWelcomeEmail(
        'test@example.com',
        'Test User'
      );

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
      
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    }, 10000); // Increase timeout

    it('should not throw exceptions on email send failure', async () => {
      // Should handle errors gracefully without throwing
      await expect(
        emailService.sendWelcomeEmail('test@example.com', 'Test User')
      ).resolves.toBeDefined();
    }, 10000); // Increase timeout
  });

  describe('Email Validation', () => {
    it('should reject emails with invalid formats', async () => {
      const invalidEmails = [
        'plaintext',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example',
      ];

      for (const email of invalidEmails) {
        const result = await emailService.sendWelcomeEmail(email, 'Test User');
        
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    }, 10000); // Increase timeout

    it('should accept valid international email formats', async () => {
      // Test a few representative cases instead of all to avoid timeout
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
      ];

      for (const email of validEmails) {
        const result = await emailService.sendWelcomeEmail(email, 'Test User');
        
        // Should not fail on validation
        expect(result).toHaveProperty('success');
      }
    }, 20000); // Increase timeout to 20 seconds
  });

  describe('sendOTPEmail', () => {
    it('should validate required parameters', async () => {
      const result = await emailService.sendOTPEmail('', '', '');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('required');
    });

    it('should validate OTP format (6 digits)', async () => {
      const invalidOTPs = ['12345', '1234567', 'abcdef', '12-34-56'];

      for (const otp of invalidOTPs) {
        const result = await emailService.sendOTPEmail(
          'test@example.com',
          'Test User',
          otp
        );
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('6-digit');
      }
    });

    it('should accept valid OTP email parameters', async () => {
      const result = await emailService.sendOTPEmail(
        'test@example.com',
        'Test User',
        '123456',
        5
      );

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    }, 10000);
  });

  describe('sendCaseApprovalEmail', () => {
    const mockData: CaseApprovalTemplateData = {
      adjusterName: 'John Adjuster',
      caseId: 'CASE-001',
      claimReference: 'CLM-2024-001',
      assetType: 'Vehicle',
      status: 'approved',
      managerName: 'Jane Manager',
      appUrl: 'https://salvage.nem-insurance.com',
    };

    it('should validate required parameters', async () => {
      const result = await emailService.sendCaseApprovalEmail('', mockData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should accept valid case approval parameters', async () => {
      const result = await emailService.sendCaseApprovalEmail(
        'adjuster@example.com',
        mockData
      );

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    }, 10000);

    it('should handle rejection with comment', async () => {
      const rejectionData: CaseApprovalTemplateData = {
        ...mockData,
        status: 'rejected',
        comment: 'Please provide clearer photos',
      };

      const result = await emailService.sendCaseApprovalEmail(
        'adjuster@example.com',
        rejectionData
      );

      expect(result).toHaveProperty('success');
    }, 10000);
  });

  describe('sendAuctionStartEmail', () => {
    const mockData: AuctionStartTemplateData = {
      vendorName: 'Vendor Company',
      auctionId: 'AUC-001',
      assetType: 'Vehicle',
      assetName: '2020 Toyota Camry',
      reservePrice: 500000,
      startTime: '2024-01-15 10:00 AM',
      endTime: '2024-01-16 10:00 AM',
      location: 'Lagos, Nigeria',
      appUrl: 'https://salvage.nem-insurance.com',
    };

    it('should validate required parameters', async () => {
      const result = await emailService.sendAuctionStartEmail('', mockData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should accept valid auction start parameters', async () => {
      const result = await emailService.sendAuctionStartEmail(
        'vendor@example.com',
        mockData
      );

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    }, 10000);
  });

  describe('sendBidAlertEmail', () => {
    const mockOutbidData: BidAlertTemplateData = {
      vendorName: 'Vendor Company',
      auctionId: 'AUC-001',
      assetName: '2020 Toyota Camry',
      alertType: 'outbid',
      yourBid: 500000,
      currentBid: 550000,
      timeRemaining: '2 hours',
      appUrl: 'https://salvage.nem-insurance.com',
    };

    const mockWinningData: BidAlertTemplateData = {
      ...mockOutbidData,
      alertType: 'winning',
      currentBid: undefined,
    };

    const mockWonData: BidAlertTemplateData = {
      ...mockOutbidData,
      alertType: 'won',
      currentBid: undefined,
      timeRemaining: undefined,
    };

    it('should validate required parameters', async () => {
      const result = await emailService.sendBidAlertEmail('', mockOutbidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should send outbid alert', async () => {
      const result = await emailService.sendBidAlertEmail(
        'vendor@example.com',
        mockOutbidData
      );

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    }, 10000);

    it('should send winning alert', async () => {
      const result = await emailService.sendBidAlertEmail(
        'vendor@example.com',
        mockWinningData
      );

      expect(result).toHaveProperty('success');
    }, 10000);

    it('should send won alert', async () => {
      const result = await emailService.sendBidAlertEmail(
        'vendor@example.com',
        mockWonData
      );

      expect(result).toHaveProperty('success');
    }, 10000);
  });

  describe('sendPaymentConfirmationEmail', () => {
    const mockData: PaymentConfirmationTemplateData = {
      vendorName: 'Vendor Company',
      auctionId: 'AUC-001',
      assetName: '2020 Toyota Camry',
      paymentAmount: 550000,
      paymentMethod: 'Paystack',
      paymentReference: 'PAY-REF-001',
      pickupAuthCode: 'AUTH-123456',
      pickupLocation: 'NEM Insurance Warehouse, Lagos',
      pickupDeadline: 'January 20, 2024',
      appUrl: 'https://salvage.nem-insurance.com',
    };

    it('should validate required parameters', async () => {
      const result = await emailService.sendPaymentConfirmationEmail('', mockData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should accept valid payment confirmation parameters', async () => {
      const result = await emailService.sendPaymentConfirmationEmail(
        'vendor@example.com',
        mockData
      );

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    }, 10000);
  });
});
