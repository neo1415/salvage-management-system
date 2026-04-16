/**
 * Pending Schema Changes API Endpoint
 * 
 * GET /api/intelligence/admin/schema/pending
 * 
 * Get list of pending schema changes.
 * Task 7.6.5: Create GET /api/intelligence/admin/schema/pending route
 * 
 * Security: Requires admin role
 * 
 * @module api/intelligence/admin/schema/pending
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SchemaEvolutionService } from '@/features/intelligence/services/schema-evolution.service';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { db } from '@/lib/db';

/**
 * GET /api/intelligence/admin/schema/pending
 * 
 * Get pending schema changes
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Authorization: Allow both system_admin and admin roles
    if (session.user.role !== 'system_admin' && session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Use SchemaEvolutionService to get pending changes
    const schemaService = new SchemaEvolutionService();
    const pendingChanges = await schemaService.getPendingChanges();

    // Audit logging
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const deviceType = userAgent.toLowerCase().includes('mobile') ? 'mobile' : 'desktop';

    await db.insert(auditLogs).values({
      userId: session.user.id,
      actionType: 'schema_pending_viewed',
      entityType: 'schema_evolution',
      entityId: 'pending_list',
      ipAddress,
      deviceType: deviceType as 'mobile' | 'desktop' | 'tablet',
      userAgent,
      afterState: {
        count: pendingChanges.length,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        pendingChanges: pendingChanges.map(change => ({
          id: change.id,
          changeType: change.changeType,
          entityType: change.entityType,
          entityName: change.entityName,
          changeDetails: change.changeDetails,
          status: change.status,
          createdAt: change.createdAt,
          reviewedBy: change.reviewedBy,
          reviewedAt: change.reviewedAt,
        })),
        count: pendingChanges.length,
        timestamp: new Date().toISOString(),
      },
    }, { status: 200 });

  } catch (error) {
    console.error('[Pending Schema Changes API] Error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
