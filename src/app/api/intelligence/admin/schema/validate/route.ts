/**
 * Schema Validation API Endpoint
 * 
 * POST /api/intelligence/admin/schema/validate
 * 
 * Validate pending schema changes (approve/reject).
 * Task 7.6.4: Create POST /api/intelligence/admin/schema/validate route
 * 
 * Security: Requires admin role
 * 
 * @module api/intelligence/admin/schema/validate
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SchemaEvolutionService } from '@/features/intelligence/services/schema-evolution.service';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { db } from '@/lib/db';
import { z } from 'zod';

/**
 * Request validation schema
 */
const schemaValidationSchema = z.object({
  changeId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
});

/**
 * POST /api/intelligence/admin/schema/validate
 * 
 * Validate (approve/reject) pending schema change
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

    // Authorization: Allow both system_admin and admin roles
    if (session.user.role !== 'system_admin' && session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = schemaValidationSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { changeId, action } = validation.data;

    // Use SchemaEvolutionService to validate
    const schemaService = new SchemaEvolutionService();
    const validationResult = await schemaService.validateSchemaChange(changeId);

    if (!validationResult.valid) {
      return NextResponse.json(
        { 
          error: 'Schema change validation failed',
          validationErrors: validationResult.errors,
        },
        { status: 400 }
      );
    }

    // Approve or reject the change
    if (action === 'approve') {
      await schemaService.approveChange(changeId, session.user.id);
      
      // Expand analytics tables
      try {
        await schemaService.expandAnalyticsTables(changeId);
      } catch (error) {
        console.error('Failed to expand analytics tables:', error);
        // Don't fail the entire operation
      }
    } else {
      // Reject the change (update status to rejected)
      await db.execute(`
        UPDATE schema_evolution_log
        SET status = 'rejected',
            reviewed_by = '${session.user.id}',
            reviewed_at = NOW()
        WHERE id = '${changeId}'
      `);
    }

    // Audit logging
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const deviceType = userAgent.toLowerCase().includes('mobile') ? 'mobile' : 'desktop';

    await db.insert(auditLogs).values({
      userId: session.user.id,
      actionType: `schema_change_${action}d`,
      entityType: 'schema_evolution',
      entityId: changeId,
      ipAddress,
      deviceType: deviceType as 'mobile' | 'desktop' | 'tablet',
      userAgent,
      afterState: {
        action,
        validationResult,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        changeId,
        action,
        validationResult,
        timestamp: new Date().toISOString(),
      },
    }, { status: 200 });

  } catch (error) {
    console.error('[Schema Validation API] Error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
