import crypto from 'crypto';
import { normalizeNigerianPhone } from '@/lib/utils/validation';
import { normalizeIdentityDate } from '@/features/kyc/utils/validation';

/**
 * BVN Verification Service
 *
 * Tier 1: Dojah BVN match (first / middle / last / DOB) + phone check via BVN lookup.
 */

const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY_STRING = process.env.BVN_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY_STRING) {
  throw new Error('BVN_ENCRYPTION_KEY or ENCRYPTION_KEY environment variable is required');
}
const ENCRYPTION_KEY = crypto.createHash('sha256').update(ENCRYPTION_KEY_STRING).digest();
const IV_LENGTH = 16;

export interface BVNVerificationRequest {
  bvn: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  phone: string;
}

export interface BVNVerificationResponse {
  success: boolean;
  verified: boolean;
  matchScore: number;
  details?: {
    firstName: string;
    middleName?: string;
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

function normalizeDob(value: string): string | null {
  return normalizeIdentityDate(value);
}

function phonesMatch(registered: string, bvnPhone: string): boolean {
  try {
    return normalizeNigerianPhone(registered) === normalizeNigerianPhone(bvnPhone);
  } catch {
    const strip = (p: string) => p.replace(/\D/g, '').slice(-10);
    return strip(registered) === strip(bvnPhone);
  }
}

export async function verifyBVN(request: BVNVerificationRequest): Promise<BVNVerificationResponse> {
  try {
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
    const dojah = getDojahService();

    const dojahData = await dojah.validateBVN({
      bvn: request.bvn,
      firstName: request.firstName,
      middleName: request.middleName,
      lastName: request.lastName,
      dateOfBirth: request.dateOfBirth,
      customerReference: providerReference,
    });

    const entity = dojahData.entity;
    let matchResult = matchDojahBVNDetails({
      bvnValid: entity?.bvn?.status === true,
      firstNameStatus: entity?.first_name?.status ?? undefined,
      lastNameStatus: entity?.last_name?.status ?? undefined,
      middleNameStatus: entity?.middle_name?.status ?? undefined,
      dobValid: entity?.dob?.status !== false,
      firstNameConfidence: entity?.first_name?.confidence_value,
      lastNameConfidence: entity?.last_name?.confidence_value,
      middleNameConfidence: entity?.middle_name?.confidence_value,
      hasMiddleNameInput: Boolean(request.middleName?.trim()),
      hasMiddleNameResult: Boolean(entity?.middle_name),
    });

    if (matchResult.verified) {
      try {
        const lookup = await dojah.lookupBVN(request.bvn);
        const lookupEntity = lookup.entity;
        const regDob = normalizeDob(request.dateOfBirth);
        const bvnDob = lookupEntity.date_of_birth
          ? normalizeDob(String(lookupEntity.date_of_birth))
          : null;

        if (bvnDob && regDob && bvnDob !== regDob) {
          matchResult.mismatches.push('Date of birth did not match BVN records');
        }

        const bvnPhone = lookupEntity.phone_number1;
        if (bvnPhone && !phonesMatch(request.phone, bvnPhone)) {
          matchResult.mismatches.push('Phone number did not match BVN records');
        }
      } catch (lookupErr) {
        console.warn('[BVN Verification] BVN lookup for phone/DOB skipped:', lookupErr);
      }
    }

    if (matchResult.mismatches.length > 0) {
      matchResult.verified = false;
    }

    return {
      success: true,
      verified: matchResult.verified,
      matchScore: matchResult.matchScore,
      details: {
        firstName: request.firstName,
        middleName: request.middleName,
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
    });
    return {
      success: false,
      verified: false,
      matchScore: 0,
      error: 'BVN Service Unavailable',
    };
  }
}

export function matchDojahBVNDetails(input: {
  bvnValid: boolean;
  firstNameConfidence?: number | null;
  lastNameConfidence?: number | null;
  middleNameConfidence?: number | null;
  firstNameStatus?: boolean;
  lastNameStatus?: boolean;
  middleNameStatus?: boolean;
  dobValid: boolean;
  hasMiddleNameInput: boolean;
  hasMiddleNameResult: boolean;
}): { verified: boolean; matchScore: number; mismatches: string[] } {
  const mismatches: string[] = [];
  let totalScore = 0;
  let nameStructureMismatch = false;

  if (input.bvnValid) totalScore += 35;
  else mismatches.push('BVN could not be validated');

  const firstNameValid = providerNameFieldMatches(
    input.firstNameStatus,
    input.firstNameConfidence
  );
  const lastNameValid = providerNameFieldMatches(
    input.lastNameStatus,
    input.lastNameConfidence
  );
  const firstNameScore = providerNameFieldScore(
    input.firstNameStatus,
    input.firstNameConfidence
  );
  const lastNameScore = providerNameFieldScore(
    input.lastNameStatus,
    input.lastNameConfidence
  );
  totalScore += Math.min(100, Math.max(0, firstNameScore)) * 0.2;
  totalScore += Math.min(100, Math.max(0, lastNameScore)) * 0.2;

  if (!firstNameValid) {
    nameStructureMismatch = true;
  }
  if (!lastNameValid) {
    nameStructureMismatch = true;
  }

  if (input.hasMiddleNameInput && input.hasMiddleNameResult) {
    const middleNameValid = providerNameFieldMatches(
      input.middleNameStatus,
      input.middleNameConfidence
    );
    const middleScore = providerNameFieldScore(
      input.middleNameStatus,
      input.middleNameConfidence
    );
    totalScore += Math.min(100, Math.max(0, middleScore)) * 0.1;
    if (!middleNameValid) {
      nameStructureMismatch = true;
    }
  } else {
    totalScore += 10;
  }

  if (nameStructureMismatch) {
    mismatches.push('Registered name did not match BVN records');
  }

  if (input.dobValid) totalScore += 15;
  else mismatches.push('Date of birth did not match BVN records');

  return {
    verified: input.bvnValid && totalScore >= 75 && mismatches.length === 0,
    matchScore: Math.round(Math.min(100, totalScore)),
    mismatches,
  };
}

function providerNameFieldMatches(
  status: boolean | undefined,
  confidence: number | null | undefined
): boolean {
  if (status !== undefined) return status;
  return typeof confidence === 'number' && confidence >= 70;
}

function providerNameFieldScore(
  status: boolean | undefined,
  confidence: number | null | undefined
): number {
  if (status === true) return Math.max(confidence ?? 100, 70);
  return confidence ?? 0;
}

export function encryptBVN(bvn: string): string {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(bvn, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('BVN encryption error:', error);
    throw new Error('Failed to encrypt BVN');
  }
}

export function decryptBVN(encryptedBVN: string): string {
  try {
    const parts = encryptedBVN.split(':');
    if (parts.length !== 2) throw new Error('Invalid encrypted BVN format');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('BVN decryption error:', error);
    throw new Error('Failed to decrypt BVN');
  }
}

export function maskBVN(bvn: string): string {
  if (!bvn || bvn.length < 4) return '****';
  return '*'.repeat(bvn.length - 4) + bvn.slice(-4);
}
