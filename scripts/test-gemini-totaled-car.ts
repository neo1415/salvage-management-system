/**
 * Test Gemini damage detection with totaled car images
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';

async function testGeminiWithTotaledCar() {
  console.log('🧪 Testing Gemini Damage Detection with Totaled Car Images\n');

  try {
    // Import Gemini service
    const { detectDamageWithGemini } = await import('@/lib/integrations/gemini-damage-detection');

    // Path to totaled car images
    const totaledDir = '.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Totalled';
    
    // Get all image files
    const files = fs.readdirSync(totaledDir);
    const imageFiles = files.filter(f => 
      f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.avif')
    );

    console.log(`Found ${imageFiles.length} totaled car images:\n`);
    imageFiles.forEach((file, i) => {
      console.log(`  ${i + 1}. ${file}`);
    });
    console.log();

    // Test with first 4 images (or all if less than 4)
    const testImages = imageFiles.slice(0, Math.min(4, imageFiles.length));
    
    console.log(`Testing with ${testImages.length} images...\n`);

    // Convert images to base64
    const base64Images = testImages.map(file => {
      const filePath = path.join(totaledDir, file);
      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString('base64');
      
      // Determine MIME type
      let mimeType = 'image/jpeg';
      if (file.endsWith('.png')) mimeType = 'image/png';
      if (file.endsWith('.avif')) mimeType = 'image/avif';
      
      return {
        data: base64,
        mimeType,
        filename: file
      };
    });

    console.log('📸 Images prepared:');
    base64Images.forEach((img, i) => {
      const sizeKB = Math.round(img.data.length * 0.75 / 1024); // Approximate size
      console.log(`  ${i + 1}. ${img.filename} (${img.mimeType}, ~${sizeKB}KB)`);
    });
    console.log();

    // Call Gemini
    console.log('🤖 Calling Gemini API...\n');
    const startTime = Date.now();
    
    const result = await detectDamageWithGemini(
      base64Images.map(img => img.data),
      base64Images.map(img => img.mimeType)
    );
    
    const responseTime = Date.now() - startTime;

    // Display results
    console.log('📊 GEMINI RESPONSE:');
    console.log('===================\n');
    console.log(`Response Time: ${responseTime}ms\n`);
    
    console.log('Overall Assessment:');
    console.log(`  Severity: ${result.overallSeverity}`);
    console.log(`  Estimated Repair Cost: ₦${result.estimatedRepairCost.toLocaleString()}`);
    console.log(`  Is Totaled: ${result.isTotaled ? 'YES' : 'NO'}`);
    console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log();

    console.log('Damaged Components:');
    if (result.damagedComponents.length === 0) {
      console.log('  (none detected)');
    } else {
      result.damagedComponents.forEach((component, i) => {
        console.log(`  ${i + 1}. ${component.component}`);
        console.log(`     - Severity: ${component.severity}`);
        console.log(`     - Repair Cost: ₦${component.repairCost.toLocaleString()}`);
        console.log(`     - Description: ${component.description}`);
      });
    }
    console.log();

    console.log('Explanation:');
    console.log(`  ${result.explanation}`);
    console.log();

    // Analysis
    console.log('🔍 ANALYSIS:');
    console.log('============\n');
    
    if (result.overallSeverity === 'minor') {
      console.log('❌ ISSUE CONFIRMED: Gemini classified totaled car as "minor"');
      console.log('   This is incorrect - the vehicle is clearly totaled.');
      console.log();
      console.log('Possible causes:');
      console.log('  1. Prompt needs improvement to emphasize total loss detection');
      console.log('  2. Image quality or angle not showing full extent of damage');
      console.log('  3. Model needs more context about what constitutes "totaled"');
      console.log('  4. Repair cost threshold for total loss may be too high');
    } else if (result.overallSeverity === 'moderate') {
      console.log('⚠️ PARTIAL ISSUE: Gemini classified totaled car as "moderate"');
      console.log('   This is better than "minor" but still incorrect.');
      console.log('   Expected: "severe" or isTotaled: true');
    } else if (result.overallSeverity === 'severe' || result.isTotaled) {
      console.log('✅ CORRECT: Gemini properly identified severe damage/total loss');
    }
    console.log();

    // Recommendations
    console.log('💡 RECOMMENDATIONS:');
    console.log('===================\n');
    
    if (result.overallSeverity !== 'severe' && !result.isTotaled) {
      console.log('1. Review Gemini prompt in gemini-damage-detection.ts');
      console.log('   - Add explicit total loss criteria');
      console.log('   - Emphasize structural damage indicators');
      console.log('   - Include airbag deployment as critical factor');
      console.log();
      console.log('2. Adjust severity thresholds');
      console.log('   - Current repair cost: ₦' + result.estimatedRepairCost.toLocaleString());
      console.log('   - Consider lowering total loss threshold');
      console.log();
      console.log('3. Test with more images');
      console.log('   - Try different angles of same vehicle');
      console.log('   - Include close-ups of critical damage');
      console.log('   - Test with airbag deployment photos');
    } else {
      console.log('✅ Gemini is working correctly for this test case');
      console.log('   Continue testing with other severity levels');
    }

    console.log('\n✅ Test complete!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

testGeminiWithTotaledCar()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
