/**
 * NIN Verification Service
 * Verifies National Identification Number against government database
 */

export interface NINVerificationResult {
  verified: boolean;
  fullName: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  message: string;
}

/**
 * Verify NIN against government database
 * Note: This is a mock implementation. In production, integrate with NIMC API
 */
export async function verifyNIN(
  nin: string,
  fullName: string,
  dateOfBirth: string
): Promise<NINVerificationResult> {
  try {
    // Validate NIN format (11 digits)
    if (!/^\d{11}$/.test(nin)) {
      return {
        verified: false,
        fullName: null,
        dateOfBirth: null,
        phone: null,
        message: 'Invalid NIN format. Must be 11 digits.',
      };
    }

    // TODO: In production, call actual NIMC API
    // For now, we'll use a mock verification
    
    // Test NIN for development: 12345678901
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      if (nin === '12345678901') {
        return {
          verified: true,
          fullName: 'Test User',
          dateOfBirth: '1990-01-01',
          phone: '08012345678',
          message: 'NIN verified successfully (test mode)',
        };
      }
    }

    // Mock verification logic
    // In production, this would call the NIMC API
    const mockVerified = true; // Assume verification passes for now
    
    if (mockVerified) {
      return {
        verified: true,
        fullName,
        dateOfBirth,
        phone: null,
        message: 'NIN verified successfully',
      };
    }

    return {
      verified: false,
      fullName: null,
      dateOfBirth: null,
      phone: null,
      message: 'NIN verification failed. Details do not match.',
    };
  } catch (error) {
    console.error('Error verifying NIN:', error);
    throw new Error('Failed to verify NIN');
  }
}

/**
 * Validate NIN format
 */
export function isValidNINFormat(nin: string): boolean {
  return /^\d{11}$/.test(nin);
}
