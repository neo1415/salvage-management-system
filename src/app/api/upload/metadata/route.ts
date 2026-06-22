import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { recordImageUploadMetadata } from '@/features/media/services/image-upload-metadata.service';

const metadataSchema = z.object({
  entityType: z.enum(['brand_asset', 'kyc_document', 'profile_picture', 'payment_proof', 'pickup_evidence', 'salvage_case']),
  entityId: z.string().uuid().optional(),
  imageUrl: z.string().url(),
  imageIndex: z.number().int().min(0).optional(),
  purpose: z.string().trim().min(1).max(80).optional(),
  clientMetadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const validation = metadataSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid upload metadata payload', details: validation.error.issues },
      { status: 400 }
    );
  }

  const { entityType, entityId, imageUrl, imageIndex, purpose, clientMetadata } = validation.data;
  if (entityType === 'brand_asset' && session.user.role !== 'system_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await recordImageUploadMetadata({
    entityType,
    entityId: entityId || session.user.id,
    imageUrl,
    imageIndex,
    purpose: purpose || 'direct_upload',
    uploadedBy: session.user.id,
    clientMetadata,
  });

  return NextResponse.json({ success: true });
}
