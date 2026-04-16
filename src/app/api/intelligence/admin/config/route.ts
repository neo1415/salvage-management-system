/**
 * Algorithm Configuration API Endpoint
 * 
 * POST /api/intelligence/admin/config
 * 
 * Update algorithm configuration parameters.
 * Task 7.6.2: Create POST /api/intelligence/admin/config route
 * 
 * Security: Requires admin role
 * 
 * @module api/intelligence/admin/config
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { algorithmConfig } from '@/lib/db/schema/intelligence';
import { algorithmConfigHistory } from '@/lib/db/schema/ml-training';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { z } from 'zod';
import { eq } from 'drizzle-orm';

/**
 * Request validation schema
 */
const configUpdateSchema = z.object({
  configKey: z.string().min(1).max(100),
  configValue: z.union([z.string(), z.number(), z.boolean()]),
  description: z.string().optional(),
});

/**
 * POST /api/intelligence/admin/config
 * 
 * Update algorithm configuration parameter
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
    const validation = configUpdateSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { configKey, configValue, description } = validation.data;

    // Get current config value for history
    const currentConfig = await db
      .select()
      .from(algorithmConfig)
      .where(eq(algorithmConfig.configKey, configKey))
      .limit(1);

    const oldValue = currentConfig.length > 0 ? currentConfig[0].configValue : null;

    // Update or insert config
    let configId: string;
    if (currentConfig.length > 0) {
      await db
        .update(algorithmConfig)
        .set({
          configValue: String(configValue),
          description: description || currentConfig[0].description,
          updatedAt: new Date(),
        })
        .where(eq(algorithmConfig.configKey, configKey));
      configId = currentConfig[0].id;
    } else {
      const newConfig = await db
        .insert(algorithmConfig)
        .values({
          configKey,
          configValue: String(configValue),
          description: description || '',
          isActive: true,
        })
        .returning({ id: algorithmConfig.id });
      configId = newConfig[0].id;
    }

    // Log to algorithm_config_history
    await db.insert(algorithmConfigHistory).values({
      configId,
      configKey,
      oldValue: oldValue ? String(oldValue) : null,
      newValue: String(configValue),
      changedBy: session.user.id,
      changeReason: description || 'Manual configuration update',
    });

    // Audit logging
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const deviceType = userAgent.toLowerCase().includes('mobile') ? 'mobile' : 'desktop';

    await db.insert(auditLogs).values({
      userId: session.user.id,
      actionType: 'algorithm_config_updated',
      entityType: 'algorithm_config',
      entityId: configKey,
      ipAddress,
      deviceType: deviceType as 'mobile' | 'desktop' | 'tablet',
      userAgent,
      beforeState: { configValue: oldValue },
      afterState: { configValue },
    });

    return NextResponse.json({
      success: true,
      data: {
        configKey,
        configValue,
        description,
        updatedAt: new Date().toISOString(),
      },
    }, { status: 200 });

  } catch (error) {
    console.error('[Algorithm Config API] Error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
