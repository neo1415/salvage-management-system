/**
 * Auction Closure Service
 * Handles automatic auction closure at end time
 * 
 * Requirements:
 * - Requirement 24: Paystack Instant Payment (generate invoice, set deadline, notify winner)
 * - Enterprise Standards Section 5: Business Logic Layer
 * 
 * This service is designed to be called by a cron job that runs periodically
 * to check for auctions that have ended and need to be closed.
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq, and, lte } from 'drizzle-orm';
import { logAction, AuditActionType, AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';
import { smsService } from '@/features/notifications/services/sms.service';
import { emailService } from '@/features/notifications/services/email.service';
import { escrowService } from '@/features/payments/services/escrow.service';
import {
  createAuctionWonNotification,
  createAuctionLostNotification,
} from '@/features/notifications/services/notification.service';
import { generateDocument } from '@/features/documents/services/document.service';
import { broadcastAuctionClosure, broadcastAuctionUpdate, broadcastAuctionClosing, broadcastDocumentGenerated, broadcastDocumentGenerationComplete } from '@/lib/socket/server';
import { getAppUrl } from '@/features/notifications/templates/email-urls';
import { configService } from '@/features/auction-deposit/services/config.service';
import {
  businessPolicyService,
  isBusinessPolicyEnforcementEnabled,
  resolveDocumentDeadlineHours,
} from '@/features/business-policy';
import { formatAssetName as formatCaseAssetName } from '@/lib/utils/asset-name';
import { brandLegalName, brandTeamName, getEmailBranding, getSupportEmail, getSupportPhone, type EmailBranding } from '@/features/notifications/templates/email-branding';

/**
 * Auction closure result
 */
export interface AuctionClosureResult {
  success: boolean;
  auctionId: string;
  winnerId?: string;
  winningBid?: number;
  paymentId?: string;
  error?: string;
}

/**
 * Batch closure result
 */
export interface BatchClosureResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  results: AuctionClosureResult[];
}

async function getEffectiveDocumentDeadlineHours(legacyHours: number): Promise<number> {
  if (!isBusinessPolicyEnforcementEnabled()) {
    return legacyHours;
  }

  const policy = await businessPolicyService.getEffectivePolicy();
  return resolveDocumentDeadlineHours(policy).value ?? legacyHours;
}

/**
 * Auction Closure Service
 * Handles automatic auction closure at end time
 */
export class AuctionClosureService {
  /**
   * Close all auctions that have ended
   * This method should be called by a cron job
   * 
   * @returns Batch closure result
   */
  async closeExpiredAuctions(): Promise<BatchClosureResult> {
    try {
      const now = new Date();

      // Find all active or extended auctions that have ended
      const expiredAuctions = await db
        .select()
        .from(auctions)
        .where(
          and(
            lte(auctions.endTime, now),
            // Only close active or extended auctions
            eq(auctions.status, 'active')
          )
        );

      console.log(`Found ${expiredAuctions.length} expired auctions to close`);

      const results: AuctionClosureResult[] = [];

      // Process each expired auction
      for (const auction of expiredAuctions) {
        try {
          const result = await this.closeAuction(auction.id);
          results.push(result);
        } catch (error) {
          console.error(`Failed to close auction ${auction.id}:`, error);
          results.push({
            success: false,
            auctionId: auction.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      return {
        totalProcessed: expiredAuctions.length,
        successful,
        failed,
        results,
      };
    } catch (error) {
      console.error('Failed to close expired auctions:', error);
      throw error;
    }
  }

  /**
   * Close a single auction
   * 
   * Requirements:
   * - Identify winning bidder
   * - Update auction status to 'closed'
   * - Generate invoice for winner
   * - Set payment deadline to 24 hours
   * - Send SMS + Email + Push notification with payment link
   * - Create audit log entry
   * 
   * IDEMPOTENCY: Safe to call multiple times. If auction is already closed,
   * returns success without re-processing. Prevents duplicate closures.
   * 
   * @param auctionId - Auction ID
   * @returns Auction closure result
   */
  async closeAuction(auctionId: string): Promise<AuctionClosureResult> {
    try {
      // Get auction details
      const [auction] = await db
        .select()
        .from(auctions)
        .where(eq(auctions.id, auctionId))
        .limit(1);

      if (!auction) {
        return {
          success: false,
          auctionId,
          error: 'Auction not found',
        };
      }

      // IDEMPOTENCY CHECK: If auction is already closed, return success
      if (auction.status === 'closed') {
        console.log(`✅ Auction ${auctionId} is already closed (idempotent check)`);
        console.log(`   - Status: ${auction.status}`);
        console.log(`   - Winner: ${auction.currentBidder || 'No winner'}`);
        console.log(`   - Winning Bid: ${auction.currentBid ? `₦${parseFloat(auction.currentBid).toLocaleString()}` : 'N/A'}`);
        console.log(`   - Skipping duplicate closure`);
        return {
          success: true,
          auctionId,
          winnerId: auction.currentBidder || undefined,
          winningBid: auction.currentBid ? parseFloat(auction.currentBid) : undefined,
        };
      }

      // IDEMPOTENCY CHECK: If auction is forfeited, don't try to close it
      if (auction.status === 'forfeited') {
        console.log(`⏸️  Auction ${auctionId} is forfeited. Cannot close.`);
        return {
          success: false,
          auctionId,
          error: 'Auction is forfeited',
        };
      }

      // Check if there's a winning bidder
      if (!auction.currentBidder || !auction.currentBid) {
        // No bids placed - close auction without winner
        await db
          .update(auctions)
          .set({
            status: 'closed',
            updatedAt: new Date(),
          })
          .where(eq(auctions.id, auctionId));

        // Log closure without winner
        await logAction({
          userId: 'system',
          actionType: AuditActionType.AUCTION_CLOSED,
          entityType: AuditEntityType.AUCTION,
          entityId: auctionId,
          ipAddress: '0.0.0.0',
          deviceType: DeviceType.DESKTOP,
          userAgent: 'cron-job',
          beforeState: { status: auction.status },
          afterState: { status: 'closed', winner: null },
        });

        console.log(`✅ Auction ${auctionId} closed with no bids`);
        return {
          success: true,
          auctionId,
        };
      }

      // Get winning vendor details
      const [vendor] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, auction.currentBidder))
        .limit(1);

      if (!vendor) {
        return {
          success: false,
          auctionId,
          error: 'Winning vendor not found',
        };
      }

      // Get user details
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, vendor.userId))
        .limit(1);

      if (!user) {
        return {
          success: false,
          auctionId,
          error: 'User not found for winning vendor',
        };
      }

      // Get case details
      const [salvageCase] = await db
        .select()
        .from(salvageCases)
        .where(eq(salvageCases.id, auction.caseId))
        .limit(1);

      if (!salvageCase) {
        return {
          success: false,
          auctionId,
          error: 'Salvage case not found',
        };
      }

      const config = await configService.getConfig();
      const documentValidityHours = await getEffectiveDocumentDeadlineHours(config.documentValidityPeriod);

      // Initial deadline is for document signing. Payment deadline is reset from
      // paymentDeadlineAfterSigning when all required documents are signed.
      const documentDeadline = new Date();
      documentDeadline.setHours(documentDeadline.getHours() + documentValidityHours);

      // IDEMPOTENCY CHECK: Check if payment already exists for this auction
      const [existingPayment] = await db
        .select()
        .from(payments)
        .where(eq(payments.auctionId, auctionId))
        .limit(1);

      let payment: typeof payments.$inferSelect;

      if (existingPayment) {
        console.log(`✅ Payment already exists for auction ${auctionId} (idempotent check)`);
        console.log(`   - Payment ID: ${existingPayment.id}`);
        console.log(`   - Status: ${existingPayment.status}`);
        console.log(`   - Amount: ₦${parseFloat(existingPayment.amount).toLocaleString()}`);
        console.log(`   - Skipping duplicate payment creation`);
        payment = existingPayment;
      } else {
        // Generate unique payment reference
        const reference = `PAY_${auctionId.substring(0, 8)}_${Date.now()}`;

        // Funds should already be frozen from bidding - use escrow wallet payment method
        const paymentMethod: 'escrow_wallet' = 'escrow_wallet';
        const escrowStatus: 'frozen' = 'frozen';

        // Create payment record (invoice)
        [payment] = await db
          .insert(payments)
          .values({
            auctionId,
            vendorId: vendor.id,
            amount: auction.currentBid.toString(),
            paymentMethod,
            escrowStatus,
            paymentReference: reference,
            status: 'pending',
            paymentDeadline: documentDeadline,
            autoVerified: false,
          })
          .returning();

        console.log(`✅ Payment record created for auction ${auctionId}`);
        console.log(`   - Payment ID: ${payment.id}`);
        console.log(`   - Reference: ${reference}`);

        await businessPolicyService.createCurrentPolicySnapshot({
          entityType: 'payment',
          entityId: payment.id,
          actorId: undefined,
          reason: `Auction winner payment obligation created for auction ${auctionId}.`,
        });
      }

      // STEP 1: Broadcast closing event (before any status changes)
      try {
        await broadcastAuctionClosing(auctionId);
        console.log(`✅ Broadcasted auction closing for ${auctionId}`);
      } catch (error) {
        console.error(`❌ Failed to broadcast auction closing for ${auctionId}:`, error);
        // Don't throw - continue with closure process
      }

      console.log(`🔄 Auction ${auctionId}: Generating documents before status change...`);

      // STEP 2: Generate required documents SYNCHRONOUSLY (CRITICAL FIX)
      // This ensures documents are ready before auction is marked as 'closed'
      try {
        await this.generateWinnerDocuments(auctionId, vendor.id, vendor.userId);
        console.log(`✅ Documents generated successfully for auction ${auctionId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const stackTrace = error instanceof Error ? error.stack : undefined;
        
        console.error(`❌ CRITICAL: Failed to generate documents for auction ${auctionId}:`, error);
        console.error(`   - Vendor ID: ${vendor.id}`);
        console.error(`   - User ID: ${vendor.userId}`);
        console.error(`   - Error details:`, errorMessage);
        if (stackTrace) {
          console.error(`   - Stack trace:`, stackTrace);
        }
        
        // Log overall document generation failure to audit trail
        try {
          await logAction({
            userId: vendor.userId,
            actionType: AuditActionType.DOCUMENT_GENERATION_FAILED,
            entityType: AuditEntityType.AUCTION,
            entityId: auctionId,
            ipAddress: '0.0.0.0',
            deviceType: DeviceType.DESKTOP,
            userAgent: 'auction-closure',
            afterState: {
              error: errorMessage,
              stackTrace,
              vendorId: vendor.id,
              timestamp: new Date().toISOString(),
              phase: 'overall_document_generation',
              context: 'auction_closure',
            },
          });
        } catch (logError) {
          console.error('Failed to log document generation failure to audit trail:', logError);
        }
        
        // Note: Auction status remains unchanged (active/extended) if documents fail
        // This allows the auction to be retried
        console.error(`⚠️  Auction ${auctionId} remains in '${auction.status}' status due to document generation failure`);
        
        // Broadcast error state
        try {
          await broadcastAuctionUpdate(auctionId, {
            ...auction,
            error: 'Document generation failed',
          });
        } catch (broadcastError) {
          console.error(`❌ Failed to broadcast error state:`, broadcastError);
        }
        
        // Don't throw - return error result instead
        return {
          success: false,
          auctionId,
          error: `Document generation failed: ${errorMessage}`,
        };
      }

      // STEP 3: Handle deposit system logic (Requirement 5: Top N Bidders Retention)
      // This must happen BEFORE status update to 'closed'
      // CRITICAL FIX: Winner record creation is now MANDATORY - if it fails, don't mark auction as closed
      const { auctionClosureService: depositClosureService } = await import('./auction-closure.service');
      const depositResult = await depositClosureService.closeAuction(auctionId);
      
      if (!depositResult.success) {
        const errorMessage = `Deposit system closure failed: ${depositResult.error}`;
        console.error(`❌ CRITICAL: ${errorMessage} for auction ${auctionId}`);
        console.error(`   - Auction will remain in '${auction.status}' status`);
        console.error(`   - Winner record was NOT created`);
        console.error(`   - This auction needs manual intervention`);
        
        // Log critical failure to audit trail
        await logAction({
          userId: vendor.userId,
          actionType: AuditActionType.AUCTION_CLOSURE_FAILED,
          entityType: AuditEntityType.AUCTION,
          entityId: auctionId,
          ipAddress: '0.0.0.0',
          deviceType: DeviceType.DESKTOP,
          userAgent: 'auction-closure',
          afterState: {
            error: errorMessage,
            phase: 'deposit_system_closure',
            auctionStatus: auction.status,
            winnerId: vendor.id,
            winningBid: auction.currentBid.toString(),
            timestamp: new Date().toISOString(),
          },
        });
        
        // Return error - DO NOT mark auction as closed
        return {
          success: false,
          auctionId,
          error: errorMessage,
        };
      }
      
      console.log(`✅ Deposit system closure complete for auction ${auctionId}`);
      console.log(`   - Winner record created: Vendor ${depositResult.winnerId}`);
      console.log(`   - Top bidders: ${depositResult.topBiddersCount} (deposits kept frozen)`);
      console.log(`   - Unfrozen bidders: ${depositResult.unfrozenBiddersCount}`);

      // STEP 4: Update auction status to 'closed' (final state - only after winner record is created)
      await db
        .update(auctions)
        .set({
          status: 'closed',
          updatedAt: new Date(),
        })
        .where(eq(auctions.id, auctionId));

      console.log(`✅ Auction ${auctionId} status: closed`);

      // CRITICAL: Invalidate auction cache after status change
      try {
        const { cache } = await import('@/lib/redis/client');
        await cache.del(`auction:details:${auctionId}`);
        console.log(`✅ Invalidated auction cache after closure`);
      } catch (cacheError) {
        console.error(`❌ Failed to invalidate auction cache:`, cacheError);
        // Don't throw - cache invalidation failure shouldn't block closure
      }

      // STEP 4: Broadcast auction closure to all viewers via Socket.io
      try {
        await broadcastAuctionClosure(auctionId, vendor.id);
        console.log(`✅ Broadcasted auction closure for ${auctionId}`);
      } catch (error) {
        console.error(`❌ Failed to broadcast auction closure for ${auctionId}:`, error);
        // Don't throw - continue with rest of closure process
      }

      // STEP 6: Broadcast auction update with new status
      try {
        await broadcastAuctionUpdate(auctionId, {
          ...auction,
          status: 'closed',
          updatedAt: new Date(),
        });
        console.log(`✅ Broadcasted auction status update for ${auctionId}`);
      } catch (error) {
        console.error(`❌ Failed to broadcast auction status update for ${auctionId}:`, error);
        // Don't throw - continue with rest of closure process
      }

      // Keep case status as 'active_auction' until payment is verified
      // Case will be marked as 'sold' when payment is verified by finance officer
      // This ensures accurate reporting and prevents showing items as sold before payment

      // Log auction closure
      await logAction({
        userId: vendor.userId,
        actionType: AuditActionType.AUCTION_CLOSED,
        entityType: AuditEntityType.AUCTION,
        entityId: auctionId,
        ipAddress: '0.0.0.0',
        deviceType: DeviceType.DESKTOP,
        userAgent: 'auction-closure',
        beforeState: { status: auction.status },
        afterState: {
          status: 'closed',
          winnerId: vendor.id,
          winningBid: auction.currentBid.toString(),
          paymentId: payment.id,
        },
      });

      // STEP 7: Send notifications to winner (async, don't wait)
      this.notifyWinner(user, vendor, auction, salvageCase, payment, documentDeadline).catch(
        async (error) => {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const stackTrace = error instanceof Error ? error.stack : undefined;
          
          console.error(`❌ CRITICAL: Failed to notify winner for auction ${auctionId}:`, error);
          console.error(`   - Vendor ID: ${vendor.id}`);
          console.error(`   - User ID: ${vendor.userId}`);
          console.error(`   - User Email: ${user.email}`);
          console.error(`   - User Phone: ${user.phone}`);
          console.error(`   - Error details:`, errorMessage);
          if (stackTrace) {
            console.error(`   - Stack trace:`, stackTrace);
          }
          
          // Log failure to audit log so admins/finance can see it
          try {
            await logAction({
              userId: vendor.userId,
              actionType: AuditActionType.NOTIFICATION_FAILED,
              entityType: AuditEntityType.AUCTION,
              entityId: auctionId,
              ipAddress: '0.0.0.0',
              deviceType: DeviceType.DESKTOP,
              userAgent: 'cron-job',
              afterState: {
                error: errorMessage,
                stackTrace,
                vendorId: vendor.id,
                paymentId: payment.id,
                userEmail: user.email,
                userPhone: user.phone,
                timestamp: new Date().toISOString(),
                context: 'auction_closure_winner_notification',
              },
            });
          } catch (logError) {
            console.error('Failed to log notification failure to audit trail:', logError);
          }
        }
      );

      console.log(
        `Auction ${auctionId} closed successfully. Winner: ${vendor.id}, Amount: ₦${parseFloat(
          auction.currentBid
        ).toLocaleString()}`
      );

      return {
        success: true,
        auctionId,
        winnerId: vendor.id,
        winningBid: parseFloat(auction.currentBid),
        paymentId: payment.id,
      };
    } catch (error) {
      console.error(`Failed to close auction ${auctionId}:`, error);
      return {
        success: false,
        auctionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate a document with retry logic and exponential backoff
   * Retries up to 3 times on failure with delays: 2s, 4s, 8s
   * 
   * @param auctionId - Auction ID
   * @param vendorId - Vendor ID
   * @param documentType - Document type to generate
   * @param createdBy - User ID who created the document
   * @param userId - User ID for audit logging
   * @param maxRetries - Maximum number of retries (default: 3)
   * @returns Generated document
   */
  private async generateDocumentWithRetry(
    auctionId: string,
    vendorId: string,
    documentType: 'bill_of_sale' | 'liability_waiver' | 'pickup_authorization',
    createdBy: string,
    userId: string,
    maxRetries = 3
  ): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const document = await generateDocument(auctionId, vendorId, documentType, createdBy);
        
        // Log successful document generation to audit log
        await logAction({
          userId,
          actionType: AuditActionType.DOCUMENT_GENERATED,
          entityType: AuditEntityType.AUCTION,
          entityId: auctionId,
          ipAddress: '0.0.0.0',
          deviceType: DeviceType.DESKTOP,
          userAgent: 'cron-job',
          afterState: {
            documentType,
            documentId: document.id,
            vendorId,
            timestamp: new Date().toISOString(),
            retryAttempt: attempt > 1 ? attempt : undefined,
            success: true,
          },
        });
        
        return document;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const stackTrace = error instanceof Error ? error.stack : undefined;
        
        console.error(`❌ Failed to generate ${documentType} (attempt ${attempt}/${maxRetries}):`, error);
        console.error(`   - Auction ID: ${auctionId}`);
        console.error(`   - Vendor ID: ${vendorId}`);
        console.error(`   - Error: ${errorMessage}`);
        if (stackTrace) {
          console.error(`   - Stack trace:`, stackTrace);
        }
        
        // Log failure to audit log for each retry attempt
        await logAction({
          userId,
          actionType: AuditActionType.DOCUMENT_GENERATION_FAILED,
          entityType: AuditEntityType.AUCTION,
          entityId: auctionId,
          ipAddress: '0.0.0.0',
          deviceType: DeviceType.DESKTOP,
          userAgent: 'cron-job',
          afterState: {
            error: errorMessage,
            stackTrace,
            documentType,
            vendorId,
            timestamp: new Date().toISOString(),
            retryAttempt: attempt,
            maxRetries,
            willRetry: attempt < maxRetries,
            context: 'document_generation_with_retry',
          },
        });
        
        if (attempt === maxRetries) {
          console.error(`❌ Max retries (${maxRetries}) exceeded for ${documentType}`);
          throw error;
        }
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`⚠️  Retry ${attempt}/${maxRetries} for ${documentType} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries exceeded');
  }

  /**
   * Generate required documents for auction winner
   * Generates: Bill of Sale, Liability Waiver (2 documents)
   * 
   * SECURITY FIX: Pickup Authorization is NOT generated here.
   * It will be generated and sent AFTER payment is complete to prevent
   * vendors from seeing the pickup code before payment.
   * 
   * IDEMPOTENCY: Checks if documents already exist before generating.
   * Safe to call multiple times - won't create duplicates.
   * 
   * @param auctionId - Auction ID
   * @param vendorId - Vendor ID
   * @param userId - User ID for audit logging
   */
  private async generateWinnerDocuments(
    auctionId: string,
    vendorId: string,
    userId: string
  ): Promise<void> {
    try {
      console.log(`📄 Starting document generation for auction ${auctionId}, vendor ${vendorId}`);

      // Check if documents already exist (duplicate prevention)
      const { releaseForms } = await import('@/lib/db/schema/release-forms');
      const existingDocuments = await db
        .select()
        .from(releaseForms)
        .where(
          and(
            eq(releaseForms.auctionId, auctionId),
            eq(releaseForms.vendorId, vendorId)
          )
        );

      const existingTypes = existingDocuments.map(doc => doc.documentType);
      const hasBillOfSale = existingTypes.includes('bill_of_sale');
      const hasLiabilityWaiver = existingTypes.includes('liability_waiver');

      if (hasBillOfSale && hasLiabilityWaiver) {
        console.log(`✅ All documents already exist for auction ${auctionId}. Skipping generation.`);
        console.log(`   - Bill of Sale: ${existingDocuments.find(d => d.documentType === 'bill_of_sale')?.id}`);
        console.log(`   - Liability Waiver: ${existingDocuments.find(d => d.documentType === 'liability_waiver')?.id}`);
        return;
      }

      const results = {
        billOfSale: hasBillOfSale,
        liabilityWaiver: hasLiabilityWaiver,
      };

      const errors: Array<{ documentType: string; error: string; stackTrace?: string }> = [];

      // Generate Bill of Sale first (sequential to avoid race conditions)
      if (!hasBillOfSale) {
        try {
          const billOfSaleDoc = await this.generateDocumentWithRetry(auctionId, vendorId, 'bill_of_sale', 'system', userId);
          results.billOfSale = true;
          console.log(`✅ Bill of Sale generated for auction ${auctionId}`);
          
          // Broadcast document generated event
          try {
            await broadcastDocumentGenerated(auctionId, 'bill_of_sale', billOfSaleDoc.id);
          } catch (broadcastError) {
            console.error(`❌ Failed to broadcast bill_of_sale generation:`, broadcastError);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const stackTrace = error instanceof Error ? error.stack : undefined;
          
          console.error(`❌ Failed to generate Bill of Sale for auction ${auctionId}:`, error);
          console.error(`   - Vendor ID: ${vendorId}`);
          console.error(`   - Error: ${errorMessage}`);
          if (stackTrace) {
            console.error(`   - Stack trace:`, stackTrace);
          }
          
          errors.push({
            documentType: 'bill_of_sale',
            error: errorMessage,
            stackTrace,
          });
        }
      } else {
        console.log(`⏭️  Bill of Sale already exists for auction ${auctionId}. Skipping.`);
      }

      // Then generate Liability Waiver (sequential to avoid race conditions)
      if (!hasLiabilityWaiver) {
        try {
          const waiverDoc = await this.generateDocumentWithRetry(auctionId, vendorId, 'liability_waiver', 'system', userId);
          results.liabilityWaiver = true;
          console.log(`✅ Liability Waiver generated for auction ${auctionId}`);
          
          // Broadcast document generated event
          try {
            await broadcastDocumentGenerated(auctionId, 'liability_waiver', waiverDoc.id);
          } catch (broadcastError) {
            console.error(`❌ Failed to broadcast liability_waiver generation:`, broadcastError);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const stackTrace = error instanceof Error ? error.stack : undefined;
          
          console.error(`❌ Failed to generate Liability Waiver for auction ${auctionId}:`, error);
          console.error(`   - Vendor ID: ${vendorId}`);
          console.error(`   - Error: ${errorMessage}`);
          if (stackTrace) {
            console.error(`   - Stack trace:`, stackTrace);
          }
          
          errors.push({
            documentType: 'liability_waiver',
            error: errorMessage,
            stackTrace,
          });
        }
      } else {
        console.log(`⏭️  Liability Waiver already exists for auction ${auctionId}. Skipping.`);
      }

      const successCount = Object.values(results).filter(Boolean).length;
      const totalCount = Object.keys(results).length;

      console.log(`📄 Document generation complete: ${successCount}/${totalCount} successful for auction ${auctionId}`);
      
      // Broadcast document generation complete
      if (successCount === totalCount) {
        const config = await configService.getConfig();
        const documentValidityHours = await getEffectiveDocumentDeadlineHours(config.documentValidityPeriod);
        const validityDeadline = new Date();
        validityDeadline.setHours(validityDeadline.getHours() + documentValidityHours);

        const { releaseForms } = await import('@/lib/db/schema/release-forms');
        await db
          .update(releaseForms)
          .set({
            validityDeadline,
            originalDeadline: validityDeadline,
            extensionCount: 0,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(releaseForms.auctionId, auctionId),
              eq(releaseForms.vendorId, vendorId)
            )
          );

        try {
          await broadcastDocumentGenerationComplete(auctionId, totalCount);
        } catch (broadcastError) {
          console.error(`❌ Failed to broadcast document generation complete:`, broadcastError);
        }
      }
      
      // Log overall generation result to audit log
      if (errors.length > 0) {
        // Log overall failure with all error details
        await logAction({
          userId,
          actionType: AuditActionType.DOCUMENT_GENERATION_FAILED,
          entityType: AuditEntityType.AUCTION,
          entityId: auctionId,
          ipAddress: '0.0.0.0',
          deviceType: DeviceType.DESKTOP,
          userAgent: 'cron-job',
          afterState: {
            error: 'One or more documents failed to generate',
            vendorId,
            timestamp: new Date().toISOString(),
            successCount,
            totalCount,
            failedDocuments: errors,
            context: 'generate_winner_documents',
          },
        });
        
        if (successCount === 0) {
          throw new Error('Failed to generate any documents');
        }
        
        if (successCount < totalCount) {
          console.warn(`⚠️ Partial document generation: Only ${successCount}/${totalCount} documents generated for auction ${auctionId}`);
          throw new Error(`Partial document generation: ${errors.map(e => e.documentType).join(', ')} failed`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const stackTrace = error instanceof Error ? error.stack : undefined;
      
      console.error(`❌ Error in generateWinnerDocuments for auction ${auctionId}:`, error);
      console.error(`   - Vendor ID: ${vendorId}`);
      console.error(`   - Error: ${errorMessage}`);
      if (stackTrace) {
        console.error(`   - Stack trace:`, stackTrace);
      }
      
      throw error;
    }
  }

  /**
   * Notify auction winner
   * Sends SMS + Email + Push notification with link to sign documents
   * 
   * @param user - User details
   * @param vendor - Vendor details
   * @param auction - Auction details
   * @param salvageCase - Salvage case details
   * @param payment - Payment details
   * @param paymentDeadline - Document signing deadline
   */
  private async notifyWinner(
    user: typeof users.$inferSelect,
    vendor: typeof vendors.$inferSelect,
    auction: typeof auctions.$inferSelect,
    salvageCase: typeof salvageCases.$inferSelect,
    payment: typeof payments.$inferSelect,
    paymentDeadline: Date
  ): Promise<void> {
    try {
      const appUrl = getAppUrl();
      // FIXED: Link to auction details page where documents can be signed
      const auctionDetailsUrl = `${appUrl}/vendor/auctions/${auction.id}`;
      const branding = await getEmailBranding();

      const winningBid = parseFloat(auction.currentBid!);
      const formattedAmount = winningBid.toLocaleString();

      // Format asset name
      const assetName = this.formatAssetName(salvageCase);

      // Send SMS notification with link to sign documents
      const smsMessage = `Congratulations. You won ${assetName} for ₦${formattedAmount}. Sign the required documents to complete payment: ${auctionDetailsUrl}`;

      await smsService.sendSMS({
        to: user.phone,
        message: smsMessage,
        category: 'auction_won',
      });

      // Send Email notification with link to sign documents
      const emailSubject = `Auction Won: Sign Documents to Complete Payment - ${assetName}`;
      const emailHtml = this.getWinnerNotificationEmailTemplate(
        user.fullName,
        assetName,
        salvageCase,
        winningBid,
        paymentDeadline,
        auctionDetailsUrl,
        branding
      );

      await emailService.sendEmail({
        to: user.email,
        subject: emailSubject,
        html: emailHtml,
      });

      // Log notification sent
      await logAction({
        userId: user.id,
        actionType: AuditActionType.NOTIFICATION_SENT,
        entityType: AuditEntityType.PAYMENT,
        entityId: payment.id,
        ipAddress: '0.0.0.0',
        deviceType: DeviceType.MOBILE,
        userAgent: 'notification-service',
        afterState: {
          type: 'auction_won',
          channels: ['sms', 'email', 'push'],
          auctionId: auction.id,
          paymentId: payment.id,
          auctionDetailsUrl,
        },
      });

      // FIXED: Create in-app notification with link to auction details page
      await createAuctionWonNotification(
        user.id,
        auction.id,
        winningBid,
        assetName,
        payment.id,
        auctionDetailsUrl
      );

      console.log(`✅ Winner notifications sent to vendor ${vendor.id} for auction ${auction.id}`);
      console.log(`   - SMS: Sign documents link sent`);
      console.log(`   - Email: Sign documents link sent`);
      console.log(`   - Push: Auction won notification with link to ${auctionDetailsUrl}`);
    } catch (error) {
      console.error('Failed to send winner notifications:', error);
      throw error;
    }
  }

  /**
   * Format asset name for display
   * 
   * @param salvageCase - Salvage case data
   * @returns Formatted asset name
   */
  private formatAssetName(salvageCase: typeof salvageCases.$inferSelect): string {
    return formatCaseAssetName(
      salvageCase.assetType,
      salvageCase.assetDetails as Record<string, unknown>,
      salvageCase.claimReference
    );
  }

  /**
   * Get winner notification email template
   * 
   * @param fullName - Winner full name
   * @param assetName - Asset name
   * @param salvageCase - Salvage case data
   * @param winningBid - Winning bid amount
   * @param paymentDeadline - Payment deadline
   * @param auctionDetailsUrl - Auction details URL where documents can be signed
   * @returns HTML email template
   */
  private getWinnerNotificationEmailTemplate(
    fullName: string,
    assetName: string,
    salvageCase: typeof salvageCases.$inferSelect,
    winningBid: number,
    paymentDeadline: Date,
    auctionDetailsUrl: string,
    branding: EmailBranding
  ): string {
    const formattedAmount = winningBid.toLocaleString();
    const deadlineHours = Math.max(
      1,
      Math.round((paymentDeadline.getTime() - Date.now()) / (1000 * 60 * 60))
    );
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
              background: ${branding.primaryColor};
              color: white;
              padding: 40px 20px;
              text-align: center;
            }
            .header h1 {
              margin: 0 0 10px 0;
              font-size: 32px;
              font-weight: 700;
            }
            .trophy {
              font-size: 64px;
              margin-bottom: 10px;
            }
            .content {
              padding: 30px 20px;
            }
            .winning-details {
              background: ${branding.accentColor};
              color: ${branding.primaryColor};
              border-radius: 12px;
              padding: 25px;
              margin: 25px 0;
              text-align: center;
            }
            .winning-details h2 {
              margin: 0 0 10px 0;
              font-size: 18px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .winning-amount {
              font-size: 42px;
              font-weight: 800;
              margin: 10px 0;
            }
            .item-details {
              background-color: #f9f9f9;
              border-left: 4px solid ${branding.primaryColor};
              padding: 20px;
              margin: 20px 0;
            }
            .item-details h3 {
              margin: 0 0 15px 0;
              color: ${branding.primaryColor};
              font-size: 20px;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              margin: 10px 0;
              padding: 8px 0;
              border-bottom: 1px solid #e0e0e0;
            }
            .detail-label {
              font-weight: 600;
              color: #666;
            }
            .detail-value {
              color: #333;
              font-weight: 500;
            }
            .deadline-warning {
              background-color: #fff3cd;
              border: 2px solid #ffc107;
              border-radius: 8px;
              padding: 20px;
              margin: 25px 0;
              text-align: center;
            }
            .deadline-warning h3 {
              margin: 0 0 10px 0;
              color: #856404;
              font-size: 20px;
            }
            .deadline-time {
              font-size: 24px;
              font-weight: 700;
              color: #d32f2f;
              margin: 10px 0;
            }
            .button {
              display: inline-block;
              padding: 16px 32px;
              background: ${branding.accentColor};
              color: ${branding.primaryColor};
              text-decoration: none;
              border-radius: 8px;
              font-weight: 700;
              font-size: 18px;
              margin: 20px 0;
              text-align: center;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              transition: transform 0.2s;
            }
            .button:hover {
              transform: translateY(-2px);
              box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
            }
            .button-container {
              text-align: center;
              margin: 30px 0;
            }
            .important-note {
              background-color: #f8d7da;
              border: 1px solid #f5c6cb;
              border-radius: 6px;
              padding: 15px;
              margin: 20px 0;
              color: #721c24;
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
              <h1>Congratulations!</h1>
              <p style="font-size: 18px; margin: 0;">You Won the Auction</p>
            </div>
            
            <div class="content">
              <p><strong>Dear ${this.escapeHtml(fullName)},</strong></p>
              
              <p>Congratulations. You are the winning bidder for the following salvage item:</p>
              
              <div class="winning-details">
                <h2>Your Winning Bid</h2>
                <div class="winning-amount">₦${formattedAmount}</div>
                <p style="margin: 5px 0 0 0; font-weight: 600;">${this.escapeHtml(assetName)}</p>
              </div>
              
              <div class="item-details">
                <h3>Item Details</h3>
                
                <div class="detail-row">
                  <span class="detail-label">Claim Reference:</span>
                  <span class="detail-value">${this.escapeHtml(salvageCase.claimReference)}</span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">Asset Type:</span>
                  <span class="detail-value">${this.escapeHtml(salvageCase.assetType.toUpperCase())}</span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">Damage Severity:</span>
                  <span class="detail-value">${this.escapeHtml((salvageCase.damageSeverity || 'unknown').toUpperCase())}</span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">Location:</span>
                  <span class="detail-value">${this.escapeHtml(salvageCase.locationName)}</span>
                </div>
              </div>
              
              <div class="deadline-warning">
                <h3>Next Steps: Sign Documents</h3>
                <p style="margin: 5px 0;">Before payment can be processed, you must sign 2 required documents:</p>
                <ul style="text-align: left; margin: 15px auto; max-width: 400px; color: #856404;">
                  <li><strong>Bill of Sale</strong></li>
                  <li><strong>Release & Waiver of Liability</strong></li>
                </ul>
                <p style="margin: 10px 0 0 0; font-weight: 600; color: #856404;">
                  All documents must be signed within ${deadlineHours} hours!
                </p>
              </div>
              
              <div class="button-container">
                <a href="${auctionDetailsUrl}" class="button">Sign Documents Now</a>
              </div>
              
              <div class="important-note">
                <strong>Important:</strong> Failure to sign all documents within ${deadlineHours} hours will result in:
                <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                  <li>Forfeiture may apply under the auction rules</li>
                  <li>Item will be re-listed for auction</li>
                  <li>Your vendor account may be reviewed</li>
                </ul>
              </div>
              
              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                <strong>What Happens After Signing:</strong>
              </p>
              <ol style="color: #666; font-size: 14px;">
                <li>Payment will be automatically processed from your escrow wallet</li>
                <li>You'll receive a pickup authorization code via SMS and email</li>
                <li>You can schedule pickup at ${this.escapeHtml(salvageCase.locationName)}</li>
                <li>Bring valid ID and your pickup code to collect the item</li>
              </ol>
              
              <p style="margin-top: 30px;">
                Click the button above to view the auction details and sign all required documents.
              </p>
              
              <p style="margin-top: 30px;">Best regards,<br><strong>${brandTeamName(branding)}</strong></p>
            </div>
            
            <div class="footer">
              <p><strong>${brandLegalName(branding)}</strong></p>
              <p>Phone: ${getSupportPhone(branding)} | Email: ${getSupportEmail(branding)}</p>
              <p style="margin-top: 15px;">This is an automated notification. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   * 
   * @param text - Text to escape
   * @returns Escaped text
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }
}

// Export singleton instance
export const auctionClosureService = new AuctionClosureService();
