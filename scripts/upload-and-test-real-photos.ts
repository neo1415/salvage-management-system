/**
 * Upload Test Photos to Cloudinary and Test with Real Gemini API
 * 
 * This script:
 * 1. Uploads all vehicle test photos to Cloudinary
 * 2. Tests them with the real Gemini API
 * 3. Validates accuracy against expected results
 * 4. Generates a comprehensive test report
 */

import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { assessDamage } from '@/features/cases/services/ai-assessment.service';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface TestPhoto {
  category: string;
  filename: string;
  localPath: string;
  cloudinaryUrl?: string;
  expectedDamaged: boolean;
  expectedSeverity?: 'minor' | 'moderate' | 'severe';
  expectedAirbag?: boolean;
  expectedTotalLoss?: boolean;
}

interface TestResult {
  photo: TestPhoto;
  result: any;
  passed: boolean;
  errors: string[];
}

const TEST_CATEGORIES = [
  {
    folder: 'Toyota camry 2021-no-damage',
    expectedDamaged: false,
    expectedSeverity: 'minor' as const,
  },
  {
    folder: 'light-severity',
    expectedDamaged: true,
    expectedSeverity: 'minor' as const,
  },
  {
    folder: 'moderate-severity',
    expectedDamaged: true,
    expectedSeverity: 'moderate' as const,
  },
  {
    folder: 'Toyota-camry-2021-high-severity',
    expectedDamaged: true,
    expectedSeverity: 'severe' as const,
  },
  {
    folder: 'airbags-deployed',
    expectedDamaged: true,
    expectedAirbag: true,
  },
  {
    folder: 'Totalled',
    expectedDamaged: true,
    expectedTotalLoss: true,
  },
];

async function uploadPhotoToCloudinary(localPath: string, filename: string): Promise<string> {
  try {
    console.log(`Uploading ${filename}...`);
    
    const result = await cloudinary.uploader.upload(localPath, {
      folder: 'gemini-test-photos',
      public_id: filename.replace(/\.[^/.]+$/, ''), // Remove extension
      resource_type: 'image',
      overwrite: true,
    });

    console.log(`✓ Uploaded: ${result.secure_url}`);
    return result.secure_url;
  } catch (error) {
    console.error(`✗ Failed to upload ${filename}:`, error);
    throw error;
  }
}

async function collectTestPhotos(): Promise<TestPhoto[]> {
  const photos: TestPhoto[] = [];
  const galleryPath = join(process.cwd(), '.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery');

  for (const category of TEST_CATEGORIES) {
    const categoryPath = join(galleryPath, category.folder);
    
    try {
      const files = await readdir(categoryPath);
      const imageFiles = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

      for (const file of imageFiles) {
        photos.push({
          category: category.folder,
          filename: file,
          localPath: join(categoryPath, file),
          expectedDamaged: category.expectedDamaged,
          expectedSeverity: category.expectedSeverity,
          expectedAirbag: category.expectedAirbag,
          expectedTotalLoss: category.expectedTotalLoss,
        });
      }
    } catch (error) {
      console.error(`Error reading category ${category.folder}:`, error);
    }
  }

  return photos;
}

async function testPhotoWithGemini(photo: TestPhoto): Promise<TestResult> {
  const errors: string[] = [];
  let passed = true;

  try {
    console.log(`\nTesting: ${photo.category}/${photo.filename}`);
    
    if (!photo.cloudinaryUrl) {
      throw new Error('Photo not uploaded to Cloudinary');
    }

    // Test with Gemini
    const result = await assessDamage(
      [photo.cloudinaryUrl],
      50000, // Market value
      {
        make: 'Toyota',
        model: 'Camry',
        year: 2021,
      }
    );

    console.log(`Method used: ${result.method}`);
    console.log(`Damage percentage: ${result.damagePercentage}%`);
    console.log(`Severity: ${result.damageSeverity}`);
    
    if (result.detailedScores) {
      console.log('Detailed scores:', result.detailedScores);
    }
    
    if (result.airbagDeployed !== undefined) {
      console.log(`Airbag deployed: ${result.airbagDeployed}`);
    }
    
    if (result.totalLoss !== undefined) {
      console.log(`Total loss: ${result.totalLoss}`);
    }

    // Validate results
    if (photo.expectedDamaged) {
      // For damaged vehicles, at least one score should be > 30
      const hasHighScore = result.detailedScores 
        ? Object.values(result.detailedScores).some(score => score > 30)
        : result.damagePercentage > 30;
      
      if (!hasHighScore) {
        errors.push(`Expected damage scores > 30, but all scores are low`);
        passed = false;
      }
    } else {
      // For undamaged vehicles, all scores should be < 30
      const hasHighScore = result.detailedScores
        ? Object.values(result.detailedScores).some(score => score > 30)
        : result.damagePercentage > 30;
      
      if (hasHighScore) {
        errors.push(`Expected all scores < 30 for undamaged vehicle, but found high scores`);
        passed = false;
      }
    }

    // Validate severity
    if (photo.expectedSeverity && result.damageSeverity !== photo.expectedSeverity) {
      errors.push(`Expected severity '${photo.expectedSeverity}', got '${result.damageSeverity}'`);
      // Don't fail on severity mismatch, just warn
    }

    // Validate airbag detection
    if (photo.expectedAirbag !== undefined && result.airbagDeployed !== photo.expectedAirbag) {
      errors.push(`Expected airbagDeployed=${photo.expectedAirbag}, got ${result.airbagDeployed}`);
      passed = false;
    }

    // Validate total loss detection
    if (photo.expectedTotalLoss !== undefined && result.totalLoss !== photo.expectedTotalLoss) {
      errors.push(`Expected totalLoss=${photo.expectedTotalLoss}, got ${result.totalLoss}`);
      passed = false;
    }

    if (passed) {
      console.log('✓ PASSED');
    } else {
      console.log('✗ FAILED:', errors.join(', '));
    }

    return {
      photo,
      result,
      passed,
      errors,
    };
  } catch (error) {
    console.error('✗ ERROR:', error);
    return {
      photo,
      result: null,
      passed: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function generateReport(results: TestResult[]) {
  console.log('\n' + '='.repeat(80));
  console.log('TEST REPORT');
  console.log('='.repeat(80));

  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;
  const accuracy = (passedTests / totalTests) * 100;

  console.log(`\nTotal Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Accuracy: ${accuracy.toFixed(2)}%`);

  // Group by category
  const byCategory = results.reduce((acc, r) => {
    if (!acc[r.photo.category]) {
      acc[r.photo.category] = [];
    }
    acc[r.photo.category].push(r);
    return acc;
  }, {} as Record<string, TestResult[]>);

  console.log('\n' + '-'.repeat(80));
  console.log('RESULTS BY CATEGORY');
  console.log('-'.repeat(80));

  for (const [category, categoryResults] of Object.entries(byCategory)) {
    const categoryPassed = categoryResults.filter(r => r.passed).length;
    const categoryTotal = categoryResults.length;
    const categoryAccuracy = (categoryPassed / categoryTotal) * 100;

    console.log(`\n${category}: ${categoryPassed}/${categoryTotal} (${categoryAccuracy.toFixed(2)}%)`);
    
    for (const result of categoryResults) {
      const status = result.passed ? '✓' : '✗';
      console.log(`  ${status} ${result.photo.filename}`);
      
      if (!result.passed && result.errors.length > 0) {
        result.errors.forEach(error => {
          console.log(`      - ${error}`);
        });
      }
    }
  }

  // False positives and false negatives
  const falsePositives = results.filter(r => 
    !r.photo.expectedDamaged && r.result && r.result.damagePercentage > 30
  ).length;
  
  const falseNegatives = results.filter(r => 
    r.photo.expectedDamaged && r.result && r.result.damagePercentage <= 30
  ).length;

  const undamagedTests = results.filter(r => !r.photo.expectedDamaged).length;
  const damagedTests = results.filter(r => r.photo.expectedDamaged).length;

  const falsePositiveRate = undamagedTests > 0 ? (falsePositives / undamagedTests) * 100 : 0;
  const falseNegativeRate = damagedTests > 0 ? (falseNegatives / damagedTests) * 100 : 0;

  console.log('\n' + '-'.repeat(80));
  console.log('ACCURACY METRICS');
  console.log('-'.repeat(80));
  console.log(`False Positive Rate: ${falsePositiveRate.toFixed(2)}% (${falsePositives}/${undamagedTests})`);
  console.log(`False Negative Rate: ${falseNegativeRate.toFixed(2)}% (${falseNegatives}/${damagedTests})`);

  // Check if targets met
  console.log('\n' + '-'.repeat(80));
  console.log('TARGET VALIDATION');
  console.log('-'.repeat(80));
  
  const targets = {
    'Overall Accuracy > 85%': accuracy > 85,
    'False Positive Rate < 10%': falsePositiveRate < 10,
    'False Negative Rate < 5%': falseNegativeRate < 5,
  };

  for (const [target, met] of Object.entries(targets)) {
    const status = met ? '✓' : '✗';
    console.log(`${status} ${target}`);
  }

  const allTargetsMet = Object.values(targets).every(v => v);
  
  console.log('\n' + '='.repeat(80));
  if (allTargetsMet) {
    console.log('✓ ALL ACCURACY TARGETS MET');
  } else {
    console.log('✗ SOME ACCURACY TARGETS NOT MET');
  }
  console.log('='.repeat(80));

  return {
    totalTests,
    passedTests,
    failedTests,
    accuracy,
    falsePositiveRate,
    falseNegativeRate,
    allTargetsMet,
  };
}

async function main() {
  console.log('='.repeat(80));
  console.log('GEMINI REAL PHOTO TESTING');
  console.log('='.repeat(80));

  // Check for API keys
  if (!process.env.GEMINI_API_KEY) {
    console.error('✗ GEMINI_API_KEY not configured in .env');
    process.exit(1);
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('✗ Cloudinary credentials not configured in .env');
    process.exit(1);
  }

  console.log('✓ API keys configured');

  // Step 1: Collect test photos
  console.log('\n' + '-'.repeat(80));
  console.log('STEP 1: Collecting test photos');
  console.log('-'.repeat(80));
  
  const photos = await collectTestPhotos();
  console.log(`Found ${photos.length} test photos across ${TEST_CATEGORIES.length} categories`);

  // Step 2: Upload to Cloudinary
  console.log('\n' + '-'.repeat(80));
  console.log('STEP 2: Uploading photos to Cloudinary');
  console.log('-'.repeat(80));

  for (const photo of photos) {
    try {
      photo.cloudinaryUrl = await uploadPhotoToCloudinary(photo.localPath, photo.filename);
    } catch (error) {
      console.error(`Failed to upload ${photo.filename}, skipping...`);
    }
  }

  const uploadedPhotos = photos.filter(p => p.cloudinaryUrl);
  console.log(`\n✓ Uploaded ${uploadedPhotos.length}/${photos.length} photos`);

  // Step 3: Test with Gemini
  console.log('\n' + '-'.repeat(80));
  console.log('STEP 3: Testing with Gemini API');
  console.log('-'.repeat(80));

  const results: TestResult[] = [];

  for (const photo of uploadedPhotos) {
    const result = await testPhotoWithGemini(photo);
    results.push(result);
    
    // Add delay to respect rate limits (10 requests/minute)
    await new Promise(resolve => setTimeout(resolve, 7000)); // 7 seconds between requests
  }

  // Step 4: Generate report
  const report = generateReport(results);

  // Exit with appropriate code
  process.exit(report.allTargetsMet ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
