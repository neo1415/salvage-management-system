import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { passwordSchema } from '@/lib/utils/validation';

/**
 * Property Test: Registration Input Validation (Password Requirements)
 * Validates: Requirement 1.2
 * 
 * This test verifies that password validation correctly enforces:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 number
 * - At least 1 special character
 */
describe('Password Validation Property Tests', () => {
  it('should accept valid passwords that meet all requirements', () => {
    fc.assert(
      fc.property(
        // Generate valid passwords with guaranteed minimum length
        fc.record({
          lowercase: fc.stringMatching(/^[a-z]{3,10}$/), // At least 3 lowercase
          uppercase: fc.stringMatching(/^[A-Z]{1,3}$/),  // At least 1 uppercase
          numbers: fc.stringMatching(/^[0-9]{1,3}$/),    // At least 1 number
          special: fc.stringMatching(/^[!@#$%^&*]{1,3}$/), // At least 1 special
        }).map(({ lowercase, uppercase, numbers, special }) => {
          // Concatenate all parts to ensure minimum 8 characters (3+1+1+1=6, need padding)
          const basePassword = lowercase + uppercase + numbers + special;
          
          // If password is less than 8 characters, pad with more lowercase
          if (basePassword.length < 8) {
            return basePassword + 'ab'; // Add padding to reach 8 chars
          }
          
          return basePassword;
        }),
        (password) => {
          // Verify password meets minimum length
          expect(password.length).toBeGreaterThanOrEqual(8);
          
          // Password should be valid
          const result = passwordSchema.safeParse(password);
          
          if (!result.success) {
            console.error('Generated password:', password);
            console.error('Validation errors:', result.error.issues);
          }
          
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject passwords shorter than 8 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 7 }),
        (shortPassword) => {
          const result = passwordSchema.safeParse(shortPassword);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some((issue) => 
              issue.message.includes('at least 8 characters')
            )).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject passwords without uppercase letters', () => {
    fc.assert(
      fc.property(
        // Generate passwords with lowercase, numbers, and special chars but NO uppercase
        fc.record({
          lowercase: fc.stringMatching(/^[a-z]{4,10}$/),
          numbers: fc.stringMatching(/^[0-9]{1,5}$/),
          special: fc.stringMatching(/^[!@#$%^&*]{1,5}$/),
        }).map(({ lowercase, numbers, special }) => lowercase + numbers + special),
        (password) => {
          // Skip if password is too short (we're testing uppercase requirement specifically)
          if (password.length < 8) return;
          
          const result = passwordSchema.safeParse(password);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some((issue) => 
              issue.message.includes('uppercase')
            )).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject passwords without numbers', () => {
    fc.assert(
      fc.property(
        // Generate passwords with lowercase, uppercase, and special chars but NO numbers
        fc.record({
          lowercase: fc.stringMatching(/^[a-z]{4,10}$/),
          uppercase: fc.stringMatching(/^[A-Z]{1,5}$/),
          special: fc.stringMatching(/^[!@#$%^&*]{1,5}$/),
        }).map(({ lowercase, uppercase, special }) => lowercase + uppercase + special),
        (password) => {
          // Skip if password is too short (we're testing number requirement specifically)
          if (password.length < 8) return;
          
          const result = passwordSchema.safeParse(password);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some((issue) => 
              issue.message.includes('number')
            )).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject passwords without special characters', () => {
    fc.assert(
      fc.property(
        // Generate passwords with lowercase, uppercase, and numbers but NO special chars
        fc.record({
          lowercase: fc.stringMatching(/^[a-z]{4,10}$/),
          uppercase: fc.stringMatching(/^[A-Z]{1,5}$/),
          numbers: fc.stringMatching(/^[0-9]{1,5}$/),
        }).map(({ lowercase, uppercase, numbers }) => lowercase + uppercase + numbers),
        (password) => {
          // Skip if password is too short (we're testing special char requirement specifically)
          if (password.length < 8) return;
          
          const result = passwordSchema.safeParse(password);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some((issue) => 
              issue.message.includes('special character')
            )).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should validate that all password requirements are independent', () => {
    // Property: Each requirement should be checked independently
    fc.assert(
      fc.property(
        fc.record({
          hasMinLength: fc.boolean(),
          hasUppercase: fc.boolean(),
          hasNumber: fc.boolean(),
          hasSpecial: fc.boolean(),
        }),
        ({ hasMinLength, hasUppercase, hasNumber, hasSpecial }) => {
          // Build password based on flags
          let password = 'abc'; // Start with lowercase
          
          if (hasMinLength) {
            password += 'defgh'; // Make it 8+ chars
          }
          
          if (hasUppercase) {
            password += 'A';
          }
          
          if (hasNumber) {
            password += '1';
          }
          
          if (hasSpecial) {
            password += '!';
          }
          
          const result = passwordSchema.safeParse(password);
          const shouldBeValid = hasMinLength && hasUppercase && hasNumber && hasSpecial;
          
          expect(result.success).toBe(shouldBeValid);
          
          if (!result.success) {
            // Verify that the error messages match the missing requirements
            const errors = result.error.issues.map((issue) => issue.message);
            
            if (!hasMinLength) {
              expect(errors.some((msg) => msg.includes('8 characters'))).toBe(true);
            }
            if (!hasUppercase) {
              expect(errors.some((msg) => msg.includes('uppercase'))).toBe(true);
            }
            if (!hasNumber) {
              expect(errors.some((msg) => msg.includes('number'))).toBe(true);
            }
            if (!hasSpecial) {
              expect(errors.some((msg) => msg.includes('special character'))).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
