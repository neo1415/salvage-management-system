/**
 * Admin API: Individual Damage Deduction Management
 * 
 * PUT /api/admin/deductions/[id] - Update deduction
 * DELETE /api/admin/deductions/[id] - Delete deduction
 * 
 * Requirements: 7.3, 7.4, 7.6, 12.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db';
import { damageDeductions } from '@/lib/db/schema/vehicle-valuations';
import { eq } from 'drizzle-orm';
import { deductionSchema } from '@/features/valuations/validation/schemas';
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
 * PUT /api/admin/deductions/[id]
 * Update deduction
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

    // Check if deduction exists
    const existing = await db
      .select()
      .from(damageDeductions)
      .where(eq(damageDeductions.id, id))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Deduction not found' },
        { status: 404 }
      );
    }

    // Parse and validate request body (Requirement 7.3)
    const body = await request.json();
    const validationResult = deductionSchema.safeParse(body);

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

    // Update deduction (Requirement 7.6)
    const result = await db
      .update(damageDeductions)
      .set({
        component: data.component,
        damageLevel: data.damageLevel,
        repairCostLow: data.repairCostEstimate.toString(),
        repairCostHigh: data.repairCostEstimate.toString(),
        valuationDeductionLow: data.valuationDeductionPercent.toString(),
        valuationDeductionHigh: data.valuationDeductionPercent.toString(),
        notes: data.description,
        updatedAt: new Date(),
      })
      .where(eq(damageDeductions.id, id))
      .returning();

    await valuationAuditService.log({
      entityType: 'deduction',
      entityId: id,
      action: 'update',
      userId: session.user.id,
      changes: buildChangedFields(existing[0] as Record<string, unknown>, result[0] as Record<string, unknown>),
    });

    return NextResponse.json({
      message: 'Deduction updated successfully',
      data: result[0]
    });
  } catch (error) {
    console.error('Error updating deduction:', error);
    
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json(
        { error: 'Deduction already exists for this component/damage level combination' },
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
 * DELETE /api/admin/deductions/[id]
 * Delete deduction
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

    // Check if deduction exists
    const existing = await db
      .select()
      .from(damageDeductions)
      .where(eq(damageDeductions.id, id))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Deduction not found' },
        { status: 404 }
      );
    }

    // Delete deduction
    await db
      .delete(damageDeductions)
      .where(eq(damageDeductions.id, id));

    await valuationAuditService.log({
      entityType: 'deduction',
      entityId: id,
      action: 'delete',
      userId: session.user.id,
      changes: {
        deduction: { old: existing[0], new: null },
      },
    });

    return NextResponse.json({
      message: 'Deduction deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting deduction:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
