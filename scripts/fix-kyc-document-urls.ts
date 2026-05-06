import 'dotenv/config';
import { db } from '../src/lib/db/drizzle';
import { vendors } from '../src/lib/db/schema/vendors';
import { eq, isNotNull, sql, and } from 'drizzle-orm';

/**
 * Fix KYC document URLs
 * 
 * This script converts public Supabase URLs to storage paths
 * so that signed URLs can be generated for private bucket access.
 * 
 * Example:
 * FROM: https://htdehmkqfrwjewzjingm.supabase.co/storage/v1/object/public/kyc-documents/vendor-id/nin_card_123.jpeg
 * TO: vendor-id/nin_card_123.jpeg
 */

function extractPathFromUrl(url: string | null): string | null {
  if (!url) return null;
  
  // Extract path from Supabase public URL
  // Format: https://{project}.supabase.co/storage/v1/object/public/kyc-documents/{path}
  const match = url.match(/\/kyc-documents\/(.+)$/);
  return match ? match[1] : url;
}

async function fixKYCDocumentUrls() {
  console.log('🔧 Fixing KYC Document URLs...\n');

  try {
    // Get all vendors with Tier 2 submissions
    const vendorsWithDocs = await db
      .select({
        id: vendors.id,
        businessName: vendors.businessName,
        cacCertificateUrl: vendors.cacCertificateUrl,
        ninCardUrl: vendors.ninCardUrl,
        addressProofUrl: vendors.addressProofUrl,
        bankStatementUrl: vendors.bankStatementUrl,
        photoIdUrl: vendors.photoIdUrl,
      })
      .from(vendors)
      .where(
        and(
          isNotNull(vendors.tier2SubmittedAt),
          sql`${vendors.tier2ApprovedAt} IS NULL`
        )
      );

    console.log(`📊 Found ${vendorsWithDocs.length} vendors with pending Tier 2 submissions\n`);

    if (vendorsWithDocs.length === 0) {
      console.log('✅ No vendors to fix');
      return;
    }

    for (const vendor of vendorsWithDocs) {
      console.log(`\n📋 Processing: ${vendor.businessName} (${vendor.id})`);
      
      const updates: any = {};
      let changesCount = 0;

      // Convert each URL to path
      if (vendor.cacCertificateUrl) {
        const path = extractPathFromUrl(vendor.cacCertificateUrl);
        if (path !== vendor.cacCertificateUrl) {
          updates.cacCertificateUrl = path;
          changesCount++;
          console.log(`   ✓ CAC Certificate: ${vendor.cacCertificateUrl} → ${path}`);
        }
      }

      if (vendor.ninCardUrl) {
        const path = extractPathFromUrl(vendor.ninCardUrl);
        if (path !== vendor.ninCardUrl) {
          updates.ninCardUrl = path;
          changesCount++;
          console.log(`   ✓ NIN Card: ${vendor.ninCardUrl} → ${path}`);
        }
      }

      if (vendor.addressProofUrl) {
        const path = extractPathFromUrl(vendor.addressProofUrl);
        if (path !== vendor.addressProofUrl) {
          updates.addressProofUrl = path;
          changesCount++;
          console.log(`   ✓ Address Proof: ${vendor.addressProofUrl} → ${path}`);
        }
      }

      if (vendor.bankStatementUrl) {
        const path = extractPathFromUrl(vendor.bankStatementUrl);
        if (path !== vendor.bankStatementUrl) {
          updates.bankStatementUrl = path;
          changesCount++;
          console.log(`   ✓ Bank Statement: ${vendor.bankStatementUrl} → ${path}`);
        }
      }

      if (vendor.photoIdUrl) {
        const path = extractPathFromUrl(vendor.photoIdUrl);
        if (path !== vendor.photoIdUrl) {
          updates.photoIdUrl = path;
          changesCount++;
          console.log(`   ✓ Photo ID: ${vendor.photoIdUrl} → ${path}`);
        }
      }

      if (changesCount > 0) {
        await db
          .update(vendors)
          .set(updates)
          .where(eq(vendors.id, vendor.id));
        
        console.log(`   ✅ Updated ${changesCount} document URLs`);
      } else {
        console.log(`   ℹ️  No changes needed`);
      }
    }

    console.log('\n✅ All document URLs fixed!\n');

  } catch (error) {
    console.error('❌ Error fixing document URLs:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

fixKYCDocumentUrls();
