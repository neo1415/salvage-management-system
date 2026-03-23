import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { logAction, AuditActionType, AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';
import { smsService } from '@/features/notifications/services/sms.service';
import { emailService } from '@/features/notifications/services/email.service';
import { z } from 'zod';

/**
 * Tier 2 Approval Workflow API
 * Allows Salvage Manager to approve/reject Tier 2 vendor applications
 * 
 * Requirements (Requirement 7):
 * - Display all uploaded documents and verification statuses
 * - Require comment for rejection
 * - Update vendor status to 'verified_tier_2' on approval
 * - Send SMS + Email notification
 * - Create audit log entry
 */

// Validation schema
const approvalSchema = z.object({
  action: z.enum(['approve', 'reject']),
  comment: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (Next.js 15 requirement)
    const { id: vendorId } = await params;
    
    // Authenticate user
    const session = await getSession();
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const managerId = session.user.id;

    // Check if user is a Salvage Manager
    const [manager] = await db
      .select()
      .from(users)
      .where(eq(users.id, managerId))
      .limit(1);

    if (!manager || manager.role !== 'salvage_manager') {
      return NextResponse.json(
        { error: 'Only Salvage Managers can approve/reject Tier 2 applications' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const validation = approvalSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { action, comment } = validation.data;

    // Require comment for rejection
    if (action === 'reject' && (!comment || comment.trim().length === 0)) {
      return NextResponse.json(
        { error: 'Comment is required when rejecting an application' },
        { status: 400 }
      );
    }

    // Get vendor by ID (already extracted from params above)
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(vendorId)) {
      return NextResponse.json(
        { error: 'Invalid vendor ID format' },
        { status: 400 }
      );
    }
    
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    // Check if vendor is in pending status
    if (vendor.status !== 'pending') {
      return NextResponse.json(
        { error: `Vendor is not in pending status. Current status: ${vendor.status}` },
        { status: 400 }
      );
    }

    // Get vendor user details
    const [vendorUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, vendor.userId))
      .limit(1);

    if (!vendorUser) {
      return NextResponse.json(
        { error: 'Vendor user not found' },
        { status: 404 }
      );
    }

    if (action === 'approve') {
      // Approve Tier 2 application
      await db
        .update(vendors)
        .set({
          status: 'approved',
          tier: 'tier2_full',
          approvedBy: managerId,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, vendorId));

      // Update user status to verified_tier_2
      await db
        .update(users)
        .set({
          status: 'verified_tier_2',
          updatedAt: new Date(),
        })
        .where(eq(users.id, vendor.userId));

      // Log approval
      await logAction({
        userId: managerId,
        actionType: AuditActionType.TIER2_APPLICATION_APPROVED,
        entityType: AuditEntityType.KYC,
        entityId: vendorId,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        deviceType: DeviceType.DESKTOP,
        userAgent: request.headers.get('user-agent') || 'unknown',
        afterState: {
          vendorId,
          vendorName: vendorUser.fullName,
          businessName: vendor.businessName,
          approvedBy: manager.fullName,
          comment: comment || 'No comment provided',
        },
      });

      // Send SMS notification to vendor
      try {
        await smsService.sendSMS({
          to: vendorUser.phone,
          message: `Congratulations! Your Tier 2 verification is complete. You can now bid on high-value auctions above ₦500,000. - NEM Salvage`,
        });
      } catch (error) {
        console.error('Error sending SMS:', error);
      }

      // Send email notification to vendor
      try {
        await emailService.sendEmail({
          to: vendorUser.email,
          subject: 'Tier 2 Verification Approved - NEM Salvage',
          html: `
            <!DOCTYPE html>
            <html lang="en">
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Tier 2 Verification Approved</title>
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    margin: 0;
                    padding: 0;
                    background-color: #f5f5f5;
                  }
                  .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: #ffffff;
                  }
                  .header {
                    background-color: #800020;
                    color: white;
                    padding: 30px 20px;
                    text-align: center;
                  }
                  .header h1 {
                    margin: 0;
                    font-size: 24px;
                  }
                  .content {
                    padding: 30px 20px;
                  }
                  .success-badge {
                    background-color: #4CAF50;
                    color: white;
                    padding: 10px 20px;
                    border-radius: 6px;
                    text-align: center;
                    font-weight: 600;
                    margin: 20px 0;
                  }
                  .benefits {
                    background-color: #f9f9f9;
                    border-left: 4px solid #FFD700;
                    padding: 15px 20px;
                    margin: 20px 0;
                  }
                  .benefits ul {
                    margin: 10px 0;
                    padding-left: 20px;
                  }
                  .benefits li {
                    margin: 8px 0;
                  }
                  .button {
                    display: inline-block;
                    padding: 14px 28px;
                    background-color: #FFD700;
                    color: #800020;
                    text-decoration: none;
                    border-radius: 6px;
                    font-weight: 600;
                    margin: 20px 0;
                  }
                  .button-container {
                    text-align: center;
                    margin: 30px 0;
                  }
                  .footer {
                    text-align: center;
                    padding: 20px;
                    font-size: 12px;
                    color: #666;
                    background-color: #f5f5f5;
                    border-top: 1px solid #e0e0e0;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>🎉 Tier 2 Verification Approved!</h1>
                  </div>
                  
                  <div class="content">
                    <p><strong>Dear ${vendorUser.fullName},</strong></p>
                    
                    <div class="success-badge">
                      ✓ Your Tier 2 verification is complete
                    </div>
                    
                    <p>Congratulations! Your Tier 2 KYC application has been approved by our team. You now have full access to all premium features.</p>
                    
                    <div class="benefits">
                      <h3 style="margin-top: 0; color: #800020;">Your New Benefits:</h3>
                      <ul>
                        <li><strong>Unlimited Bidding:</strong> Bid on high-value auctions above ₦500,000</li>
                        <li><strong>Priority Support:</strong> Get faster response times from our support team</li>
                        <li><strong>Leaderboard Eligibility:</strong> Compete for top positions and recognition</li>
                        <li><strong>Tier 2 Badge:</strong> Display your verified business status</li>
                      </ul>
                    </div>
                    
                    <div class="button-container">
                      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://salvage.nem-insurance.com'}/vendor/auctions" class="button">Browse Premium Auctions</a>
                    </div>
                    
                    <p style="margin-top: 30px;">Best regards,<br><strong>NEM Salvage Management Team</strong></p>
                  </div>
                  
                  <div class="footer">
                    <p><strong>NEM Insurance Plc</strong></p>
                    <p>199 Ikorodu Road, Obanikoro, Lagos, Nigeria</p>
                    <p>Phone: 234-02-014489560 | Email: nemsupport@nem-insurance.com</p>
                  </div>
                </div>
              </body>
            </html>
          `,
        });
      } catch (error) {
        console.error('Error sending email:', error);
      }

      return NextResponse.json({
        success: true,
        message: 'Tier 2 application approved successfully',
        data: {
          vendorId,
          status: 'approved',
          tier: 'tier2_full',
          approvedBy: manager.fullName,
          approvedAt: new Date().toISOString(),
        },
      });
    } else {
      // Reject Tier 2 application
      // Maintain Tier 1 status, set vendor status back to approved
      await db
        .update(vendors)
        .set({
          status: 'approved', // Keep as approved Tier 1
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, vendorId));

      // Log rejection
      await logAction({
        userId: managerId,
        actionType: AuditActionType.TIER2_APPLICATION_REJECTED,
        entityType: AuditEntityType.KYC,
        entityId: vendorId,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        deviceType: DeviceType.DESKTOP,
        userAgent: request.headers.get('user-agent') || 'unknown',
        afterState: {
          vendorId,
          vendorName: vendorUser.fullName,
          businessName: vendor.businessName,
          rejectedBy: manager.fullName,
          reason: comment,
        },
      });

      // Send SMS notification to vendor
      try {
        await smsService.sendSMS({
          to: vendorUser.phone,
          message: `Your Tier 2 application requires additional information. Please check your email for details. - NEM Salvage`,
        });
      } catch (error) {
        console.error('Error sending SMS:', error);
      }

      // Send email notification to vendor with rejection reason
      try {
        await emailService.sendEmail({
          to: vendorUser.email,
          subject: 'Tier 2 Application - Additional Information Required',
          html: `
            <!DOCTYPE html>
            <html lang="en">
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Tier 2 Application Update</title>
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    margin: 0;
                    padding: 0;
                    background-color: #f5f5f5;
                  }
                  .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: #ffffff;
                  }
                  .header {
                    background-color: #800020;
                    color: white;
                    padding: 30px 20px;
                    text-align: center;
                  }
                  .header h1 {
                    margin: 0;
                    font-size: 24px;
                  }
                  .content {
                    padding: 30px 20px;
                  }
                  .info-box {
                    background-color: #fff3cd;
                    border-left: 4px solid #ffc107;
                    padding: 15px 20px;
                    margin: 20px 0;
                  }
                  .reason-box {
                    background-color: #f9f9f9;
                    border: 1px solid #e0e0e0;
                    padding: 15px 20px;
                    margin: 20px 0;
                    border-radius: 6px;
                  }
                  .reason-box h3 {
                    margin-top: 0;
                    color: #800020;
                  }
                  .next-steps {
                    background-color: #f9f9f9;
                    border-left: 4px solid #FFD700;
                    padding: 15px 20px;
                    margin: 20px 0;
                  }
                  .next-steps ol {
                    margin: 10px 0;
                    padding-left: 20px;
                  }
                  .next-steps li {
                    margin: 8px 0;
                  }
                  .button {
                    display: inline-block;
                    padding: 14px 28px;
                    background-color: #FFD700;
                    color: #800020;
                    text-decoration: none;
                    border-radius: 6px;
                    font-weight: 600;
                    margin: 20px 0;
                  }
                  .button-container {
                    text-align: center;
                    margin: 30px 0;
                  }
                  .footer {
                    text-align: center;
                    padding: 20px;
                    font-size: 12px;
                    color: #666;
                    background-color: #f5f5f5;
                    border-top: 1px solid #e0e0e0;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>Tier 2 Application Update</h1>
                  </div>
                  
                  <div class="content">
                    <p><strong>Dear ${vendorUser.fullName},</strong></p>
                    
                    <div class="info-box">
                      <p style="margin: 0;"><strong>Your Tier 2 application requires additional information before we can proceed.</strong></p>
                    </div>
                    
                    <p>Thank you for submitting your Tier 2 KYC application. After careful review, we need some additional information or clarification to complete your verification.</p>
                    
                    <div class="reason-box">
                      <h3>Feedback from Our Team:</h3>
                      <p>${comment || 'Please contact support for more details.'}</p>
                    </div>
                    
                    <div class="next-steps">
                      <h3 style="margin-top: 0; color: #800020;">Next Steps:</h3>
                      <ol>
                        <li>Review the feedback above carefully</li>
                        <li>Prepare the required documents or corrections</li>
                        <li>Resubmit your Tier 2 application with the updated information</li>
                      </ol>
                    </div>
                    
                    <p><strong>Good News:</strong> Your Tier 1 status remains active, so you can continue bidding on auctions up to ₦500,000 while you prepare your resubmission.</p>
                    
                    <div class="button-container">
                      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://salvage.nem-insurance.com'}/vendor/kyc/tier2" class="button">Resubmit Application</a>
                    </div>
                    
                    <p>If you have any questions or need assistance, please don't hesitate to contact our support team:</p>
                    <ul>
                      <li>Phone: 234-02-014489560</li>
                      <li>Email: nemsupport@nem-insurance.com</li>
                    </ul>
                    
                    <p style="margin-top: 30px;">Best regards,<br><strong>NEM Salvage Management Team</strong></p>
                  </div>
                  
                  <div class="footer">
                    <p><strong>NEM Insurance Plc</strong></p>
                    <p>199 Ikorodu Road, Obanikoro, Lagos, Nigeria</p>
                    <p>Phone: 234-02-014489560 | Email: nemsupport@nem-insurance.com</p>
                  </div>
                </div>
              </body>
            </html>
          `,
        });
      } catch (error) {
        console.error('Error sending email:', error);
      }

      return NextResponse.json({
        success: true,
        message: 'Tier 2 application rejected. Vendor notified with feedback.',
        data: {
          vendorId,
          status: 'approved', // Maintains Tier 1
          tier: 'tier1_bvn',
          rejectedBy: manager.fullName,
          reason: comment,
        },
      });
    }
  } catch (error) {
    console.error('Error processing Tier 2 approval:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
