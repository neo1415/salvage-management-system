/**
 * Admin API: Individual Valuation Management
 * 
 * PUT /api/admin/valuations/[id] - Update valuation
 * DELETE /api/admin/valuations/[id] - Delete valuation
 * 
 * Requirements: 7.3, 7.4, 7.6, 12.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { eq } from 'drizzle-orm';
import { valuationSchema } from '@/features/valuations/validation/schemas';
import { valuationAuditService } from '@/features/valuations/services/audit.service';

function buildChangedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  for (const [key, newValue] of Object.entries(after)) {
    const oldValue = before[key];
    if (String(oldValue ?? '') !== String(newValue ?? '')) {
      changes[key] = { old: oldValue ?? null, new: newValue ?? null };
    }
  }

  return changes;
}

/**
 * PUT /api/admin/valuations/[id]
 * Update valuation
 * Requirements: 7.3, 7.6, 12.1
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication and authorization
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Restrict to admin and manager roles
    if (session.user.role !== 'system_admin' && session.user.role !== 'salvage_manager') {
      return NextResponse.json(
        { error: 'Forbidden - Admin or Manager role required' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check if valuation exists
    const existing = await db
      .select()
      .from(vehicleValuations)
      .where(eq(vehicleValuations.id, id))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Valuation not found' },
        { status: 404 }
      );
    }

    // Parse and validate request body (Requirement 7.3)
    const body = await request.json();
    const validationResult = valuationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.issues 
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Update valuation (Requirement 7.6)
    const result = await db
      .update(vehicleValuations)
      .set({
        make: data.make,
        model: data.model,
        year: data.year,
        conditionCategory: data.conditionCategory,
        lowPrice: data.lowPrice.toString(),
        highPrice: data.highPrice.toString(),
        averagePrice: data.averagePrice.toString(),
        mileageLow: data.mileageLow,
        mileageHigh: data.mileageHigh,
        marketNotes: data.marketNotes,
        updatedAt: new Date(),
      })
      .where(eq(vehicleValuations.id, id))
      .returning();

    await valuationAuditService.log({
      entityType: 'valuation',
      entityId: id,
      action: 'update',
      userId: session.user.id,
      changes: buildChangedFields(existing[0] as Record<string, unknown>, result[0] as Record<string, unknown>),
    });

    return NextResponse.json({
      message: 'Valuation updated successfully',
      data: result[0]
    });
  } catch (error) {
    console.error('Error updating valuation:', error);
    
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json(
        { error: 'Valuation already exists for this make/model/year/condition combination' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/valuations/[id]
 * Delete valuation
 * Requirements: 7.4, 12.1
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication and authorization
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Restrict to admin and manager roles
    if (session.user.role !== 'system_admin' && session.user.role !== 'salvage_manager') {
      return NextResponse.json(
        { error: 'Forbidden - Admin or Manager role required' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check for confirmation flag (Requirement 7.4)
    const body = await request.json().catch(() => ({}));
    if (!body.confirm) {
      return NextResponse.json(
        { error: 'Confirmation required - include { confirm: true } in request body' },
        { status: 400 }
      );
    }

    // Check if valuation exists
    const existing = await db
      .select()
      .from(vehicleValuations)
      .where(eq(vehicleValuations.id, id))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Valuation not found' },
        { status: 404 }
      );
    }

    // Delete valuation
    await db
      .delete(vehicleValuations)
      .where(eq(vehicleValuations.id, id));

    await valuationAuditService.log({
      entityType: 'valuation',
      entityId: id,
      action: 'delete',
      userId: session.user.id,
      changes: {
        valuation: { old: existing[0], new: null },
      },
    });

    return NextResponse.json({
      message: 'Valuation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting valuation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
