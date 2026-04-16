/**
 * Fraud Alert Review API
 * Task 4.5.3: Implement fraud alert review workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fraudAlerts } from '@/lib/db/schema/intelligence';
import { eq } from 'drizzle-orm';
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { action, notes } = body;

    if (!['dismiss', 'confirm', 'investigate'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be: dismiss, confirm, or investigate' },
        { status: 400 }
      );
    }

    // Get existing alert to preserve metadata
    const [existingAlert] = await db
      .select()
      .from(fraudAlerts)
      .where(eq(fraudAlerts.id, id))
      .limit(1);

    if (!existingAlert) {
      return NextResponse.json(
        { error: 'Fraud alert not found' },
        { status: 404 }
      );
    }

    // Update fraud alert status, preserving existing metadata and adding review notes
    const updatedMetadata = {
      ...(existingAlert.metadata || {}),
      reviewNotes: notes || undefined,
    };

    const [updatedAlert] = await db
      .update(fraudAlerts)
      .set({
        status: action === 'dismiss' ? 'dismissed' : action === 'confirm' ? 'confirmed' : 'reviewed',
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        metadata: updatedMetadata,
      })
      .where(eq(fraudAlerts.id, id))
      .returning();

    if (!updatedAlert) {
      return NextResponse.json(
        { error: 'Fraud alert not found' },
        { status: 404 }
      );
    }

    // If confirmed, take additional actions based on entity type
    if (action === 'confirm') {
      await handleConfirmedFraud(updatedAlert);
    }

    return NextResponse.json({
      success: true,
      alert: updatedAlert,
    });
  } catch (error) {
    console.error('Error reviewing fraud alert:', error);
    return NextResponse.json(
      { error: 'Failed to review fraud alert' },
      { status: 500 }
    );
  }
}

/**
 * Handle confirmed fraud cases
 */
async function handleConfirmedFraud(alert: any) {
  // Import dynamically to avoid circular dependencies
  const { vendors } = await import('@/lib/db/schema/vendors');
  const { users } = await import('@/lib/db/schema/users');
  const { auctions } = await import('@/lib/db/schema/auctions');

  try {
    switch (alert.entityType) {
      case 'vendor':
        // Suspend vendor account - no suspensionReason field, use performanceStats.fraudFlags
        const currentVendor = await db
          .select()
          .from(vendors)
          .where(eq(vendors.id, alert.entityId))
          .limit(1);
        
        if (currentVendor[0]) {
          const updatedStats = {
            ...(currentVendor[0].performanceStats as any),
            fraudFlags: ((currentVendor[0].performanceStats as any)?.fraudFlags || 0) + 1,
          };
          
          await db
            .update(vendors)
            .set({ 
              status: 'suspended',
              performanceStats: updatedStats,
              updatedAt: new Date(),
            })
            .where(eq(vendors.id, alert.entityId));
        }
        break;

      case 'user':
        // Suspend user account
        await db
          .update(users)
          .set({ 
            status: 'suspended',
            updatedAt: new Date(),
          })
          .where(eq(users.id, alert.entityId));
        break;

      case 'auction':
        // Cancel auction if still active
        await db
          .update(auctions)
          .set({ 
            status: 'cancelled',
            updatedAt: new Date(),
          })
          .where(eq(auctions.id, alert.entityId));
        break;

      case 'case':
        // Cancel case - use 'cancelled' status instead of 'rejected'
        const { salvageCases } = await import('@/lib/db/schema/cases');
        await db
          .update(salvageCases)
          .set({ 
            status: 'cancelled',
            updatedAt: new Date(),
          })
          .where(eq(salvageCases.id, alert.entityId));
        break;
    }

    console.log(`✅ Handled confirmed fraud for ${alert.entityType} ${alert.entityId}`);
  } catch (error) {
    console.error('Error handling confirmed fraud:', error);
    throw error;
  }
}
