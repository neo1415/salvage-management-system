/**
 * Investigation Script: Case Data Structure
 * 
 * This script fetches a real case from the database and logs the complete
 * aiAssessment structure to understand:
 * 1. Where the Gemini prose damage summary is stored
 * 2. What the actual analysisMethod value is
 * 3. Where voice notes are stored
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { desc } from 'drizzle-orm';

async function investigateCaseData() {
  console.log('🔍 Fetching most recent case from database...\n');

  try {
    // Get the most recent case
    const cases = await db
      .select()
      .from(salvageCases)
      .orderBy(desc(salvageCases.createdAt))
      .limit(1);

    if (cases.length === 0) {
      console.log('❌ No cases found in database');
      return;
    }

    const caseData = cases[0];
    
    console.log('📋 CASE BASIC INFO:');
    console.log('  ID:', caseData.id);
    console.log('  Claim Reference:', caseData.claimReference);
    console.log('  Asset Type:', caseData.assetType);
    console.log('  Status:', caseData.status);
    console.log('  Damage Severity:', caseData.damageSeverity);
    console.log('  Market Value:', caseData.marketValue);
    console.log('  Salvage Value:', caseData.estimatedSalvageValue);
    console.log('  Reserve Price:', caseData.reservePrice);
    console.log('\n');

    console.log('🤖 AI ASSESSMENT STRUCTURE:');
    console.log('  Type:', typeof caseData.aiAssessment);
    console.log('  Is null?', caseData.aiAssessment === null);
    console.log('\n');

    if (caseData.aiAssessment && typeof caseData.aiAssessment === 'object') {
      const assessment = caseData.aiAssessment as Record<string, unknown>;
      
      console.log('📊 AI ASSESSMENT FIELDS:');
      console.log('  Available keys:', Object.keys(assessment));
      console.log('\n');

      // Check for analysisMethod
      console.log('🔬 ANALYSIS METHOD:');
      console.log('  Value:', assessment.analysisMethod);
      console.log('  Type:', typeof assessment.analysisMethod);
      console.log('\n');

      // Check for labels (damage descriptions)
      console.log('🏷️ LABELS (Damage Descriptions):');
      if (Array.isArray(assessment.labels)) {
        console.log('  Count:', assessment.labels.length);
        console.log('  Values:', assessment.labels);
      } else {
        console.log('  Not an array or missing');
      }
      console.log('\n');

      // Check for recommendation (prose summary)
      console.log('📝 RECOMMENDATION (Prose Summary):');
      console.log('  Value:', assessment.recommendation);
      console.log('  Type:', typeof assessment.recommendation);
      console.log('\n');

      // Check for damageScore
      console.log('📈 DAMAGE SCORE (Percentages):');
      if (assessment.damageScore && typeof assessment.damageScore === 'object') {
        console.log('  Keys:', Object.keys(assessment.damageScore));
        console.log('  Values:', assessment.damageScore);
      } else {
        console.log('  Not available');
      }
      console.log('\n');

      // Check for confidence
      console.log('🎯 CONFIDENCE METRICS:');
      if (assessment.confidence && typeof assessment.confidence === 'object') {
        console.log('  Keys:', Object.keys(assessment.confidence));
        console.log('  Values:', assessment.confidence);
      } else {
        console.log('  Not available');
      }
      console.log('\n');

      // Check for other fields
      console.log('💰 VALUATION FIELDS:');
      console.log('  estimatedSalvageValue:', assessment.estimatedSalvageValue);
      console.log('  reservePrice:', assessment.reservePrice);
      console.log('  marketValue:', assessment.marketValue);
      console.log('  estimatedRepairCost:', assessment.estimatedRepairCost);
      console.log('  damagePercentage:', assessment.damagePercentage);
      console.log('  isRepairable:', assessment.isRepairable);
      console.log('\n');

      // Full dump for reference
      console.log('🗂️ COMPLETE AI ASSESSMENT OBJECT:');
      console.log(JSON.stringify(assessment, null, 2));
      console.log('\n');
    }

    // Check for voice notes
    console.log('🎤 VOICE NOTES:');
    const voiceNotes = (caseData as any).voiceNotes;
    console.log('  Field exists?', voiceNotes !== undefined);
    console.log('  Type:', typeof voiceNotes);
    if (Array.isArray(voiceNotes)) {
      console.log('  Count:', voiceNotes.length);
      console.log('  Values:', voiceNotes);
    } else {
      console.log('  Not an array or missing');
    }
    console.log('\n');

    // Check assetDetails for voice notes
    console.log('📦 ASSET DETAILS:');
    console.log('  Type:', typeof caseData.assetDetails);
    if (caseData.assetDetails && typeof caseData.assetDetails === 'object') {
      console.log('  Keys:', Object.keys(caseData.assetDetails));
      const assetDetails = caseData.assetDetails as Record<string, unknown>;
      if (assetDetails.voiceNotes) {
        console.log('  Voice notes in assetDetails:', assetDetails.voiceNotes);
      }
    }
    console.log('\n');

    console.log('✅ Investigation complete!');
    console.log('\n');
    console.log('KEY FINDINGS:');
    console.log('1. Gemini prose summary is in: aiAssessment.recommendation');
    console.log('2. Damage labels are in: aiAssessment.labels (array)');
    console.log('3. Analysis method is in: aiAssessment.analysisMethod');
    console.log('4. Voice notes location: Check output above');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

investigateCaseData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
