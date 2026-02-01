import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { users, vendors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyBVN, encryptBVN } from '@/features/vendors/services/bvn-verification.service';
import { emailService } from '@/features/notifications/services/email.service';
import { smsService } from '@/features/notifications/services/sms.service';
import { logAction, createAuditLogData, AuditActionType, AuditEntityType } from '@/lib/utils/audit-logger';
import { auth } from '@/lib/auth/next-auth.config';

/**
 * POST /api/vendors/verify-bvn
 * 
 * Tier 1 KYC Verification API
 * Verifies vendor BVN and auto-approves to Tier 1 on successful match
 * 
 * Requirements: 4, Enterprise Standards Section 6.1
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login to continue.' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 2. Parse and validate request body
    const body = await request.json();
    const { bvn } = body;

    // Validate BVN format (11 digits)
    if (!bvn || typeof bvn !== 'string') {
      return NextResponse.json(
        { error: 'BVN is required' },
        { status: 400 }
      );
    }

    if (!/^\d{11}$/.test(bvn)) {
      return NextResponse.json(
        { error: 'Invalid BVN format. BVN must be exactly 11 digits.' },
        { status: 400 }
      );
    }

    // 3. Get user details from database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is a vendor
    if (user.role !== 'vendor') {
      return NextResponse.json(
        { error: 'Only vendors can complete BVN verification' },
        { status: 403 }
      );
    }

    // 4. Check if vendor record exists, create if not
    let [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, userId))
      .limit(1);

    if (!vendor) {
      // Create vendor record
      const [newVendor] = await db
        .insert(vendors)
        .values({
          userId,
          tier: 'tier1_bvn',
          status: 'pending',
          categories: [],
          performanceStats: {
            totalBids: 0,
            totalWins: 0,
            winRate: 0,
            avgPaymentTimeHours: 0,
            onTimePickupRate: 0,
            fraudFlags: 0,
          },
          rating: '0.00',
        })
        .returning();
      
      vendor = newVendor;
    }

    // Check if already verified
    if (vendor.bvnVerifiedAt) {
      return NextResponse.json(
        { 
          error: 'BVN already verified',
          message: 'Your BVN has already been verified. You are a Tier 1 vendor.',
        },
        { status: 400 }
      );
    }

    // 5. Log BVN verification initiation
    await logAction(
      createAuditLogData(
        request,
        userId,
        AuditActionType.BVN_VERIFICATION_INITIATED,
        AuditEntityType.KYC,
        vendor.id,
        undefined,
        { bvn: `***${bvn.slice(-4)}` }
      )
    );

    // 6. Call BVN verification service
    const [firstName, ...lastNameParts] = user.fullName.split(' ');
    const lastName = lastNameParts.join(' ');

    const verificationResult = await verifyBVN({
      bvn,
      firstName,
      lastName,
      dateOfBirth: user.dateOfBirth.toISOString().split('T')[0], // YYYY-MM-DD
      phone: user.phone,
    });

    // 7. Handle verification failure
    if (!verificationResult.success) {
      await logAction(
        createAuditLogData(
          request,
          userId,
          AuditActionType.BVN_VERIFICATION_FAILED,
          AuditEntityType.KYC,
          vendor.id,
          undefined,
          { 
            error: verificationResult.error,
            bvn: `***${bvn.slice(-4)}`,
          }
        )
      );

      return NextResponse.json(
        { 
          error: 'BVN verification failed',
          message: verificationResult.error || 'Unable to verify BVN. Please try again.',
        },
        { status: 400 }
      );
    }

    // 8. Handle verification mismatch
    if (!verificationResult.verified) {
      await logAction(
        createAuditLogData(
          request,
          userId,
          AuditActionType.BVN_VERIFICATION_FAILED,
          AuditEntityType.KYC,
          vendor.id,
          undefined,
          { 
            matchScore: verificationResult.matchScore,
            mismatches: verificationResult.mismatches,
            bvn: `***${bvn.slice(-4)}`,
          }
        )
      );

      return NextResponse.json(
        { 
          error: 'BVN details do not match',
          message: 'The BVN details do not match your registration information. Please ensure your name, date of birth, and phone number match your BVN records.',
          matchScore: verificationResult.matchScore,
          mismatches: verificationResult.mismatches,
        },
        { status: 400 }
      );
    }

    // 9. Encrypt and store BVN
    const encryptedBVN = encryptBVN(bvn);

    // 10. Update vendor record - Auto-approve to Tier 1
    await db
      .update(vendors)
      .set({
        bvnEncrypted: encryptedBVN,
        bvnVerifiedAt: new Date(),
        tier: 'tier1_bvn',
        status: 'approved',
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, vendor.id));

    // 11. Update user status to verified_tier_1
    await db
      .update(users)
      .set({
        status: 'verified_tier_1',
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // 12. Log successful verification
    await logAction(
      createAuditLogData(
        request,
        userId,
        AuditActionType.BVN_VERIFICATION_SUCCESSFUL,
        AuditEntityType.KYC,
        vendor.id,
        { tier: vendor.tier, status: vendor.status },
        { 
          tier: 'tier1_bvn',
          status: 'approved',
          bvn: `***${bvn.slice(-4)}`,
          matchScore: verificationResult.matchScore,
        }
      )
    );

    // 13. Send SMS notification
    const smsResult = await smsService.sendTier1ApprovalSMS(user.phone, user.fullName);
    if (!smsResult.success) {
      console.error('Failed to send Tier 1 approval SMS:', smsResult.error);
    }

    // 14. Send email notification
    const emailResult = await emailService.sendEmail({
      to: user.email,
      subject: 'Congratulations! Tier 1 Verification Complete',
      html: getTier1ApprovalEmailTemplate(user.fullName),
    });
    if (!emailResult.success) {
      console.error('Failed to send Tier 1 approval email:', emailResult.error);
    }

    // 15. Return success response
    return NextResponse.json(
      {
        success: true,
        message: 'Congratulations! Your Tier 1 verification is complete. You can now bid up to ₦500,000.',
        data: {
          tier: 'tier1_bvn',
          status: 'approved',
          bvnVerified: true,
          maxBidAmount: 500000,
        },
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('BVN verification API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'An unexpected error occurred. Please try again later.',
      },
      { status: 500 }
    );
  }
}

/**
 * Get Tier 1 approval email template
 */
function getTier1ApprovalEmailTemplate(fullName: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://salvage.nem-insurance.com';
  
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tier 1 Verification Complete</title>
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
          .badge {
            display: inline-block;
            background-color: #FFD700;
            color: #800020;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            margin-top: 10px;
          }
          .content {
            padding: 30px 20px;
          }
          .content p {
            margin: 0 0 15px 0;
          }
          .success-icon {
            text-align: center;
            font-size: 64px;
            margin: 20px 0;
          }
          .benefits {
            background-color: #f9f9f9;
            border-left: 4px solid #FFD700;
            padding: 15px 20px;
            margin: 20px 0;
          }
          .benefits h3 {
            margin: 0 0 10px 0;
            color: #800020;
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
            text-align: center;
          }
          .button:hover {
            background-color: #FFC700;
          }
          .button-container {
            text-align: center;
            margin: 30px 0;
          }
          .upgrade-info {
            background-color: #fff8e1;
            border: 1px solid #FFD700;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
          }
          .upgrade-info h3 {
            margin: 0 0 10px 0;
            color: #800020;
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
          @media only screen and (max-width: 600px) {
            .header h1 {
              font-size: 20px;
            }
            .content {
              padding: 20px 15px;
            }
            .button {
              display: block;
              width: 100%;
              box-sizing: border-box;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Congratulations!</h1>
            <div class="badge">✓ Tier 1 Verified</div>
          </div>
          
          <div class="content">
            <div class="success-icon">✅</div>
            
            <p><strong>Dear ${escapeHtml(fullName)},</strong></p>
            
            <p>Your Tier 1 KYC verification is complete! Your BVN has been successfully verified and you are now approved to start bidding on salvage items.</p>
            
            <div class="benefits">
              <h3>What You Can Do Now:</h3>
              <ul>
                <li><strong>Browse Auctions:</strong> View all available salvage items</li>
                <li><strong>Place Bids:</strong> Bid up to ₦500,000 on any item</li>
                <li><strong>Win Auctions:</strong> Secure salvage items at competitive prices</li>
                <li><strong>Instant Payments:</strong> Pay securely via Paystack</li>
              </ul>
            </div>
            
            <div class="button-container">
              <a href="${appUrl}/vendor/auctions" class="button">Browse Auctions Now</a>
            </div>
            
            <div class="upgrade-info">
              <h3>Want to Bid Higher?</h3>
              <p>Upgrade to <strong>Tier 2</strong> to unlock unlimited bidding on high-value items above ₦500,000.</p>
              <p>Tier 2 benefits include:</p>
              <ul>
                <li>Unlimited bidding amounts</li>
                <li>Priority customer support</li>
                <li>Leaderboard eligibility</li>
                <li>Exclusive high-value auctions</li>
              </ul>
              <p><a href="${appUrl}/vendor/kyc/tier2" style="color: #800020; font-weight: 600;">Upgrade to Tier 2 →</a></p>
            </div>
            
            <p style="margin-top: 30px;">Best regards,<br><strong>NEM Insurance Team</strong></p>
          </div>
          
          <div class="footer">
            <p><strong>NEM Insurance Plc</strong></p>
            <p>199 Ikorodu Road, Obanikoro, Lagos, Nigeria</p>
            <p>Phone: 234-02-014489560 | Email: nemsupport@nem-insurance.com</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
