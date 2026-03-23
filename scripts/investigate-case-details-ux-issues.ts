/**
 * Investigation Script: Case Details UX Issues
 * 
 * This script investigates the critical UX issues reported by the user:
 * 1. Vehicle language used for electronics
 * 2. Contradictory statements (total loss vs repairable)
 * 3. Confidence metrics display
 * 4. Damage breakdown showing 50% placeholders instead of actual values
 * 5. Analysis method showing "mock"
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { users } from '@/lib/db/schema/users';
import { eq, desc } from 'drizzle-orm';
import { formatNaira, formatAnalysisMethod } from '@/lib/utils/currency-formatter';

async function investigateCaseDetailsIssues() {
  console.log('🔍 Investigating Case Details UX Issues\n');

  try {
    // Get the most recent electronics case
    const cases = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.assetType, 'electronics'))
      .orderBy(desc(salvageCases.createdAt))
      .limit(1);

    if (cases.length === 0) {
      console.log('❌ No electronics cases found. Looking for any case...');
      
      const anyCases = await db
        .select()
        .from(salvageCases)
        .orderBy(desc(salvageCases.createdAt))
        .limit(1);
      
      if (anyCases.length === 0) {
        console.log('❌ No cases found in database');
        return;
      }
      
      console.log('Found case of type:', anyCases[0].assetType);
      console.log('\n');
    }

    const caseData = cases.length > 0 ? cases[0] : (await db.select().from(salvageCases).orderBy(desc(salvageCases.createdAt)).limit(1))[0];
    
    console.log('📋 CASE OVERVIEW:');
    console.log('  ID:', caseData.id);
    console.log('  Claim Reference:', caseData.claimReference);
    console.log('  Asset Type:', caseData.assetType);
    console.log('  Status:', caseData.status);
    console.log('\n');

    // Issue 1: Check AI Assessment structure
    console.log('🤖 ISSUE 1: AI ASSESSMENT STRUCTURE');
    if (caseData.aiAssessment && typeof caseData.aiAssessment === 'object') {
      const assessment = caseData.aiAssessment as any;
      
      console.log('  Analysis Method:', assessment.analysisMethod || 'NOT SET');
      console.log('  Damage Severity:', caseData.damageSeverity);
      console.log('  Is Repairable:', assessment.isRepairable);
      console.log('  Is Total Loss:', assessment.isTotalLoss);
      console.log('\n');
      
      // Issue 2: Check for contradiction
      console.log('🚨 ISSUE 2: CONTRADICTION CHECK');
      if (assessment.isTotalLoss === true && assessment.isRepairable === true) {
        console.log('  ❌ CONTRADICTION FOUND: isTotalLoss=true but isRepairable=true');
      } else if (assessment.isTotalLoss === true && assessment.isRepairable === false) {
        console.log('  ✅ Consistent: isTotalLoss=true and isRepairable=false');
      } else if (assessment.isTotalLoss === false && assessment.isRepairable === true) {
        console.log('  ✅ Consistent: isTotalLoss=false and isRepairable=true');
      } else {
        console.log('  ⚠️ Unclear state:', { isTotalLoss: assessment.isTotalLoss, isRepairable: assessment.isRepairable });
      }
      console.log('\n');
      
      // Issue 3: Check confidence metrics
      console.log('📊 ISSUE 3: CONFIDENCE METRICS');
      if (assessment.confidence) {
        console.log('  Overall:', assessment.confidence.overall + '%');
        console.log('  Photo Quality:', assessment.confidence.photoQuality + '%');
        console.log('  Damage Detection:', assessment.confidence.damageDetection + '%');
        console.log('  Vehicle Detection:', assessment.confidence.vehicleDetection + '%');
        console.log('  Valuation Accuracy:', assessment.confidence.valuationAccuracy + '%');
        console.log('  ⚠️ These metrics are being displayed but user wants them REMOVED');
      } else {
        console.log('  ✅ No confidence metrics found');
      }
      console.log('\n');
      
      // Issue 4: Check damage breakdown
      console.log('🔧 ISSUE 4: DAMAGE BREAKDOWN');
      if (assessment.damageScore) {
        console.log('  Structural:', assessment.damageScore.structural + '%');
        console.log('  Mechanical:', assessment.damageScore.mechanical + '%');
        console.log('  Cosmetic:', assessment.damageScore.cosmetic + '%');
        console.log('  Electrical:', assessment.damageScore.electrical + '%');
        console.log('  Interior:', assessment.damageScore.interior + '%');
        
        // Check if all are 50%
        const allFifty = Object.values(assessment.damageScore).every((v: any) => v === 50);
        if (allFifty) {
          console.log('  ❌ ALL VALUES ARE 50% - PLACEHOLDER DATA!');
        } else {
          console.log('  ✅ Actual damage values present');
        }
      } else {
        console.log('  ❌ No damageScore field found');
      }
      console.log('\n');
      
      // Issue 5: Check recommendation text
      console.log('📝 ISSUE 5: RECOMMENDATION TEXT');
      if (assessment.recommendation) {
        console.log('  Text:', assessment.recommendation.substring(0, 200));
        
        // Check for vehicle-specific language
        const vehicleWords = ['vehicle', 'car', 'automobile', 'mileage', 'engine'];
        const hasVehicleLanguage = vehicleWords.some(word => 
          assessment.recommendation.toLowerCase().includes(word)
        );
        
        if (caseData.assetType !== 'vehicle' && hasVehicleLanguage) {
          console.log('  ❌ VEHICLE LANGUAGE USED FOR NON-VEHICLE ITEM!');
        } else {
          console.log('  ✅ Language appropriate for asset type');
        }
      } else {
        console.log('  ⚠️ No recommendation field');
      }
      console.log('\n');
      
      // Issue 6: Check analysis method
      console.log('🔬 ISSUE 6: ANALYSIS METHOD');
      console.log('  Raw value:', assessment.analysisMethod);
      console.log('  Should be: gemini, vision, or neutral');
      if (assessment.analysisMethod === 'mock') {
        console.log('  ❌ SHOWING "mock" - SHOULD SHOW ACTUAL METHOD!');
      } else {
        console.log('  ✅ Actual method recorded');
      }
    } else {
      console.log('❌ No AI assessment found');
    }

    console.log('\n');
    console.log('🎯 SUMMARY OF ISSUES TO FIX:');
    console.log('  1. Remove confidence metrics display from UI');
    console.log('  2. Fix damage breakdown to show actual values (not 50%)');
    console.log('  3. Fix total loss vs repairable contradiction');
    console.log('  4. Ensure item-type-specific language in recommendations');
    console.log('  5. Fix analysis method if showing "mock"');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

investigateCaseDetailsIssues()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
