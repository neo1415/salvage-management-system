/**
 * Test Gemini Damage Detection with Real Vehicle Photos
 * 
 * This script tests the Gemini damage detection system with real vehicle photos
 * from the test gallery. It validates accuracy, severity classification, and
 * special condition detection (airbags, total loss).
 * 
 * Usage:
 *   tsx scripts/test-gemini-with-real-photos.ts
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */

import { readdir } from 'fs/promises';
import { join } from 'path';
import { assessDamage } from '@/features/cases/services/ai-assessment.service';
import { initializeGeminiService } from '@/lib/integrations/gemini-damage-detection';

interface TestPhoto {
  path: string;
  category: string;
  expectedSeverity: 'minor' | 'moderate' | 'severe';
  expectedAirbag: boolean;
  expectedTotalLoss: boolean;
  expectedMinDamage: number;
  expectedMaxDamage: number;
}

interface TestResult {
  photo: string;
  category: string;
  passed: boolean;
  actualSeverity: string;
  expectedSeverity: string;
  actualDamage: number;
  expectedRange: string;
  airbagMatch: boolean;
  totalLossMatch: boolean;
  method: string;
  details: string;
}

// Test photo definitions with expected outcomes
const testPhotos: TestPhoto[] = [
  // Undamaged vehicles (4 photos)
  {
    path: '.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Toyota camry 2021-no-damage/344x258.jpg',
    category: 'undamaged',
    expectedSeverity: 'minor',
    expectedAirbag: false,
    expectedTotalLoss: false,
    expectedMinDamage: 0,
    expectedMaxDamage: 30,
  },
  {
    path: '.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Toyota camry 2021-no-damage/images (10).jpg',
    category: 'undamaged',
    expectedSeverity: 'minor',
    expectedAirbag: false,
    expectedTotalLoss: false,
    expectedMinDamage: 0,
    expectedMaxDamage: 30,
  },
  {
    path: '.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Toyota camry 2021-no-damage/images (11).jpg',
    category: 'undamaged',
    expectedSeverity: 'minor',
    expectedAirbag: false,
    expectedTotalLoss: false,
    expectedMinDamage: 0,
    expectedMaxDamage: 30,
  },
  {
    path: '.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Toyota camry 2021-no-damage/images (12).jpg',
    category: 'undamaged',
    expectedSeverity: 'minor',
    expectedAirbag: false,
    expectedTotalLoss: false,
    expectedMinDamage: 0,
    expectedMaxDamage: 30,
  },
  
  // Light severity (3 photos)
  {
    path: '.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/light-severity/download (1).jpg',
    category: 'light-damage',
    expectedSeverity: 'minor',
    expectedAirbag: false,
    expectedTotalLoss: false,
    expectedMinDamage: 30,
    expectedMaxDamage: 50,
  },
  {
    path: '.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/light-severity/images (1).jpg',
    category: 'light-damage',
    expectedSeverity: 'minor',
    expectedAirbag: false,
    expectedTotalLoss: false,
    expectedMinDamage: 30,
    expectedMaxDamage: 50,
  },
  {
    path: '.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/light-severity/images (2).jpg',
    category: 'light-damage',
    expectedSeverity: 'minor',
    expectedAirbag: false,
    expectedTotalLoss: false,
    expectedMinDamage: 30,
    expectedMaxDamage: 50,
  },
  
  // Moderate severity (3 photos)
  {
    path: '.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/moderate-severity/feb780a0cbf04ff69f76602c7b71adfb_hrs.jpg',
    category: 'moderate-damage',
    expectedSeverity: 'moderate',
    expectedAirbag: false,
    expectedTotalLoss: false,
    expectedMinDamage: 50,
    expectedMaxDamage: 70,
  },
  {
    path: '.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/moderate-severity/images (8).jpg',
    category: 'moderate-damage',
    expectedSeverity: 'moderate',
    expectedAirbag: false,
    expectedTotalLoss: false,
    expectedMinDamage: 50,
    expectedMaxDamage: 70,
  },
  {
    path: '.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/moderate-severity/images (9).jpg',
    category: 'moderate-damage',
    expectedSeverity: 'moderate',
    expectedAirbag: false,
    expectedTotalLoss: false,
    expectedMinDamage: 50,
    expectedMaxDamage: 70,
  },
  
  // High severity (5 photos)
  {
    path: '.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Toyota-camry-2021-high-severity/images (3).jpg',
    category: 'high-damage',
    expectedSeverity: 'severe',
    expectedAirbag: true,
    expectedTotalLoss: false,
    expectedMinDamage: 70,
    expectedMaxDamage: 100,
  },
  {
    path: '.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Toyota-camry-2021-high-severity/images (4).jpg',
    category: 'high-damage',
    expectedSeverity: 'severe',
    expectedAirbag: true,
    expectedTotalLoss: false,
    expectedMinDamage: 70,
    expectedMaxDamage: 100,
  },
  {
    path: '.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Toyota-camry-2021-high-severity/images (5).jpg',
    category: 'high-damage',
    expectedSeverity: 'severe',
    expectedAirbag: true,
    expectedTotalLoss: false,
    expectedMinDamage: 70,
    expectedMaxDamage: 100,
  },
  {
    path: '.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Toyota-camry-2021-high-severity/images (6).jpg',
    category: 'high-damage',
    expectedSeverity: 'severe',
    expectedAirbag: true,
    expectedTotalLoss: false,
    expectedMinDamage: 70,
    expectedMaxDamage: 100,
  },
  {
    path: '.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Toyota-camry-2021-high-severity/images (7).jpg',
    category: 'high-damage',
    expectedSeverity: 'severe',
    expectedAirbag: true,
    expectedTotalLoss: false,
    expectedMinDamage: 70,
    expectedMaxDamage: 100,
  },
  
  // Airbag deployed (3 photos)
  {
    path: '.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/airbags-deployed/download (2).jpg',
    category: 'airbag-deployed',
    expectedSeverity: 'moderate',
    expectedAirbag: true,
    expectedTotalLoss: false,
    expectedMinDamage: 50,
    expectedMaxDamage: 80,
  },
  {
    path: '.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/airbags-deployed/images (13).jpg',
    category: 'airbag-deployed',
    expectedSeverity: 'moderate',
    expectedAirbag: true,
    expectedTotalLoss: false,
    expectedMinDamage: 50,
    expectedMaxDamage: 80,
  },
  {
    path: '.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/airbags-deployed/images (14).jpg',
    category: 'airbag-deployed',
    expectedSeverity: 'moderate',
    expectedAirbag: true,
    expectedTotalLoss: false,
    expectedMinDamage: 50,
    expectedMaxDamage: 80,
  },
  
  // Total loss (3 photos) - Note: AVIF format may need special handling
  {
    path: '.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Totalled/images (15).jpg',
    category: 'total-loss',
    expectedSeverity: 'severe',
    expectedAirbag: true,
    expectedTotalLoss: true,
    expectedMinDamage: 75,
    expectedMaxDamage: 100,
  },
  {
    path: '.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Totalled/images (16).jpg',
    category: 'total-loss',
    expectedSeverity: 'severe',
    expectedAirbag: true,
    expectedTotalLoss: true,
    expectedMinDamage: 75,
    expectedMaxDamage: 100,
  },
];

async function testPhotoWithGemini(photo: TestPhoto): Promise<TestResult> {
  console.log(`\nTesting: ${photo.path}`);
  console.log(`Category: ${photo.category}`);
  console.log(`Expected: ${photo.expectedSeverity}, damage ${photo.expectedMinDamage}-${photo.expectedMaxDamage}%`);
  
  try {
    // For this test, we'll use file:// URLs since photos are local
    // In production, these would be Cloudinary URLs
    const fileUrl = `file://${join(process.cwd(), photo.path)}`;
    
    // Test with vehicle context (Toyota Camry 2021 for most photos)
    const vehicleContext = {
      make: 'Toyota',
      model: 'Camry',
      year: 2021,
    };
    
    const result = await assessDamage([fileUrl], 30000, vehicleContext);
    
    // Validate results
    const severityMatch = result.damageSeverity === photo.expectedSeverity;
    const damageInRange = result.damagePercentage >= photo.expectedMinDamage && 
                          result.damagePercentage <= photo.expectedMaxDamage;
    const airbagMatch = result.airbagDeployed === photo.expectedAirbag;
    const totalLossMatch = result.totalLoss === photo.expectedTotalLoss;
    
    const passed = severityMatch && damageInRange && airbagMatch && totalLossMatch;
    
    console.log(`Result: ${result.method} - ${result.damageSeverity}, ${result.damagePercentage}% damage`);
    console.log(`Airbag: ${result.airbagDeployed}, Total Loss: ${result.totalLoss}`);
    console.log(`Status: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    
    return {
      photo: photo.path.split('/').pop() || photo.path,
      category: photo.category,
      passed,
      actualSeverity: result.damageSeverity,
      expectedSeverity: photo.expectedSeverity,
      actualDamage: result.damagePercentage,
      expectedRange: `${photo.expectedMinDamage}-${photo.expectedMaxDamage}%`,
      airbagMatch,
      totalLossMatch,
      method: result.method || 'unknown',
      details: result.summary || 'No summary available',
    };
  } catch (error: any) {
    console.error(`Error testing photo: ${error.message}`);
    return {
      photo: photo.path.split('/').pop() || photo.path,
      category: photo.category,
      passed: false,
      actualSeverity: 'error',
      expectedSeverity: photo.expectedSeverity,
      actualDamage: 0,
      expectedRange: `${photo.expectedMinDamage}-${photo.expectedMaxDamage}%`,
      airbagMatch: false,
      totalLossMatch: false,
      method: 'error',
      details: error.message,
    };
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('GEMINI DAMAGE DETECTION - REAL PHOTO ACCURACY TEST');
  console.log('='.repeat(80));
  
  // Initialize Gemini service
  console.log('\nInitializing Gemini service...');
  await initializeGeminiService();
  
  // Run tests
  const results: TestResult[] = [];
  
  for (const photo of testPhotos) {
    const result = await testPhotoWithGemini(photo);
    results.push(result);
    
    // Small delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Generate summary report
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  
  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;
  const accuracyRate = (passedTests / totalTests * 100).toFixed(1);
  
  console.log(`\nTotal Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} (${accuracyRate}%)`);
  console.log(`Failed: ${failedTests}`);
  
  // Category breakdown
  const categories = ['undamaged', 'light-damage', 'moderate-damage', 'high-damage', 'airbag-deployed', 'total-loss'];
  console.log('\nCategory Breakdown:');
  categories.forEach(category => {
    const categoryResults = results.filter(r => r.category === category);
    const categoryPassed = categoryResults.filter(r => r.passed).length;
    const categoryTotal = categoryResults.length;
    const categoryAccuracy = categoryTotal > 0 ? (categoryPassed / categoryTotal * 100).toFixed(1) : '0.0';
    console.log(`  ${category}: ${categoryPassed}/${categoryTotal} (${categoryAccuracy}%)`);
  });
  
  // Method usage
  console.log('\nMethod Usage:');
  const methodCounts = results.reduce((acc, r) => {
    acc[r.method] = (acc[r.method] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  Object.entries(methodCounts).forEach(([method, count]) => {
    console.log(`  ${method}: ${count} tests`);
  });
  
  // Failed tests details
  if (failedTests > 0) {
    console.log('\nFailed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`\n  Photo: ${r.photo}`);
      console.log(`  Category: ${r.category}`);
      console.log(`  Expected: ${r.expectedSeverity}, ${r.expectedRange}`);
      console.log(`  Actual: ${r.actualSeverity}, ${r.actualDamage}%`);
      console.log(`  Airbag Match: ${r.airbagMatch ? '✅' : '❌'}`);
      console.log(`  Total Loss Match: ${r.totalLossMatch ? '✅' : '❌'}`);
    });
  }
  
  // Requirements validation
  console.log('\n' + '='.repeat(80));
  console.log('REQUIREMENTS VALIDATION');
  console.log('='.repeat(80));
  
  const undamagedResults = results.filter(r => r.category === 'undamaged');
  const damagedResults = results.filter(r => r.category !== 'undamaged');
  const airbagResults = results.filter(r => r.category === 'airbag-deployed' || r.category === 'high-damage');
  const totalLossResults = results.filter(r => r.category === 'total-loss');
  
  console.log(`\n✅ Requirement 8.1: Tested with ${damagedResults.length} damaged vehicle photos (min 10)`);
  console.log(`✅ Requirement 8.3: Tested with ${undamagedResults.length} undamaged vehicle photos (min 3)`);
  console.log(`✅ Requirement 8.5: Tested varying damage severity levels`);
  console.log(`✅ Requirement 8.6: Tested ${airbagResults.length} photos with airbag deployment (min 2)`);
  console.log(`✅ Requirement 8.7: Tested ${totalLossResults.length} total loss photos (min 2)`);
  
  // Accuracy targets
  console.log('\nAccuracy Targets:');
  console.log(`  Overall Accuracy: ${accuracyRate}% (target: >85%)`);
  
  const falsePositives = undamagedResults.filter(r => r.actualDamage > 30).length;
  const falsePositiveRate = undamagedResults.length > 0 ? (falsePositives / undamagedResults.length * 100).toFixed(1) : '0.0';
  console.log(`  False Positive Rate: ${falsePositiveRate}% (target: <10%)`);
  
  const falseNegatives = damagedResults.filter(r => r.actualDamage < 30).length;
  const falseNegativeRate = damagedResults.length > 0 ? (falseNegatives / damagedResults.length * 100).toFixed(1) : '0.0';
  console.log(`  False Negative Rate: ${falseNegativeRate}% (target: <5%)`);
  
  console.log('\n' + '='.repeat(80));
  console.log(`TEST ${parseFloat(accuracyRate) >= 85 ? 'PASSED' : 'NEEDS REVIEW'}`);
  console.log('='.repeat(80));
}

main().catch(console.error);
