/**
 * Missing Documents Checker Cron Job
 * 
 * Runs every 5 minutes to check for closed auctions with missing documents
 * and automatically regenerates them.
 * 
 * Purpose:
 * - Detect closed auctions missing Bill of Sale or Liability Waiver
 * - Auto-regenerate missing documents
 * - Log all actions for audit trail
 * - Handle errors gracefully without crashing
 * 
 * Schedule: Every 5 minutes (* /5 * * * *)
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';
import { generateDocument } from '@/features/documents/services/document.service';
import { logAction, AuditActionType, AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';

interface MissingDocumentResult {
  auctionId: string;
  winnerId: string;
  missingDocuments: string[];
  regenerated: string[];
  failed: string[];
}

/**
 * Check all closed auctions for missing documents and regenerate them
 */
export async function checkMissingDocuments(): Promise<{
  checked: number;
  fixed: number;
  failed: number;
  results: MissingDocumentResult[];
}> {
  console.log('🔍 Starting missing documents check...');
  
  const startTime = Date.now();
  const results: MissingDocumentResult[] = [];
  let totalFixed = 0;
  let totalFailed = 0;

  try {
    // Get all closed auctions
    const closedAuctions = await db
      .select()
      .from(auctions)
      .where(eq(auctions.status, 'closed'));

    console.log(`📋 Found ${closedAuctions.length} closed auction(s) to check`);

    if (closedAuctions.length === 0) {
      console.log('✅ No closed auctions found. Nothing to check.');
      return { checked: 0, fixed: 0, failed: 0, results: [] };
    }

    // Check each auction for missing documents
    for (const auction of closedAuctions) {
      // Skip auctions without a winner
      if (!auction.currentBidder) {
        continue;
      }

      try {
        // Get vendor details for audit logging
        const [vendor] = await db
          .select()
          .from(vendors)
          .where(eq(vendors.id, auction.currentBidder))
          .limit(1);

        const userId = vendor?.userId || 'system';

        // Get existing documents for this auction
        const documents = await db
          .select()
          .from(releaseForms)
          .where(eq(releaseForms.auctionId, auction.id));

        const existingTypes = documents.map(d => d.documentType);
        const hasBillOfSale = existingTypes.includes('bill_of_sale');
        const hasLiabilityWaiver = existingTypes.includes('liability_waiver');

        // Check if any documents are missing
        const missingTypes: Array<'bill_of_sale' | 'liability_waiver'> = [];
        if (!hasBillOfSale) missingTypes.push('bill_of_sale');
        if (!hasLiabilityWaiver) missingTypes.push('liability_waiver');

        // If documents are missing, regenerate them
        if (missingTypes.length > 0) {
          console.log(`⚠️  Auction ${auction.id} missing documents: ${missingTypes.join(', ')}`);
          
          const regenerated: string[] = [];
          const failed: string[] = [];

          for (const docType of missingTypes) {
            try {
              console.log(`   🔄 Regenerating ${docType}...`);
              
              const document = await generateDocument(
                auction.id,
                auction.currentBidder,
                docType,
                'system'
              );

              regenerated.push(docType);
              totalFixed++;
              console.log(`   ✅ ${docType} regenerated successfully`);

              // Log successful regeneration to audit trail
              await logAction({
                userId,
                actionType: AuditActionType.DOCUMENT_GENERATED,
                entityType: AuditEntityType.AUCTION,
                entityId: auction.id,
                ipAddress: '0.0.0.0',
                deviceType: DeviceType.DESKTOP,
                userAgent: 'cron-job-missing-documents',
                afterState: {
                  documentType: docType,
                  documentId: document.id,
                  vendorId: auction.currentBidder,
                  timestamp: new Date().toISOString(),
                  context: 'missing_documents_cron_regeneration',
                  success: true,
                },
              });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              const stackTrace = error instanceof Error ? error.stack : undefined;
              
              failed.push(docType);
              totalFailed++;
              console.error(`   ❌ Failed to regenerate ${docType}:`, errorMessage);
              if (stackTrace) {
                console.error(`   - Stack trace:`, stackTrace);
              }

              // Log failure to audit trail
              await logAction({
                userId,
                actionType: AuditActionType.DOCUMENT_GENERATION_FAILED,
                entityType: AuditEntityType.AUCTION,
                entityId: auction.id,
                ipAddress: '0.0.0.0',
                deviceType: DeviceType.DESKTOP,
                userAgent: 'cron-job-missing-documents',
                afterState: {
                  error: errorMessage,
                  stackTrace,
                  documentType: docType,
                  vendorId: auction.currentBidder,
                  timestamp: new Date().toISOString(),
                  context: 'missing_documents_cron_regeneration',
                },
              });
            }
          }

          results.push({
            auctionId: auction.id,
            winnerId: auction.currentBidder,
            missingDocuments: missingTypes,
            regenerated,
            failed,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Error processing auction ${auction.id}:`, errorMessage);
        // Continue with next auction
      }
    }

    const duration = Date.now() - startTime;
    console.log('');
    console.log('📊 Missing Documents Check Summary');
    console.log('-'.repeat(60));
    console.log(`Total auctions checked: ${closedAuctions.length}`);
    console.log(`Auctions with missing documents: ${results.length}`);
    console.log(`Documents regenerated: ${totalFixed}`);
    console.log(`Documents failed: ${totalFailed}`);
    console.log(`Duration: ${duration}ms`);
    console.log('');

    if (totalFailed === 0 && totalFixed > 0) {
      console.log('✅ All missing documents regenerated successfully!');
    } else if (totalFailed > 0) {
      console.log('⚠️  Some documents failed to regenerate. Check logs above.');
    } else {
      console.log('✅ No missing documents found.');
    }

    return {
      checked: closedAuctions.length,
      fixed: totalFixed,
      failed: totalFailed,
      results,
    };
  } catch (error) {
    console.error('❌ Error in missing documents checker:', error);
    throw error;
  }
}
