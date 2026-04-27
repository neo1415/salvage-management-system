import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';
import { recommendationGenerationService } from '@/features/intelligence/services/recommendation-generation.service';

/**
 * Daily Cron Job: Generate Vendor Recommendations
 * 
 * Runs daily to generate personalized auction recommendations for all active vendors
 * based on their interaction history (views, bids, watches)
 * 
 * Schedule: Daily at 2 AM
 * Vercel Cron: 0 2 * * *
 */
export async function GET(request: NextRequest) {
  // SECURITY: Verify cron secret (REQUIRED)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    console.error('[Security] CRON_SECRET not configured - cron endpoints are vulnerable!');
    return NextResponse.json(
      { error: 'Server misconfiguration' },
      { status: 500 }
    );
  }

  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Security] Unauthorized cron attempt', {
      hasAuthHeader: !!authHeader,
      ip: request.headers.get('x-forwarded-for') || 'unknown',
    });
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log('🎯 Starting daily recommendation generation...\n');
  
  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;
  let noHistoryCount = 0;
  
  try {
    // Get all approved vendors
    const activeVendors = await db
      .select({ id: vendors.id, businessName: vendors.businessName })
      .from(vendors)
      .where(eq(vendors.status, 'approved'));
    
    console.log(`📊 Found ${activeVendors.length} approved vendors\n`);
    
    // Generate recommendations for each vendor
    for (const vendor of activeVendors) {
      try {
        console.log(`\n🔄 Processing vendor: ${vendor.businessName} (${vendor.id})`);
        
        const recommendations = await recommendationGenerationService.generateRecommendationsForVendor(vendor.id);
        
        if (recommendations.length > 0) {
          // Store recommendations
          await recommendationGenerationService.storeRecommendations(vendor.id, recommendations);
          
          console.log(`✅ Generated ${recommendations.length} recommendations for ${vendor.businessName}`);
          successCount++;
        } else {
          console.log(`ℹ️  No recommendations generated for ${vendor.businessName} (no interaction history or no matching auctions)`);
          noHistoryCount++;
        }
      } catch (error) {
        console.error(`❌ Error generating recommendations for vendor ${vendor.id}:`, error);
        errorCount++;
      }
    }
    
    const duration = Date.now() - startTime;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 RECOMMENDATION GENERATION COMPLETE');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Success: ${successCount} vendors`);
    console.log(`ℹ️  No history: ${noHistoryCount} vendors`);
    console.log(`❌ Errors: ${errorCount} vendors`);
    console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`${'='.repeat(60)}\n`);
    
    return NextResponse.json({
      success: true,
      summary: {
        totalVendors: activeVendors.length,
        successCount,
        noHistoryCount,
        errorCount,
        durationMs: duration,
      },
    });
  } catch (error) {
    console.error('\n❌ Fatal error in recommendation generation:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate recommendations',
      },
      { status: 500 }
    );
  }
}
