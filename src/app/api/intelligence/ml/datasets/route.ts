/**
 * ML Datasets List API Endpoint
 * 
 * GET /api/intelligence/ml/datasets
 * 
 * Returns list of exported ML datasets.
 * Task 7.5.2: Create GET /api/intelligence/ml/datasets route
 * 
 * @module api/intelligence/ml/datasets
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { mlTrainingDatasets } from '@/lib/db/schema/ml-training';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

const querySchema = z.object({
  datasetType: z.enum(['price_prediction', 'recommendation', 'fraud_detection']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Allow system_admin and admin roles
    if (session.user.role !== 'system_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const parsedQuery = querySchema.safeParse({
      datasetType: searchParams.get('datasetType') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsedQuery.error.issues },
        { status: 400 }
      );
    }

    const { datasetType, limit } = parsedQuery.data;

    // Query datasets
    const datasets = datasetType
      ? await db
          .select()
          .from(mlTrainingDatasets)
          .where(eq(mlTrainingDatasets.datasetType, datasetType))
          .orderBy(desc(mlTrainingDatasets.createdAt))
          .limit(limit)
      : await db
          .select()
          .from(mlTrainingDatasets)
          .orderBy(desc(mlTrainingDatasets.createdAt))
          .limit(limit);

    return NextResponse.json({
      success: true,
      data: datasets,
      meta: {
        count: datasets.length,
        filters: { datasetType: datasetType ?? null },
      },
    });

  } catch (error) {
    console.error('[ML Datasets List API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
