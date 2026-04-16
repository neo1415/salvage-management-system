/**
 * Document Integration Service
 * 
 * Extends existing document service with deposit-specific functionality:
 * - Validity deadline tracking (Requirement 6.3)
 * - Payment deadline calculation (Requirement 8.5)
 * - Remaining payment calculation (Requirement 8.4)
 * - Document expiry checking (Requirement 9.1)
 * - Document regeneration for fallback chain (Requirement 9.6)
 */

import { db } from '@/lib/db/drizzle';
import { releaseForms, type ReleaseForm } from '@/lib/db/schema/release-forms';
import { systemConfig } from '@/lib/db/schema/auction-deposit';
import { eq, and } from 'drizzle-orm';
import { generateDocument } from '@/features/documents/services/document.service';

/**
 * Get configuration value from system_config table with testing mode support
 */
async function getConfigValue(parameter: string, defaultValue: number): Promise<number> {
  try {
    // Check testing mode first
    const testingMode = process.env.TESTING_MODE === 'true';
    
    if (testingMode) {
      // Override with testing mode values (in minutes, convert to hours)
      if (parameter === 'document_validity_period' && process.env.TESTING_DOCUMENT_VALIDITY_MINUTES) {
        const minutes = parseInt(process.env.TESTING_DOCUMENT_VALIDITY_MINUTES);
        console.log(`🧪 TESTING MODE: Using ${minutes} minutes for document validity (instead of ${defaultValue} hours)`);
        return minutes / 60; // Convert minutes to hours
      }
      
      if (parameter === 'payment_deadline_after_signing' && process.env.TESTING_PAYMENT_DEADLINE_MINUTES) {
        const minutes = parseInt(process.env.TESTING_PAYMENT_DEADLINE_MINUTES);
        console.log(`🧪 TESTING MODE: Using ${minutes} minutes for payment deadline (instead of ${defaultValue} hours)`);
        return minutes / 60; // Convert minutes to hours
      }
      
      if (parameter === 'grace_extension_duration' && process.env.TESTING_EXTENSION_MINUTES) {
        const minutes = parseInt(process.env.TESTING_EXTENSION_MINUTES);
        console.log(`🧪 TESTING MODE: Using ${minutes} minutes for grace extension (instead of ${defaultValue} hours)`);
        return minutes / 60; // Convert minutes to hours
      }
    }
    
    // Get from database config
    const [config] = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.parameter, parameter))
      .limit(1);

    if (config && config.value) {
      return parseFloat(config.value);
    }

    return defaultValue;
  } catch (error) {
    console.warn(`⚠️ Failed to fetch config ${parameter}, using default ${defaultValue}:`, error);
    return defaultValue;
  }
}

/**
 * Generate documents with validity deadline (Requirement 6.3)
 * Wraps existing generateDocument with deposit-specific deadline logic
 */
export async function generateDocumentsWithDeadline(
  auctionId: string,
  winnerId: string,
  generatedBy: string
): Promise<{ success: boolean; validityDeadline: Date; documents?: ReleaseForm[]; error?: string }> {
  try {
    // Get document validity period from config (default 48 hours)
    const validityHours = await getConfigValue('document_validity_period', 48);
    
    // Calculate validity deadline
    const validityDeadline = new Date();
    validityDeadline.setHours(validityDeadline.getHours() + validityHours);

    // Generate both required documents using existing service
    const billOfSale = await generateDocument(
      auctionId,
      winnerId,
      'bill_of_sale',
      generatedBy
    );

    const liabilityWaiver = await generateDocument(
      auctionId,
      winnerId,
      'liability_waiver',
      generatedBy
    );

    // Update generated documents with validity deadline
    await db
      .update(releaseForms)
      .set({
        validityDeadline,
        originalDeadline: validityDeadline,
        extensionCount: 0
      })
      .where(
        and(
          eq(releaseForms.auctionId, auctionId),
          eq(releaseForms.vendorId, winnerId)
        )
      );

    console.log(`✅ Documents generated with validity deadline: ${validityDeadline.toISOString()}`);

    return {
      success: true,
      validityDeadline,
      documents: [billOfSale, liabilityWaiver]
    };
  } catch (error) {
    console.error('❌ Error generating documents with deadline:', error);
    return {
      success: false,
      validityDeadline: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check if documents have expired (Requirement 9.1)
 * Used by fallback chain to determine if next bidder should be promoted
 */
export async function areDocumentsExpired(
  auctionId: string,
  vendorId: string
): Promise<{ expired: boolean; deadline?: Date; remainingHours?: number }> {
  try {
    const documents = await db
      .select()
      .from(releaseForms)
      .where(
        and(
          eq(releaseForms.auctionId, auctionId),
          eq(releaseForms.vendorId, vendorId)
        )
      );

    if (documents.length === 0) {
      return { expired: false };
    }

    // Check if any document has a validity deadline
    const docWithDeadline = documents.find(doc => doc.validityDeadline);

    if (!docWithDeadline || !docWithDeadline.validityDeadline) {
      // Legacy documents without deadline - not expired
      return { expired: false };
    }

    const now = new Date();
    const deadline = new Date(docWithDeadline.validityDeadline);
    const expired = now > deadline;

    const remainingMs = deadline.getTime() - now.getTime();
    const remainingHours = Math.max(0, remainingMs / (1000 * 60 * 60));

    return {
      expired,
      deadline,
      remainingHours
    };
  } catch (error) {
    console.error('❌ Error checking document expiry:', error);
    return { expired: false };
  }
}

/**
 * Calculate remaining payment after deposit (Requirement 8.4)
 * remaining_amount = final_bid - deposit_amount
 */
export function calculateRemainingPayment(
  finalBid: number,
  depositAmount: number
): number {
  const remaining = finalBid - depositAmount;
  
  if (remaining < 0) {
    console.warn(`⚠️ Negative remaining payment: finalBid=${finalBid}, deposit=${depositAmount}`);
    return 0;
  }

  return remaining;
}

/**
 * Set payment deadline after document signing (Requirement 8.5)
 * payment_deadline = current_time + payment_deadline_after_signing
 */
export async function setPaymentDeadline(
  auctionId: string,
  vendorId: string
): Promise<{ success: boolean; paymentDeadline?: Date; error?: string }> {
  try {
    // Get payment deadline period from config (default 72 hours)
    const deadlineHours = await getConfigValue('payment_deadline_after_signing', 72);
    
    // Calculate payment deadline
    const paymentDeadline = new Date();
    paymentDeadline.setHours(paymentDeadline.getHours() + deadlineHours);

    // Update documents with payment deadline
    await db
      .update(releaseForms)
      .set({ paymentDeadline })
      .where(
        and(
          eq(releaseForms.auctionId, auctionId),
          eq(releaseForms.vendorId, vendorId)
        )
      );

    console.log(`✅ Payment deadline set: ${paymentDeadline.toISOString()}`);

    return {
      success: true,
      paymentDeadline
    };
  } catch (error) {
    console.error('❌ Error setting payment deadline:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Regenerate documents with fresh validity period (Requirement 9.6)
 * Used when fallback chain promotes next bidder
 */
export async function regenerateDocumentsForFallback(
  auctionId: string,
  newWinnerId: string,
  generatedBy: string,
  previousWinnerId?: string
): Promise<{ success: boolean; validityDeadline?: Date; error?: string }> {
  try {
    // Mark previous winner's documents as expired if they exist
    if (previousWinnerId) {
      await db
        .update(releaseForms)
        .set({ status: 'expired' })
        .where(
          and(
            eq(releaseForms.auctionId, auctionId),
            eq(releaseForms.vendorId, previousWinnerId)
          )
        );

      console.log(`✅ Marked previous winner's documents as expired: ${previousWinnerId}`);
    }

    // Generate new documents with fresh deadline for new winner
    const result = await generateDocumentsWithDeadline(auctionId, newWinnerId, generatedBy);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to regenerate documents'
      };
    }

    console.log(`✅ Regenerated documents for fallback winner: ${newWinnerId}`);

    return {
      success: true,
      validityDeadline: result.validityDeadline
    };
  } catch (error) {
    console.error('❌ Error regenerating documents for fallback:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get document status for an auction winner
 * Useful for UI display and status checks
 */
export async function getDocumentStatus(
  auctionId: string,
  vendorId: string
): Promise<{
  exists: boolean;
  signed: boolean;
  expired: boolean;
  validityDeadline?: Date;
  paymentDeadline?: Date;
  remainingHours?: number;
}> {
  try {
    const documents = await db
      .select()
      .from(releaseForms)
      .where(
        and(
          eq(releaseForms.auctionId, auctionId),
          eq(releaseForms.vendorId, vendorId)
        )
      );

    if (documents.length === 0) {
      return {
        exists: false,
        signed: false,
        expired: false
      };
    }

    // Check if all documents are signed
    const allSigned = documents.every(doc => doc.signedAt !== null);

    // Check expiry status
    const expiryCheck = await areDocumentsExpired(auctionId, vendorId);

    // Get deadlines from first document (all should have same deadlines)
    const firstDoc = documents[0];

    return {
      exists: true,
      signed: allSigned,
      expired: expiryCheck.expired,
      validityDeadline: firstDoc.validityDeadline || undefined,
      paymentDeadline: firstDoc.paymentDeadline || undefined,
      remainingHours: expiryCheck.remainingHours
    };
  } catch (error) {
    console.error('❌ Error getting document status:', error);
    return {
      exists: false,
      signed: false,
      expired: false
    };
  }
}

/**
 * Extend document validity deadline (for grace period extensions)
 * Used by grace extension service
 */
export async function extendDocumentDeadline(
  auctionId: string,
  vendorId: string,
  extensionHours: number
): Promise<{ success: boolean; newDeadline?: Date; error?: string }> {
  try {
    const documents = await db
      .select()
      .from(releaseForms)
      .where(
        and(
          eq(releaseForms.auctionId, auctionId),
          eq(releaseForms.vendorId, vendorId)
        )
      );

    if (documents.length === 0) {
      return {
        success: false,
        error: 'No documents found'
      };
    }

    const firstDoc = documents[0];
    const currentDeadline = firstDoc.validityDeadline 
      ? new Date(firstDoc.validityDeadline)
      : new Date();

    // Calculate new deadline
    const newDeadline = new Date(currentDeadline);
    newDeadline.setHours(newDeadline.getHours() + extensionHours);

    // Update all documents
    await db
      .update(releaseForms)
      .set({
        validityDeadline: newDeadline,
        extensionCount: (firstDoc.extensionCount || 0) + 1
      })
      .where(
        and(
          eq(releaseForms.auctionId, auctionId),
          eq(releaseForms.vendorId, vendorId)
        )
      );

    console.log(`✅ Extended document deadline by ${extensionHours} hours. New deadline: ${newDeadline.toISOString()}`);

    return {
      success: true,
      newDeadline
    };
  } catch (error) {
    console.error('❌ Error extending document deadline:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
