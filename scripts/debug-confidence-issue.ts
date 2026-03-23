#!/usr/bin/env tsx

/**
 * Debug script to isolate the confidence calculation issue
 */

// Mock vision results to test confidence calculation
const mockVisionResults = {
  labels: [{ description: 'Test', score: 0.8 }],
  totalConfidence: 0.8 // This should be a decimal (0-1)
};

console.log('🔍 Testing confidence calculation...');
console.log('Input totalConfidence:', mockVisionResults.totalConfidence);

// Test the calculation that should happen
const damageDetection1 = Math.round(mockVisionResults.totalConfidence * 100);
console.log('With multiplication by 100:', damageDetection1);

const damageDetection2 = Math.round(mockVisionResults.totalConfidence);
console.log('Without multiplication by 100:', damageDetection2);

// Test with a high confidence value that might be causing the issue
const highConfidenceResults = {
  labels: [{ description: 'Test', score: 0.95 }],
  totalConfidence: 25.33 // This might be the issue - already a percentage
};

console.log('\n🔍 Testing with high confidence value...');
console.log('Input totalConfidence:', highConfidenceResults.totalConfidence);

const damageDetection3 = Math.round(highConfidenceResults.totalConfidence * 100);
console.log('With multiplication by 100:', damageDetection3);

const damageDetection4 = Math.round(highConfidenceResults.totalConfidence);
console.log('Without multiplication by 100:', damageDetection4);