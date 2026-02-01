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
// Generate a proper 32-byte key from the environment variable
const ENCRYPTION_KEY_STRING = process.env.BVN_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
// Ensure we have exactly 32 bytes for AES-256
const ENCRYPTION_KEY = crypto.createHash('sha256').update(ENCRYPTION_KEY_STRING).digest();
const IV_LENGTH = 16;

// Paystack configuration
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// Test mode BVN
const TEST_BVN = '12345678901';

/**
 * Check if we're in test mode (runtime check)
 */
function isTestMode(): boolean {
  return process.env.PAYSTACK_SECRET_KEY?.startsWith('sk_test_') || false;
}

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
}

export interface PaystackBVNResponse {
  status: boolean;
  message: string;
  data: {
    first_name: string;
    last_name: string;
    dob: string;
    formatted_dob: string;
    mobile: string;
    bvn: string;
  };
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

    // Test mode support
    if (isTestMode() && request.bvn === TEST_BVN) {
      console.log('[TEST MODE] BVN Verification:', {
        bvn: maskBVN(request.bvn),
        firstName: request.firstName,
        lastName: request.lastName,
        dateOfBirth: request.dateOfBirth,
        phone: request.phone,
      });

      return {
        success: true,
        verified: true,
        matchScore: 100,
        details: {
          firstName: request.firstName,
          lastName: request.lastName,
          dateOfBirth: request.dateOfBirth,
          phone: request.phone,
        },
      };
    }

    // Call Paystack BVN verification API
    const response = await fetch(`${PAYSTACK_BASE_URL}/bank/resolve_bvn/${request.bvn}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        verified: false,
        matchScore: 0,
        error: errorData.message || `Paystack API error: ${response.status}`,
      };
    }

    const paystackData: PaystackBVNResponse = await response.json();

    if (!paystackData.status || !paystackData.data) {
      return {
        success: false,
        verified: false,
        matchScore: 0,
        error: paystackData.message || 'BVN verification failed',
      };
    }

    // Perform matching with fuzzy logic for Nigerian names
    const matchResult = matchBVNDetails(request, paystackData.data);

    return {
      success: true,
      verified: matchResult.verified,
      matchScore: matchResult.matchScore,
      details: {
        firstName: paystackData.data.first_name,
        lastName: paystackData.data.last_name,
        dateOfBirth: paystackData.data.formatted_dob || paystackData.data.dob,
        phone: paystackData.data.mobile,
      },
      mismatches: matchResult.mismatches,
    };
  } catch (error) {
    console.error('BVN verification error:', error);
    return {
      success: false,
      verified: false,
      matchScore: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Match BVN details with fuzzy matching for Nigerian names
 * Handles common variations in Nigerian names
 */
function matchBVNDetails(
  request: BVNVerificationRequest,
  bvnData: PaystackBVNResponse['data']
): { verified: boolean; matchScore: number; mismatches: string[] } {
  const mismatches: string[] = [];
  let totalScore = 0;
  const weights = {
    firstName: 30,
    lastName: 30,
    dateOfBirth: 25,
    phone: 15,
  };

  // First name matching with fuzzy logic
  const firstNameScore = fuzzyMatchNigerianName(
    request.firstName,
    bvnData.first_name
  );
  totalScore += firstNameScore * weights.firstName / 100;
  if (firstNameScore < 70) {
    mismatches.push(`First name mismatch: "${request.firstName}" vs "${bvnData.first_name}"`);
  }

  // Last name matching with fuzzy logic
  const lastNameScore = fuzzyMatchNigerianName(
    request.lastName,
    bvnData.last_name
  );
  totalScore += lastNameScore * weights.lastName / 100;
  if (lastNameScore < 70) {
    mismatches.push(`Last name mismatch: "${request.lastName}" vs "${bvnData.last_name}"`);
  }

  // Date of birth matching (exact match required)
  const dobMatch = normalizeDateOfBirth(request.dateOfBirth) === normalizeDateOfBirth(bvnData.dob);
  if (dobMatch) {
    totalScore += weights.dateOfBirth;
  } else {
    mismatches.push(`Date of birth mismatch: "${request.dateOfBirth}" vs "${bvnData.dob}"`);
  }

  // Phone matching (last 10 digits)
  const phoneScore = matchPhoneNumbers(request.phone, bvnData.mobile);
  totalScore += phoneScore * weights.phone / 100;
  if (phoneScore < 80) {
    mismatches.push(`Phone mismatch: "${request.phone}" vs "${bvnData.mobile}"`);
  }

  // Verification threshold: 75% match score
  const verified = totalScore >= 75;

  return {
    verified,
    matchScore: Math.round(totalScore),
    mismatches: verified ? [] : mismatches,
  };
}

/**
 * Fuzzy match Nigerian names
 * Handles common variations: spaces, hyphens, apostrophes, case
 */
function fuzzyMatchNigerianName(name1: string, name2: string): number {
  // Normalize names
  const normalize = (name: string) =>
    name
      .toLowerCase()
      .trim()
      .replace(/['\-\s]/g, '');

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  // Exact match
  if (n1 === n2) return 100;

  // Check if one contains the other (common in Nigerian names)
  if (n1.includes(n2) || n2.includes(n1)) {
    const longer = Math.max(n1.length, n2.length);
    const shorter = Math.min(n1.length, n2.length);
    return Math.round((shorter / longer) * 100);
  }

  // Levenshtein distance for similarity
  const distance = levenshteinDistance(n1, n2);
  const maxLength = Math.max(n1.length, n2.length);
  const similarity = ((maxLength - distance) / maxLength) * 100;

  return Math.round(similarity);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Normalize date of birth to YYYY-MM-DD format
 */
function normalizeDateOfBirth(dob: string): string {
  // Handle various date formats
  const date = new Date(dob);
  if (isNaN(date.getTime())) return dob;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Match phone numbers (last 10 digits)
 */
function matchPhoneNumbers(phone1: string, phone2: string): number {
  // Extract digits only
  const digits1 = phone1.replace(/\D/g, '');
  const digits2 = phone2.replace(/\D/g, '');

  // Compare last 10 digits (Nigerian phone numbers)
  const last10_1 = digits1.slice(-10);
  const last10_2 = digits2.slice(-10);

  if (last10_1 === last10_2) return 100;

  // Partial match
  let matches = 0;
  for (let i = 0; i < 10; i++) {
    if (last10_1[i] === last10_2[i]) matches++;
  }

  return Math.round((matches / 10) * 100);
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
