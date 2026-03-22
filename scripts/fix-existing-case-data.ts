/**
 * Fix Existing Case Data
 * 
 * This script fixes existing cases that have:
 * 1. 50% placeholder damage values
 * 2. Missing isTotalLoss field
 * 3. Vehicle language for non-vehicle items
 * 4. Missing priceSource field
 * 
 * It re-runs the AI assessment for these cases to get correct values.
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq } from 'drizzle-orm';
import { assessDamageEnhanced } from '@/features/cases/services/ai-assessment-enhanced.service';
import type { UniversalItemInfo } from '@/features/cases/services/ai-assessment-enhanced.service';

async function fixExistingCaseData() {
  console.log('🔧 Fixing Existing Case Data\n');

  try {
    // Find cases with 50% placeholder values
    const cases = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.assetType, 'electronics'));

    console.log(`Found ${cases.length} electronics cases to check\n`);

    for (const caseData of cases) {
      console.log(`\n📋 Processing case: ${caseData.claimReference}`);
      console.log(`   Asset Type: ${caseData.assetType}`);
      
      // Check if this case has 50% placeholder values
      const assessment = caseData.aiAssessment as any;
      if (!assessment || !assessment.damageScore) {
        console.log('   ⚠️ No AI assessment found, skipping');
        continue;
      }
      
      const allFifty = Object.values(assessment.damageScore).every((v: any) => v === 50);
      if (!allFifty) {
        console.log('   ✅ Already has actual damage values, skipping');
        continue;
      }
      
      console.log('   ❌ Has 50% placeholder values, fixing...');
      
      // Re-run AI assessment with proper item info
      const assetDetails = caseData.assetDetails as any;
      
      let itemInfo: UniversalItemInfo | undefined;
      
      if (caseData.assetType === 'electronics') {
        itemInfo = {
          type: 'electronics',
          brand: assetDetails.brand,
          model: assetDetails.model,
          storageCapacity: assetDetails.storage || assetDetails.storageCapacity,
          condition: assetDetails.condition || 'Nigerian Used',
          age: assetDetails.year ? new Date().getFullYear() - assetDetails.year : 2,
        };
      } else if (caseData.assetType === 'vehicle') {
        itemInfo = {
          type: 'vehicle',
          make: assetDetails.make,
          model: assetDetails.model,
          year: assetDetails.year,
          mileage: assetDetails.mileage,
          condition: assetDetails.condition || 'Nigerian Used',
        };
      } else if (caseData.assetType === 'appliance') {
        itemInfo = {
          type: 'appliance',
          brand: assetDetails.brand,
          model: assetDetails.model,
          condition: assetDetails.condition || 'Nigerian Used',
        };
      }
      
      if (!itemInfo) {
        console.log('   ⚠️ Could not build item info, skipping');
        continue;
      }
      
      console.log('   🤖 Re-running AI assessment...');
      
      try {
        const newAssessment = await assessDamageEnhanced({
          photos: caseData.photos || [],
          universalItemInfo: itemInfo,
        });
        
        console.log('   ✅ New assessment complete:');
        console.log('      Damage Scores:', newAssessment.damageScore);
        console.log('      Is Total Loss:', newAssessment.isTotalLoss);
        console.log('      Price Source:', newAssessment.priceSource);
        console.log('      Analysis Method:', newAssessment.analysisMethod);
        console.log('      Recommendation:', newAssessment.recommendation.substring(0, 80) + '...');
        
        // Update the case in database
        await db
          .update(salvageCases)
          .set({
            damageSeverity: newAssessment.damageSeverity,
            estimatedSalvageValue: newAssessment.estimatedSalvageValue.toString(),
            reservePrice: newAssessment.reservePrice.toString(),
            marketValue: newAssessment.marketValue.toString(),
            aiAssessment: {
              labels: newAssessment.labels,
              confidenceScore: newAssessment.confidenceScore,
              damagePercentage: newAssessment.damagePercentage,
              processedAt: newAssessment.processedAt,
              damageScore: newAssessment.damageScore,
              confidence: newAssessment.confidence,
              estimatedRepairCost: newAssessment.estimatedRepairCost,
              isRepairable: newAssessment.isRepairable,
              isTotalLoss: newAssessment.isTotalLoss,
              priceSource: newAssessment.priceSource,
              recommendation: newAssessment.recommendation,
              warnings: newAssessment.warnings,
              analysisMethod: newAssessment.analysisMethod,
              photoCount: newAssessment.photoCount,
              qualityTier: newAssessment.qualityTier,
            },
          })
          .where(eq(salvageCases.id, caseData.id));
        
        console.log('   ✅ Case updated successfully');
        
      } catch (error) {
        console.error('   ❌ Failed to re-assess:', error instanceof Error ? error.message : error);
      }
    }
    
    console.log('\n');
    console.log('✅ ALL CASES PROCESSED!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

fixExistingCaseData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
