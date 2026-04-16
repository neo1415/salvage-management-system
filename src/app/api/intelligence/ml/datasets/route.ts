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
    if (session.user.role !== 'admin' && session.user.role !== 'system_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    
    // Make datasetType optional - don't validate if not provided
    const datasetType = searchParams.get('datasetType');
    const limit = searchParams.get('limit');
    
    // Only validate if datasetType is provided
    if (datasetType && !['price_prediction', 'recommendation', 'fraud_detection'].includes(datasetType)) {
      return NextResponse.json(
        { error: 'Invalid datasetType. Must be one of: price_prediction, recommendation, fraud_detection' },
        { status: 400 }
      );
    }
    
    // Validate limit if provided
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return NextResponse.json(
        { error: 'Invalid limit. Must be between 1 and 100' },
        { status: 400 }
      );
    }

    // Query datasets
    let query = db
      .select()
      .from(mlTrainingDatasets)
      .orderBy(desc(mlTrainingDatasets.createdAt))
      .limit(parsedLimit);

    if (datasetType) {
      query = query.where(eq(mlTrainingDatasets.datasetType, datasetType as any)) as any;
    }

    const datasets = await query;

    return NextResponse.json({
      success: true,
      data: datasets,
      meta: {
        count: datasets.length,
        filters: { datasetType: datasetType || null },
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
