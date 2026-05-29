import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { emailService } from '@/features/notifications/services/email.service';
import { smsService } from '@/features/notifications/services/sms.service';
import { brandTeamName, getEmailBranding } from '@/features/notifications/templates/email-branding';
import { wrapProfessionalEmail } from '@/features/notifications/templates/wrap-professional-email';

/**
 * Vendor Approval/Rejection API
 * 
 * Allows Salvage Managers to approve or reject vendor KYC applications
 * Sends email and SMS notifications to vendors
 * 
 * Requirements: 7, NFR5.3
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  let vendorId: string | undefined;
  
  try {
    // Await params (Next.js 15+ requirement)
    const { id } = await params;
    vendorId = id;

    console.log('🔄 [VENDOR APPROVAL] Starting approval process for vendor:', id);

    // Authenticate user
    const session = await getSession();
    if (!session || !session.user) {
      console.error('❌ [VENDOR APPROVAL] Unauthorized - no session');
      return NextResponse.json(
        { error: 'Unauthorized', success: false },
        { status: 401 }
      );
    }

    console.log('✅ [VENDOR APPROVAL] User authenticated:', session.user.id);

    // Check if user is a Salvage Manager
    const [manager] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!manager || manager.role !== 'salvage_manager') {
      console.error('❌ [VENDOR APPROVAL] Forbidden - user is not a salvage manager:', {
        userId: session.user.id,
        role: manager?.role,
      });
      return NextResponse.json(
        { error: 'Only Salvage Managers can review vendor applications', success: false },
        { status: 403 }
      );
    }

    console.log('✅ [VENDOR APPROVAL] Manager verified:', manager.id);

    // Parse request body
    const body = await request.json();
    const { action, comment } = body;
    const branding = await getEmailBranding();

    console.log('📦 [VENDOR APPROVAL] Request body:', { action, hasComment: !!comment });

    // Validate action
    if (!action || !['approve', 'reject'].includes(action)) {
      console.error('❌ [VENDOR APPROVAL] Invalid action:', action);
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"', success: false },
        { status: 400 }
      );
    }

    // Validate comment for rejection
    if (action === 'reject' && (!comment || comment.trim().length === 0)) {
      console.error('❌ [VENDOR APPROVAL] Rejection requires comment');
      return NextResponse.json(
        { error: 'Comment is required for rejection', success: false },
        { status: 400 }
      );
    }

    // Get vendor
    console.log('🔍 [VENDOR APPROVAL] Fetching vendor from database...');
    const [vendor] = await db
      .select({
        id: vendors.id,
        userId: vendors.userId,
        businessName: vendors.businessName,
        tier: vendors.tier,
        status: vendors.status,
        tier2SubmittedAt: vendors.tier2SubmittedAt,
      })
      .from(vendors)
      .where(eq(vendors.id, id))
      .limit(1);

    if (!vendor) {
      console.error('❌ [VENDOR APPROVAL] Vendor not found:', id);
      return NextResponse.json(
        { error: 'Vendor not found', success: false },
        { status: 404 }
      );
    }

    console.log('✅ [VENDOR APPROVAL] Vendor found:', {
      id: vendor.id,
      businessName: vendor.businessName,
      tier: vendor.tier,
      status: vendor.status,
      tier2SubmittedAt: vendor.tier2SubmittedAt,
    });

    // Get vendor user details for notifications
    console.log('🔍 [VENDOR APPROVAL] Fetching vendor user details...');
    const [vendorUser] = await db
      .select({
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
      })
      .from(users)
      .where(eq(users.id, vendor.userId))
      .limit(1);

    if (!vendorUser) {
      console.error('❌ [VENDOR APPROVAL] Vendor user not found:', vendor.userId);
      return NextResponse.json(
        { error: 'Vendor user not found', success: false },
        { status: 404 }
      );
    }

    console.log('✅ [VENDOR APPROVAL] Vendor user found:', {
      fullName: vendorUser.fullName,
      email: vendorUser.email,
    });

    // Update vendor based on action
    if (action === 'approve') {
      console.log('✅ [VENDOR APPROVAL] Processing approval...');
      
      // Determine if this is a Tier 2 approval based on tier2SubmittedAt
      const isTier2Approval = vendor.tier2SubmittedAt !== null;
      
      console.log('📊 [VENDOR APPROVAL] Approval type:', {
        isTier2Approval,
        currentTier: vendor.tier,
        tier2SubmittedAt: vendor.tier2SubmittedAt,
      });

      const updateData = {
        status: 'approved' as const,
        tier: isTier2Approval ? ('tier2_full' as const) : vendor.tier,
        approvedBy: manager.id,
        approvedAt: new Date(),
        tier2ApprovedAt: isTier2Approval ? new Date() : undefined,
        tier2ApprovedBy: isTier2Approval ? manager.id : undefined,
        tier2ExpiresAt: isTier2Approval 
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
          : undefined,
        tier2RejectionReason: null, // Clear any previous rejection reason
        updatedAt: new Date(),
      };

      console.log('💾 [VENDOR APPROVAL] Updating vendor in database:', updateData);

      const updateResult = await db
        .update(vendors)
        .set(updateData)
        .where(eq(vendors.id, id))
        .returning();

      console.log('✅ [VENDOR APPROVAL] Database update result:', {
        rowsAffected: updateResult.length,
        updatedVendor: updateResult[0],
      });

      if (updateResult.length === 0) {
        console.error('❌ [VENDOR APPROVAL] Database update failed - no rows affected');
        throw new Error('Failed to update vendor in database');
      }

      // Determine tier display text for email
      const tierDisplayText = isTier2Approval 
        ? 'Tier 2 (Full Business KYC)' 
        : vendor.tier === 'tier1_bvn' 
          ? 'Tier 1 (BVN Verified)' 
          : 'Tier 0 (No BVN)';

      console.log('📧 [VENDOR APPROVAL] Sending approval email...');
      
      // Send approval email
      try {
        await emailService.sendEmail({
          to: vendorUser.email,
          subject: 'KYC Application Approved',
          html: await wrapProfessionalEmail(
            'KYC Application Approved',
            `
            <p>Dear ${vendorUser.fullName},</p>
            <p>We are pleased to inform you that your KYC application for <strong>${vendor.businessName || 'your vendor account'}</strong> has been approved.</p>
            <p><strong>Tier:</strong> ${tierDisplayText}</p>
            ${comment ? `<p><strong>Manager's Note:</strong> ${comment}</p>` : ''}
            <p>You can now participate in auctions and bid on salvage assets.</p>
            ${isTier2Approval ? '<p><strong>Tier 2 Benefits:</strong> Unlimited bidding, leaderboard access, and priority support.</p>' : ''}
            <p>Thank you for choosing ${branding.brandName}.</p>
            <p>Best regards,<br>${brandTeamName(branding)}</p>
          `,
            `Your ${branding.brandName} KYC application has been approved.`
          ),
        });
        console.log('✅ [VENDOR APPROVAL] Approval email sent successfully');
      } catch (emailError) {
        console.error('⚠️ [VENDOR APPROVAL] Failed to send approval email:', emailError);
        // Don't fail the entire request if email fails
      }

      console.log('📱 [VENDOR APPROVAL] Sending approval SMS...');
      
      // Send approval SMS
      try {
        await smsService.sendSMS({
          to: vendorUser.phone,
          message: `${branding.brandName}: Your KYC application has been approved. You can now participate in eligible auctions.`,
        });
        console.log('✅ [VENDOR APPROVAL] Approval SMS sent successfully');
      } catch (smsError) {
        console.error('⚠️ [VENDOR APPROVAL] Failed to send approval SMS:', smsError);
        // Don't fail the entire request if SMS fails
      }

      const duration = Date.now() - startTime;
      console.log(`✅ [VENDOR APPROVAL] Approval completed successfully in ${duration}ms`);

      return NextResponse.json({
        success: true,
        message: 'Vendor approved successfully',
        vendor: {
          id: vendor.id,
          status: 'approved',
          tier: updateData.tier,
        },
      });
    } else {
      console.log('❌ [VENDOR APPROVAL] Processing rejection...');
      
      const updateData = {
        status: 'suspended' as const,
        tier2RejectionReason: comment.trim(),
        updatedAt: new Date(),
      };

      console.log('💾 [VENDOR APPROVAL] Updating vendor in database:', updateData);

      const updateResult = await db
        .update(vendors)
        .set(updateData)
        .where(eq(vendors.id, id))
        .returning();

      console.log('✅ [VENDOR APPROVAL] Database update result:', {
        rowsAffected: updateResult.length,
        updatedVendor: updateResult[0],
      });

      if (updateResult.length === 0) {
        console.error('❌ [VENDOR APPROVAL] Database update failed - no rows affected');
        throw new Error('Failed to update vendor in database');
      }

      console.log('📧 [VENDOR APPROVAL] Sending rejection email...');
      
      // Send rejection email
      try {
        await emailService.sendEmail({
          to: vendorUser.email,
          subject: 'KYC Application Requires Attention',
          html: await wrapProfessionalEmail(
            'KYC Application Update Required',
            `
            <p>Dear ${vendorUser.fullName},</p>
            <p>Thank you for submitting your KYC application for <strong>${vendor.businessName || 'your vendor account'}</strong>.</p>
            <p>Unfortunately, we need you to update your application before we can proceed with approval.</p>
            <p><strong>Reason:</strong></p>
            <p>${comment}</p>
            <p><strong>Next Steps:</strong></p>
            <ul>
              <li>Log in to your account</li>
              <li>Navigate to the KYC section</li>
              <li>Update your information based on the feedback above</li>
              <li>Resubmit your application</li>
            </ul>
            <p>If you have any questions, please contact our support team.</p>
            <p>Best regards,<br>${brandTeamName(branding)}</p>
          `,
            `Your ${branding.brandName} KYC application needs updates.`
          ),
        });
        console.log('✅ [VENDOR APPROVAL] Rejection email sent successfully');
      } catch (emailError) {
        console.error('⚠️ [VENDOR APPROVAL] Failed to send rejection email:', emailError);
        // Don't fail the entire request if email fails
      }

      console.log('📱 [VENDOR APPROVAL] Sending rejection SMS...');
      
      // Send rejection SMS
      try {
        await smsService.sendSMS({
          to: vendorUser.phone,
          message: `${branding.brandName}: Your KYC application needs updates. Reason: ${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}. Please check your email for details.`,
        });
        console.log('✅ [VENDOR APPROVAL] Rejection SMS sent successfully');
      } catch (smsError) {
        console.error('⚠️ [VENDOR APPROVAL] Failed to send rejection SMS:', smsError);
        // Don't fail the entire request if SMS fails
      }

      const duration = Date.now() - startTime;
      console.log(`✅ [VENDOR APPROVAL] Rejection completed successfully in ${duration}ms`);

      return NextResponse.json({
        success: true,
        message: 'Vendor rejected successfully',
        vendor: {
          id: vendor.id,
          status: 'rejected',
          rejectionReason: comment.trim(),
        },
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [VENDOR APPROVAL] Error processing vendor review (${duration}ms):`, {
      vendorId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        success: false,
      },
      { status: 500 }
    );
  }
}
