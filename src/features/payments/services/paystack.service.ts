import crypto from 'crypto';
import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq } from 'drizzle-orm';
import { logAction, AuditActionType, AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';
import { smsService } from '@/features/notifications/services/sms.service';
import { emailService } from '@/features/notifications/services/email.service';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
// Paystack uses the SECRET KEY for webhook signature verification
const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_SECRET_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export interface PaymentInitiation {
  paymentId: string;
  paymentUrl: string;
  reference: string;
  amount: number;
  deadline: Date;
}

export interface PaystackWebhookPayload {
  event: string;
  data: {
    reference: string;
    amount: number;
    status: string;
    paid_at?: string;
    customer?: {
      email: string;
      phone?: string;
    };
    metadata?: Record<string, unknown>;
  };
}

/**
 * Initialize a payment with Paystack
 * Generates a payment link for the vendor to complete payment
 */
export async function initiatePayment(
  auctionId: string,
  vendorId: string,
  userId: string
): Promise<PaymentInitiation> {
  try {
    // Get auction details
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (!auction) {
      throw new Error('Auction not found');
    }

    if (!auction.currentBid) {
      throw new Error('No winning bid found');
    }

    // Get vendor details
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) {
      throw new Error('Vendor not found');
    }

    // Get user details
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, vendor.userId))
      .limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    // Calculate payment deadline (24 hours from now)
    const paymentDeadline = new Date();
    paymentDeadline.setHours(paymentDeadline.getHours() + 24);

    // Generate unique payment reference
    const reference = `PAY_${auctionId.substring(0, 8)}_${Date.now()}`;

    // Create payment record
    const [payment] = await db
      .insert(payments)
      .values({
        auctionId,
        vendorId,
        amount: auction.currentBid.toString(),
        paymentMethod: 'paystack',
        paymentReference: reference,
        status: 'pending',
        paymentDeadline,
      })
      .returning();

    // Convert amount to kobo (Paystack uses kobo)
    const amountInKobo = Math.round(parseFloat(auction.currentBid.toString()) * 100);

    // Initialize Paystack transaction
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        amount: amountInKobo,
        reference,
        callback_url: `${APP_URL}/vendor/payments/${payment.id}/verify`,
        metadata: {
          paymentId: payment.id,
          auctionId,
          vendorId,
          custom_fields: [
            {
              display_name: 'Auction ID',
              variable_name: 'auction_id',
              value: auctionId,
            },
            {
              display_name: 'Vendor ID',
              variable_name: 'vendor_id',
              value: vendorId,
            },
          ],
        },
      }),
    });

    if (!paystackResponse.ok) {
      const error = await paystackResponse.json();
      throw new Error(`Paystack initialization failed: ${error.message || 'Unknown error'}`);
    }

    const paystackData = await paystackResponse.json();

    // Log payment initiation
    await logAction({
      userId,
      actionType: AuditActionType.PAYMENT_INITIATED,
      entityType: AuditEntityType.PAYMENT,
      entityId: payment.id,
      ipAddress: '0.0.0.0', // Will be set by API route
      deviceType: DeviceType.DESKTOP, // Will be set by API route
      userAgent: 'system',
      afterState: {
        paymentId: payment.id,
        auctionId,
        amount: auction.currentBid.toString(),
        reference,
        method: 'paystack',
      },
    });

    return {
      paymentId: payment.id,
      paymentUrl: paystackData.data.authorization_url,
      reference,
      amount: parseFloat(auction.currentBid.toString()),
      deadline: paymentDeadline,
    };
  } catch (error) {
    console.error('Error initiating payment:', error);
    throw error;
  }
}

/**
 * Manually verify a payment with Paystack
 * Used for checking payment status
 */
export async function verifyPayment(
  paymentReference: string,
  userId: string
): Promise<{ verified: boolean; payment: typeof payments.$inferSelect | null }> {
  try {
    // Verify with Paystack
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${paymentReference}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    if (!paystackResponse.ok) {
      throw new Error('Failed to verify payment with Paystack');
    }

    const paystackData = await paystackResponse.json();

    if (paystackData.data.status !== 'success') {
      return { verified: false, payment: null };
    }

    // Find payment in database
    const payment = await db.query.payments.findFirst({
      where: eq(payments.paymentReference, paymentReference),
    });

    if (!payment) {
      throw new Error('Payment not found in database');
    }

    // Verify amount matches
    const expectedAmountInKobo = Math.round(parseFloat(payment.amount) * 100);
    if (paystackData.data.amount !== expectedAmountInKobo) {
      throw new Error('Payment amount mismatch');
    }

    // Update payment status
    const [updatedPayment] = await db
      .update(payments)
      .set({
        status: 'verified',
        verifiedAt: new Date(),
        verifiedBy: userId,
        autoVerified: false,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id))
      .returning();

    // Log verification
    await logAction({
      userId,
      actionType: AuditActionType.PAYMENT_VERIFIED,
      entityType: AuditEntityType.PAYMENT,
      entityId: payment.id,
      ipAddress: '0.0.0.0',
      deviceType: DeviceType.DESKTOP,
      userAgent: 'system',
      beforeState: { status: payment.status },
      afterState: { status: 'verified', verifiedBy: userId },
    });

    return { verified: true, payment: updatedPayment };
  } catch (error) {
    console.error('Error verifying payment:', error);
    throw error;
  }
}

/**
 * Verify Paystack webhook signature
 * Paystack uses HMAC SHA512 with your secret key
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const hash = crypto.createHmac('sha512', PAYSTACK_WEBHOOK_SECRET).update(payload).digest('hex');
  return hash === signature;
}

/**
 * Process Paystack webhook
 * Auto-verifies payment and generates pickup authorization
 * Also handles wallet funding confirmations
 */
export async function processPaystackWebhook(
  payload: PaystackWebhookPayload,
  signature: string,
  rawPayload: string
): Promise<void> {
  try {
    // Verify webhook signature
    if (!verifyWebhookSignature(rawPayload, signature)) {
      throw new Error('Invalid webhook signature');
    }

    // Only process successful charge events
    if (payload.event !== 'charge.success') {
      console.log(`Ignoring webhook event: ${payload.event}`);
      return;
    }

    const { reference, amount, status, metadata } = payload.data;

    if (status !== 'success') {
      console.log(`Payment not successful: ${status}`);
      return;
    }

    // Check if this is a wallet funding transaction
    if (metadata && typeof metadata === 'object' && 'type' in metadata && metadata.type === 'wallet_funding') {
      await processWalletFunding(reference, amount, metadata);
      return;
    }

    // Otherwise, process as auction payment
    await processAuctionPayment(reference, amount);
  } catch (error) {
    console.error('Error processing Paystack webhook:', error);
    throw error;
  }
}

/**
 * Process wallet funding webhook
 */
async function processWalletFunding(
  reference: string,
  amountInKobo: number,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    const { escrowService } = await import('@/features/payments/services/escrow.service');
    
    // Extract wallet ID and vendor ID from metadata
    const walletId = metadata.walletId as string;
    const vendorId = metadata.vendorId as string;

    if (!walletId || !vendorId) {
      throw new Error('Missing wallet or vendor ID in metadata');
    }

    // Get vendor to find the userId
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) {
      throw new Error(`Vendor not found: ${vendorId}`);
    }

    // Convert amount from kobo to naira
    const amount = amountInKobo / 100;

    // Credit the wallet (using the vendor's userId)
    await escrowService.creditWallet(walletId, amount, reference, vendor.userId);

    console.log(`Wallet funded successfully: ${walletId}, Amount: ₦${amount}, Reference: ${reference}`);
  } catch (error) {
    console.error('Error processing wallet funding:', error);
    throw error;
  }
}

/**
 * Process auction payment webhook
 */
async function processAuctionPayment(reference: string, amountInKobo: number): Promise<void> {
  try {
    // Find payment in database
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.paymentReference, reference))
      .limit(1);

    if (!payment) {
      throw new Error(`Payment not found for reference: ${reference}`);
    }

    // Verify amount matches (Paystack sends amount in kobo)
    const expectedAmountInKobo = Math.round(parseFloat(payment.amount) * 100);
    if (amountInKobo !== expectedAmountInKobo) {
      throw new Error(
        `Amount mismatch: expected ${expectedAmountInKobo} kobo, got ${amountInKobo} kobo`
      );
    }

    // Check if already verified
    if (payment.status === 'verified') {
      console.log(`Payment already verified: ${payment.id}`);
      return;
    }

    // Get auction details
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, payment.auctionId))
      .limit(1);

    if (!auction) {
      throw new Error('Auction not found');
    }

    // Get case details
    const [salvageCase] = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.id, auction.caseId))
      .limit(1);

    if (!salvageCase) {
      throw new Error('Case not found');
    }

    // Get vendor details
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, payment.vendorId))
      .limit(1);

    if (!vendor) {
      throw new Error('Vendor not found');
    }

    // Get user details
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, vendor.userId))
      .limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    // Update payment status to verified
    await db
      .update(payments)
      .set({
        status: 'verified',
        verifiedAt: new Date(),
        autoVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    // Generate pickup authorization code
    const pickupCode = generatePickupAuthorizationCode(payment.id);

    // Send SMS notification
    const smsMessage = `Payment confirmed! Your pickup authorization code is: ${pickupCode}. Amount: ₦${parseFloat(
      payment.amount
    ).toLocaleString()}. Valid for 7 days.`;
    
    await smsService.sendSMS({
      to: user.phone,
      message: smsMessage,
    });

    // Send email notification
    const emailSubject = 'Payment Confirmed - Pickup Authorization';
    const emailHtml = `
      <h2>Payment Confirmed</h2>
      <p>Dear ${user.fullName},</p>
      <p>Your payment of <strong>₦${parseFloat(payment.amount).toLocaleString()}</strong> has been confirmed.</p>
      <h3>Pickup Authorization Code</h3>
      <p style="font-size: 24px; font-weight: bold; color: #800020;">${pickupCode}</p>
      <p>Please present this code when collecting your salvage item.</p>
      <h3>Item Details</h3>
      <ul>
        <li>Claim Reference: ${salvageCase.claimReference}</li>
        <li>Asset Type: ${salvageCase.assetType}</li>
        <li>Location: ${salvageCase.locationName}</li>
      </ul>
      <p>This authorization is valid for 7 days from the date of payment.</p>
      <p>Thank you for using NEM Salvage Management System.</p>
    `;

    await emailService.sendEmail({
      to: user.email,
      subject: emailSubject,
      html: emailHtml,
    });

    // Log auto-verification
    await logAction({
      userId: payment.vendorId,
      actionType: AuditActionType.PAYMENT_AUTO_VERIFIED,
      entityType: AuditEntityType.PAYMENT,
      entityId: payment.id,
      ipAddress: '0.0.0.0',
      deviceType: DeviceType.MOBILE,
      userAgent: 'paystack-webhook',
      beforeState: { status: payment.status },
      afterState: {
        status: 'verified',
        autoVerified: true,
        pickupCode,
      },
    });

    console.log(`Payment auto-verified successfully: ${payment.id}`);
  } catch (error) {
    console.error('Error processing auction payment:', error);
    throw error;
  }
}

/**
 * Generate a pickup authorization code
 * Format: NEM-XXXX-XXXX
 */
function generatePickupAuthorizationCode(paymentId: string): string {
  const hash = crypto.createHash('sha256').update(paymentId).digest('hex');
  const code1 = hash.substring(0, 4).toUpperCase();
  const code2 = hash.substring(4, 8).toUpperCase();
  return `NEM-${code1}-${code2}`;
}
