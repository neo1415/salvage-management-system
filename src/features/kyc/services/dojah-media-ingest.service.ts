import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { uploadFile, getKycDocumentFolder, getProfilePictureFolder, TRANSFORMATION_PRESETS } from '@/lib/storage/cloudinary';
import type { DojahVerificationResult } from '../schemas/dojah.schemas';
import type { KYCVerificationData } from '../types/kyc.types';

type DojahMediaType = 'selfie' | 'photo_id' | 'address_proof' | 'cac_certificate' | 'bank_statement' | 'business_document';

interface MediaCandidate {
  type: DojahMediaType;
  url: string;
  sourceKey: string;
}

export interface DojahMediaIngestResult {
  verificationData: Partial<KYCVerificationData>;
  profilePictureUrl?: string;
  assets: Array<{
    type: DojahMediaType;
    sourceKey: string;
    storedUrl: string;
    publicId: string;
  }>;
  diagnostics: {
    candidateCount: number;
    uploadedCount: number;
    skippedCount: number;
  };
}

const URL_KEY_PATTERN = /(url|image|photo|selfie|document|file)/i;
const HTTPS_URL_PATTERN = /^https:\/\/[^\s"'<>]+$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function classifyMedia(path: string): DojahMediaType | null {
  const lower = path.toLowerCase();
  if (lower.includes('selfie') || lower.includes('liveness')) return 'selfie';
  if (lower.includes('bank') || lower.includes('statement')) return 'bank_statement';
  if (lower.includes('address') || lower.includes('utility')) return 'address_proof';
  if (lower.includes('business') || lower.includes('cac')) return 'cac_certificate';
  if (lower.includes('government') || lower.includes('id') || lower.includes('document')) return 'photo_id';
  return null;
}

function collectMediaCandidates(value: unknown, path: string[] = []): MediaCandidate[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectMediaCandidates(item, [...path, String(index)]));
  }

  if (!isRecord(value)) return [];

  const candidates: MediaCandidate[] = [];
  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...path, key];
    if (typeof child === 'string' && URL_KEY_PATTERN.test(key) && HTTPS_URL_PATTERN.test(child)) {
      const type = classifyMedia(nextPath.join('.'));
      if (type) candidates.push({ type, url: child, sourceKey: nextPath.join('.') });
    } else if (isRecord(child) || Array.isArray(child)) {
      candidates.push(...collectMediaCandidates(child, nextPath));
    }
  }
  return candidates;
}

function uniqueCandidates(candidates: MediaCandidate[]): MediaCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.type}:${candidate.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function publicIdFor(reference: string, type: DojahMediaType, index: number): string {
  const safeRef = reference.replace(/[^a-zA-Z0-9_-]/g, '').slice(-32) || 'dojah';
  return `dojah-${type}-${safeRef}-${index}`;
}

function verificationDataField(type: DojahMediaType, storedUrl: string): Partial<KYCVerificationData> {
  if (type === 'selfie') return { selfieUrl: storedUrl, biometricVerifiedAt: new Date() };
  if (type === 'photo_id') return { photoIdUrl: storedUrl, ninCardUrl: storedUrl, photoIdVerifiedAt: new Date() };
  if (type === 'address_proof') return { addressProofUrl: storedUrl, addressVerifiedAt: new Date() };
  if (type === 'cac_certificate') return { cacCertificateUrl: storedUrl };
  if (type === 'bank_statement') return { bankStatementUrl: storedUrl };
  return {};
}

export async function ingestDojahMediaForVendor(input: {
  vendorId: string;
  userId: string;
  providerReference: string;
  verificationResult: DojahVerificationResult;
}): Promise<DojahMediaIngestResult> {
  const candidates = uniqueCandidates(collectMediaCandidates(input.verificationResult));
  const assets: DojahMediaIngestResult['assets'] = [];
  const verificationData: Partial<KYCVerificationData> = {};
  let profilePictureUrl: string | undefined;
  let skippedCount = 0;

  for (const [index, candidate] of candidates.entries()) {
    try {
      const folder = candidate.type === 'selfie'
        ? getProfilePictureFolder(input.userId, 'vendor')
        : getKycDocumentFolder(input.vendorId);
      const upload = await uploadFile(candidate.url, {
        folder,
        publicId: publicIdFor(input.providerReference, candidate.type, index),
        resourceType: 'auto',
        compress: false,
        transformation: candidate.type === 'selfie' ? TRANSFORMATION_PRESETS.COMPRESSED : undefined,
        tags: ['dojah', 'kyc', candidate.type],
      });

      assets.push({
        type: candidate.type,
        sourceKey: candidate.sourceKey,
        storedUrl: upload.secureUrl,
        publicId: upload.publicId,
      });

      Object.assign(verificationData, verificationDataField(candidate.type, upload.secureUrl));
      if (candidate.type === 'selfie' && !profilePictureUrl) {
        profilePictureUrl = upload.secureUrl;
      }
    } catch (error) {
      skippedCount += 1;
      console.warn('[DojahMediaIngest] Failed to import provider media', {
        type: candidate.type,
        sourceKey: candidate.sourceKey,
        message: error instanceof Error ? error.message : 'Unknown media import error',
      });
    }
  }

  if (profilePictureUrl) {
    await db
      .update(users)
      .set({ profilePictureUrl, updatedAt: new Date() })
      .where(eq(users.id, input.userId));
  }

  return {
    verificationData,
    profilePictureUrl,
    assets,
    diagnostics: {
      candidateCount: candidates.length,
      uploadedCount: assets.length,
      skippedCount,
    },
  };
}
