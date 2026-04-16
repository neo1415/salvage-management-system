/**
 * Vendor Recommendations API Endpoint
 * 
 * GET /api/vendors/[id]/recommendations
 * 
 * Generates personalized auction recommendations for a vendor using hybrid
 * collaborative and content-based filtering algorithms.
 * 
 * Security:
 * - Requires authentication
 * - Vendors can only access their own recommendations
 * - Rate limited to prevent abuse
 * - Input validation using Zod schemas
 * 
 * Performance:
 * - Redis caching with 15-minute TTL
 * - Sub-200ms response time target
 * 
 * @module api/vendors/recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { RecommendationService } from '@/features/intelligence/services/recommendation.service';
import { z } from 'zod';
import { db } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';

// Input validation schema
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

/**
 * GET /api/vendors/[id]/recommendations
 * 
 * Generate personalized auction recommendations for a vendor
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = performance.now();

  try {
    // Authentication check
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const vendorId = params.id;

    // Validate vendor ID format
    if (!vendorId || typeof vendorId !== 'string' || vendorId.length !== 36) {
      return NextResponse.json(
        { error: 'Invalid vendor ID format' },
        { status: 400 }
      );
    }

    // Authorization: Ensure user can only access their own recommendations
    // (unless they're an admin)
    if (session.user.role !== 'admin' && session.user.role !== 'manager') {
      // Get vendor's user ID
      const vendorData = await db
        .select({ userId: vendors.userId })
        .from(vendors)
        .where(eq(vendors.id, vendorId))
        .limit(1);

      if (!vendorData || vendorData.length === 0) {
        return NextResponse.json(
          { error: 'Vendor not found' },
          { status: 404 }
        );
      }

      if (vendorData[0].userId !== session.user.id) {
        return NextResponse.json(
          { error: 'Forbidden: You can only access your own recommendations' },
          { status: 403 }
        );
      }
    }

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = querySchema.safeParse({
      limit: searchParams.get('limit'),
    });

    if (!queryParams.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryParams.error.issues },
        { status: 400 }
      );
    }

    const { limit } = queryParams.data;

    // Generate recommendations
    const recommendationService = new RecommendationService();
    const recommendations = await recommendationService.generateRecommendations(
      vendorId,
      limit
    );

    // Calculate response time
    const responseTime = performance.now() - startTime;

    // Get request metadata for audit logging
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const deviceType = userAgent.toLowerCase().includes('mobile') ? 'mobile' : 'desktop';

    // Audit logging
    await db.insert(auditLogs).values({
      userId: session.user.id,
      actionType: 'intelligence_api_accessed',
      entityType: 'recommendation',
      entityId: vendorId,
      ipAddress,
      deviceType: deviceType as 'mobile' | 'desktop' | 'tablet',
      userAgent,
      afterState: {
        endpoint: '/api/vendors/[id]/recommendations',
        recommendationCount: recommendations.length,
        responseTimeMs: Math.round(responseTime),
        limit,
      },
    });

    // Return recommendations
    return NextResponse.json({
      success: true,
      data: {
        vendorId,
        recommendations,
        count: recommendations.length,
        generatedAt: new Date().toISOString(),
      },
      meta: {
        responseTimeMs: Math.round(responseTime),
        cached: false,
      },
    });

  } catch (error: any) {
    console.error('Error generating recommendations:', error);

    // Audit log the error
    try {
      const session = await auth();
      if (session?.user) {
        const ipAddress = request.headers.get('x-forwarded-for') || 
                          request.headers.get('x-real-ip') || 
                          '127.0.0.1';
        const userAgent = request.headers.get('user-agent') || 'unknown';
        const deviceType = userAgent.toLowerCase().includes('mobile') ? 'mobile' : 'desktop';

        await db.insert(auditLogs).values({
          userId: session.user.id,
          actionType: 'intelligence_fallback',
          entityType: 'recommendation',
          entityId: params.id,
          ipAddress,
          deviceType: deviceType as 'mobile' | 'desktop' | 'tablet',
          userAgent,
          afterState: {
            error: error.message,
            endpoint: '/api/vendors/[id]/recommendations',
          },
        });
      }
    } catch (auditError) {
      console.error('Failed to log error to audit:', auditError);
    }

    // Return generic error without exposing sensitive information
    return NextResponse.json(
      { 
        error: 'Failed to generate recommendations',
        message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
      },
      { status: 500 }
    );
  }
}
