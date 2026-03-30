/**
 * Visual Test: Gemini Damage Display Component
 * 
 * This script generates sample data to visually test the GeminiDamageDisplay component
 * with various scenarios (complete data, partial data, missing data).
 * 
 * Run with: npx tsx scripts/test-gemini-display-visual.tsx
 */

interface ItemDetails {
  detectedMake?: string;
  detectedModel?: string;
  detectedYear?: string;
  color?: string;
  trim?: string;
  bodyStyle?: string;
  storage?: string;
  overallCondition?: string;
  notes?: string;
}

interface DamagedPart {
  part: string;
  severity: 'minor' | 'moderate' | 'severe';
  confidence: number;
}

interface TestCase {
  name: string;
  itemDetails?: ItemDetails;
  damagedParts?: DamagedPart[];
  summary?: string;
  expectedBehavior: string;
}

const testCases: TestCase[] = [
  {
    name: 'Complete Vehicle Data',
    itemDetails: {
      detectedMake: 'Toyota',
      detectedModel: 'Camry',
      detectedYear: '2020',
      color: 'White',
      trim: 'SE',
      bodyStyle: 'Sedan',
      overallCondition: 'Good',
      notes: 'Well-maintained vehicle with minor cosmetic damage',
    },
    damagedParts: [
      { part: 'driver front door', severity: 'severe', confidence: 90 },
      { part: 'front bumper', severity: 'moderate', confidence: 85 },
      { part: 'passenger side mirror', severity: 'minor', confidence: 95 },
    ],
    summary: 'Severe damage to driver front door with deployed airbag. Front bumper and passenger side mirror also damaged. Vehicle is repairable but requires significant work.',
    expectedBehavior: 'Should display all sections: Item Details, Damaged Parts, and Summary',
  },
  {
    name: 'Electronics Data',
    itemDetails: {
      detectedMake: 'Apple',
      detectedModel: 'iPhone 13 Pro',
      detectedYear: '2021',
      color: 'Graphite',
      storage: '256GB',
      overallCondition: 'Fair',
    },
    damagedParts: [
      { part: 'front screen glass', severity: 'moderate', confidence: 90 },
      { part: 'rear camera lens', severity: 'minor', confidence: 85 },
    ],
    summary: 'Cracked front screen glass with functional LCD. Minor scratch on rear camera lens. Device is functional and repairable.',
    expectedBehavior: 'Should display electronics-specific fields (storage) and all sections',
  },
  {
    name: 'Partial Data - No Item Details',
    itemDetails: undefined,
    damagedParts: [
      { part: 'front bumper', severity: 'moderate', confidence: 80 },
      { part: 'hood', severity: 'minor', confidence: 75 },
    ],
    summary: 'Front-end damage with moderate impact to bumper and minor hood damage.',
    expectedBehavior: 'Should display Damaged Parts and Summary only (no Item Details section)',
  },
  {
    name: 'Partial Data - No Damaged Parts',
    itemDetails: {
      detectedMake: 'Mercedes-Benz',
      detectedModel: 'GLE-Class',
      detectedYear: '2021',
      color: 'Black',
      bodyStyle: 'SUV',
      overallCondition: 'Excellent',
    },
    damagedParts: [],
    summary: 'Vehicle appears to be in excellent condition with no visible damage.',
    expectedBehavior: 'Should display Item Details and Summary only (no Damaged Parts section)',
  },
  {
    name: 'Partial Data - No Summary',
    itemDetails: {
      detectedMake: 'Honda',
      detectedModel: 'Accord',
      detectedYear: '2019',
      overallCondition: 'Fair',
    },
    damagedParts: [
      { part: 'rear bumper', severity: 'severe', confidence: 88 },
    ],
    summary: undefined,
    expectedBehavior: 'Should display Item Details and Damaged Parts only (no Summary section)',
  },
  {
    name: 'Minimal Data',
    itemDetails: {
      detectedMake: 'Toyota',
      detectedModel: 'Corolla',
    },
    damagedParts: [
      { part: 'front door', severity: 'minor', confidence: 70 },
    ],
    summary: undefined,
    expectedBehavior: 'Should display minimal Item Details and Damaged Parts',
  },
  {
    name: 'Empty Data',
    itemDetails: undefined,
    damagedParts: [],
    summary: undefined,
    expectedBehavior: 'Should return null (not render anything)',
  },
  {
    name: 'Vehicle Mismatch Warning',
    itemDetails: {
      detectedMake: 'Mercedes-Benz',
      detectedModel: 'GLE-Class',
      detectedYear: '2016',
      color: 'White',
      bodyStyle: 'SUV',
      overallCondition: 'Fair',
      notes: 'Vehicle in photos appears to be a 2016 Mercedes-Benz GLE, which differs from the provided information (2021 Toyota Camry). Please verify vehicle information with the claimant.',
    },
    damagedParts: [
      { part: 'front bumper', severity: 'severe', confidence: 92 },
      { part: 'rear quarter panel', severity: 'moderate', confidence: 88 },
    ],
    summary: 'Significant front and rear damage. Front bumper requires replacement. Rear quarter panel has moderate damage.',
    expectedBehavior: 'Should display warning note about vehicle mismatch',
  },
];

function formatTestCase(testCase: TestCase): string {
  let output = `\n${'='.repeat(80)}\n`;
  output += `Test Case: ${testCase.name}\n`;
  output += `${'='.repeat(80)}\n\n`;

  output += `Expected Behavior:\n  ${testCase.expectedBehavior}\n\n`;

  // Item Details
  if (testCase.itemDetails && Object.keys(testCase.itemDetails).length > 0) {
    output += `📋 Item Details:\n`;
    if (testCase.itemDetails.detectedMake) output += `  Make: ${testCase.itemDetails.detectedMake}\n`;
    if (testCase.itemDetails.detectedModel) output += `  Model: ${testCase.itemDetails.detectedModel}\n`;
    if (testCase.itemDetails.detectedYear) output += `  Year: ${testCase.itemDetails.detectedYear}\n`;
    if (testCase.itemDetails.color) output += `  Color: ${testCase.itemDetails.color}\n`;
    if (testCase.itemDetails.trim) output += `  Trim: ${testCase.itemDetails.trim}\n`;
    if (testCase.itemDetails.bodyStyle) output += `  Body Style: ${testCase.itemDetails.bodyStyle}\n`;
    if (testCase.itemDetails.storage) output += `  Storage: ${testCase.itemDetails.storage}\n`;
    if (testCase.itemDetails.overallCondition) output += `  Overall Condition: ${testCase.itemDetails.overallCondition}\n`;
    if (testCase.itemDetails.notes) output += `  Notes: ${testCase.itemDetails.notes}\n`;
    output += '\n';
  } else {
    output += `📋 Item Details: (none)\n\n`;
  }

  // Damaged Parts
  if (testCase.damagedParts && testCase.damagedParts.length > 0) {
    output += `🔧 Damaged Parts (${testCase.damagedParts.length}):\n`;
    testCase.damagedParts.forEach((part, index) => {
      const severityEmoji = part.severity === 'severe' ? '🔴' : part.severity === 'moderate' ? '🟠' : '🟡';
      output += `  ${index + 1}. ${part.part}\n`;
      output += `     ${severityEmoji} Severity: ${part.severity.toUpperCase()}\n`;
      output += `     Confidence: ${part.confidence}%\n`;
    });
    output += '\n';
  } else {
    output += `🔧 Damaged Parts: (none)\n\n`;
  }

  // Summary
  if (testCase.summary) {
    output += `📝 Summary:\n  ${testCase.summary}\n\n`;
  } else {
    output += `📝 Summary: (none)\n\n`;
  }

  return output;
}

function main() {
  console.log('\n🎨 Visual Test: Gemini Damage Display Component\n');
  console.log('This test generates sample data to verify the component displays correctly');
  console.log('with various scenarios (complete data, partial data, missing data).\n');

  testCases.forEach(testCase => {
    console.log(formatTestCase(testCase));
  });

  console.log('='.repeat(80));
  console.log('\n✅ Test data generated successfully!\n');
  console.log('To visually test the component:');
  console.log('  1. Copy the test data above');
  console.log('  2. Navigate to any page using GeminiDamageDisplay');
  console.log('  3. Use browser dev tools to modify the aiAssessment data');
  console.log('  4. Verify the component displays correctly for each scenario\n');
  console.log('Pages to test:');
  console.log('  - Vendor Auction Details: /vendor/auctions/[id]');
  console.log('  - Manager Approvals: /manager/approvals');
  console.log('  - Adjuster Case Details: /adjuster/cases/[id]\n');
}

main();
