#!/usr/bin/env tsx

/**
 * Debug script to test confidence processing in the enhanced service
 */

// Simulate a Vision API response
const mockVisionAssessment = {
  labels: ['Vehicle', 'Car', 'Automotive'],
  confidenceScore: 85, // This should be a percentage (0-100)
  damagePercentage: 50,
  method: 'vision' as const
};

console.log('🔍 Testing confidence processing...');
console.log('Mock Vision Assessment:', mockVisionAssessment);

// Simulate how the enhanced service processes this
const visionResults = {
  labels: mockVisionAssessment.labels.map(label => ({
    description: label,
    score: mockVisionAssessment.confidenceScore / 100, // Convert to decimal
  })),
  totalConfidence: mockVisionAssessment.confidenceScore / 100, // Convert to decimal
};

console.log('Processed Vision Results:', visionResults);

// Simulate the confidence calculation
const damageDetection1 = Math.round(visionResults.totalConfidence * 100); // OLD (incorrect)
const damageDetection2 = Math.round(visionResults.totalConfidence); // NEW (correct)

console.log('Damage Detection (old method):', damageDetection1);
console.log('Damage Detection (new method):', damageDetection2);

// Test with a high confidence score that might cause the issue
const highConfidenceAssessment = {
  labels: ['Vehicle', 'Car', 'Automotive'],
  confidenceScore: 2533, // This is the problematic value we're seeing
  damagePercentage: 50,
  method: 'vision' as const
};

console.log('\n🔍 Testing with high confidence value...');
console.log('High Confidence Assessment:', highConfidenceAssessment);

const highVisionResults = {
  labels: highConfidenceAssessment.labels.map(label => ({
    description: label,
    score: highConfidenceAssessment.confidenceScore / 100,
  })),
  totalConfidence: highConfidenceAssessment.confidenceScore / 100,
};

console.log('Processed High Vision Results:', highVisionResults);

const highDamageDetection1 = Math.round(highVisionResults.totalConfidence * 100);
const highDamageDetection2 = Math.round(highVisionResults.totalConfidence);

console.log('High Damage Detection (old method):', highDamageDetection1);
console.log('High Damage Detection (new method):', highDamageDetection2);