/**
 * Auction Price Prediction API Endpoint
 * 
 * GET /api/auctions/[id]/prediction
 * 
 * Returns price prediction for an auction with confidence intervals.
 * Task 7.1.1: Create GET /api/auctions/[id]/prediction route
 * 
 * Security: Requires authentication, validates auction access
 * Performance: <200ms response time with caching
 * 
 * @module api/auctions/prediction
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PredictionService } from '@/features/intelligence/services/prediction.service';
import { db } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { z } from 'zod';

/**
 * Detect device type from user agent string
 */
function detectDeviceType(userAgent: string): 'mobile' | 'desktop' | 'tablet' {
  const ua = userAgent.toLowerCase();
  
  // Check for tablet first (more specific)
  if (/(ipad|tablet|playbook|silk)|(android(?!.*mobile))/i.test(ua)) {
    return 'tablet';
  }
  
  // Check for mobile
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    return 'mobile';
  }
  
  // Default to desktop
  return 'desktop';
}

/**
 * GET /api/auctions/[id]/prediction
 * 
 * Generate or retrieve price prediction for an auction
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Task 7.1.2: Implement authentication middleware
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // FIXED: Await params in Next.js 15
    const resolvedParams = await params;

    // Task 7.1.3: Implement request validation
    const auctionId = resolvedParams.id;
    
    if (!auctionId || typeof auctionId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid auction ID' },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidSchema = z.string().uuid();
    const validation = uuidSchema.safeParse(auctionId);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid auction ID format' },
        { status: 400 }
      );
    }

    // Generate prediction
    const predictionService = new PredictionService();
    const prediction = await predictionService.generatePrediction(auctionId);

    // Log prediction view to audit logs (with proper IP address handling)
    try {
      const ipAddress = request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       '0.0.0.0';
      
      // Extract user agent and device type from request headers
      const userAgent = request.headers.get('user-agent') || 'unknown';
      const deviceType = detectDeviceType(userAgent);
      
      await db.insert(auditLogs).values({
        userId: session.user.id,
        actionType: 'prediction_viewed',
        entityType: 'auction',
        entityId: auctionId,
        ipAddress: ipAddress,
        deviceType: deviceType,
        userAgent: userAgent,
        afterState: {
          confidenceScore: prediction.confidenceScore,
          method: prediction.method,
        },
      });
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      console.error('[Prediction API] Audit log error:', auditError);
    }

    // Task 7.1.4: Implement response formatting
    // FIXED: Return flat structure to match UI expectations (not nested data.data)
    // FIXED: Convert createdAt to Date object before calling toISOString()
    const timestamp = prediction.createdAt instanceof Date 
      ? prediction.createdAt.toISOString()
      : new Date(prediction.createdAt).toISOString();
    
    return NextResponse.json({
      success: true,
      auctionId: prediction.auctionId,
      predictedPrice: prediction.predictedPrice,
      lowerBound: prediction.lowerBound,
      upperBound: prediction.upperBound,
      confidenceScore: prediction.confidenceScore,
      confidenceLevel: prediction.confidenceLevel,
      method: prediction.method,
      sampleSize: prediction.sampleSize,
      metadata: prediction.metadata,
      algorithmVersion: prediction.algorithmVersion,
      timestamp: timestamp,
    }, { status: 200 });

  } catch (error) {
    console.error('[Prediction API] Error:', error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message === 'Auction not found') {
        return NextResponse.json(
          { error: 'Auction not found' },
          { status: 404 }
        );
      }

      if (error.message === 'Insufficient data for price prediction') {
        return NextResponse.json(
          { 
            error: 'Insufficient data for price prediction',
            message: 'Not enough historical data available for this auction type'
          },
          { status: 200 } // Return 200 with message, not an error
        );
      }
    }

    // Generic error response
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
