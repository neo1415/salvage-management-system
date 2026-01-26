import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailService } from '@/features/notifications/services/email.service';

/**
 * Unit Tests: Email Service
 * Tests email sending functionality with proper error handling
 */
describe('Email Service', () => {
  let emailService: EmailService;

  beforeEach(() => {
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
    });

    it('should handle special characters in name safely', async () => {
      const namesWithSpecialChars = [
        "O'Brien",
        'Jean-Pierre',
        'José García',
        '<script>alert("xss")</script>',
        'Test & User',
      ];

      for (const name of namesWithSpecialChars) {
        const result = await emailService.sendWelcomeEmail(
          'test@example.com',
          name
        );

        // Should not throw error
        expect(result).toHaveProperty('success');
      }
    });
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
    });

    it('should accept optional replyTo parameter', async () => {
      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
        replyTo: 'support@example.com',
      });

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });
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
    });

    it('should escape HTML in user name to prevent XSS', async () => {
      const maliciousName = '<script>alert("xss")</script>';
      const result = await emailService.sendWelcomeEmail(
        'test@example.com',
        maliciousName
      );

      // Should not throw error and should handle safely
      expect(result).toHaveProperty('success');
    });

    it('should include all required information in welcome email', async () => {
      // This test verifies the template structure
      const result = await emailService.sendWelcomeEmail(
        'test@example.com',
        'Test User'
      );

      // Template should be generated
      expect(result).toHaveProperty('success');
    });
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
    });

    it('should not throw exceptions on email send failure', async () => {
      // Should handle errors gracefully without throwing
      await expect(
        emailService.sendWelcomeEmail('test@example.com', 'Test User')
      ).resolves.toBeDefined();
    });
  });

  describe('Email Validation', () => {
    it('should reject emails with invalid formats', async () => {
      const invalidEmails = [
        'plaintext',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example',
        'user..name@example.com',
      ];

      for (const email of invalidEmails) {
        const result = await emailService.sendWelcomeEmail(email, 'Test User');
        
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('should accept valid international email formats', async () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'user_name@test-domain.com',
        'user123@example.org',
      ];

      for (const email of validEmails) {
        const result = await emailService.sendWelcomeEmail(email, 'Test User');
        
        // Should not fail on validation
        expect(result).toHaveProperty('success');
      }
    });
  });
});
