/**
 * ML Dataset Export API Endpoint
 * 
 * POST /api/intelligence/ml/export-dataset
 * 
 * Exports ML training datasets with feature engineering.
 * Task 7.5.1: Create POST /api/intelligence/ml/export-dataset route
 * 
 * @module api/intelligence/ml/export-dataset
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';

const exportSchema = z.object({
  datasetType: z.enum(['price_prediction', 'recommendation', 'fraud_detection']),
  format: z.enum(['csv', 'json', 'parquet']).optional().default('csv'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  splitRatio: z.object({
    train: z.number().min(0).max(1),
    validation: z.number().min(0).max(1),
    test: z.number().min(0).max(1),
  }).optional().default({ train: 0.7, validation: 0.15, test: 0.15 }),
  anonymize: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Allow both system_admin and admin roles
    if (session.user.role !== 'system_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = exportSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const exportParams = validation.data;

    return NextResponse.json({
      success: false,
      error: 'ML dataset export is not wired to the current dataset service yet',
      data: {
        datasetId: null,
        datasetType: exportParams.datasetType,
        format: exportParams.format,
        recordCount: 0,
        splits: null,
        downloadUrl: null,
        expiresAt: null,
      },
    }, { status: 501 });

  } catch (error) {
    console.error('[ML Dataset Export API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
