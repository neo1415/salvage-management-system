import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auctions, vendors, users, salvageCases, payments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { smsService } from '@/features/notifications/services/sms.service';
import { emailService } from '@/features/notifications/services/email.service';
import { createAuctionWonNotification } from '@/features/notifications/services/notification.service';

/**
 * Admin Manual Notification Sending API
 * 
 * POST /api/admin/auctions/[id]/send-notification
 * 
 * Manually send auction won notification to winner
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or finance
    if (session.user.role !== 'admin' && session.user.role !== 'finance_officer') {
      return NextResponse.json(
        { error: 'Forbidden - Admin or Finance access required' },
        { status: 403 }
      );
    }

    const { id: auctionId } = await params;

    // Get auction with all related data
    const [auctionData] = await db
      .select({
        auction: auctions,
        case: salvageCases,
        vendor: vendors,
        user: users,
        payment: payments,
      })
      .from(auctions)
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .leftJoin(vendors, eq(auctions.currentBidder, vendors.id))
      .leftJoin(users, eq(vendors.userId, users.id))
      .leftJoin(payments, eq(payments.auctionId, auctions.id))
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (!auctionData) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    const { auction, case: salvageCase, vendor, user, payment } = auctionData;

    if (auction.status !== 'closed') {
      return NextResponse.json(
        { error: 'Auction must be closed to send notification' },
        { status: 400 }
      );
    }

    if (!vendor || !user) {
      return NextResponse.json(
        { error: 'No winner for this auction' },
        { status: 400 }
      );
    }

    if (!payment) {
      return NextResponse.json(
        { 
          error: 'No payment record found for this auction',
          details: 'Payment records are created automatically when the auction closes. If the auction just closed, please wait a moment and try again. If the issue persists, check the audit logs for closure errors.',
          troubleshooting: {
            auctionStatus: auction.status,
            hasWinner: !!auction.currentBidder,
            winningBid: auction.currentBid,
            suggestion: auction.status !== 'closed' 
              ? 'Auction must be closed first. Wait for automatic closure or close it manually.'
              : 'Payment record should exist. Check if auction closure completed successfully in audit logs.'
          }
        },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://salvage.nem-insurance.com';
    const paymentUrl = `${appUrl}/vendor/payments/${payment.id}`;
    const winningBid = parseFloat(auction.currentBid!);
    const formattedAmount = winningBid.toLocaleString();

    // Format asset name
    const assetDetails = salvageCase.assetDetails as Record<string, string>;
    let assetName = '';
    switch (salvageCase.assetType) {
      case 'vehicle':
        assetName = `${assetDetails.year || ''} ${assetDetails.make || ''} ${assetDetails.model || ''}`.trim() || 'Vehicle';
        break;
      case 'property':
        assetName = `${assetDetails.propertyType || 'Property'}`;
        break;
      case 'electronics':
        assetName = `${assetDetails.brand || ''} ${assetDetails.serialNumber || 'Electronics'}`.trim();
        break;
      case 'machinery':
        assetName = `${assetDetails.brand || ''} ${assetDetails.model || ''} ${assetDetails.machineryType || ''}`.trim();
        if (!assetName) {
          assetName = assetDetails.machineryType || 'Machinery';
        }
        break;
      default:
        assetName = 'Salvage Item';
    }

    const results = {
      sms: { success: false, error: '' },
      email: { success: false, error: '' },
      inApp: { success: false, error: '' },
    };

    // Calculate hours until deadline
    const paymentDeadline = new Date(payment.paymentDeadline);
    const hoursUntilDeadline = Math.round(
      (paymentDeadline.getTime() - new Date().getTime()) / (1000 * 60 * 60)
    );

    // Send SMS notification
    try {
      const smsMessage = `Congratulations! You won the auction for ${assetName}. Winning bid: ₦${formattedAmount}. Pay within ${hoursUntilDeadline} hours to secure your item: ${paymentUrl}`;

      await smsService.sendSMS({
        to: user.phone,
        message: smsMessage,
      });
      results.sms.success = true;
    } catch (error) {
      results.sms.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Send Email notification
    try {
      const emailSubject = `🎉 You Won! Pay Within 24 Hours - ${assetName}`;
      const emailHtml = getWinnerNotificationEmailTemplate(
        user.fullName,
        assetName,
        salvageCase,
        winningBid,
        paymentDeadline,
        paymentUrl
      );

      await emailService.sendEmail({
        to: user.email,
        subject: emailSubject,
        html: emailHtml,
      });
      results.email.success = true;
    } catch (error) {
      results.email.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Create in-app notification
    try {
      await createAuctionWonNotification(
        user.id,
        auction.id,
        winningBid,
        assetName,
        payment.id,
        paymentUrl
      );
      results.inApp.success = true;
    } catch (error) {
      results.inApp.error = error instanceof Error ? error.message : 'Unknown error';
    }

    const successCount = Object.values(results).filter((r) => r.success).length;
    const totalCount = Object.keys(results).length;

    if (successCount === 0) {
      return NextResponse.json(
        {
          error: 'Failed to send any notifications',
          details: results,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${successCount}/${totalCount} notifications successfully`,
      results,
    });
  } catch (error) {
    console.error('Admin send notification API error:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}

/**
 * Get winner notification email template
 */
function getWinnerNotificationEmailTemplate(
  fullName: string,
  assetName: string,
  salvageCase: typeof salvageCases.$inferSelect,
  winningBid: number,
  paymentDeadline: Date,
  paymentUrl: string
): string {
  const formattedAmount = winningBid.toLocaleString();
  const deadlineFormatted = paymentDeadline.toLocaleString('en-NG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Lagos',
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Congratulations - You Won!</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #800020 0%, #a00028 100%); color: white; padding: 40px 20px; text-align: center;">
            <div style="font-size: 64px; margin-bottom: 10px;">🏆</div>
            <h1 style="margin: 0 0 10px 0; font-size: 32px; font-weight: 700;">Congratulations!</h1>
            <p style="font-size: 18px; margin: 0;">You Won the Auction</p>
          </div>
          
          <div style="padding: 30px 20px;">
            <p><strong>Dear ${escapeHtml(fullName)},</strong></p>
            
            <p>Great news! You are the winning bidder for the following salvage item:</p>
            
            <div style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: #800020; border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center;">
              <h2 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Your Winning Bid</h2>
              <div style="font-size: 42px; font-weight: 800; margin: 10px 0;">₦${formattedAmount}</div>
              <p style="margin: 5px 0 0 0; font-weight: 600;">${escapeHtml(assetName)}</p>
            </div>
            
            <div style="background-color: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
              <h3 style="margin: 0 0 10px 0; color: #856404; font-size: 20px;">⏰ Payment Deadline</h3>
              <p style="margin: 5px 0;">You must complete payment by:</p>
              <div style="font-size: 24px; font-weight: 700; color: #d32f2f; margin: 10px 0;">${deadlineFormatted}</div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${paymentUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: #800020; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 18px;">Pay Now with Paystack</a>
            </div>
            
            <p style="margin-top: 30px;">Best regards,<br><strong>NEM Insurance Team</strong></p>
          </div>
          
          <div style="text-align: center; padding: 20px; font-size: 12px; color: #666; background-color: #f5f5f5; border-top: 1px solid #e0e0e0;">
            <p><strong>NEM Insurance Plc</strong></p>
            <p>199 Ikorodu Road, Obanikoro, Lagos, Nigeria</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

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
