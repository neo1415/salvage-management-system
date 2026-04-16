/**
 * Privacy Opt-Out API Endpoint
 * 
 * POST /api/intelligence/privacy/opt-out
 * 
 * Opt out of personalized recommendations.
 * Task 7.7.2: Create POST /api/intelligence/privacy/opt-out route
 * 
 * Security: Requires authentication
 * 
 * @module api/intelligence/privacy/opt-out
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { vendors } from '@/lib/db/schema/vendors';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Request validation schema
 */
const optOutSchema = z.object({
  vendorId: z.string().uuid(),
  optOut: z.boolean(),
});

/**
 * POST /api/intelligence/privacy/opt-out
 * 
 * Opt out of personalized recommendations
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = optOutSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { vendorId, optOut } = validation.data;

    // Authorization: Ensure user owns the vendor
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

    if (vendorData[0].userId !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: You can only manage your own vendor preferences' },
        { status: 403 }
      );
    }

    // Update vendor preferences
    await db
      .update(vendors)
      .set({
        preferences: {
          intelligenceOptOut: optOut,
        },
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, vendorId));

    // Audit logging
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const deviceType = userAgent.toLowerCase().includes('mobile') ? 'mobile' : 'desktop';

    await db.insert(auditLogs).values({
      userId: session.user.id,
      actionType: optOut ? 'intelligence_opted_out' : 'intelligence_opted_in',
      entityType: 'vendor',
      entityId: vendorId,
      ipAddress,
      deviceType: deviceType as 'mobile' | 'desktop' | 'tablet',
      userAgent,
      afterState: {
        intelligenceOptOut: optOut,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        vendorId,
        intelligenceOptOut: optOut,
        message: optOut 
          ? 'Successfully opted out of personalized recommendations' 
          : 'Successfully opted in to personalized recommendations',
        timestamp: new Date().toISOString(),
      },
    }, { status: 200 });

  } catch (error) {
    console.error('[Privacy Opt-Out API] Error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
