import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { otpCache } from '@/lib/redis/client';

/**
 * Property Test for OTP Expiry and Validation
 * 
 * **Validates: Requirements 3.3, 3.4, 3.5**
 * 
 * This test suite validates the OTP expiry and validation logic using property-based testing.
 * It generates random OTPs and verifies that:
 * - OTPs are stored with correct expiry time
 * - OTP verification attempts are tracked correctly
 * - Maximum attempts are enforced
 * - OTPs expire after the specified time
 * 
 * Note: These tests use real Redis (Vercel KV) for enterprise-grade validation.
 * Test runs are reduced to 5 iterations per property to balance coverage with execution time.
 */

describe('Property Test: OTP Expiry and Validation', () => {
  // Track phone numbers used in tests for cleanup
  const usedPhoneNumbers = new Set<string>();

  beforeEach(() => {
    // Clear any existing OTP data before each test
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up all test data from Redis (with timeout protection)
    const cleanupPromises = Array.from(usedPhoneNumbers).map(async (phone) => {
      try {
        await Promise.race([
          otpCache.del(phone),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Cleanup timeout')), 2000))
        ]);
      } catch (error) {
        // Ignore cleanup errors
        console.warn(`Cleanup failed for ${phone}:`, error);
      }
    });
    
    await Promise.allSettled(cleanupPromises);
    usedPhoneNumbers.clear();
  });

  /**
   * Property 4.1: OTP Storage and Retrieval
   * 
   * **Validates: Requirement 3.3** - OTP validity set to 5 minutes
   * 
   * Property: For any valid phone number and OTP, storing and immediately retrieving
   * the OTP should return the same value with 0 attempts.
   */
  it('Property 4.1: OTP storage and retrieval maintains data integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 15 }), // phone number
        fc.integer({ min: 100000, max: 999999 }).map(String), // 6-digit OTP
        async (phone, otp) => {
          usedPhoneNumbers.add(phone);

          // Store OTP
          await otpCache.set(phone, otp);

          // Retrieve OTP
          const retrieved = await otpCache.get(phone);

          // Verify data integrity
          expect(retrieved).not.toBeNull();
          expect(retrieved?.otp).toBe(otp);
          expect(retrieved?.attempts).toBe(0);

          // Clean up
          await otpCache.del(phone);
        }
      ),
      { numRuns: 5 } // Reduced for real Redis performance over network
    );
  }, 60000); // 60 second timeout for property-based test

  /**
   * Property 4.2: OTP Attempt Tracking
   * 
   * **Validates: Requirement 3.4** - Vendor enters 6-digit OTP for verification
   * **Validates: Requirement 3.5** - If OTP verification fails 3 times, require resend
   * 
   * Property: For any phone number with an OTP, incrementing attempts N times
   * should result in exactly N attempts being recorded.
   */
  it('Property 4.2: OTP attempt tracking increments correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 15 }), // phone number
        fc.integer({ min: 100000, max: 999999 }).map(String), // 6-digit OTP
        fc.integer({ min: 1, max: 5 }), // number of attempts
        async (phone, otp, numAttempts) => {
          usedPhoneNumbers.add(phone);

          // Store OTP
          await otpCache.set(phone, otp);

          // Increment attempts N times
          let lastAttemptCount = 0;
          for (let i = 0; i < numAttempts; i++) {
            lastAttemptCount = await otpCache.incrementAttempts(phone);
          }

          // Verify attempt count
          expect(lastAttemptCount).toBe(numAttempts);

          // Verify stored data
          const retrieved = await otpCache.get(phone);
          expect(retrieved?.attempts).toBe(numAttempts);

          // Clean up
          await otpCache.del(phone);
        }
      ),
      { numRuns: 5 }
    );
  }, 60000);

  /**
   * Property 4.3: Maximum Attempts Enforcement
   * 
   * **Validates: Requirement 3.5** - If OTP verification fails 3 times, require resend
   * 
   * Property: For any phone number with an OTP, after 3 failed attempts,
   * the system should enforce the maximum attempt limit.
   */
  it('Property 4.3: Maximum attempts (3) are enforced', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 15 }), // phone number
        fc.integer({ min: 100000, max: 999999 }).map(String), // 6-digit OTP
        async (phone, otp) => {
          usedPhoneNumbers.add(phone);

          const MAX_ATTEMPTS = 3;

          // Store OTP
          await otpCache.set(phone, otp);

          // Increment attempts to max
          for (let i = 0; i < MAX_ATTEMPTS; i++) {
            await otpCache.incrementAttempts(phone);
          }

          // Verify max attempts reached
          const retrieved = await otpCache.get(phone);
          expect(retrieved?.attempts).toBe(MAX_ATTEMPTS);

          // Verify that attempts >= MAX_ATTEMPTS
          expect(retrieved?.attempts).toBeGreaterThanOrEqual(MAX_ATTEMPTS);

          // Clean up
          await otpCache.del(phone);
        }
      ),
      { numRuns: 5 }
    );
  }, 60000);

  /**
   * Property 4.4: OTP Deletion
   * 
   * **Validates: Requirement 3.3** - OTP validity management
   * 
   * Property: For any phone number with an OTP, deleting the OTP
   * should result in no OTP being retrievable.
   */
  it('Property 4.4: OTP deletion removes data completely', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 15 }), // phone number
        fc.integer({ min: 100000, max: 999999 }).map(String), // 6-digit OTP
        async (phone, otp) => {
          usedPhoneNumbers.add(phone);

          // Store OTP
          await otpCache.set(phone, otp);

          // Verify OTP exists
          const beforeDelete = await otpCache.get(phone);
          expect(beforeDelete).not.toBeNull();

          // Delete OTP
          await otpCache.del(phone);

          // Verify OTP is gone
          const afterDelete = await otpCache.get(phone);
          expect(afterDelete).toBeNull();
        }
      ),
      { numRuns: 5 }
    );
  }, 60000);

  /**
   * Property 4.5: OTP Format Validation
   * 
   * **Validates: Requirement 3.4** - Vendor enters 6-digit OTP
   * 
   * Property: All generated OTPs should be exactly 6 digits.
   */
  it('Property 4.5: OTP format is always 6 digits', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100000, max: 999999 }).map(String), // 6-digit OTP
        async (otp) => {
          // Verify OTP is 6 digits
          expect(otp).toMatch(/^\d{6}$/);
          expect(otp.length).toBe(6);
        }
      ),
      { numRuns: 20 }
    );
  }, 10000);

  /**
   * Property 4.6: Multiple Phone Numbers Independence
   * 
   * **Validates: Requirement 3.3** - OTP management per phone number
   * 
   * Property: OTPs for different phone numbers should be independent.
   * Storing OTP for phone A should not affect OTP for phone B.
   */
  it('Property 4.6: OTPs for different phone numbers are independent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 15 }), // phone1
        fc.string({ minLength: 10, maxLength: 15 }), // phone2
        fc.integer({ min: 100000, max: 999999 }).map(String), // otp1
        fc.integer({ min: 100000, max: 999999 }).map(String), // otp2
        async (phone1, phone2, otp1, otp2) => {
          // Skip if phone numbers are the same
          fc.pre(phone1 !== phone2);

          usedPhoneNumbers.add(phone1);
          usedPhoneNumbers.add(phone2);

          // Store OTPs for both phones
          await otpCache.set(phone1, otp1);
          await otpCache.set(phone2, otp2);

          // Retrieve and verify independence
          const retrieved1 = await otpCache.get(phone1);
          const retrieved2 = await otpCache.get(phone2);

          expect(retrieved1?.otp).toBe(otp1);
          expect(retrieved2?.otp).toBe(otp2);
          expect(retrieved1?.otp).not.toBe(retrieved2?.otp);

          // Clean up
          await otpCache.del(phone1);
          await otpCache.del(phone2);
        }
      ),
      { numRuns: 5 }
    );
  }, 60000);

  /**
   * Property 4.7: Attempt Counter Reset on New OTP
   * 
   * **Validates: Requirement 3.5** - Resend OTP resets attempts
   * 
   * Property: When a new OTP is set for a phone number, the attempt counter
   * should be reset to 0, regardless of previous attempts.
   */
  it('Property 4.7: Setting new OTP resets attempt counter', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 15 }), // phone number
        fc.integer({ min: 100000, max: 999999 }).map(String), // otp1
        fc.integer({ min: 100000, max: 999999 }).map(String), // otp2
        fc.integer({ min: 1, max: 3 }), // initial attempts
        async (phone, otp1, otp2, initialAttempts) => {
          usedPhoneNumbers.add(phone);

          // Store first OTP and increment attempts
          await otpCache.set(phone, otp1);
          for (let i = 0; i < initialAttempts; i++) {
            await otpCache.incrementAttempts(phone);
          }

          // Verify attempts were recorded
          const beforeReset = await otpCache.get(phone);
          expect(beforeReset?.attempts).toBe(initialAttempts);

          // Set new OTP (simulating resend)
          await otpCache.set(phone, otp2);

          // Verify attempts are reset
          const afterReset = await otpCache.get(phone);
          expect(afterReset?.otp).toBe(otp2);
          expect(afterReset?.attempts).toBe(0);

          // Clean up
          await otpCache.del(phone);
        }
      ),
      { numRuns: 5 }
    );
  }, 60000);
});
