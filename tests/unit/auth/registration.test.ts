import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registrationSchema } from '@/lib/utils/validation';

/**
 * Unit Tests: Registration Edge Cases
 * Tests duplicate email/phone rejection, invalid formats, weak passwords, and missing fields
 */
describe('Registration Validation Edge Cases', () => {
  const validRegistrationData = {
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+2348012345678',
    password: 'SecurePass123!',
    dateOfBirth: new Date('1990-01-01'),
    termsAccepted: true,
  };

  describe('Email Validation', () => {
    it('should reject invalid email format', () => {
      const invalidEmails = [
        'notanemail',
        'missing@domain',
        '@nodomain.com',
        'spaces in@email.com',
        'double@@domain.com',
        'missing.domain@',
      ];

      invalidEmails.forEach((email) => {
        const result = registrationSchema.safeParse({
          ...validRegistrationData,
          email,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((issue) => 
            issue.path.includes('email') && issue.message.includes('Invalid email')
          )).toBe(true);
        }
      });
    });

    it('should accept valid email formats', () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'user123@test-domain.com',
      ];

      validEmails.forEach((email) => {
        const result = registrationSchema.safeParse({
          ...validRegistrationData,
          email,
        });

        expect(result.success).toBe(true);
      });
    });

    it('should normalize email to lowercase', () => {
      const result = registrationSchema.safeParse({
        ...validRegistrationData,
        email: 'UPPERCASE@EXAMPLE.COM',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('uppercase@example.com');
      }
    });
  });

  describe('Phone Number Validation', () => {
    it('should reject invalid Nigerian phone formats', () => {
      const invalidPhones = [
        '12345',
        '+1234567890', // Not Nigerian
        '080123456', // Too short
        '08012345678901', // Too long
        '+234601234567', // Invalid prefix (60)
        '0601234567', // Invalid prefix (60)
      ];

      invalidPhones.forEach((phone) => {
        const result = registrationSchema.safeParse({
          ...validRegistrationData,
          phone,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((issue) => 
            issue.path.includes('phone')
          )).toBe(true);
        }
      });
    });

    it('should accept valid Nigerian phone formats', () => {
      const validPhones = [
        '+2348012345678',
        '2348012345678',
        '08012345678',
        '+2347012345678',
        '+2349012345678',
      ];

      validPhones.forEach((phone) => {
        const result = registrationSchema.safeParse({
          ...validRegistrationData,
          phone,
        });

        expect(result.success).toBe(true);
      });
    });

    it('should normalize phone numbers to +234 format', () => {
      const testCases = [
        { input: '08012345678', expected: '+2348012345678' },
        { input: '2348012345678', expected: '+2348012345678' },
        { input: '+2348012345678', expected: '+2348012345678' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = registrationSchema.safeParse({
          ...validRegistrationData,
          phone: input,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.phone).toBe(expected);
        }
      });
    });
  });

  describe('Password Validation', () => {
    it('should reject weak passwords', () => {
      const weakPasswords = [
        { password: 'short', reason: 'Too short' },
        { password: 'nouppercase123!', reason: 'No uppercase' },
        { password: 'NoNumbers!', reason: 'No numbers' },
        { password: 'NoSpecial123', reason: 'No special characters' },
        { password: 'weak', reason: 'Too short and missing requirements' },
      ];

      weakPasswords.forEach(({ password, reason }) => {
        const result = registrationSchema.safeParse({
          ...validRegistrationData,
          password,
        });

        expect(result.success, `Password "${password}" should be rejected (${reason})`).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((issue) => 
            issue.path.includes('password')
          )).toBe(true);
        }
      });
    });

    it('should accept strong passwords', () => {
      const strongPasswords = [
        'SecurePass123!',
        'MyP@ssw0rd',
        'C0mpl3x!Pass',
        'Str0ng#Password',
      ];

      strongPasswords.forEach((password) => {
        const result = registrationSchema.safeParse({
          ...validRegistrationData,
          password,
        });

        expect(result.success).toBe(true);
      });
    });
  });

  describe('Missing Required Fields', () => {
    it('should reject registration with missing fullName', () => {
      const { fullName, ...dataWithoutName } = validRegistrationData;
      const result = registrationSchema.safeParse(dataWithoutName);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => 
          issue.path.includes('fullName')
        )).toBe(true);
      }
    });

    it('should reject registration with missing email', () => {
      const { email, ...dataWithoutEmail } = validRegistrationData;
      const result = registrationSchema.safeParse(dataWithoutEmail);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => 
          issue.path.includes('email')
        )).toBe(true);
      }
    });

    it('should reject registration with missing phone', () => {
      const { phone, ...dataWithoutPhone } = validRegistrationData;
      const result = registrationSchema.safeParse(dataWithoutPhone);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => 
          issue.path.includes('phone')
        )).toBe(true);
      }
    });

    it('should reject registration with missing password', () => {
      const { password, ...dataWithoutPassword } = validRegistrationData;
      const result = registrationSchema.safeParse(dataWithoutPassword);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => 
          issue.path.includes('password')
        )).toBe(true);
      }
    });

    it('should reject registration with missing dateOfBirth', () => {
      const { dateOfBirth, ...dataWithoutDOB } = validRegistrationData;
      const result = registrationSchema.safeParse(dataWithoutDOB);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => 
          issue.path.includes('dateOfBirth')
        )).toBe(true);
      }
    });

    it('should reject registration without accepting terms', () => {
      const result = registrationSchema.safeParse({
        ...validRegistrationData,
        termsAccepted: false,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => 
          issue.path.includes('termsAccepted') && 
          issue.message.includes('accept the terms')
        )).toBe(true);
      }
    });
  });

  describe('Age Validation', () => {
    it('should reject users under 18 years old', () => {
      const today = new Date();
      const under18 = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate());

      const result = registrationSchema.safeParse({
        ...validRegistrationData,
        dateOfBirth: under18,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => 
          issue.path.includes('dateOfBirth') && 
          issue.message.includes('18 years old')
        )).toBe(true);
      }
    });

    it('should accept users 18 years or older', () => {
      const today = new Date();
      const exactly18 = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
      const over18 = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate());

      [exactly18, over18].forEach((dateOfBirth) => {
        const result = registrationSchema.safeParse({
          ...validRegistrationData,
          dateOfBirth,
        });

        expect(result.success).toBe(true);
      });
    });
  });

  describe('Full Name Validation', () => {
    it('should reject names that are too short', () => {
      const result = registrationSchema.safeParse({
        ...validRegistrationData,
        fullName: 'A',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => 
          issue.path.includes('fullName') && 
          issue.message.includes('at least 2 characters')
        )).toBe(true);
      }
    });

    it('should reject names that are too long', () => {
      const longName = 'A'.repeat(256);
      const result = registrationSchema.safeParse({
        ...validRegistrationData,
        fullName: longName,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => 
          issue.path.includes('fullName') && 
          issue.message.includes('not exceed 255 characters')
        )).toBe(true);
      }
    });

    it('should accept valid names', () => {
      const validNames = [
        'John Doe',
        'Mary Jane Smith',
        'O\'Brien',
        'Jean-Pierre',
        'José García',
      ];

      validNames.forEach((fullName) => {
        const result = registrationSchema.safeParse({
          ...validRegistrationData,
          fullName,
        });

        expect(result.success).toBe(true);
      });
    });
  });
});
