import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq, and } from 'drizzle-orm';
import { uploadFile, validateFile } from '@/lib/storage/cloudinary';
import { logAction, AuditActionType, AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';
import { emailService } from '@/features/notifications/services/email.service';
import { rateLimit, createRateLimitHeaders } from '@/lib/utils/rate-limit';

const MAX_FILE_SIZE_MB = 5;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];

/**
 * POST /api/payments/[id]/upload-proof
 * Upload payment proof for bank transfer
 * 
 * Requirements: 25 (Bank Transfer Payment)
 * 
 * Acceptance Criteria:
 * - Accept payment receipt/screenshot upload (JPG/PDF, max 5MB)
 * - Upload to Cloudinary
 * - Set payment status to 'pending'
 * - Notify Finance Officer
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting: 5 uploads per hour per IP
    const rateLimitResult = await rateLimit(request, {
      limit: 5,
      window: 3600, // 1 hour
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many upload attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const { id: paymentId } = await params;

    // Add rate limit headers to response
    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Too many upload attempts. Please try again later.',
          retryAfter: rateLimitResult.retryAfter,
        },
        { 
          status: 429,
          headers: rateLimitHeaders,
        }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(paymentId)) {
      return NextResponse.json(
        { error: 'Invalid payment ID format' },
        { status: 400 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { error: 'Payment proof file is required' },
        { status: 400 }
      );
    }

    // Validate file (server-side validation - CRITICAL for security)
    const validation = validateFile(
      { size: file.size, type: file.type },
      MAX_FILE_SIZE_MB,
      ALLOWED_FILE_TYPES
    );

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Get payment details
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

    // Get vendor details to verify ownership
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

    // Check if payment is already verified
    if (payment.status === 'verified') {
      return NextResponse.json(
        { error: 'Payment is already verified' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cloudinary (server-side only - secure)
    const uploadResult = await uploadFile(buffer, {
      folder: `payment-proofs/${paymentId}`,
      resourceType: file.type === 'application/pdf' ? 'raw' : 'image',
      compress: file.type !== 'application/pdf', // Compress images but not PDFs
      tags: ['payment-proof', 'bank-transfer', paymentId],
    });

    // Update payment with proof URL and set status to pending
    const [updatedPayment] = await db
      .update(payments)
      .set({
        paymentProofUrl: uploadResult.secureUrl,
        status: 'pending',
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId))
      .returning();

    // Get user details for notification
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, vendor.userId))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Notify Finance Officers
    await notifyFinanceOfficers(payment, user, uploadResult.secureUrl);

    // Log activity
    await logAction({
      userId: vendor.userId,
      actionType: AuditActionType.BANK_TRANSFER_PROOF_UPLOADED,
      entityType: AuditEntityType.PAYMENT,
      entityId: paymentId,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '0.0.0.0',
      deviceType: request.headers.get('user-agent')?.toLowerCase().includes('mobile')
        ? DeviceType.MOBILE
        : DeviceType.DESKTOP,
      userAgent: request.headers.get('user-agent') || 'unknown',
      beforeState: {
        status: payment.status,
        paymentProofUrl: payment.paymentProofUrl,
      },
      afterState: {
        status: 'pending',
        paymentProofUrl: uploadResult.secureUrl,
      },
    });

    // Return updated payment details
    return NextResponse.json(updatedPayment, {
      headers: rateLimitHeaders,
    });
  } catch (error) {
    console.error('Error uploading payment proof:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload payment proof',
      },
      { status: 500 }
    );
  }
}

/**
 * Notify Finance Officers about new payment proof submission
 */
async function notifyFinanceOfficers(
  payment: typeof payments.$inferSelect,
  vendor: typeof users.$inferSelect,
  proofUrl: string
): Promise<void> {
  try {
    // Get all Finance Officers
    const financeOfficers = await db
      .select()
      .from(users)
      .where(eq(users.role, 'finance_officer'));

    if (financeOfficers.length === 0) {
      console.warn('No Finance Officers found to notify');
      return;
    }

    // Send email to each Finance Officer
    const emailPromises = financeOfficers.map(async (officer) => {
      const emailSubject = 'New Bank Transfer Payment Proof Submitted';
      const emailHtml = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Payment Proof Submitted</title>
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
                background-color: #800020;
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
                border-left: 4px solid #FFD700;
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
              .alert {
                background-color: #fff3cd;
                border: 1px solid #ffc107;
                border-radius: 6px;
                padding: 15px;
                margin: 20px 0;
              }
              .alert strong {
                color: #856404;
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
                <h1>New Payment Proof Submitted</h1>
              </div>
              
              <div class="content">
                <p><strong>Dear ${officer.fullName},</strong></p>
                
                <p>A vendor has submitted payment proof for a bank transfer that requires your verification.</p>
                
                <div class="payment-details">
                  <h3>Payment Details</h3>
                  <ul>
                    <li><strong>Payment ID:</strong> ${payment.id}</li>
                    <li><strong>Amount:</strong> ₦${parseFloat(payment.amount).toLocaleString()}</li>
                    <li><strong>Vendor:</strong> ${vendor.fullName}</li>
                    <li><strong>Vendor Email:</strong> ${vendor.email}</li>
                    <li><strong>Vendor Phone:</strong> ${vendor.phone}</li>
                    <li><strong>Payment Method:</strong> Bank Transfer</li>
                    <li><strong>Submitted:</strong> ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</li>
                  </ul>
                </div>
                
                <div class="alert">
                  <strong>⚠️ Action Required:</strong> Please review and verify this payment within 4 hours to ensure timely processing.
                </div>
                
                <div class="button-container">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/finance/payments" class="button">Review Payment</a>
                </div>
                
                <p style="margin-top: 30px;">Best regards,<br><strong>NEM Salvage Management System</strong></p>
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

      return emailService.sendEmail({
        to: officer.email,
        subject: emailSubject,
        html: emailHtml,
      });
    });

    await Promise.all(emailPromises);

    console.log(`Notified ${financeOfficers.length} Finance Officers about payment proof submission`);
  } catch (error) {
    console.error('Error notifying Finance Officers:', error);
    // Don't throw error - notification failure shouldn't block the upload
  }
}
