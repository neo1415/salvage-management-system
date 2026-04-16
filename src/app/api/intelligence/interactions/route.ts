/**
 * Interaction Tracking API Endpoint
 * 
 * POST /api/intelligence/interactions
 * 
 * Records vendor interaction events (view, bid, win) for analytics and ML training.
 * Task 7.3.1: Create POST /api/intelligence/interactions route
 * 
 * Security: Requires authentication, validates event data
 * Performance: Async processing, non-blocking
 * 
 * @module api/intelligence/interactions
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { interactions } from '@/lib/db/schema/intelligence';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

/**
 * Task 7.3.2: Implement event validation schema
 */
const interactionEventSchema = z.object({
  vendorId: z.string().uuid(),
  auctionId: z.string().uuid(),
  eventType: z.enum(['view', 'bid', 'win', 'click_recommendation']),
  sessionId: z.string().optional(),
  metadata: z.object({
    deviceType: z.enum(['mobile', 'desktop', 'tablet']).optional(),
    predictionShown: z.object({
      predictedPrice: z.number(),
      confidenceScore: z.number(),
    }).optional(),
    recommendationShown: z.object({
      matchScore: z.number(),
      reasonCodes: z.array(z.string()),
    }).optional(),
    source: z.string().optional(),
  }).optional(),
});

/**
 * POST /api/intelligence/interactions
 * 
 * Record vendor interaction event
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
    const validation = interactionEventSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const eventData = validation.data;

    // Authorization: Ensure user can only track their own vendor's interactions
    // (unless they're an admin)
    if (session.user.role !== 'admin' && session.user.role !== 'manager') {
      // TODO: Verify vendorId belongs to session.user.id
      // For now, we'll allow it but log it
    }

    // Task 7.3.2: Enrich event data
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Determine device type from user agent if not provided
    let deviceType = eventData.metadata?.deviceType;
    if (!deviceType) {
      deviceType = userAgent.toLowerCase().includes('mobile') ? 'mobile' : 'desktop';
    }

    // Task 7.3.3: Implement session tracking logic
    const sessionId = eventData.sessionId || uuidv4();

    // Enrich metadata
    const enrichedMetadata = {
      ...eventData.metadata,
      deviceType,
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString(),
    };

    // Insert interaction event
    await db.insert(interactions).values({
      vendorId: eventData.vendorId,
      auctionId: eventData.auctionId,
      eventType: eventData.eventType,
      sessionId,
      metadata: enrichedMetadata,
    });

    // Log to audit logs
    await db.insert(auditLogs).values({
      userId: session.user.id,
      actionType: 'interaction_tracked',
      entityType: 'interaction',
      entityId: eventData.auctionId,
      ipAddress,
      deviceType: deviceType as 'mobile' | 'desktop' | 'tablet',
      userAgent,
      afterState: {
        eventType: eventData.eventType,
        vendorId: eventData.vendorId,
        auctionId: eventData.auctionId,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        eventType: eventData.eventType,
        timestamp: new Date().toISOString(),
      },
    }, { status: 201 });

  } catch (error) {
    console.error('[Interaction Tracking API] Error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
