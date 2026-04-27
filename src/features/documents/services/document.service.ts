/**
 * Document Service
 * 
 * Business logic for document generation, signing, and management.
 * Handles bill of sale, liability waivers, pickup authorizations, and salvage certificates.
 */

import { db, withRetry } from '@/lib/db/drizzle';
import { releaseForms, documentDownloads, type DocumentType, type ReleaseForm } from '@/lib/db/schema/release-forms';
import { auctions } from '@/lib/db/schema/auctions';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq, and, desc } from 'drizzle-orm';
import { uploadFile, CLOUDINARY_FOLDERS } from '@/lib/storage/cloudinary';
import {
  generateBillOfSalePDF,
  generateLiabilityWaiverPDF,
  generatePickupAuthorizationPDF,
  generateSalvageCertificatePDF,
  type BillOfSaleData,
  type LiabilityWaiverData,
  type PickupAuthorizationData,
  type SalvageCertificateData,
} from './pdf-generation.service';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Generate a document and store in database
 */
export async function generateDocument(
  auctionId: string,
  vendorId: string,
  documentType: DocumentType,
  generatedBy: string
): Promise<ReleaseForm> {
  try {
    // Check if document already exists for this auction/vendor/documentType (with retry)
    const [existingDocument] = await withRetry(async () => {
      return await db
        .select()
        .from(releaseForms)
        .where(
          and(
            eq(releaseForms.auctionId, auctionId),
            eq(releaseForms.vendorId, vendorId),
            eq(releaseForms.documentType, documentType)
          )
        )
        .limit(1);
    });

    // If document exists and is pending or signed, return it (don't create duplicate)
    if (existingDocument && (existingDocument.status === 'pending' || existingDocument.status === 'signed')) {
      console.log(`✅ Document already exists: ${documentType} for auction ${auctionId} (status: ${existingDocument.status})`);
      console.log(`   - Document ID: ${existingDocument.id}`);
      console.log(`   - Returning existing document instead of creating duplicate`);
      return existingDocument;
    }

    // Fetch auction, vendor, and case data (with retry)
    const [auctionData] = await withRetry(async () => {
      return await db
        .select({
          auction: auctions,
          case: salvageCases,
          vendor: vendors,
          vendorUser: users,
        })
        .from(auctions)
        .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
        .innerJoin(vendors, eq(vendors.id, vendorId))
        .innerJoin(users, eq(vendors.userId, users.id))
        .where(eq(auctions.id, auctionId))
        .limit(1);
    });

    if (!auctionData) {
      throw new Error('Auction not found');
    }

    const { auction, case: caseData, vendor, vendorUser } = auctionData;

    // Generate verification URL
    const verificationUrl = `${APP_URL}/verify-document/${auctionId}`;

    // Extract asset details from JSONB
    const assetDetails = caseData.assetDetails as {
      make?: string;
      model?: string;
      year?: number;
      vin?: string;
      propertyType?: string;
      address?: string;
      brand?: string;
      serialNumber?: string;
    };

    // Prepare document data based on type
    let pdfBuffer: Buffer;
    let title: string;
    const assetDescription = `${assetDetails.make || ''} ${assetDetails.model || ''} ${assetDetails.year || ''}`.trim() || caseData.assetType;
    
    // Base document data that matches the schema
    const baseDocumentData = {
      buyerName: vendorUser.fullName,
      buyerEmail: vendorUser.email,
      buyerPhone: vendorUser.phone,
      buyerBvn: vendor.bvnEncrypted ? '****' : undefined,
      sellerName: 'NEM Insurance Plc',
      sellerAddress: '199 Ikorodu Road, Obanikoro, Lagos, Nigeria',
      sellerContact: '234-02-014489560',
      assetType: caseData.assetType,
      assetDescription,
      assetCondition: caseData.vehicleCondition || 'salvage',
      vin: assetDetails.vin,
      make: assetDetails.make,
      model: assetDetails.model,
      year: assetDetails.year,
      salePrice: Number(auction.currentBid || 0),
      paymentMethod: 'To be determined',
      paymentReference: undefined,
      transactionDate: new Date().toLocaleDateString('en-NG'),
      pickupLocation: caseData.locationName || 'NEM Insurance Salvage Yard',
      pickupDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toLocaleDateString('en-NG'),
      pickupAuthCode: undefined as string | undefined,
      qrCodeData: undefined as string | undefined,
      verificationUrl,
    };

    switch (documentType) {
      case 'bill_of_sale':
        title = 'Bill of Sale';
        const billOfSaleData: BillOfSaleData = {
          transactionId: auctionId,
          transactionDate: new Date().toLocaleDateString('en-NG'),
          buyerName: vendorUser.fullName,
          buyerEmail: vendorUser.email,
          buyerPhone: vendorUser.phone,
          buyerBvn: vendor.bvnEncrypted ? '****' : undefined,
          sellerName: 'NEM Insurance Plc',
          sellerAddress: '199 Ikorodu Road, Obanikoro, Lagos, Nigeria',
          sellerContact: '234-02-014489560',
          assetType: caseData.assetType,
          assetDescription,
          assetCondition: caseData.vehicleCondition || 'salvage',
          vin: assetDetails.vin,
          make: assetDetails.make,
          model: assetDetails.model,
          year: assetDetails.year,
          salePrice: Number(auction.currentBid || 0),
          paymentMethod: 'To be determined',
          pickupLocation: caseData.locationName || 'NEM Insurance Salvage Yard',
          pickupDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toLocaleDateString('en-NG'),
          verificationUrl,
        };
        pdfBuffer = await generateBillOfSalePDF(billOfSaleData);
        break;

      case 'liability_waiver':
        title = 'Release & Waiver of Liability';
        const waiverData: LiabilityWaiverData = {
          vendorName: vendorUser.fullName,
          vendorEmail: vendorUser.email,
          vendorPhone: vendorUser.phone,
          vendorBvn: vendor.bvnEncrypted ? '****' : undefined,
          assetDescription,
          assetCondition: caseData.vehicleCondition || 'salvage',
          auctionId,
          transactionDate: new Date().toLocaleDateString('en-NG'),
          verificationUrl,
        };
        pdfBuffer = await generateLiabilityWaiverPDF(waiverData);
        break;

      case 'pickup_authorization':
        title = 'Pickup Authorization';
        const authCode = `AUTH-${auctionId.substring(0, 8).toUpperCase()}`;
        const pickupAuthData: PickupAuthorizationData = {
          authorizationCode: authCode,
          auctionId,
          vendorName: vendorUser.fullName,
          vendorPhone: vendorUser.phone,
          assetDescription,
          pickupLocation: caseData.locationName || 'NEM Insurance Salvage Yard',
          pickupDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toLocaleDateString('en-NG'),
          pickupContact: '234-02-014489560',
          paymentAmount: Number(auction.currentBid || 0),
          paymentReference: 'To be updated',
          paymentDate: new Date().toLocaleDateString('en-NG'),
          verificationUrl,
        };
        pdfBuffer = await generatePickupAuthorizationPDF(pickupAuthData);
        baseDocumentData.pickupAuthCode = authCode;
        break;

      case 'salvage_certificate':
        title = 'Salvage Certificate';
        if (!assetDetails.vin) {
          throw new Error('Salvage certificate requires VIN');
        }
        // Construct damage description from AI assessment
        const aiLabels = (caseData.aiAssessment as { labels?: string[] })?.labels || [];
        const damageDescription = aiLabels.length > 0 
          ? `Damage detected: ${aiLabels.join(', ')}` 
          : 'Salvage vehicle with undisclosed damage';
        
        const salvageCertData: SalvageCertificateData = {
          vin: assetDetails.vin,
          make: assetDetails.make || 'Unknown',
          model: assetDetails.model || 'Unknown',
          year: assetDetails.year || new Date().getFullYear(),
          damageAssessment: damageDescription,
          totalLossDeclaration: true,
          claimReference: caseData.claimReference || 'N/A',
          insuranceCompany: 'NEM Insurance Plc',
          saleDate: new Date().toLocaleDateString('en-NG'),
          buyerName: vendorUser.fullName,
          verificationUrl,
        };
        pdfBuffer = await generateSalvageCertificatePDF(salvageCertData);
        break;

      default:
        throw new Error(`Unsupported document type: ${documentType}`);
    }

    // Upload PDF to Cloudinary
    const folder = `${CLOUDINARY_FOLDERS.SALVAGE_CASES}/${auctionId}/documents`;
    const uploadResult = await uploadFile(pdfBuffer, {
      folder,
      publicId: `${documentType}_${Date.now()}`,
      resourceType: 'raw',
      compress: false,
    });

    // Store document in database (with retry and conflict handling)
    let document: ReleaseForm;
    try {
      [document] = await withRetry(async () => {
        return await db
          .insert(releaseForms)
          .values({
            auctionId,
            vendorId,
            documentType,
            title,
            status: 'pending',
            pdfUrl: uploadResult.secureUrl,
            pdfPublicId: uploadResult.publicId,
            documentData: baseDocumentData,
            generatedBy: generatedBy === 'system' ? null : generatedBy, // Fix: Use null for system-generated documents
          })
          .returning();
      });
    } catch (insertError: any) {
      // Handle unique constraint violation (duplicate document)
      if (insertError.code === '23505' || insertError.message?.includes('duplicate key') || insertError.message?.includes('unique constraint')) {
        console.log(`⚠️  Duplicate document detected during insert: ${documentType} for auction ${auctionId}`);
        console.log(`   - This is expected during race conditions (offline/online, multiple closure requests)`);
        console.log(`   - Fetching existing document instead...`);
        
        // Fetch the existing document
        const [existingDoc] = await withRetry(async () => {
          return await db
            .select()
            .from(releaseForms)
            .where(
              and(
                eq(releaseForms.auctionId, auctionId),
                eq(releaseForms.vendorId, vendorId),
                eq(releaseForms.documentType, documentType)
              )
            )
            .limit(1);
        });
        
        if (!existingDoc) {
          throw new Error('Document insert failed and existing document not found');
        }
        
        console.log(`✅ Using existing document: ${existingDoc.id} (status: ${existingDoc.status})`);
        return existingDoc;
      }
      
      // Re-throw other errors
      throw insertError;
    }

    console.log(`✅ Document generated: ${documentType} for auction ${auctionId}`);
    console.log(`   - Document ID: ${document.id}`);
    console.log(`   - Vendor ID: ${vendorId}`);
    console.log(`   - Status: ${document.status}`);
    console.log(`   - PDF URL: ${uploadResult.secureUrl}`);

    return document;
  } catch (error) {
    console.error('Error generating document:', error);
    throw new Error(`Failed to generate document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Sign a document with digital signature
 */
export async function signDocument(
  documentId: string,
  vendorId: string,
  signatureData: string,
  ipAddress: string,
  deviceType: string,
  userAgent: string
): Promise<ReleaseForm> {
  try {
    // Verify document exists and belongs to vendor (with retry)
    const [existingDoc] = await withRetry(async () => {
      return await db
        .select()
        .from(releaseForms)
        .where(
          and(
            eq(releaseForms.id, documentId),
            eq(releaseForms.vendorId, vendorId)
          )
        )
        .limit(1);
    });

    if (!existingDoc) {
      throw new Error('Document not found or unauthorized');
    }

    if (existingDoc.status === 'signed') {
      throw new Error('Document already signed');
    }

    if (existingDoc.status === 'voided') {
      throw new Error('Document has been voided');
    }

    // NEW: Check if document is disabled due to forfeiture
    if (existingDoc.disabled) {
      throw new Error('Document signing is disabled. This auction has been forfeited. Please contact support if you wish to proceed.');
    }

    // NEW: Check if auction is forfeited
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, existingDoc.auctionId))
      .limit(1);

    if (auction && auction.status === 'forfeited') {
      throw new Error('Cannot sign documents for a forfeited auction. Please contact support for assistance.');
    }

    // If this is a liability waiver, regenerate the PDF with the signature
    let updatedPdfUrl = existingDoc.pdfUrl;
    let updatedPdfPublicId = existingDoc.pdfPublicId;
    
    if (existingDoc.documentType === 'liability_waiver') {
      try {
        // Fetch auction and vendor data to regenerate PDF
        const [auctionData] = await db
          .select({
            auction: auctions,
            case: salvageCases,
            vendor: vendors,
            vendorUser: users,
          })
          .from(auctions)
          .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
          .innerJoin(vendors, eq(vendors.id, vendorId))
          .innerJoin(users, eq(vendors.userId, users.id))
          .where(eq(auctions.id, existingDoc.auctionId))
          .limit(1);

        if (auctionData) {
          const { auction, case: caseData, vendor, vendorUser } = auctionData;
          const assetDetails = caseData.assetDetails as {
            make?: string;
            model?: string;
            year?: number;
          };
          const assetDescription = `${assetDetails.make || ''} ${assetDetails.model || ''} ${assetDetails.year || ''}`.trim() || caseData.assetType;
          
          // Regenerate waiver PDF with signature
          const waiverData: LiabilityWaiverData = {
            vendorName: vendorUser.fullName,
            vendorEmail: vendorUser.email,
            vendorPhone: vendorUser.phone,
            vendorBvn: vendor.bvnEncrypted ? '****' : undefined,
            assetDescription,
            assetCondition: caseData.vehicleCondition || 'salvage',
            auctionId: existingDoc.auctionId,
            transactionDate: new Date().toLocaleDateString('en-NG'),
            signatureData, // Include the signature
            signedDate: new Date().toLocaleDateString('en-NG'),
            verificationUrl: `${APP_URL}/verify-document/${existingDoc.auctionId}`,
          };
          
          const pdfBuffer = await generateLiabilityWaiverPDF(waiverData);
          
          // Upload new PDF with signature
          const folder = `${CLOUDINARY_FOLDERS.SALVAGE_CASES}/${existingDoc.auctionId}/documents`;
          const uploadResult = await uploadFile(pdfBuffer, {
            folder,
            publicId: `liability_waiver_signed_${Date.now()}`,
            resourceType: 'raw',
            compress: false,
          });
          
          updatedPdfUrl = uploadResult.secureUrl;
          updatedPdfPublicId = uploadResult.publicId;
          
          console.log(`✅ Regenerated waiver PDF with signature: ${documentId}`);
        }
      } catch (error) {
        console.error('Error regenerating PDF with signature:', error);
        // Continue with original PDF if regeneration fails
      }
    }

    // Update document with signature (with retry)
    const [signedDoc] = await withRetry(async () => {
      return await db
        .update(releaseForms)
        .set({
          digitalSignature: signatureData,
          signedAt: new Date(),
          signatureIpAddress: ipAddress,
          signatureDeviceType: deviceType,
          signatureUserAgent: userAgent,
          status: 'signed',
          pdfUrl: updatedPdfUrl,
          pdfPublicId: updatedPdfPublicId,
          updatedAt: new Date(),
        })
        .where(eq(releaseForms.id, documentId))
        .returning();
    });

    console.log(`✅ Document signed: ${documentId} by vendor ${vendorId}`);

    // Ensure signedDoc was returned
    if (!signedDoc) {
      throw new Error('Failed to update document');
    }

    // NEW: Send document signing progress notifications
    try {
      const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
      if (vendor) {
        const [user] = await db.select().from(users).where(eq(users.id, vendor.userId)).limit(1);
        if (user) {
          await sendDocumentSigningProgressNotifications(
            signedDoc.auctionId,
            vendorId,
            user
          );
        }
      }
    } catch (error) {
      console.error('❌ Error sending document signing progress notifications:', error);
      // Don't fail the signing if notifications fail
    }

    // NEW: Check if all documents are signed and update auction status
    try {
      const allSigned = await checkAllDocumentsSigned(signedDoc.auctionId, vendorId);
      
      if (allSigned) {
        console.log(`\n🔄 ALL DOCUMENTS SIGNED for auction ${signedDoc.auctionId}`);
        
        // CRITICAL FIX: Only update status if auction is currently 'closed'
        // Never change status if it's already 'awaiting_payment' or any other status
        const [currentAuction] = await db
          .select()
          .from(auctions)
          .where(eq(auctions.id, signedDoc.auctionId))
          .limit(1);

        if (!currentAuction) {
          throw new Error(`Auction ${signedDoc.auctionId} not found`);
        }

        // Only proceed if auction is in 'closed' status
        if (currentAuction.status === 'closed') {
          console.log(`   Updating status: closed → awaiting_payment`);
          
          // Update auction status to awaiting_payment (vendor must choose payment method)
          const [updatedAuction] = await db
            .update(auctions)
            .set({ 
              status: 'awaiting_payment',
              updatedAt: new Date()
            })
            .where(
              and(
                eq(auctions.id, signedDoc.auctionId),
                eq(auctions.status, 'closed') // Double-check status hasn't changed
              )
            )
            .returning();

          if (!updatedAuction) {
            console.log(`⚠️  Auction status was not 'closed', skipping status update`);
            return signedDoc; // Return early, don't broadcast or notify
          }

          console.log(`✅ Auction status updated successfully: ${updatedAuction.status}`);

          // CRITICAL FIX: Invalidate auction details cache to prevent stale data
          try {
            const { cache } = await import('@/lib/redis/client');
            const cacheKey = `auction:details:${signedDoc.auctionId}`;
            await cache.del(cacheKey);
            console.log(`✅ Invalidated auction details cache: ${cacheKey}`);
          } catch (cacheError) {
            console.error(`❌ Failed to invalidate auction details cache:`, cacheError);
            // Don't throw - cache invalidation failure shouldn't block the process
          }

          // CRITICAL FIX: Broadcast status change via Socket.IO for real-time UI updates
          try {
            const { broadcastAuctionUpdate } = await import('@/lib/socket/server');
            await broadcastAuctionUpdate(signedDoc.auctionId, updatedAuction);
            console.log(`✅ Broadcasted status change for auction ${signedDoc.auctionId} via Socket.IO`);
          } catch (socketError) {
            console.error(`❌ Failed to broadcast status change via Socket.IO:`, socketError);
            // Don't throw - status update succeeded, Socket.IO is just for real-time updates
          }

          // Send notification to vendor to choose payment method
          const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
          if (vendor) {
            const [user] = await db.select().from(users).where(eq(users.id, vendor.userId)).limit(1);
            if (user) {
              const { createNotification } = await import('@/features/notifications/services/notification.service');
              await createNotification({
                userId: user.id,
                type: 'PAYMENT_METHOD_SELECTION_REQUIRED',
                title: 'Choose Payment Method',
                message: 'All documents signed! Please choose how you would like to pay.',
                data: {
                  auctionId: signedDoc.auctionId,
                },
              });

              console.log(`✅ Vendor notified to choose payment method for auction ${signedDoc.auctionId}\n`);
            }
          }
        } else {
          console.log(`ℹ️  Auction is in '${currentAuction.status}' status, not 'closed'. Skipping status update.`);
        }
      } else {
        console.log(`ℹ️  Not all documents signed yet for auction ${signedDoc.auctionId}`);
      }
    } catch (error) {
      console.error('❌ CRITICAL ERROR updating auction status after document signing:', error);
      console.error('   Auction ID:', signedDoc.auctionId);
      console.error('   Vendor ID:', vendorId);
      console.error('   Error details:', error instanceof Error ? error.message : 'Unknown error');
      // Don't fail the signing if status update fails, but log prominently
    }

    return signedDoc;
  } catch (error) {
    console.error('Error signing document:', error);
    throw new Error(`Failed to sign document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all documents for an auction
 */
export async function getAuctionDocuments(
  auctionId: string,
  vendorId: string
): Promise<ReleaseForm[]> {
  try {
    const documents = await db
      .select()
      .from(releaseForms)
      .where(
        and(
          eq(releaseForms.auctionId, auctionId),
          eq(releaseForms.vendorId, vendorId)
        )
      )
      .orderBy(desc(releaseForms.createdAt));

    return documents;
  } catch (error) {
    console.error('Error fetching auction documents:', error);
    throw new Error('Failed to fetch auction documents');
  }
}

/**
 * Download document (with audit logging)
 */
export async function downloadDocument(
  documentId: string,
  vendorId: string,
  downloadMethod: string,
  ipAddress: string,
  deviceType: string,
  userAgent: string
): Promise<{ 
  pdfUrl: string; 
  title: string; 
  documentType: DocumentType;
  assetDescription: string;
  createdAt: Date;
}> {
  try {
    // Verify document exists and belongs to vendor
    const [document] = await db
      .select()
      .from(releaseForms)
      .where(
        and(
          eq(releaseForms.id, documentId),
          eq(releaseForms.vendorId, vendorId)
        )
      )
      .limit(1);

    if (!document) {
      throw new Error('Document not found or unauthorized');
    }

    if (!document.pdfUrl) {
      throw new Error('Document PDF not available');
    }

    // Log download
    await db.insert(documentDownloads).values({
      releaseFormId: documentId,
      vendorId,
      ipAddress,
      deviceType,
      userAgent,
      downloadMethod,
    });

    console.log(`✅ Document downloaded: ${documentId} by vendor ${vendorId}`);

    // Extract asset description from document data
    const documentData = document.documentData as { assetDescription?: string };
    const assetDescription = documentData?.assetDescription || 'Document';

    return {
      pdfUrl: document.pdfUrl,
      title: document.title,
      documentType: document.documentType,
      assetDescription,
      createdAt: document.createdAt,
    };
  } catch (error) {
    console.error('Error downloading document:', error);
    throw new Error(`Failed to download document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Void a document (admin only)
 */
export async function voidDocument(
  documentId: string,
  voidedBy: string,
  reason: string
): Promise<ReleaseForm> {
  try {
    const [voidedDoc] = await db
      .update(releaseForms)
      .set({
        status: 'voided',
        voidedAt: new Date(),
        voidedBy,
        voidedReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(releaseForms.id, documentId))
      .returning();

    if (!voidedDoc) {
      throw new Error('Document not found');
    }

    console.log(`✅ Document voided: ${documentId} by ${voidedBy}`);

    return voidedDoc;
  } catch (error) {
    console.error('Error voiding document:', error);
    throw new Error(`Failed to void document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if vendor has signed liability waiver for auction
 */
export async function hasSignedLiabilityWaiver(
  auctionId: string,
  vendorId: string
): Promise<boolean> {
  try {
    const [waiver] = await db
      .select()
      .from(releaseForms)
      .where(
        and(
          eq(releaseForms.auctionId, auctionId),
          eq(releaseForms.vendorId, vendorId),
          eq(releaseForms.documentType, 'liability_waiver'),
          eq(releaseForms.status, 'signed')
        )
      )
      .limit(1);

    return !!waiver;
  } catch (error) {
    console.error('Error checking liability waiver:', error);
    return false;
  }
}

/**
 * Check if all required documents are signed for an auction
 * Required documents: bill_of_sale, liability_waiver (2 documents)
 * 
 * SECURITY FIX: Removed pickup_authorization from required documents.
 * Pickup authorization is now generated and sent AFTER payment is complete,
 * preventing vendors from seeing the pickup code before payment.
 * 
 * FORFEITURE CHECK: Returns false if auction is forfeited or documents are disabled.
 */
export async function checkAllDocumentsSigned(
  auctionId: string,
  vendorId: string
): Promise<boolean> {
  try {
    // Check if auction is forfeited
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (auction && auction.status === 'forfeited') {
      console.log(`⏸️  Auction ${auctionId} is forfeited. Documents cannot be signed.`);
      return false;
    }

    const documents = await db
      .select()
      .from(releaseForms)
      .where(
        and(
          eq(releaseForms.auctionId, auctionId),
          eq(releaseForms.vendorId, vendorId)
        )
      );

    // Check if any documents are disabled
    const hasDisabledDocuments = documents.some(doc => doc.disabled);
    if (hasDisabledDocuments) {
      console.log(`⏸️  Some documents for auction ${auctionId} are disabled. Cannot proceed.`);
      return false;
    }

    const requiredTypes: DocumentType[] = ['bill_of_sale', 'liability_waiver'];
    const signedTypes = documents
      .filter(doc => doc.status === 'signed' && !doc.disabled)
      .map(doc => doc.documentType);

    const allSigned = requiredTypes.every(type => signedTypes.includes(type));

    console.log(`Document signing status for auction ${auctionId}:`, {
      requiredTypes,
      signedTypes,
      allSigned,
      auctionStatus: auction?.status,
      hasDisabledDocuments,
    });

    return allSigned;
  } catch (error) {
    console.error('Error checking all documents signed:', error);
    return false;
  }
}

/**
 * Get document signing progress for an auction
 * Returns progress information including count and percentage
 * 
 * SECURITY FIX: Only 2 documents required for signing (bill_of_sale, liability_waiver).
 * Pickup authorization is generated and sent AFTER payment is complete.
 */
export async function getDocumentProgress(
  auctionId: string,
  vendorId: string
): Promise<{
  totalDocuments: number;
  signedDocuments: number;
  progress: number;
  allSigned: boolean;
  documents: Array<{
    id: string;
    type: DocumentType;
    status: 'pending' | 'signed' | 'voided';
    signedAt: Date | null;
  }>;
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
      )
      .orderBy(releaseForms.createdAt);

    const totalDocuments = 2; // bill_of_sale, liability_waiver (pickup_authorization sent after payment)
    const signedDocuments = documents.filter(doc => doc.status === 'signed').length;
    const progress = Math.round((signedDocuments / totalDocuments) * 100);
    const allSigned = signedDocuments === totalDocuments;

    const documentList = documents.map(doc => ({
      id: doc.id,
      type: doc.documentType,
      status: doc.status as 'pending' | 'signed' | 'voided',
      signedAt: doc.signedAt,
    }));

    console.log(`Document progress for auction ${auctionId}:`, {
      totalDocuments,
      signedDocuments,
      progress,
      allSigned,
    });

    return {
      totalDocuments,
      signedDocuments,
      progress,
      allSigned,
      documents: documentList,
    };
  } catch (error) {
    console.error('Error getting document progress:', error);
    throw new Error(`Failed to get document progress: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Send document signing progress notifications
 * Sends push notification after first document signed (1/2)
 * Sends SMS and Email after all documents signed (2/2)
 * 
 * SECURITY FIX: Only 2 documents required (bill_of_sale, liability_waiver).
 * Pickup authorization sent AFTER payment complete.
 */
async function sendDocumentSigningProgressNotifications(
  auctionId: string,
  vendorId: string,
  user: { id: string; fullName: string; email: string; phone: string }
): Promise<void> {
  try {
    // Get document progress
    const progress = await getDocumentProgress(auctionId, vendorId);
    
    console.log(`📊 Document progress for auction ${auctionId}: ${progress.signedDocuments}/${progress.totalDocuments}`);

    // Log document signing progress
    const { logAction, AuditActionType, AuditEntityType, DeviceType } = await import('@/lib/utils/audit-logger');
    await logAction({
      userId: user.id,
      actionType: AuditActionType.DOCUMENT_SIGNING_PROGRESS,
      entityType: AuditEntityType.DOCUMENT,
      entityId: auctionId,
      ipAddress: 'system',
      deviceType: DeviceType.DESKTOP,
      userAgent: 'document-service',
      afterState: {
        auctionId,
        vendorId,
        signedDocuments: progress.signedDocuments,
        totalDocuments: progress.totalDocuments,
        progress: progress.progress,
        allSigned: progress.allSigned,
      },
    });

    // Send push notification for 1/2 progress
    if (progress.signedDocuments === 1) {
      const remaining = progress.totalDocuments - progress.signedDocuments;
      const { pushNotificationService } = await import('@/features/notifications/services/push.service');
      
      await pushNotificationService.sendPushNotification(
        null, // No subscription needed - will use fallback
        {
          userId: user.id,
          title: 'Document Signing Progress',
          body: `${progress.signedDocuments}/${progress.totalDocuments} documents signed. ${remaining} document remaining.`,
          icon: '/icons/Nem-insurance-Logo.jpg',
          badge: '/icons/Nem-insurance-Logo.jpg',
          tag: 'document-progress',
          data: {
            auctionId,
            signedDocuments: progress.signedDocuments,
            totalDocuments: progress.totalDocuments,
          },
        },
        {
          phone: user.phone,
          email: user.email,
          fullName: user.fullName,
        }
      );

      console.log(`✅ Push notification sent: ${progress.signedDocuments}/${progress.totalDocuments} documents signed`);
    }

    // Send SMS and Email after all documents signed (2/2)
    if (progress.allSigned) {
      const { smsService } = await import('@/features/notifications/services/sms.service');
      
      await smsService.sendSMS({
        to: user.phone,
        message: `All required documents signed! Payment is being processed. You will receive your pickup code shortly.`,
        userId: user.id,
      });

      console.log(`✅ SMS sent: All documents signed for auction ${auctionId}`);

      // Send email notification
      const { emailService } = await import('@/features/notifications/services/email.service');
      const { documentSignedTemplate } = await import('@/features/notifications/templates');
      
      // Fetch auction details for email
      const [auctionData] = await db
        .select({
          auction: auctions,
          case: salvageCases,
        })
        .from(auctions)
        .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
        .where(eq(auctions.id, auctionId))
        .limit(1);

      if (auctionData) {
        const { auction, case: caseData } = auctionData;
        const assetDetails = caseData.assetDetails as {
          make?: string;
          model?: string;
          year?: number;
        };
        const assetDescription = `${assetDetails.make || ''} ${assetDetails.model || ''} ${assetDetails.year || ''}`.trim() || caseData.assetType;
        
        const emailHtml = documentSignedTemplate({
          vendorName: user.fullName,
          documentTitle: 'All Required Documents',
          signedAt: new Date().toLocaleString('en-NG', {
            dateStyle: 'full',
            timeStyle: 'short',
          }),
          nextSteps: `All 2 required documents have been successfully signed! Your payment of ₦${parseFloat(auction.currentBid || '0').toLocaleString()} is now being processed. Once payment is verified, you will receive your pickup authorization code via SMS and email. You can then schedule a pickup time for your ${assetDescription}.`,
          downloadUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/vendor/documents/${auctionId}`,
        });

        await emailService.sendEmail({
          to: user.email,
          subject: 'All Documents Signed - Payment Processing',
          html: emailHtml,
        });

        console.log(`✅ Email sent: All documents signed for auction ${auctionId}`);
      }
    }
  } catch (error) {
    console.error('❌ Error sending document signing progress notifications:', error);
    // Don't throw - notifications are best-effort
  }
}

/**
 * Trigger automatic fund release when all documents are signed
 * This is the CORE automation that completes the payment flow
 */
export async function triggerFundReleaseOnDocumentCompletion(
  auctionId: string,
  vendorId: string,
  userId: string
): Promise<void> {
  let payment: any = null; // Declare outside try block so it's accessible in catch block
  
  try {
    console.log(`🔄 Checking if fund release should be triggered for auction ${auctionId}...`);

    // Step 1: Check if all documents are signed
    const allSigned = await checkAllDocumentsSigned(auctionId, vendorId);
    
    if (!allSigned) {
      console.log(`⏸️  Not all documents signed for auction ${auctionId}. Skipping fund release.`);
      return;
    }

    console.log(`✅ All documents signed for auction ${auctionId}. Proceeding with fund release...`);

    // Step 2: Get payment record (check for BOTH escrow_wallet AND paystack)
    const { payments } = await import('@/lib/db/schema/payments');
    
    // CRITICAL FIX: Check for verified payment of ANY type (escrow_wallet OR paystack)
    // The old code only checked for escrow_wallet, which broke Paystack payments
    [payment] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.auctionId, auctionId),
          eq(payments.vendorId, vendorId),
          eq(payments.status, 'verified') // Only process verified payments
        )
      )
      .limit(1);

    // RETROACTIVE FIX: If payment record doesn't exist, create it
    if (!payment) {
      console.warn(`⚠️  Payment record not found for auction ${auctionId}. Creating retroactively...`);
      
      // Get auction details to create payment record
      const [auction] = await db
        .select()
        .from(auctions)
        .where(eq(auctions.id, auctionId))
        .limit(1);

      if (!auction) {
        console.error(`❌ Auction not found: ${auctionId}`);
        throw new Error('Auction not found');
      }

      if (!auction.currentBid || !auction.currentBidder) {
        console.error(`❌ Auction has no winning bid: ${auctionId}`);
        throw new Error('Auction has no winning bid');
      }

      // Calculate payment deadline (24 hours from now)
      const paymentDeadline = new Date();
      paymentDeadline.setHours(paymentDeadline.getHours() + 24);

      // Generate unique payment reference
      const reference = `PAY_${auctionId.substring(0, 8)}_${Date.now()}`;

      // Create payment record with escrow_wallet method and frozen status
      const [newPayment] = await db
        .insert(payments)
        .values({
          auctionId,
          vendorId,
          amount: auction.currentBid.toString(),
          paymentMethod: 'escrow_wallet',
          escrowStatus: 'frozen',
          paymentReference: reference,
          status: 'pending',
          paymentDeadline,
          autoVerified: false,
        })
        .returning();

      payment = newPayment;

      console.log(`✅ Payment record created retroactively:`);
      console.log(`   - Payment ID: ${payment.id}`);
      console.log(`   - Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
      console.log(`   - Payment Method: ${payment.paymentMethod}`);
      console.log(`   - Escrow Status: ${payment.escrowStatus}`);
      console.log(`   - Status: ${payment.status}`);

      // Log the retroactive payment creation
      const { logAction, AuditActionType, AuditEntityType, DeviceType } = await import('@/lib/utils/audit-logger');
      await logAction({
        userId,
        actionType: AuditActionType.PAYMENT_INITIATED,
        entityType: AuditEntityType.PAYMENT,
        entityId: payment.id,
        ipAddress: 'system',
        deviceType: DeviceType.DESKTOP,
        userAgent: 'document-service-retroactive',
        afterState: {
          auctionId,
          vendorId,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          escrowStatus: payment.escrowStatus,
          status: payment.status,
          retroactive: true,
          reason: 'Payment record missing when documents completed',
        },
      });
    }

    console.log(`💰 Payment found: ${payment.id}, Amount: ₦${payment.amount}, Status: ${payment.status}`);

    // Step 3: ENHANCED DUPLICATE PREVENTION - Check multiple conditions
    
    // Check 3a: Escrow funds already released (PRIMARY CHECK)
    // For Paystack payments, status is 'verified' but escrowStatus may still be null
    // We should only skip if funds were ACTUALLY released (escrowStatus === 'released')
    if (payment.escrowStatus === 'released') {
      console.log(`⏸️  Escrow funds already released for auction ${auctionId}. Skipping fund release.`);
      return;
    }

    // Check 3b: PAYMENT_UNLOCKED notification already exists
    // Only check if userId is a valid UUID (not 'system')
    const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    
    if (isValidUuid) {
      const { notifications } = await import('@/lib/db/schema/notifications');
      const [existingNotification] = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.type, 'PAYMENT_UNLOCKED')
          )
        )
        .limit(1);

      // Check if notification data matches this auction
      if (existingNotification) {
        const notificationData = existingNotification.data as { auctionId?: string; paymentId?: string };
        if (notificationData?.auctionId === auctionId || notificationData?.paymentId === payment.id) {
          console.log(`⏸️  Payment unlocked notification already exists for auction ${auctionId}. Skipping fund release.`);
          return;
        }
      }
    }

    console.log(`✅ All duplicate prevention checks passed. Proceeding with fund release...`);

    // Step 5: Release funds via escrow service
    // Step 5: Release funds via escrow service
    const { escrowService } = await import('@/features/payments/services/escrow.service');
    const amount = parseFloat(payment.amount);
    
    console.log(`🔓 Releasing ₦${amount.toLocaleString()} from vendor wallet...`);
    await escrowService.releaseFunds(vendorId, amount, auctionId, userId);
    console.log(`✅ Funds released successfully via Paystack`);

    // Step 6: Update payment status to verified
    // Step 6: Update payment status to verified
    await db
      .update(payments)
      .set({
        status: 'verified',
        escrowStatus: 'released',
        verifiedAt: new Date(),
        autoVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    console.log(`✅ Payment status updated to 'verified'`);

    // Step 7: Update case status to sold
    // Step 7: Update case status to sold
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (auction) {
      await db
        .update(salvageCases)
        .set({
          status: 'sold',
          updatedAt: new Date(),
        })
        .where(eq(salvageCases.id, auction.caseId));

      console.log(`✅ Case status updated to 'sold'`);
    }

    // Step 8: Generate pickup authorization code
    const pickupAuthCode = `AUTH-${auctionId.substring(0, 8).toUpperCase()}`;

    // Step 9: Send notifications to vendor with pickup details
    // Step 9: Send notifications to vendor with pickup details
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (vendor && auction) {
      const [user] = await db.select().from(users).where(eq(users.id, vendor.userId)).limit(1);
      if (user) {
        // Get pickup location from case data
        const [caseData] = await db
          .select()
          .from(salvageCases)
          .where(eq(salvageCases.id, auction.caseId))
          .limit(1);
        
        const pickupLocation = caseData?.locationName || 'NEM Insurance Salvage Yard';
        const pickupDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toLocaleDateString('en-NG');

        // Send SMS notification with pickup location and deadline
        const { smsService } = await import('@/features/notifications/services/sms.service');
        await smsService.sendSMS({
          to: user.phone,
          message: `✅ Payment complete! Pickup Authorization Code: ${pickupAuthCode}. Location: ${pickupLocation}. Deadline: ${pickupDeadline}. Bring valid ID.`,
          userId: user.id,
        });

        // Send email notification with full pickup details
        const { emailService } = await import('@/features/notifications/services/email.service');
        const assetDetails = (auction as any).title || 'Salvage Item';
        await emailService.sendPaymentConfirmationEmail(user.email, {
          vendorName: user.fullName,
          auctionId,
          paymentId: payment.id,
          assetName: assetDetails,
          paymentAmount: parseFloat(payment.amount),
          paymentMethod: 'Escrow Wallet',
          paymentReference: `ESCROW_${auctionId.substring(0, 8)}`,
          pickupAuthCode,
          pickupLocation,
          pickupDeadline,
          appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        });

        // FIXED: Send push notification with PAYMENT_UNLOCKED type for modal trigger
        const { createNotification } = await import('@/features/notifications/services/notification.service');
        await createNotification({
          userId: user.id,
          type: 'PAYMENT_UNLOCKED',
          title: 'Payment Complete!',
          message: `Pickup Authorization Code: ${pickupAuthCode}. Location: ${pickupLocation}. Deadline: ${pickupDeadline}`,
          data: {
            auctionId,
            paymentId: payment.id,
            pickupAuthCode,
            pickupLocation,
            pickupDeadline,
          },
        });

        console.log(`✅ Payment complete notifications sent to vendor ${user.fullName}`);
        console.log(`   - SMS: Pickup Authorization Code ${pickupAuthCode}`);
        console.log(`   - Email: Payment confirmation with pickup details`);
        console.log(`   - Push: PAYMENT_UNLOCKED notification (triggers modal)`);
        console.log(`   - Pickup Location: ${pickupLocation}`);
        console.log(`   - Pickup Deadline: ${pickupDeadline}`);
      }
    }

    // Step 10: Create audit log entry
    // Step 10: Create audit log entry
    const { logAction, AuditActionType, AuditEntityType, DeviceType } = await import('@/lib/utils/audit-logger');
    await logAction({
      userId,
      actionType: AuditActionType.FUNDS_RELEASED,
      entityType: AuditEntityType.PAYMENT,
      entityId: payment.id,
      ipAddress: 'system',
      deviceType: DeviceType.DESKTOP,
      userAgent: 'document-service',
      afterState: {
        auctionId,
        vendorId,
        amount,
        status: 'verified',
        escrowStatus: 'released',
        autoVerified: true,
        trigger: 'document_signing_completion',
      },
    });

    console.log(`✅ Funds released automatically for auction ${auctionId} after document signing completion`);

    // Step 11: Send success notification to Finance Officers
    try {
      await sendFundReleaseSuccessNotification(auctionId, payment.id, amount);
    } catch (notificationError) {
      console.error('❌ Failed to send fund release success notification:', notificationError);
      // Don't throw - notification failure shouldn't block the process
    }
  } catch (error) {
    console.error('❌ Error triggering fund release:', error);
    
    // Send alert to Finance Officer
    try {
      await sendFundReleaseFailureAlert(auctionId, vendorId, payment?.id || 'unknown', error);
    } catch (alertError) {
      console.error('❌ Failed to send fund release failure alert:', alertError);
    }
    
    throw error;
  }
}

/**
 * Send fund release failure alert to Finance Officer
 * Called when automatic fund release fails
 */
async function sendFundReleaseFailureAlert(
  auctionId: string,
  vendorId: string,
  paymentId: string,
  error: unknown
): Promise<void> {
  try {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Get Finance Officer users (role = 'finance_officer')
    const financeOfficers = await db
      .select()
      .from(users)
      .where(eq(users.role, 'finance_officer'))
      .limit(5); // Send to max 5 finance officers

    if (financeOfficers.length === 0) {
      console.warn('⚠️  No Finance Officers found to send alert');
      return;
    }

    // Get vendor details
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    const vendorName = vendor ? 'Vendor' : 'Unknown Vendor';

    // Send email to each Finance Officer
    const { emailService } = await import('@/features/notifications/services/email.service');
    
    for (const officer of financeOfficers) {
      await emailService.sendEmail({
        to: officer.email,
        subject: `🚨 Escrow Payment Failed - Action Required - Auction ${auctionId.substring(0, 8)}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Automatic Fund Release Failed</h2>
            <p>Dear ${officer.fullName},</p>
            <p>An automatic fund release failed and requires your immediate attention.</p>
            
            <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #991b1b;">Error Details</h3>
              <p><strong>Auction ID:</strong> ${auctionId}</p>
              <p><strong>Vendor:</strong> ${vendorName}</p>
              <p><strong>Error:</strong> ${errorMessage}</p>
              <p><strong>Time:</strong> ${new Date().toLocaleString('en-NG')}</p>
            </div>

            <h3>What Happened?</h3>
            <p>The vendor completed all 2 required documents (Bill of Sale, Liability Waiver), which should have automatically triggered fund release from their escrow wallet to NEM Insurance. However, the Paystack transfer failed.</p>

            <h3>Action Required</h3>
            <ol>
              <li>Log in to the Finance Officer dashboard</li>
              <li>Navigate to Payments → Escrow Wallet Payments</li>
              <li>Find auction ${auctionId.substring(0, 8)}</li>
              <li>Review the error details</li>
              <li>Click "Manual Release" to retry the fund transfer</li>
            </ol>

            <p style="margin-top: 30px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://salvage.nem-insurance.com'}/finance/payments" 
                 style="background-color: #7f1d1d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Payment Dashboard
              </a>
            </p>

            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              This is an automated alert from the NEM Salvage Management System.
            </p>
          </div>
        `,
      });

      // Send push notification
      const { createNotification } = await import('@/features/notifications/services/notification.service');
      await createNotification({
        userId: officer.id,
        type: 'payment_reminder',
        title: '🚨 Escrow Payment Failed',
        message: `Automatic fund release failed for auction ${auctionId.substring(0, 8)}. Manual intervention required.`,
        data: {
          auctionId,
          vendorId,
          paymentId,
          error: errorMessage,
        },
      });
    }

    console.log(`✅ Fund release failure alerts sent to ${financeOfficers.length} Finance Officers`);
  } catch (error) {
    console.error('❌ Error sending fund release failure alert:', error);
    // Don't throw - this is a best-effort notification
  }
}

/**
 * Send fund release success notification to Finance Officers
 * Called when automatic fund release succeeds
 */
async function sendFundReleaseSuccessNotification(
  auctionId: string,
  paymentId: string,
  amount: number
): Promise<void> {
  try {
    // Get Finance Officer users (role = 'finance_officer')
    const financeOfficers = await db
      .select()
      .from(users)
      .where(eq(users.role, 'finance_officer'))
      .limit(5); // Send to max 5 finance officers

    if (financeOfficers.length === 0) {
      console.warn('⚠️  No Finance Officers found to send success notification');
      return;
    }

    // Get auction and case details for context
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (!auction) {
      console.warn('⚠️  Auction not found for success notification');
      return;
    }

    const [caseData] = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.id, auction.caseId))
      .limit(1);

    const assetDescription = caseData 
      ? `${caseData.assetType} - ${caseData.claimReference}`
      : 'Salvage Item';

    // Send email to each Finance Officer
    const { emailService } = await import('@/features/notifications/services/email.service');
    
    for (const officer of financeOfficers) {
      // Send email notification
      await emailService.sendEmail({
        to: officer.email,
        subject: `✅ Escrow Payment Released - ${auctionId.substring(0, 8)}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">Automatic Fund Release Successful</h2>
            <p>Dear ${officer.fullName},</p>
            <p>An escrow wallet payment has been successfully released automatically.</p>
            
            <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #065f46;">Payment Details</h3>
              <p><strong>Auction ID:</strong> ${auctionId}</p>
              <p><strong>Payment ID:</strong> ${paymentId}</p>
              <p><strong>Amount:</strong> ₦${amount.toLocaleString()}</p>
              <p><strong>Asset:</strong> ${assetDescription}</p>
              <p><strong>Time:</strong> ${new Date().toLocaleString('en-NG')}</p>
            </div>

            <h3>What Happened?</h3>
            <p>The vendor completed all 2 required documents (Bill of Sale, Liability Waiver), which automatically triggered fund release from their escrow wallet to NEM Insurance. The Paystack transfer was successful.</p>

            <h3>Next Steps</h3>
            <ul>
              <li>Payment has been marked as "verified"</li>
              <li>Case status updated to "sold"</li>
              <li>Vendor has been notified with pickup authorization code</li>
              <li>No action required from you</li>
            </ul>

            <p style="margin-top: 30px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://salvage.nem-insurance.com'}/finance/payments" 
                 style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Payment Dashboard
              </a>
            </p>

            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              This is an automated notification from the NEM Salvage Management System.
            </p>
          </div>
        `,
      });

      // Send push notification
      const { createNotification } = await import('@/features/notifications/services/notification.service');
      await createNotification({
        userId: officer.id,
        type: 'payment_success',
        title: '✅ Escrow Payment Released',
        message: `₦${amount.toLocaleString()} released for auction ${auctionId.substring(0, 8)}. All documents signed.`,
        data: {
          auctionId,
          paymentId,
          amount,
        },
      });
    }

    console.log(`✅ Fund release success notifications sent to ${financeOfficers.length} Finance Officers`);
  } catch (error) {
    console.error('❌ Error sending fund release success notification:', error);
    // Don't throw - this is a best-effort notification
  }
}
