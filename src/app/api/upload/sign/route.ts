/**
 * API Route: Generate Signed Upload Parameters
 * 
 * This endpoint generates signed upload parameters for secure client-side uploads to Cloudinary.
 * The signature ensures that only authorized uploads with specific parameters can succeed.
 * 
 * POST /api/upload/sign
 * 
 * Request Body:
 * {
 *   "entityType": "salvage-case" | "kyc-document",
 *   "entityId": "case-123" | "vendor-456",
 *   "transformation": "thumbnail" | "medium" | "large" | "compressed" (optional)
 * }
 * 
 * Response:
 * {
 *   "signature": "abc123...",
 *   "timestamp": 1234567890,
 *   "cloudName": "your-cloud-name",
 *   "apiKey": "your-api-key",
 *   "folder": "salvage-cases/case-123",
 *   "uploadUrl": "https://api.cloudinary.com/v1_1/your-cloud-name/image/upload"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { rateLimit, createRateLimitHeaders } from '@/lib/utils/rate-limit';
import {
  generateSignedUploadParams,
  getSalvageCaseFolder,
  getKycDocumentFolder,
  TRANSFORMATION_PRESETS,
} from '@/lib/storage/cloudinary';

const uploadSignSchema = z.object({
  entityType: z.enum(['salvage-case', 'kyc-document']),
  entityId: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid entityId format'),
  transformation: z.enum(['thumbnail', 'medium', 'large', 'compressed']).optional(),
});

const SALVAGE_UPLOAD_ROLES = new Set(['claims_adjuster', 'salvage_manager', 'system_admin']);
const KYC_UPLOAD_ROLES = new Set(['vendor', 'salvage_manager', 'system_admin']);

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResult = await rateLimit(request, {
      limit: 20,
      window: 60 * 60,
      identifier: `upload-sign:${session.user.id}`,
    });
    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many upload signing requests. Please try again later.' },
        { status: 429, headers: rateLimitHeaders }
      );
    }

    const body = await request.json();
    const validation = uploadSignSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid upload signing request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { entityType, entityId, transformation } = validation.data;
    const role = session.user.role;

    if (entityType === 'salvage-case' && !SALVAGE_UPLOAD_ROLES.has(role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (entityType === 'kyc-document' && !KYC_UPLOAD_ROLES.has(role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Determine folder based on entity type
    let folder: string;
    if (entityType === 'salvage-case') {
      folder = getSalvageCaseFolder(entityId);
    } else {
      folder = getKycDocumentFolder(entityId);
    }

    // Get transformation preset if specified
    let transformationPreset;
    if (transformation) {
      const presetKey = transformation.toUpperCase() as keyof typeof TRANSFORMATION_PRESETS;
      if (TRANSFORMATION_PRESETS[presetKey]) {
        transformationPreset = TRANSFORMATION_PRESETS[presetKey];
      }
    }

    // Generate signed upload parameters
    const params = generateSignedUploadParams(
      folder,
      undefined, // Let Cloudinary generate unique public ID
      transformationPreset
    );

    // Return signed parameters with upload URL
    return NextResponse.json({
      ...params,
      uploadUrl: `https://api.cloudinary.com/v1_1/${params.cloudName}/image/upload`,
    }, { headers: rateLimitHeaders });
  } catch (error) {
    console.error('Error generating signed upload params:', error);
    return NextResponse.json(
      { error: 'Failed to generate signed upload parameters' },
      { status: 500 }
    );
  }
}
