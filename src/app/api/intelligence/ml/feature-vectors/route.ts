/**
 * Feature Vectors API Endpoint
 * 
 * GET /api/intelligence/ml/feature-vectors
 * 
 * Returns feature vectors for ML training.
 * Task 7.5.3: Create GET /api/intelligence/ml/feature-vectors route
 * 
 * @module api/intelligence/ml/feature-vectors
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { FeatureEngineeringService } from '@/features/intelligence/services/feature-engineering.service';
import { z } from 'zod';

const querySchema = z.object({
  entityType: z.enum(['auction', 'vendor']),
  entityId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: session?.user ? 'Forbidden: Admin access required' : 'Unauthorized' },
        { status: session?.user ? 403 : 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const queryParams = querySchema.safeParse({
      entityType: searchParams.get('entityType'),
      entityId: searchParams.get('entityId'),
      limit: searchParams.get('limit'),
    });

    if (!queryParams.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryParams.error.issues },
        { status: 400 }
      );
    }

    const { entityType, entityId, limit } = queryParams.data;

    const featureService = new FeatureEngineeringService();
    const vectors = await featureService.getFeatureVectors({
      entityType,
      entityId,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: vectors,
      meta: {
        count: vectors.length,
        filters: { entityType, entityId },
      },
    });

  } catch (error) {
    console.error('[Feature Vectors API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
