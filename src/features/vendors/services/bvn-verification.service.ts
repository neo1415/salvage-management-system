import crypto from 'crypto';

/**
 * BVN Verification Service
 * 
 * Handles BVN verification using Paystack Identity API
 * Implements encryption, decryption, and masking for BVN security
 * 
 * Cost: ₦50 per verification (vs Mono ₦100)
 */

// Encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
// Generate a proper 32-byte key from an explicit environment variable.
// Never fall back to a random key, because encrypted BVNs would become unreadable after restart.
const ENCRYPTION_KEY_STRING = process.env.BVN_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY_STRING) {
  throw new Error('BVN_ENCRYPTION_KEY or ENCRYPTION_KEY environment variable is required');
}
// Ensure we have exactly 32 bytes for AES-256
const ENCRYPTION_KEY = crypto.createHash('sha256').update(ENCRYPTION_KEY_STRING).digest();
const IV_LENGTH = 16;

export interface BVNVerificationRequest {
  bvn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // Format: YYYY-MM-DD
  phone: string;
}

export interface BVNVerificationResponse {
  success: boolean;
  verified: boolean;
  matchScore: number; // 0-100
  details?: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    phone: string;
  };
  mismatches?: string[];
  error?: string;
  provider?: 'dojah';
  providerReference?: string;
  providerRawResponse?: unknown;
}

/**
 * Verify BVN using Paystack Identity API
 * Implements fuzzy matching for Nigerian names
 */
export async function verifyBVN(request: BVNVerificationRequest): Promise<BVNVerificationResponse> {
  try {
    // Validate BVN format (11 digits)
    if (!request.bvn || !/^\d{11}$/.test(request.bvn)) {
      return {
        success: false,
        verified: false,
        matchScore: 0,
        error: 'Invalid BVN format. BVN must be 11 digits.',
      };
    }

    const { getDojahService } = await import('@/features/kyc/services/dojah.service');
    const providerReference = `tier1-bvn-${crypto.randomUUID()}`;
    const dojahData = await getDojahService().validateBVN({
      bvn: request.bvn,
      firstName: request.firstName,
      lastName: request.lastName,
      dateOfBirth: request.dateOfBirth,
      customerReference: providerReference,
    });

    const entity = dojahData.entity;
    const matchResult = matchDojahBVNDetails({
      bvnValid: entity?.bvn?.status === true,
      firstNameValid: entity?.first_name?.status !== false,
      lastNameValid: entity?.last_name?.status !== false,
      dobValid: entity?.dob?.status !== false,
      firstNameConfidence: entity?.first_name?.confidence_value,
      lastNameConfidence: entity?.last_name?.confidence_value,
    });

    return {
      success: true,
      verified: matchResult.verified,
      matchScore: matchResult.matchScore,
      details: {
        firstName: request.firstName,
        lastName: request.lastName,
        dateOfBirth: request.dateOfBirth,
        phone: request.phone,
      },
      mismatches: matchResult.mismatches,
      provider: 'dojah',
      providerReference,
      providerRawResponse: dojahData,
    };
  } catch (error) {
    console.error('[BVN Verification] Exception caught:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : undefined,
    });
    return {
      success: false,
      verified: false,
      matchScore: 0,
      error: 'BVN Service Unavailable',
    };
  }
}

function matchDojahBVNDetails(input: {
  bvnValid: boolean;
  firstNameConfidence?: number | null;
  lastNameConfidence?: number | null;
  firstNameValid: boolean;
  lastNameValid: boolean;
  dobValid: boolean;
}): { verified: boolean; matchScore: number; mismatches: string[] } {
  const mismatches: string[] = [];
  let totalScore = 0;

  if (input.bvnValid) totalScore += 40;
  else mismatches.push('BVN could not be validated');

  const firstNameScore = input.firstNameValid ? input.firstNameConfidence ?? 100 : input.firstNameConfidence ?? 0;
  const lastNameScore = input.lastNameValid ? input.lastNameConfidence ?? 100 : input.lastNameConfidence ?? 0;
  totalScore += Math.min(100, Math.max(0, firstNameScore)) * 0.25;
  totalScore += Math.min(100, Math.max(0, lastNameScore)) * 0.25;

  if (!input.firstNameValid || firstNameScore < 70) {
    mismatches.push('First name did not match BVN records');
  }
  if (!input.lastNameValid || lastNameScore < 70) {
    mismatches.push('Last name did not match BVN records');
  }

  if (input.dobValid) totalScore += 10;
  else mismatches.push('Date of birth did not match BVN records');

  return {
    verified: input.bvnValid && totalScore >= 75 && mismatches.length === 0,
    matchScore: Math.round(totalScore),
    mismatches,
  };
}

/**
 * Encrypt BVN using AES-256
 */
export function encryptBVN(bvn: string): string {
  try {
    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher with the 32-byte key
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);

    // Encrypt
    let encrypted = cipher.update(bvn, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return IV + encrypted data
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('BVN encryption error:', error);
    throw new Error('Failed to encrypt BVN');
  }
}

/**
 * Decrypt BVN using AES-256
 */
export function decryptBVN(encryptedBVN: string): string {
  try {
    // Split IV and encrypted data
    const parts = encryptedBVN.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted BVN format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    // Create decipher with the 32-byte key
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);

    // Decrypt
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('BVN decryption error:', error);
    throw new Error('Failed to decrypt BVN');
  }
}

/**
 * Mask BVN to show only last 4 digits
 * Example: 12345678901 -> *******8901
 */
export function maskBVN(bvn: string): string {
  if (!bvn || bvn.length < 4) return '****';

  const last4 = bvn.slice(-4);
  const masked = '*'.repeat(bvn.length - 4) + last4;

  return masked;
}
