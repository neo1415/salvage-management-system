/**
 * Find the 2021 Toyota Camry case in the database
 */

import { db } from '@/lib/db';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq, and, sql } from 'drizzle-orm';

async function findCamryCase() {
  console.log('🔍 Searching for 2021 Toyota Camry cases in database...\n');
  
  try {
    // Find all cases with Toyota Camry 2021
    const cases = await db
      .select()
      .from(salvageCases)
      .where(
        and(
          sql`${salvageCases.assetDetails}->>'make' = 'Toyota'`,
          sql`${salvageCases.assetDetails}->>'model' = 'Camry'`,
          sql`(${salvageCases.assetDetails}->>'year')::int = 2021`
        )
      )
      .orderBy(sql`${salvageCases.createdAt} DESC`)
      .limit(5);
    
    if (cases.length === 0) {
      console.log('❌ No 2021 Toyota Camry cases found in database');
      return;
    }
    
    console.log(`✅ Found ${cases.length} case(s)\n`);
    console.log('='.repeat(100));
    
    for (const caseData of cases) {
      console.log(`\n📋 Case ID: ${caseData.id}`);
      console.log(`Claim Reference: ${caseData.claimReference}`);
      console.log(`Status: ${caseData.status}`);
      console.log(`Created: ${caseData.createdAt}`);
      
      console.log('\n🚗 Vehicle Details:');
      const assetDetails = caseData.assetDetails as any;
      console.log(`  Make: ${assetDetails.make}`);
      console.log(`  Model: ${assetDetails.model}`);
      console.log(`  Year: ${assetDetails.year}`);
      console.log(`  VIN: ${assetDetails.vin || 'N/A'}`);
      
      console.log('\n💰 Pricing:');
      console.log(`  Market Value:        ₦${parseFloat(caseData.marketValue).toLocaleString()}`);
      console.log(`  Salvage Value:       ₦${parseFloat(caseData.estimatedSalvageValue).toLocaleString()}`);
      console.log(`  Reserve Price:       ₦${parseFloat(caseData.reservePrice).toLocaleString()}`);
      
      // Calculate percentages
      const marketValue = parseFloat(caseData.marketValue);
      const salvageValue = parseFloat(caseData.estimatedSalvageValue);
      const reservePrice = parseFloat(caseData.reservePrice);
      
      const salvagePercent = (salvageValue / marketValue) * 100;
      const reservePercent = (reservePrice / marketValue) * 100;
      
      console.log(`\n📊 Percentages:`);
      console.log(`  Salvage as % of Market: ${salvagePercent.toFixed(2)}%`);
      console.log(`  Reserve as % of Market: ${reservePercent.toFixed(2)}%`);
      
      if (salvagePercent < 1 || reservePercent < 1) {
        console.log(`\n🚨 BUG DETECTED! Values are less than 1% of market value!`);
      }
      
      console.log('\n🔧 Vehicle Condition:');
      console.log(`  Mileage: ${caseData.vehicleMileage || 'N/A'}`);
      console.log(`  Condition: ${caseData.vehicleCondition || 'N/A'}`);
      
      console.log('\n🤖 AI Assessment:');
      const aiAssessment = caseData.aiAssessment as any;
      console.log(`  Damage Severity: ${caseData.damageSeverity}`);
      console.log(`  Confidence Score: ${aiAssessment.confidenceScore}%`);
      console.log(`  Damage Percentage: ${aiAssessment.damagePercentage}%`);
      console.log(`  Analysis Method: ${aiAssessment.analysisMethod || 'unknown'}`);
      console.log(`  Photo Count: ${aiAssessment.photoCount || 'unknown'}`);
      
      if (aiAssessment.damageScore) {
        console.log('\n  Damage Scores:');
        console.log(`    Structural: ${aiAssessment.damageScore.structural}`);
        console.log(`    Mechanical: ${aiAssessment.damageScore.mechanical}`);
        console.log(`    Cosmetic: ${aiAssessment.damageScore.cosmetic}`);
        console.log(`    Electrical: ${aiAssessment.damageScore.electrical}`);
        console.log(`    Interior: ${aiAssessment.damageScore.interior}`);
      }
      
      if (aiAssessment.estimatedRepairCost) {
        console.log(`\n  Estimated Repair Cost: ₦${aiAssessment.estimatedRepairCost.toLocaleString()}`);
      }
      
      if (aiAssessment.confidence) {
        console.log('\n  Confidence Breakdown:');
        console.log(`    Overall: ${aiAssessment.confidence.overall}%`);
        console.log(`    Vehicle Detection: ${aiAssessment.confidence.vehicleDetection}%`);
        console.log(`    Damage Detection: ${aiAssessment.confidence.damageDetection}%`);
        console.log(`    Valuation Accuracy: ${aiAssessment.confidence.valuationAccuracy}%`);
        console.log(`    Photo Quality: ${aiAssessment.confidence.photoQuality}%`);
      }
      
      if (aiAssessment.warnings && aiAssessment.warnings.length > 0) {
        console.log('\n  ⚠️  Warnings:');
        aiAssessment.warnings.forEach((warning: string, index: number) => {
          console.log(`    ${index + 1}. ${warning}`);
        });
      }
      
      if (aiAssessment.labels && aiAssessment.labels.length > 0) {
        console.log('\n  🏷️  Detected Labels:');
        console.log(`    ${aiAssessment.labels.slice(0, 10).join(', ')}`);
        if (aiAssessment.labels.length > 10) {
          console.log(`    ... and ${aiAssessment.labels.length - 10} more`);
        }
      }
      
      // Check for AI estimates and manager overrides
      if (caseData.aiEstimates) {
        console.log('\n💡 AI Estimates (Original):');
        const aiEst = caseData.aiEstimates as any;
        console.log(`  Market Value: ₦${aiEst.marketValue?.toLocaleString() || 'N/A'}`);
        console.log(`  Repair Cost: ₦${aiEst.repairCost?.toLocaleString() || 'N/A'}`);
        console.log(`  Salvage Value: ₦${aiEst.salvageValue?.toLocaleString() || 'N/A'}`);
        console.log(`  Reserve Price: ₦${aiEst.reservePrice?.toLocaleString() || 'N/A'}`);
      }
      
      if (caseData.managerOverrides) {
        console.log('\n👤 Manager Overrides:');
        const overrides = caseData.managerOverrides as any;
        if (overrides.marketValue) console.log(`  Market Value: ₦${overrides.marketValue.toLocaleString()}`);
        if (overrides.repairCost) console.log(`  Repair Cost: ₦${overrides.repairCost.toLocaleString()}`);
        if (overrides.salvageValue) console.log(`  Salvage Value: ₦${overrides.salvageValue.toLocaleString()}`);
        if (overrides.reservePrice) console.log(`  Reserve Price: ₦${overrides.reservePrice.toLocaleString()}`);
        console.log(`  Reason: ${overrides.reason}`);
        console.log(`  By: ${overrides.overriddenBy}`);
        console.log(`  At: ${overrides.overriddenAt}`);
      }
      
      console.log('\n' + '='.repeat(100));
    }
    
  } catch (error) {
    console.error('❌ Error querying database:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
  }
}

// Run the query
findCamryCase()
  .then(() => {
    console.log('\n✅ Query complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Query failed:', error);
    process.exit(1);
  });
