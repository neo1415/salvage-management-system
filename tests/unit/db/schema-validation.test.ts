import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property Test: Registration Input Validation
 * Validates: Requirements 1.2, 1.3, 1.4
 * 
 * This test verifies that the validation logic for user registration
 * correctly validates email format, phone format, and password requirements.
 */

// Email validation function
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Nigerian phone validation function
function isValidNigerianPhone(phone: string): boolean {
  // Nigerian phone numbers: +234XXXXXXXXXX or 0XXXXXXXXXX (11 digits after 0)
  const phoneRegex = /^(\+234|0)[789]\d{9}$/;
  return phoneRegex.test(phone);
}

// Password validation function
// Requirements: minimum 8 characters, 1 uppercase, 1 number, 1 special character
function isValidPassword(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false;
  return true;
}

describe('Property Test: Registration Input Validation', () => {
  describe('Email Validation (Requirement 1.3)', () => {
    it('should accept valid email formats', () => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          (email) => {
            expect(isValidEmail(email)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject emails without @ symbol', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('@')),
          (invalidEmail) => {
            expect(isValidEmail(invalidEmail)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject emails without domain', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}@`),
          (invalidEmail) => {
            expect(isValidEmail(invalidEmail)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Nigerian Phone Validation (Requirement 1.4)', () => {
    it('should accept valid Nigerian phone numbers with +234 prefix', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 7000000000, max: 9099999999 }),
          (phoneNumber) => {
            const phone = `+234${phoneNumber}`;
            expect(isValidNigerianPhone(phone)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid Nigerian phone numbers with 0 prefix', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 7000000000, max: 9099999999 }),
          (phoneNumber) => {
            const phone = `0${phoneNumber}`;
            expect(isValidNigerianPhone(phone)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject phone numbers with invalid prefixes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000000000, max: 6999999999 }),
          (phoneNumber) => {
            const phone = `0${phoneNumber}`;
            expect(isValidNigerianPhone(phone)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject phone numbers with incorrect length', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100000, max: 999999 }),
          (phoneNumber) => {
            const phone = `+234${phoneNumber}`;
            expect(isValidNigerianPhone(phone)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Password Validation (Requirement 1.2)', () => {
    it('should accept passwords meeting all requirements', () => {
      // Generator for valid passwords
      const validPasswordArb = fc.tuple(
        fc.string({ minLength: 5, maxLength: 10 }).filter(s => s.trim().length > 0), // base string with content
        fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'), // uppercase
        fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), // number
        fc.constantFrom('!', '@', '#', '$', '%', '^', '&', '*') // special char
      ).map(([base, upper, num, special]) => {
        // Ensure minimum 8 characters total (5 base + 1 upper + 1 num + 1 special = 8)
        return base + upper + num + special;
      });

      fc.assert(
        fc.property(validPasswordArb, (password) => {
          expect(isValidPassword(password)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject passwords shorter than 8 characters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 7 }),
          (shortPassword) => {
            expect(isValidPassword(shortPassword)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject passwords without uppercase letters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 8, maxLength: 20 })
            .filter(s => !/[A-Z]/.test(s)),
          (password) => {
            expect(isValidPassword(password)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject passwords without numbers', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 8, maxLength: 20 })
            .filter(s => !/[0-9]/.test(s)),
          (password) => {
            expect(isValidPassword(password)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject passwords without special characters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 8, maxLength: 20 })
            .filter(s => !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(s)),
          (password) => {
            expect(isValidPassword(password)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Combined Registration Data Validation', () => {
    it('should validate complete registration data', () => {
      const registrationDataArb = fc.record({
        email: fc.emailAddress(),
        phone: fc.integer({ min: 7000000000, max: 9099999999 }).map(n => `+234${n}`),
        password: fc.tuple(
          fc.string({ minLength: 5, maxLength: 10 }).filter(s => s.trim().length > 0), // base string with content
          fc.constantFrom('A', 'B', 'C', 'D', 'E'),
          fc.constantFrom('0', '1', '2', '3', '4'),
          fc.constantFrom('!', '@', '#', '$', '%')
        ).map(([base, upper, num, special]) => base + upper + num + special),
      });

      fc.assert(
        fc.property(registrationDataArb, (data) => {
          expect(isValidEmail(data.email)).toBe(true);
          expect(isValidNigerianPhone(data.phone)).toBe(true);
          expect(isValidPassword(data.password)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });
});
