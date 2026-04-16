/**
 * Payment Service
 * Handles payment processing for auction winners with deposit deduction
 * 
 * Requirements:
 * - Requirement 13: Hybrid Payment Calculation
 * - Requirement 14: Wallet-Only Payment Processing
 * - Requirement 15: Paystack-Only Payment Processing
 * - Requirement 16: Hybrid Payment Processing
 * - Requirement 21.4: Legacy auction payment (full amount without deposit deduction)
 * - Requirement 28: Idempotent Payment Processing
 */

import { db } from '@/lib/db/drizzle';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { bids } from '@/lib/db/schema/bids';
import { payments } from '@/lib/db/schema/payments';
import { depositEvents, auctionWinners } from '@/lib/db/schema/auction-deposit';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq, and, desc } from 'drizzle-orm';
import { depositNotificationService } from './deposit-notification.service';
import { smsService } from '@/features/notifications/services/sms.service';
import { emailService } from '@/features/notifications/services/email.service';
import { pushNotificationService } from '@/features/notifications/services/push.service';
import { createNotification } from '@/features/notifications/services/notification.service';

export interface PaymentBreakdown {
  finalBid: number;
  depositAmount: number;
  remainingAmount: number;
  availableBalance: number;
  walletPortion: number;
  paystackPortion: number;
  canUseWalletOnly: boolean;
}

export interface ProcessWalletPaymentParams {
  auctionId: string;
  vendorId: string;
  finalBid: number;
  depositAmount: number;
  idempotencyKey: string;
}

export interface InitializePaystackPaymentParams {
  auctionId: string;
  vendorId: string;
  finalBid: number;
  depositAmount: number;
  idempotencyKey: string;
}

export interface ProcessHybridPaymentParams {
  auctionId: string;
  vendorId: string;
  finalBid: number;
  depositAmount: number;
  idempotencyKey: string;
  vendorEmail: string;
}

export interface PaymentResult {
  paymentId: string;
  type: 'wallet' | 'paystack' | 'hybrid';
  amount: number;
  status: 'completed' | 'pending';
  paystackReference?: string;
  authorizationUrl?: string;
  accessCode?: string;
  walletAmount?: number;
  paystackAmount?: number;
}

/**
 * Payment Service
 * Handles payment processing for auction deposit system
 */
export class PaymentService {
  /**
   * Calculate payment breakdown for vendor
   * Requirement 21.4: For legacy auctions, process full amount without deposit deduction
   * 
   * @param vendorId - Vendor ID
   * @param auctionId - Auction ID
   * @param finalBid - Final bid amount
   * @param depositAmount - Deposit amount already frozen
   * @returns Payment breakdown with all amounts
   */
  async calculatePaymentBreakdown(
    vendorId: string,
    auctionId: string,
    finalBid: number,
    depositAmount: number
  ): Promise<PaymentBreakdown> {
    // Check if this is a legacy auction
    const [winningBid] = await db
      .select()
      .from(bids)
      .where(
        and(
          eq(bids.auctionId, auctionId),
          eq(bids.vendorId, vendorId)
        )
      )
      .orderBy(desc(bids.createdAt))
      .limit(1);

    const isLegacyAuction = winningBid?.isLegacy === true;

    // Get vendor wallet balance
    const [wallet] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, vendorId))
      .limit(1);

    if (!wallet) {
      throw new Error(`Wallet not found for vendor ${vendorId}`);
    }

    const availableBalance = parseFloat(wallet.availableBalance);

    // Requirement 21.4: For legacy auctions, remaining amount = full bid (no deposit deduction)
    const remainingAmount = isLegacyAuction ? finalBid : (finalBid - depositAmount);

    // Calculate wallet and Paystack portions
    const walletPortion = Math.min(availableBalance, remainingAmount);
    const paystackPortion = remainingAmount - walletPortion;

    // Check if wallet-only payment is possible
    const canUseWalletOnly = availableBalance >= remainingAmount;

    return {
      finalBid,
      depositAmount,
      remainingAmount,
      availableBalance,
      walletPortion,
      paystackPortion,
      canUseWalletOnly,
    };
  }

  /**
   * Process wallet-only payment
   * 
   * @param params - Payment parameters
   * @returns Payment result
   * @throws Error if insufficient balance or payment already exists
   */
  async processWalletPayment(
    params: ProcessWalletPaymentParams
  ): Promise<PaymentResult> {
    const { auctionId, vendorId, finalBid, depositAmount, idempotencyKey } = params;

    const remainingAmount = finalBid - depositAmount;

    // Check for existing payment with same idempotency key
    const existingPayment = await this.checkIdempotency(auctionId, idempotencyKey);
    if (existingPayment) {
      return existingPayment;
    }

    // Use database transaction for atomicity
    const result = await db.transaction(async (tx) => {
      // Lock wallet for update
      const [wallet] = await tx
        .select()
        .from(escrowWallets)
        .where(eq(escrowWallets.vendorId, vendorId))
        .for('update')
        .limit(1);

      if (!wallet) {
        throw new Error(`Wallet not found for vendor ${vendorId}`);
      }

      // Parse wallet values
      const currentBalance = parseFloat(wallet.balance);
      const currentAvailable = parseFloat(wallet.availableBalance);
      const currentFrozen = parseFloat(wallet.frozenAmount);
      const currentForfeited = parseFloat(wallet.forfeitedAmount || '0');

      // Verify sufficient available balance
      if (currentAvailable < remainingAmount) {
        throw new Error(
          `Insufficient available balance. Required: ₦${remainingAmount.toFixed(2)}, Available: ₦${currentAvailable.toFixed(2)}`
        );
      }

      // Verify sufficient frozen amount for deposit
      if (currentFrozen < depositAmount) {
        throw new Error(
          `Insufficient frozen amount. Required: ₦${depositAmount.toFixed(2)}, Frozen: ₦${currentFrozen.toFixed(2)}`
        );
      }

      // Calculate new wallet values
      // Deduct remaining amount from available, unfreeze deposit
      const newBalance = currentBalance - remainingAmount - depositAmount;
      const newAvailable = currentAvailable - remainingAmount;
      const newFrozen = currentFrozen - depositAmount;

      // Verify invariant before update
      const expectedBalance = newAvailable + newFrozen + currentForfeited;
      if (Math.abs(expectedBalance - newBalance) > 0.01) {
        throw new Error(
          `Wallet invariant violation. Balance: ${newBalance}, Expected: ${expectedBalance}`
        );
      }

      // Update wallet
      await tx
        .update(escrowWallets)
        .set({
          balance: newBalance.toFixed(2),
          availableBalance: newAvailable.toFixed(2),
          frozenAmount: newFrozen.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(escrowWallets.vendorId, vendorId));

      // Check if payment record already exists (from document signing)
      const [existingPayment] = await tx
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.auctionId, auctionId),
            eq(payments.vendorId, vendorId),
            eq(payments.status, 'pending')
          )
        )
        .limit(1);

      let payment;
      if (existingPayment) {
        // Update existing payment record to verified
        console.log(`✅ Updating existing payment record: ${existingPayment.id}`);
        [payment] = await tx
          .update(payments)
          .set({
            paymentReference: idempotencyKey, // Update with wallet payment reference
            status: 'verified',
            autoVerified: true,
            verifiedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(payments.id, existingPayment.id))
          .returning();
      } else {
        // Create new payment record (fallback if document signing didn't create one)
        console.log(`✅ Creating new payment record`);
        [payment] = await tx
          .insert(payments)
          .values({
            auctionId,
            vendorId,
            amount: finalBid.toFixed(2),
            paymentMethod: 'escrow_wallet',
            paymentReference: idempotencyKey,
            status: 'verified',
            autoVerified: true,
            paymentDeadline: new Date(),
          })
          .returning();
      }

      // Record deposit event (unfreeze)
      await tx.insert(depositEvents).values({
        vendorId,
        auctionId,
        eventType: 'unfreeze',
        amount: depositAmount.toFixed(2),
        balanceBefore: currentBalance.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        frozenBefore: currentFrozen.toFixed(2),
        frozenAfter: newFrozen.toFixed(2),
        availableBefore: currentAvailable.toFixed(2), // FIXED: Use currentAvailable
        availableAfter: newAvailable.toFixed(2), // FIXED: Use newAvailable
        description: `Deposit unfrozen after wallet payment`,
      });

      // Verify invariant after update
      await this.verifyInvariantInTransaction(tx, vendorId);

      return {
        paymentId: payment.id,
        type: 'wallet' as const,
        amount: finalBid,
        status: 'completed' as const,
      };
    });

    // CRITICAL: Release funds to finance (same as Paystack webhook)
    console.log(`💰 Releasing deposit funds to finance...`);
    const { escrowService } = await import('@/features/payments/services/escrow.service');
    
    await escrowService.releaseFunds(
      vendorId,
      depositAmount,
      auctionId,
      'system' // userId for audit trail
    );
    
    console.log(`✅ Deposit funds released successfully`);
    console.log(`   - ₦${depositAmount.toLocaleString()} transferred to finance`);
    console.log(`   - Debit transaction created in walletTransactions`);
    console.log(`   - Unfreeze transaction created in walletTransactions`);
    console.log(`   - Money transferred to NEM Insurance via Paystack Transfers API`);

    // Unfreeze all non-winner deposits (fallback chain complete)
    console.log(`🔓 Unfreezing all non-winner deposits for auction ${auctionId}`);
    await this.unfreezeNonWinnerDeposits(auctionId, vendorId);

    // Send payment confirmation notification
    await depositNotificationService.sendPaymentConfirmationNotification({
      vendorId,
      auctionId,
      amount: finalBid,
    });

    // CRITICAL: Generate pickup authorization (this was missing!)
    await this.generatePickupAuthorization({
      vendorId,
      auctionId,
      amount: finalBid,
    });

    return result;
  }

  /**
   * Initialize Paystack-only payment
   * 
   * @param params - Payment parameters
   * @returns Payment result with Paystack reference
   * @throws Error if payment already exists
   */
  async initializePaystackPayment(
    params: InitializePaystackPaymentParams
  ): Promise<PaymentResult & { authorizationUrl: string; accessCode: string }> {
    const { auctionId, vendorId, finalBid, depositAmount, idempotencyKey } = params;

    const remainingAmount = finalBid - depositAmount;

    // CHECK FIRST: Look for existing pending PAYSTACK payment to prevent duplicates
    // CRITICAL FIX: Only block if there's a pending PAYSTACK payment, not escrow_wallet
    // The escrow_wallet payment is created during closure but user hasn't selected method yet
    const [existingPending] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.auctionId, auctionId),
          eq(payments.vendorId, vendorId),
          eq(payments.status, 'pending'),
          eq(payments.paymentMethod, 'paystack') // ✅ Only check for Paystack payments
        )
      )
      .limit(1);
    
    if (existingPending) {
      console.log(`⚠️  Paystack payment already pending for auction ${auctionId}, returning existing`);
      // Return existing payment info - don't create duplicate
      return {
        paymentId: existingPending.id,
        type: 'paystack',
        amount: parseFloat(existingPending.amount),
        status: 'pending',
        paystackReference: existingPending.paymentReference || idempotencyKey,
        authorizationUrl: 'ALREADY_PENDING',
        accessCode: 'ALREADY_PENDING',
      };
    }

    // CRITICAL FIX: Delete any pending escrow_wallet payment from closure
    // This payment was created during closure but user is now choosing Paystack
    const [escrowPayment] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.auctionId, auctionId),
          eq(payments.vendorId, vendorId),
          eq(payments.status, 'pending'),
          eq(payments.paymentMethod, 'escrow_wallet')
        )
      )
      .limit(1);
    
    if (escrowPayment) {
      console.log(`🗑️  Deleting pending escrow_wallet payment from closure: ${escrowPayment.id}`);
      console.log(`   - User is now choosing Paystack instead`);
      await db.delete(payments).where(eq(payments.id, escrowPayment.id));
      console.log(`✅ Escrow wallet payment deleted, proceeding with Paystack`);
    }

    // Get vendor and user details for Paystack
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) {
      throw new Error(`Vendor not found: ${vendorId}`);
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, vendor.userId))
      .limit(1);

    if (!user || !user.email) {
      throw new Error(`User email not found for vendor: ${vendorId}`);
    }

    // Create pending payment record BEFORE Paystack initialization
    // CRITICAL: Store FULL amount (finalBid) in payment record for finance dashboard
    // The remainingAmount is what Paystack charges, but total payment is finalBid (includes deposit)
    const [payment] = await db
      .insert(payments)
      .values({
        auctionId,
        vendorId,
        amount: finalBid.toFixed(2), // Store FULL amount (₦120k), not just Paystack portion (₦20k)
        paymentMethod: 'paystack',
        paymentReference: idempotencyKey,
        status: 'pending',
        paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      })
      .returning();

    // Initialize Paystack transaction with fixed amount (remainingAmount)
    const amountInKobo = Math.round(remainingAmount * 100); // Paystack uses kobo
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    console.log('Paystack initialization details:', {
      remainingAmount,
      amountInKobo,
      hasSecretKey: !!PAYSTACK_SECRET_KEY,
      appUrl: APP_URL,
      email: user.email,
      reference: idempotencyKey,
    });

    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY not configured');
    }

    const paystackPayload = {
      email: user.email,
      amount: amountInKobo,
      reference: idempotencyKey,
      callback_url: `${APP_URL}/vendor/auctions/${auctionId}?payment=success`, // ADD ?payment=success for callback
      metadata: {
        paymentId: payment.id,
        auctionId,
        vendorId,
        depositAmount: depositAmount.toFixed(2),
        finalBid: finalBid.toFixed(2),
        remainingAmount: remainingAmount.toFixed(2),
      },
    };

    console.log('Paystack API request payload:', paystackPayload);

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload),
    });

    console.log('Paystack API response status:', paystackResponse.status);
    console.log('Paystack API response ok:', paystackResponse.ok);

    if (!paystackResponse.ok) {
      const error = await paystackResponse.json();
      console.error('Paystack API error response:', error);
      
      // Delete the pending payment record since Paystack initialization failed
      await db.delete(payments).where(eq(payments.id, payment.id));
      
      throw new Error(`Paystack initialization failed: ${error.message || 'Unknown error'}`);
    }

    const paystackData = await paystackResponse.json();
    console.log('Paystack API success response:', paystackData);

    if (!paystackData.data || !paystackData.data.authorization_url) {
      console.error('Invalid Paystack response structure:', paystackData);
      
      // Delete the pending payment record
      await db.delete(payments).where(eq(payments.id, payment.id));
      
      throw new Error('Invalid response from Paystack: missing authorization_url');
    }

    return {
      paymentId: payment.id,
      type: 'paystack',
      amount: finalBid, // Return FULL amount for UI display
      status: 'pending',
      paystackReference: idempotencyKey,
      authorizationUrl: paystackData.data.authorization_url,
      accessCode: paystackData.data.access_code,
    };
  }

  /**
   * Handle Paystack webhook for payment completion
   * 
   * CRITICAL: This must be ATOMIC - payment verification and fund release must succeed together
   * If fund release fails, payment should NOT be marked as verified
   * 
   * @param paystackReference - Paystack transaction reference
   * @param success - Whether payment succeeded
   * @throws Error if payment not found or already processed
   */
  async handlePaystackWebhook(
    paystackReference: string,
    success: boolean
  ): Promise<void> {
    // Find payment first (outside transaction for initial check)
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.paymentReference, paystackReference))
      .limit(1);

    if (!payment) {
      throw new Error(`Payment not found for Paystack reference: ${paystackReference}`);
    }

    // Check if already processed (idempotency)
    if (payment.status === 'verified' || payment.status === 'rejected') {
      console.log(`✅ Payment ${payment.id} already processed with status: ${payment.status}`);
      return;
    }

    if (!success) {
      // Mark payment as rejected, allow retry
      await db
        .update(payments)
        .set({
          status: 'rejected',
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));
      console.log(`❌ Payment ${payment.id} rejected by Paystack`);
      return;
    }

    // Payment succeeded - now we need to do ATOMIC operation:
    // 1. Mark payment as verified
    // 2. Release funds (unfreeze + debit + transfer to finance)
    // If ANY step fails, the ENTIRE operation should fail

    const vendorId = payment.vendorId;
    const auctionId = payment.auctionId;
    const paymentAmount = parseFloat(payment.amount);

    // Get winner record to get deposit amount
    const [winner] = await db
      .select()
      .from(auctionWinners)
      .where(
        and(
          eq(auctionWinners.auctionId, auctionId),
          eq(auctionWinners.vendorId, vendorId),
          eq(auctionWinners.status, 'active')
        )
      )
      .limit(1);

    if (!winner) {
      throw new Error(`Winner record not found for auction ${auctionId}, vendor ${vendorId}`);
    }

    const depositAmount = parseFloat(winner.depositAmount);

    console.log(`💳 Processing Paystack payment for auction ${auctionId}`);
    console.log(`   - Payment Amount: ₦${paymentAmount.toLocaleString()}`);
    console.log(`   - Deposit to Release: ₦${depositAmount.toLocaleString()}`);

    // ATOMIC OPERATION: Mark payment verified AND release funds
    // If releaseFunds fails, we rollback payment verification
    try {
      // Step 1: Mark payment as verified (in transaction)
      await db.transaction(async (tx) => {
        await tx
          .update(payments)
          .set({
            status: 'verified',
            autoVerified: true,
            verifiedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(payments.id, payment.id));
        
        console.log(`✅ Payment ${payment.id} marked as verified`);
      });

      // Step 2: Release funds (unfreeze + debit + transfer)
      // This MUST succeed or we rollback payment verification
      console.log(`💰 Releasing deposit funds to finance...`);
      const { escrowService } = await import('@/features/payments/services/escrow.service');
      
      await escrowService.releaseFunds(
        vendorId,
        depositAmount,
        auctionId,
        'system' // userId for audit trail
      );
      
      console.log(`✅ Deposit funds released successfully`);
      console.log(`   - ₦${depositAmount.toLocaleString()} transferred to finance`);
      console.log(`   - Debit transaction created in walletTransactions`);
      console.log(`   - Unfreeze transaction created in walletTransactions`);
      console.log(`   - Money transferred to NEM Insurance via Paystack Transfers API`);

      // Step 3: Unfreeze all non-winner deposits (fallback chain complete)
      console.log(`🔓 Unfreezing all non-winner deposits for auction ${auctionId}`);
      await this.unfreezeNonWinnerDeposits(auctionId, vendorId);

      // Step 4: Send notifications and generate pickup authorization
      const paymentInfo = {
        vendorId,
        auctionId,
        amount: paymentAmount,
        depositAmount,
      };

      await depositNotificationService.sendPaymentConfirmationNotification(paymentInfo);
      await this.generatePickupAuthorization(paymentInfo);
      
      console.log(`✅ Payment processing complete for auction ${auctionId}`);
    } catch (error) {
      // CRITICAL: Fund release failed - rollback payment verification
      console.error(`❌ CRITICAL: Fund release failed, rolling back payment verification`);
      console.error(`   Error:`, error);
      
      // Rollback: Mark payment as pending again so user can retry
      await db
        .update(payments)
        .set({
          status: 'pending',
          autoVerified: false,
          verifiedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));
      
      console.log(`🔄 Payment ${payment.id} rolled back to pending status`);
      console.log(`   - User can retry payment`);
      console.log(`   - Finance dashboard will NOT show this payment`);
      console.log(`   - Deposit remains frozen in vendor wallet`);
      
      // Re-throw error so webhook handler knows it failed
      throw new Error(
        `Payment verification rolled back due to fund release failure: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate pickup authorization after payment verification
   * Creates pickup authorization document and sends notifications with code
   * 
   * @param paymentInfo - Payment information
   */
  private async generatePickupAuthorization(paymentInfo: {
    vendorId: string;
    auctionId: string;
    amount: number;
  }): Promise<void> {
    try {
      console.log(`🎫 Generating pickup authorization for auction ${paymentInfo.auctionId}`);
      
      // Generate pickup authorization code
      const pickupAuthCode = this.generatePickupAuthorizationCode(paymentInfo.auctionId);
      
      // Generate pickup authorization document
      const { generateDocument } = await import('@/features/documents/services/document.service');
      
      const pickupAuthDocument = await generateDocument(
        paymentInfo.auctionId,
        paymentInfo.vendorId,
        'pickup_authorization',
        'system'
      );
      
      console.log(`✅ Pickup authorization document generated: ${pickupAuthDocument.id}`);
      
      // Get vendor and user details for notifications
      const [vendor] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, paymentInfo.vendorId))
        .limit(1);
      
      if (!vendor) {
        throw new Error(`Vendor not found: ${paymentInfo.vendorId}`);
      }
      
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, vendor.userId))
        .limit(1);
      
      if (!user) {
        throw new Error(`User not found for vendor: ${paymentInfo.vendorId}`);
      }
      
      // Get auction details with case information
      const [auction] = await db
        .select({
          id: auctions.id,
          caseId: auctions.caseId,
          assetName: salvageCases.assetType,
          locationName: salvageCases.locationName,
        })
        .from(auctions)
        .leftJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
        .where(eq(auctions.id, paymentInfo.auctionId))
        .limit(1);
      
      const assetName = auction?.assetName || 'auction item';
      const locationName = auction?.locationName || 'TBD';
      
      // Send SMS with pickup code (wrapped in try-catch to prevent blocking)
      try {
        if (user.phone) {
          await smsService.sendSMS({
            to: user.phone,
            message: `NEM Salvage: Payment confirmed! Pickup code: ${pickupAuthCode}. Location: ${locationName}. Deadline: 48 hours. Bring valid ID.`,
          });
          console.log(`✅ Pickup authorization SMS sent to ${user.phone}`);
        }
      } catch (smsError) {
        console.error('SMS notification error (non-blocking):', smsError);
      }
      
      // Send email with pickup code (wrapped in try-catch to prevent blocking)
      try {
        if (user.email) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          
          await emailService.sendPaymentConfirmationEmail(user.email, {
            vendorName: vendor.businessName || 'Vendor',
            auctionId: paymentInfo.auctionId,
            paymentId: 'PAYMENT-' + paymentInfo.auctionId.substring(0, 8),
            assetName,
            paymentAmount: paymentInfo.amount,
            paymentMethod: 'Wallet/Paystack',
            paymentReference: pickupAuthCode,
            pickupAuthCode,
            pickupLocation: locationName,
            pickupDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toLocaleString(),
            appUrl,
          });
          console.log(`✅ Pickup authorization email sent to ${user.email}`);
        }
      } catch (emailError) {
        console.error('Email notification error (non-blocking):', emailError);
      }
      
      // Send push notification (wrapped in try-catch to prevent blocking)
      try {
        await pushNotificationService.sendPushNotification(
          null, // subscription - will use fallback (SMS/email)
          {
            userId: user.id,
            title: '🎫 Pickup Authorization Ready',
            body: `Code: ${pickupAuthCode}. Collect ${assetName} within 48 hours.`,
            data: {
              auctionId: paymentInfo.auctionId,
              type: 'pickup_authorization',
              pickupAuthCode,
            },
          }
        );
        console.log(`✅ Pickup authorization push notification sent`);
      } catch (pushError) {
        console.error('Push notification error (non-blocking):', pushError);
      }
      
      // Create in-app notification (wrapped in try-catch to prevent blocking)
      try {
        await createNotification({
          userId: user.id,
          type: 'payment_success',
          title: 'Pickup Authorization Ready',
          message: `Your pickup code is ${pickupAuthCode}. Collect ${assetName} within 48 hours.`,
          data: {
            auctionId: paymentInfo.auctionId,
            pickupAuthCode,
            type: 'pickup_authorization',
          },
        });
        console.log(`✅ Pickup authorization in-app notification created`);
      } catch (notifError) {
        console.error('In-app notification error (non-blocking):', notifError);
      }
      
      console.log(`✅ Pickup authorization complete for auction ${paymentInfo.auctionId}`);
    } catch (error) {
      // Log error but don't throw - pickup authorization failure shouldn't block payment
      console.error('❌ Error generating pickup authorization (non-blocking):', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
    }
  }

  /**
   * Generate pickup authorization code
   * Format: AUTH-{first 8 chars of auction ID uppercase}
   * 
   * @param auctionId - Auction ID
   * @returns Pickup authorization code
   */
  private generatePickupAuthorizationCode(auctionId: string): string {
    return `AUTH-${auctionId.substring(0, 8).toUpperCase()}`;
  }

  /**
   * Unfreeze all non-winner deposits after winner completes payment
   * This completes the fallback chain - deposits were frozen for all bidders
   * in case winner failed to pay, but now that payment is complete, everyone
   * else gets their deposits back.
   * 
   * @param auctionId - Auction ID
   * @param winnerId - Winner vendor ID (to exclude from unfreezing)
   */
  private async unfreezeNonWinnerDeposits(
    auctionId: string,
    winnerId: string
  ): Promise<void> {
    try {
      // Get all bidders with frozen deposits (excluding winner)
      const allWinners = await db
        .select()
        .from(auctionWinners)
        .where(eq(auctionWinners.auctionId, auctionId));

      if (!allWinners || allWinners.length === 0) {
        console.log(`⚠️  No auction winners found for auction ${auctionId}`);
        return;
      }

      // Filter out the winner
      const nonWinners = allWinners.filter((w) => w.vendorId !== winnerId);

      if (nonWinners.length === 0) {
        console.log(`✅ No non-winner deposits to unfreeze for auction ${auctionId}`);
        return;
      }

      console.log(`🔓 Unfreezing deposits for ${nonWinners.length} non-winners`);

      // Unfreeze each non-winner's deposit
      for (const bidder of nonWinners) {
        const depositAmount = parseFloat(bidder.depositAmount);
        
        try {
          // Use escrow service to unfreeze
          const { escrowService } = await import('@/features/payments/services/escrow.service');
          
          await escrowService.unfreezeFunds(
            bidder.vendorId,
            depositAmount,
            auctionId,
            'system' // userId for audit trail
          );
          
          console.log(`✅ Unfroze ₦${depositAmount.toLocaleString()} for vendor ${bidder.vendorId}`);
        } catch (error) {
          console.error(`❌ Failed to unfreeze deposit for vendor ${bidder.vendorId}:`, error);
          // Continue with other bidders even if one fails
        }
      }

      console.log(`✅ All non-winner deposits unfrozen for auction ${auctionId}`);
    } catch (error) {
      console.error(`❌ Error unfreezing non-winner deposits:`, error);
      // Don't throw - this shouldn't block payment completion
    }
  }

  /**
   * Process hybrid payment (wallet + Paystack)
   * 
   * @param params - Payment parameters
   * @returns Payment result
   * @throws Error if insufficient balance or payment already exists
   */
  async processHybridPayment(
    params: ProcessHybridPaymentParams
  ): Promise<PaymentResult> {
    const { auctionId, vendorId, finalBid, depositAmount, idempotencyKey, vendorEmail } = params;

    const remainingAmount = finalBid - depositAmount;

    // Check for existing payment with same idempotency key
    const existingPayment = await this.checkIdempotency(auctionId, idempotencyKey);
    if (existingPayment) {
      return existingPayment;
    }

    // Get wallet balance
    const [wallet] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, vendorId))
      .limit(1);

    if (!wallet) {
      throw new Error(`Wallet not found for vendor ${vendorId}`);
    }

    const availableBalance = parseFloat(wallet.availableBalance);

    // Calculate wallet and Paystack portions
    const walletPortion = Math.min(availableBalance, remainingAmount);
    const paystackPortion = remainingAmount - walletPortion;

    if (paystackPortion <= 0) {
      throw new Error(
        'Hybrid payment requires Paystack portion > 0. Use wallet-only payment instead.'
      );
    }

    if (walletPortion <= 0) {
      throw new Error(
        'Hybrid payment requires wallet portion > 0. Use Paystack-only payment instead.'
      );
    }

    // Step 1: Deduct wallet portion in transaction
    await db.transaction(async (tx) => {
      const [walletLocked] = await tx
        .select()
        .from(escrowWallets)
        .where(eq(escrowWallets.vendorId, vendorId))
        .for('update')
        .limit(1);

      if (!walletLocked) {
        throw new Error(`Wallet not found for vendor ${vendorId}`);
      }

      const currentBalance = parseFloat(walletLocked.balance);
      const currentAvailable = parseFloat(walletLocked.availableBalance);
      const currentFrozen = parseFloat(walletLocked.frozenAmount);
      const currentForfeited = parseFloat(walletLocked.forfeitedAmount || '0');

      // Verify sufficient available balance
      if (currentAvailable < walletPortion) {
        throw new Error(
          `Insufficient available balance. Required: ₦${walletPortion.toFixed(2)}, Available: ₦${currentAvailable.toFixed(2)}`
        );
      }

      // Calculate new wallet values (deduct wallet portion only, keep deposit frozen)
      const newBalance = currentBalance - walletPortion;
      const newAvailable = currentAvailable - walletPortion;

      // Verify invariant
      const expectedBalance = newAvailable + currentFrozen + currentForfeited;
      if (Math.abs(expectedBalance - newBalance) > 0.01) {
        throw new Error(
          `Wallet invariant violation. Balance: ${newBalance}, Expected: ${expectedBalance}`
        );
      }

      // Update wallet (deduct wallet portion)
      await tx
        .update(escrowWallets)
        .set({
          balance: newBalance.toFixed(2),
          availableBalance: newAvailable.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(escrowWallets.vendorId, vendorId));

      // Record deposit event for wallet deduction
      await tx.insert(depositEvents).values({
        vendorId,
        auctionId,
        eventType: 'unfreeze', // Using unfreeze to represent wallet deduction
        amount: walletPortion.toFixed(2),
        balanceBefore: currentBalance.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        frozenBefore: currentFrozen.toFixed(2),
        frozenAfter: currentFrozen.toFixed(2), // Frozen unchanged
        availableBefore: currentAvailable.toFixed(2),
        availableAfter: newAvailable.toFixed(2),
        description: `Hybrid payment - wallet portion deducted (₦${walletPortion.toFixed(2)})`,
      });

      // Verify invariant after update
      await this.verifyInvariantInTransaction(tx, vendorId);
    });

    // Step 2: Check if payment record already exists (from document signing)
    const [existingPaymentRecord] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.auctionId, auctionId),
          eq(payments.vendorId, vendorId),
          eq(payments.status, 'pending')
        )
      )
      .limit(1);

    let payment;
    if (existingPaymentRecord) {
      // Update existing payment record
      console.log(`✅ Updating existing payment record: ${existingPaymentRecord.id}`);
      [payment] = await db
        .update(payments)
        .set({
          paymentMethod: 'paystack', // Using paystack method for hybrid
          paymentReference: idempotencyKey, // Will be updated with Paystack reference
          updatedAt: new Date(),
        })
        .where(eq(payments.id, existingPaymentRecord.id))
        .returning();
    } else {
      // Create new payment record (fallback if document signing didn't create one)
      console.log(`✅ Creating new payment record`);
      [payment] = await db
        .insert(payments)
        .values({
          auctionId,
          vendorId,
          amount: finalBid.toFixed(2),
          paymentMethod: 'paystack', // Using paystack method for hybrid
          paymentReference: idempotencyKey, // Will be updated with Paystack reference
          status: 'pending',
          paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        })
        .returning();
    }

    // Step 3: Initialize Paystack transaction with FIXED amount (paystackPortion only)
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: vendorEmail,
        amount: Math.round(paystackPortion * 100), // Convert to kobo, FIXED amount
        reference: payment.id,
        callback_url: `${process.env.NEXTAUTH_URL}/vendor/auctions/${auctionId}?payment=success`,
        metadata: {
          auctionId,
          vendorId,
          depositAmount: depositAmount.toFixed(2),
          walletPortion: walletPortion.toFixed(2),
          paystackPortion: paystackPortion.toFixed(2),
          paymentType: 'hybrid',
          custom_fields: [
            {
              display_name: 'Auction ID',
              variable_name: 'auction_id',
              value: auctionId,
            },
            {
              display_name: 'Payment Type',
              variable_name: 'payment_type',
              value: 'Hybrid (Wallet + Paystack)',
            },
            {
              display_name: 'Wallet Portion',
              variable_name: 'wallet_portion',
              value: `₦${walletPortion.toLocaleString()}`,
            },
          ],
        },
      }),
    });

    if (!paystackResponse.ok) {
      // Rollback wallet deduction
      await db.transaction(async (tx) => {
        const [walletLocked] = await tx
          .select()
          .from(escrowWallets)
          .where(eq(escrowWallets.vendorId, vendorId))
          .for('update')
          .limit(1);

        if (walletLocked) {
          const currentBalance = parseFloat(walletLocked.balance);
          const currentAvailable = parseFloat(walletLocked.availableBalance);
          const currentFrozen = parseFloat(walletLocked.frozenAmount);

          // Refund wallet portion
          const newBalance = currentBalance + walletPortion;
          const newAvailable = currentAvailable + walletPortion;

          await tx
            .update(escrowWallets)
            .set({
              balance: newBalance.toFixed(2),
              availableBalance: newAvailable.toFixed(2),
              updatedAt: new Date(),
            })
            .where(eq(escrowWallets.vendorId, vendorId));

          // Record refund event
          await tx.insert(depositEvents).values({
            vendorId,
            auctionId,
            eventType: 'unfreeze', // Using unfreeze to represent refund
            amount: walletPortion.toFixed(2),
            balanceBefore: currentBalance.toFixed(2),
            balanceAfter: newBalance.toFixed(2),
            frozenBefore: currentFrozen.toFixed(2),
            frozenAfter: currentFrozen.toFixed(2),
            availableBefore: currentAvailable.toFixed(2),
            availableAfter: newAvailable.toFixed(2),
            description: `Hybrid payment rollback - Paystack initialization failed`,
          });
        }
      });

      // Delete pending payment
      await db.delete(payments).where(eq(payments.id, payment.id));

      throw new Error('Failed to initialize Paystack payment. Wallet amount refunded.');
    }

    const paystackData = await paystackResponse.json();

    // Update payment with Paystack reference
    await db
      .update(payments)
      .set({
        paymentReference: paystackData.data.reference,
      })
      .where(eq(payments.id, payment.id));

    return {
      paymentId: payment.id,
      type: 'hybrid',
      amount: finalBid,
      status: 'pending',
      paystackReference: paystackData.data.reference,
      authorizationUrl: paystackData.data.authorization_url,
      accessCode: paystackData.data.access_code,
      walletAmount: walletPortion,
      paystackAmount: paystackPortion,
    };
  }

  /**
   * Rollback hybrid payment if Paystack fails
   * Refunds wallet portion back to available balance
   * 
   * @param paymentId - Payment ID
   * @param vendorId - Vendor ID
   * @param walletPortion - Amount to refund
   */
  async rollbackHybridPayment(
    paymentId: string,
    vendorId: string,
    walletPortion: number
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // Lock wallet for update
      const [wallet] = await tx
        .select()
        .from(escrowWallets)
        .where(eq(escrowWallets.vendorId, vendorId))
        .for('update')
        .limit(1);

      if (!wallet) {
        throw new Error(`Wallet not found for vendor ${vendorId}`);
      }

      const currentBalance = parseFloat(wallet.balance);
      const currentAvailable = parseFloat(wallet.availableBalance);
      const currentFrozen = parseFloat(wallet.frozenAmount);
      const currentForfeited = parseFloat(wallet.forfeitedAmount || '0');

      // Refund wallet portion
      const newBalance = currentBalance + walletPortion;
      const newAvailable = currentAvailable + walletPortion;

      // Verify invariant
      const expectedBalance = newAvailable + currentFrozen + currentForfeited;
      if (Math.abs(expectedBalance - newBalance) > 0.01) {
        throw new Error(
          `Wallet invariant violation during rollback. Balance: ${newBalance}, Expected: ${expectedBalance}`
        );
      }

      // Update wallet (refund wallet portion)
      await tx
        .update(escrowWallets)
        .set({
          balance: newBalance.toFixed(2),
          availableBalance: newAvailable.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(escrowWallets.vendorId, vendorId));

      // Mark payment as rejected
      await tx
        .update(payments)
        .set({
          status: 'rejected',
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentId));

      // Verify invariant after update
      await this.verifyInvariantInTransaction(tx, vendorId);
    });
  }

  /**
   * Check for existing payment with same idempotency key
   * 
   * @param auctionId - Auction ID
   * @param idempotencyKey - Idempotency key
   * @returns Existing payment result or null
   */
  private async checkIdempotency(
    auctionId: string,
    idempotencyKey: string
  ): Promise<PaymentResult | null> {
    const [existingPayment] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.auctionId, auctionId),
          eq(payments.paymentReference, idempotencyKey)
        )
      )
      .limit(1);

    if (existingPayment) {
      // Return existing payment result
      const type = existingPayment.paymentMethod === 'escrow_wallet' ? 'wallet' : 
                   existingPayment.paymentReference?.includes('_hybrid_') ? 'hybrid' : 'paystack';
      const status = existingPayment.status === 'verified' ? 'completed' : 'pending';
      
      return {
        paymentId: existingPayment.id,
        type: type as 'wallet' | 'paystack' | 'hybrid',
        amount: parseFloat(existingPayment.amount),
        status: status as 'completed' | 'pending',
        paystackReference: existingPayment.paymentReference || undefined,
      };
    }

    return null;
  }

  /**
   * Verify wallet invariant within a transaction
   * 
   * @param tx - Database transaction
   * @param vendorId - Vendor ID
   * @throws Error if invariant violation detected
   */
  private async verifyInvariantInTransaction(
    tx: any,
    vendorId: string
  ): Promise<void> {
    const [wallet] = await tx
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, vendorId))
      .limit(1);

    if (!wallet) {
      throw new Error(`Wallet not found for vendor ${vendorId}`);
    }

    const balance = parseFloat(wallet.balance);
    const available = parseFloat(wallet.availableBalance);
    const frozen = parseFloat(wallet.frozenAmount);
    const forfeited = parseFloat(wallet.forfeitedAmount || '0');

    const expectedBalance = available + frozen + forfeited;

    if (Math.abs(balance - expectedBalance) > 0.01) {
      console.error('[CRITICAL] Wallet invariant violation detected during payment:', {
        vendorId,
        walletId: wallet.id,
        balance,
        available,
        frozen,
        forfeited,
        expectedBalance,
        difference: balance - expectedBalance,
      });

      throw new Error(
        `Wallet invariant violation: balance=${balance}, expected=${expectedBalance}, diff=${(balance - expectedBalance).toFixed(2)}`
      );
    }
  }
}

// Export singleton instance
export const paymentService = new PaymentService();
