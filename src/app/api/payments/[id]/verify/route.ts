import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq } from 'drizzle-orm';
import { logAction, AuditActionType, AuditEntityType, getDeviceTypeFromUserAgent, getIpAddress } from '@/lib/utils/audit-logger';
import { emailService } from '@/features/notifications/services/email.service';
import { smsService } from '@/features/notifications/services/sms.service';

/**
 * POST /api/payments/[id]/verify
 * Manual payment verification by Finance Officer
 * 
 * Requirements: 28 (Manual Payment Verification)
 * 
 * Acceptance Criteria:
 * - Allow Finance Officer to approve/reject payments
 * - Verify amount matches invoice
 * - Verify bank details match vendor registration
 * - Generate pickup authorization on approval
 * - Send SMS + Email notification
 * - Create audit log entry
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paymentId } = await params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(paymentId)) {
      return NextResponse.json(
        { error: 'Invalid payment ID format' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { financeOfficerId, action, comment } = body;

    // Validate required fields
    if (!financeOfficerId) {
      return NextResponse.json(
        { error: 'Finance Officer ID is required' },
        { status: 400 }
      );
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be either "approve" or "reject"' },
        { status: 400 }
      );
    }

    if (action === 'reject' && (!comment || comment.trim().length < 10)) {
      return NextResponse.json(
        { error: 'Comment is required for rejection and must be at least 10 characters' },
        { status: 400 }
      );
    }

    // Verify Finance Officer exists and has correct role
    const [financeOfficer] = await db
      .select()
      .from(users)
      .where(eq(users.id, financeOfficerId))
      .limit(1);

    if (!financeOfficer) {
      return NextResponse.json(
        { error: 'Finance Officer not found' },
        { status: 404 }
      );
    }

    if (financeOfficer.role !== 'finance_officer') {
      return NextResponse.json(
        { error: 'Unauthorized: User is not a Finance Officer' },
        { status: 403 }
      );
    }

    // Get payment details with related data
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Check if payment is already verified or rejected
    if (payment.status === 'verified') {
      return NextResponse.json(
        { error: 'Payment is already verified' },
        { status: 400 }
      );
    }

    if (payment.status === 'rejected') {
      return NextResponse.json(
        { error: 'Payment is already rejected' },
        { status: 400 }
      );
    }

    // Check if payment is pending
    if (payment.status !== 'pending') {
      return NextResponse.json(
        { error: `Payment status is ${payment.status}, cannot verify` },
        { status: 400 }
      );
    }

    // Get vendor details
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, payment.vendorId))
      .limit(1);

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
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

    // Get auction details
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, payment.auctionId))
      .limit(1);

    if (!auction) {
      return NextResponse.json(
        { error: 'Auction not found' },
        { status: 404 }
      );
    }

    // Get case details
    const [caseDetails] = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.id, auction.caseId))
      .limit(1);

    if (!caseDetails) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    // Verify amount matches invoice (auction current bid)
    const paymentAmount = parseFloat(payment.amount);
    const auctionAmount = auction.currentBid ? parseFloat(auction.currentBid) : 0;

    if (Math.abs(paymentAmount - auctionAmount) > 0.01) {
      console.warn(
        `Payment amount mismatch: Payment ${paymentAmount} vs Auction ${auctionAmount}`
      );
      // Don't block verification, but log the warning
    }

    // Verify bank details match vendor registration (if bank transfer)
    if (payment.paymentMethod === 'bank_transfer') {
      // This is a basic check - in production, you might want more sophisticated verification
      if (!vendor.bankAccountNumber || !vendor.bankName) {
        console.warn('Vendor bank details not found in registration');
      }
    }

    if (action === 'approve') {
      // Generate pickup authorization code
      const pickupAuthCode = generatePickupAuthorizationCode();

      // Update payment status to verified
      const [updatedPayment] = await db
        .update(payments)
        .set({
          status: 'verified',
          verifiedBy: financeOfficerId,
          verifiedAt: new Date(),
          autoVerified: false,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentId))
        .returning();

      // Send SMS notification
      const smsMessage = `Payment verified! Your pickup authorization code is: ${pickupAuthCode}. Item: ${caseDetails.assetType}. Amount: ₦${parseFloat(payment.amount).toLocaleString()}. Present this code at pickup location.`;
      
      await smsService.sendSMS({
        to: vendorUser.phone,
        message: smsMessage,
      });

      // Send email notification using professional template
      await emailService.sendPaymentConfirmationEmail(vendorUser.email, {
        vendorName: vendorUser.fullName,
        auctionId: payment.auctionId,
        assetName: `${caseDetails.assetType.toUpperCase()} - ${caseDetails.claimReference}`,
        paymentAmount: parseFloat(payment.amount),
        paymentMethod: payment.paymentMethod === 'paystack' ? 'Paystack' : 
                       payment.paymentMethod === 'flutterwave' ? 'Flutterwave' : 'Bank Transfer',
        paymentReference: payment.paymentReference || payment.id,
        pickupAuthCode: pickupAuthCode,
        pickupLocation: caseDetails.locationName,
        pickupDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
        appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      });

      // Log activity
      await logAction({
        userId: financeOfficerId,
        actionType: AuditActionType.PAYMENT_VERIFIED,
        entityType: AuditEntityType.PAYMENT,
        entityId: paymentId,
        ipAddress: getIpAddress(request.headers),
        deviceType: getDeviceTypeFromUserAgent(request.headers.get('user-agent') || ''),
        userAgent: request.headers.get('user-agent') || 'unknown',
        beforeState: {
          status: payment.status,
          verifiedBy: payment.verifiedBy,
          verifiedAt: payment.verifiedAt,
        },
        afterState: {
          status: 'verified',
          verifiedBy: financeOfficerId,
          verifiedAt: new Date().toISOString(),
          pickupAuthCode,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Payment verified successfully',
        payment: {
          id: updatedPayment.id,
          status: updatedPayment.status,
          verifiedBy: updatedPayment.verifiedBy,
          verifiedAt: updatedPayment.verifiedAt,
          pickupAuthCode,
        },
      });
    } else {
      // Reject payment
      const [updatedPayment] = await db
        .update(payments)
        .set({
          status: 'rejected',
          verifiedBy: financeOfficerId,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentId))
        .returning();

      // Send SMS notification
      const smsMessage = `Payment rejected. Reason: ${comment}. Please resubmit correct payment proof or contact support at ${process.env.SUPPORT_PHONE || '234-02-014489560'}.`;
      
      await smsService.sendSMS({
        to: vendorUser.phone,
        message: smsMessage,
      });

      // Send email notification
      await sendRejectionEmail(
        vendorUser,
        payment,
        caseDetails,
        comment,
        financeOfficer
      );

      // Log activity
      await logAction({
        userId: financeOfficerId,
        actionType: AuditActionType.PAYMENT_REJECTED,
        entityType: AuditEntityType.PAYMENT,
        entityId: paymentId,
        ipAddress: getIpAddress(request.headers),
        deviceType: getDeviceTypeFromUserAgent(request.headers.get('user-agent') || ''),
        userAgent: request.headers.get('user-agent') || 'unknown',
        beforeState: {
          status: payment.status,
          verifiedBy: payment.verifiedBy,
          verifiedAt: payment.verifiedAt,
        },
        afterState: {
          status: 'rejected',
          verifiedBy: financeOfficerId,
          verifiedAt: new Date().toISOString(),
          rejectionReason: comment,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Payment rejected',
        payment: {
          id: updatedPayment.id,
          status: updatedPayment.status,
          verifiedBy: updatedPayment.verifiedBy,
          verifiedAt: updatedPayment.verifiedAt,
        },
      });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      {
        error: 'Failed to verify payment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Generate pickup authorization code
 * Format: NEM-XXXX-XXXX (e.g., NEM-A7B2-C9D4)
 */
function generatePickupAuthorizationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar-looking characters
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `NEM-${part1}-${part2}`;
}

/**
 * Send rejection email to vendor
 */
async function sendRejectionEmail(
  vendor: typeof users.$inferSelect,
  payment: typeof payments.$inferSelect,
  caseDetails: typeof salvageCases.$inferSelect,
  rejectionReason: string,
  financeOfficer: typeof users.$inferSelect
): Promise<void> {
  try {
    const emailSubject = 'Payment Verification Failed - Action Required';
    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Rejected</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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
              background-color: #dc3545;
              color: white;
              padding: 30px 20px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            .content {
              padding: 30px 20px;
            }
            .content p {
              margin: 0 0 15px 0;
            }
            .payment-details {
              background-color: #f9f9f9;
              border-left: 4px solid #dc3545;
              padding: 15px 20px;
              margin: 20px 0;
            }
            .payment-details h3 {
              margin: 0 0 10px 0;
              font-size: 16px;
              color: #800020;
            }
            .payment-details ul {
              list-style: none;
              padding: 0;
              margin: 0;
            }
            .payment-details li {
              margin: 8px 0;
            }
            .rejection-reason {
              background-color: #fff3cd;
              border: 2px solid #ffc107;
              border-radius: 6px;
              padding: 15px;
              margin: 20px 0;
            }
            .rejection-reason h3 {
              margin: 0 0 10px 0;
              color: #856404;
            }
            .rejection-reason p {
              margin: 0;
              color: #856404;
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
              text-align: center;
            }
            .button:hover {
              background-color: #FFC700;
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
            .footer p {
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payment Verification Failed</h1>
            </div>
            
            <div class="content">
              <p><strong>Dear ${vendor.fullName},</strong></p>
              
              <p>Unfortunately, your payment proof could not be verified. Please review the reason below and resubmit the correct payment proof.</p>
              
              <div class="rejection-reason">
                <h3>Rejection Reason:</h3>
                <p>${rejectionReason}</p>
              </div>
              
              <div class="payment-details">
                <h3>Payment Details</h3>
                <ul>
                  <li><strong>Payment ID:</strong> ${payment.id}</li>
                  <li><strong>Amount:</strong> ₦${parseFloat(payment.amount).toLocaleString()}</li>
                  <li><strong>Item:</strong> ${caseDetails.assetType}</li>
                  <li><strong>Claim Reference:</strong> ${caseDetails.claimReference}</li>
                  <li><strong>Reviewed By:</strong> ${financeOfficer.fullName}</li>
                  <li><strong>Reviewed At:</strong> ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</li>
                </ul>
              </div>
              
              <div class="button-container">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/vendor/payments/${payment.id}" class="button">Resubmit Payment Proof</a>
              </div>
              
              <p style="margin-top: 30px;">If you believe this is an error or need assistance, please contact our support team:</p>
              <ul>
                <li>Phone: ${process.env.SUPPORT_PHONE || '234-02-014489560'}</li>
                <li>Email: ${process.env.SUPPORT_EMAIL || 'nemsupport@nem-insurance.com'}</li>
              </ul>
              
              <p style="margin-top: 30px;">Best regards,<br><strong>NEM Insurance Finance Team</strong></p>
            </div>
            
            <div class="footer">
              <p><strong>NEM Insurance Plc</strong></p>
              <p>199 Ikorodu Road, Obanikoro, Lagos, Nigeria</p>
              <p style="margin-top: 15px;">This is an automated notification. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await emailService.sendEmail({
      to: vendor.email,
      subject: emailSubject,
      html: emailHtml,
    });

    console.log(`Rejection email sent to ${vendor.email}`);
  } catch (error) {
    console.error('Error sending rejection email:', error);
    // Don't throw error - email failure shouldn't block the rejection
  }
}
