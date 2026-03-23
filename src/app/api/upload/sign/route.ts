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
import {
  generateSignedUploadParams,
  getSalvageCaseFolder,
  getKycDocumentFolder,
  TRANSFORMATION_PRESETS,
} from '@/lib/storage/cloudinary';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entityType, entityId, transformation } = body;

    // Validate required fields
    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'Missing required fields: entityType, entityId' },
        { status: 400 }
      );
    }

    // Validate entity type
    if (!['salvage-case', 'kyc-document'].includes(entityType)) {
      return NextResponse.json(
        { error: 'Invalid entityType. Must be "salvage-case" or "kyc-document"' },
        { status: 400 }
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
    });
  } catch (error) {
    console.error('Error generating signed upload params:', error);
    return NextResponse.json(
      { error: 'Failed to generate signed upload parameters' },
      { status: 500 }
    );
  }
}
