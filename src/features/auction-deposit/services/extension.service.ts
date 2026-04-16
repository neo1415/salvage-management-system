/**
 * Grace Period Extension Service
 * 
 * Handles grace period extensions for document signing deadlines.
 * Finance Officers can grant extensions (max 2, default 24 hours each) to vendors
 * who need more time to sign documents.
 * 
 * Requirements: 7.1-7.7
 */

import { db } from '@/lib/db/drizzle';
import { graceExtensions, systemConfig } from '@/lib/db/schema/auction-deposit';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { auctions } from '@/lib/db/schema/auctions';
import { eq, and, desc } from 'drizzle-orm';
import { extendDocumentDeadline } from './document-integration.service';

/**
 * Get configuration value from system_config table with testing mode support
 */
async function getConfigValue(parameter: string, defaultValue: number): Promise<number> {
  try {
    // Check testing mode first
    const testingMode = process.env.TESTING_MODE === 'true';
    
    if (testingMode) {
      // Override with testing mode values (in minutes, convert to hours)
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
 * Grant grace period extension for document signing (Requirement 7)
 * 
 * @param auctionId - Auction ID
 * @param vendorId - Vendor ID (winner)
 * @param grantedBy - User ID of Finance Officer granting extension
 * @param reason - Reason for extension
 * @returns Success status, new deadline, or error
 */
export async function grantExtension(
  auctionId: string,
  vendorId: string,
  grantedBy: string,
  reason: string
): Promise<{ 
  success: boolean; 
  newDeadline?: Date; 
  extensionCount?: number;
  error?: string 
}> {
  try {
    // 1. Get max extensions allowed from config (Requirement 7.2)
    const maxExtensions = await getConfigValue('max_grace_extensions', 2);
    
    // 2. Get extension duration from config (Requirement 7.3)
    const extensionHours = await getConfigValue('grace_extension_duration', 24);

    // 3. Get current document status
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
        error: 'No documents found for this auction winner'
      };
    }

    const firstDoc = documents[0];
    const currentExtensionCount = firstDoc.extensionCount || 0;

    // 4. Verify extensionCount < max_grace_extensions (Requirement 7.2)
    if (currentExtensionCount >= maxExtensions) {
      return {
        success: false,
        extensionCount: currentExtensionCount,
        error: `Maximum extensions reached (${maxExtensions})`
      };
    }

    // 5. Extend document deadline (Requirement 7.3)
    const extendResult = await extendDocumentDeadline(
      auctionId,
      vendorId,
      extensionHours
    );

    if (!extendResult.success) {
      return {
        success: false,
        error: extendResult.error || 'Failed to extend deadline'
      };
    }

    // 6. Record extension in grace_extensions table (Requirement 7.5)
    const [extension] = await db
      .insert(graceExtensions)
      .values({
        auctionId,
        grantedBy,
        extensionType: 'document_signing',
        durationHours: extensionHours,
        reason,
        oldDeadline: firstDoc.validityDeadline || new Date(),
        newDeadline: extendResult.newDeadline!,
        createdAt: new Date()
      })
      .returning();

    console.log(`✅ Grace extension granted: ${extensionHours} hours for auction ${auctionId}`);
    console.log(`   - Extension count: ${currentExtensionCount} → ${currentExtensionCount + 1}`);
    console.log(`   - New deadline: ${extendResult.newDeadline?.toISOString()}`);
    console.log(`   - Granted by: ${grantedBy}`);
    console.log(`   - Reason: ${reason}`);

    return {
      success: true,
      newDeadline: extendResult.newDeadline,
      extensionCount: currentExtensionCount + 1
    };
  } catch (error) {
    console.error('❌ Error granting extension:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get extension history for an auction
 * 
 * @param auctionId - Auction ID
 * @returns List of extensions granted
 */
export async function getExtensionHistory(
  auctionId: string
): Promise<Array<{
  id: string;
  grantedBy: string;
  reason: string;
  extensionHours: number;
  previousDeadline: Date;
  newDeadline: Date;
  createdAt: Date;
}>> {
  try {
    const extensions = await db
      .select()
      .from(graceExtensions)
      .where(eq(graceExtensions.auctionId, auctionId))
      .orderBy(desc(graceExtensions.createdAt));

    return extensions.map(ext => ({
      id: ext.id,
      grantedBy: ext.grantedBy,
      reason: ext.reason || '',
      extensionHours: ext.durationHours,
      previousDeadline: ext.oldDeadline,
      newDeadline: ext.newDeadline,
      createdAt: ext.createdAt
    }));
  } catch (error) {
    console.error('❌ Error fetching extension history:', error);
    return [];
  }
}

/**
 * Check if extension can be granted
 * 
 * @param auctionId - Auction ID
 * @param vendorId - Vendor ID
 * @returns Whether extension can be granted and current count
 */
export async function canGrantExtension(
  auctionId: string,
  vendorId: string
): Promise<{ 
  canGrant: boolean; 
  currentCount: number; 
  maxAllowed: number;
  reason?: string;
}> {
  try {
    // Get max extensions allowed
    const maxExtensions = await getConfigValue('max_grace_extensions', 2);

    // Get current extension count from documents
    const documents = await db
      .select()
      .from(releaseForms)
      .where(
        and(
          eq(releaseForms.auctionId, auctionId),
          eq(releaseForms.vendorId, vendorId)
        )
      )
      .limit(1);

    if (documents.length === 0) {
      return {
        canGrant: false,
        currentCount: 0,
        maxAllowed: maxExtensions,
        reason: 'No documents found'
      };
    }

    const currentCount = documents[0].extensionCount || 0;
    const canGrant = currentCount < maxExtensions;

    return {
      canGrant,
      currentCount,
      maxAllowed: maxExtensions,
      reason: canGrant ? undefined : 'Maximum extensions reached'
    };
  } catch (error) {
    console.error('❌ Error checking extension eligibility:', error);
    return {
      canGrant: false,
      currentCount: 0,
      maxAllowed: 2,
      reason: 'Error checking eligibility'
    };
  }
}
