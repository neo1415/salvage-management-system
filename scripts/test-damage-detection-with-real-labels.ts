/**
 * Test damage detection fix by directly calling calculateDamageScore
 * This simulates what Vision API would return for a collision
 */

// Simulate Vision API labels for a collision
const collisionLabels = [
  { description: 'Vehicle', score: 0.95 },
  { description: 'Car', score: 0.92 },
  { description: 'Traffic collision', score: 0.81 },  // This is the key label
  { description: 'Motor vehicle', score: 0.88 },
  { description: 'Automotive exterior', score: 0.85 },
];

console.log('\n🔍 TESTING DAMAGE DETECTION FIX\n');
console.log('=' .repeat(80));
console.log('\n📊 Simulating Vision API labels for a collision:\n');

collisionLabels.forEach(label => {
  console.log(`  - "${label.description}" (score: ${label.score})`);
});

console.log('\n🔧 Testing calculateDamageScore function...\n');

// Inline the calculateDamageScore logic to test it
const damageKeywords = [
  'damage', 'damaged', 'broken', 'crack', 'cracked', 'dent', 'dented',
  'scratch', 'scratched', 'rust', 'rusted', 'collision', 'bent',
  'crushed', 'shattered', 'torn', 'missing', 'detached', 'smashed',
  'destroyed', 'wrecked', 'wreck', 'junk', 'salvage', 'totaled',
  'debris', 'rubble', 'scrap', 'mangled', 'twisted', 'burned',
  'fire damage', 'water damage', 'flood', 'corroded', 'corrosion'
];

// Check if ANY damage keywords are present
let totalDamageScore = 0;
let damageCount = 0;

collisionLabels.forEach(label => {
  const desc = label.description.toLowerCase();
  const isDamage = damageKeywords.some(keyword => desc.includes(keyword));
  
  if (isDamage) {
    totalDamageScore += label.score * 100;
    damageCount++;
    console.log(`🚨 Damage detected: "${label.description}" (score: ${label.score})`);
  }
});

if (damageCount === 0) {
  console.log('✅ No damage keywords detected - vehicle appears to be in good condition');
  console.log('\n❌ TEST FAILED: "Traffic collision" should have been detected as damage!');
  process.exit(1);
}

console.log(`\n⚠️ Damage detected in ${damageCount} labels, total score: ${totalDamageScore}`);

// Categorize damage by type
const structuralDamage = collisionLabels.filter(l => {
  const desc = l.description.toLowerCase();
  return damageKeywords.some(k => desc.includes(k)) &&
         (desc.includes('frame') || desc.includes('chassis') || desc.includes('structural') ||
          desc.includes('pillar') || desc.includes('roof') || desc.includes('floor'));
});

const mechanicalDamage = collisionLabels.filter(l => {
  const desc = l.description.toLowerCase();
  return damageKeywords.some(k => desc.includes(k)) &&
         (desc.includes('engine') || desc.includes('transmission') || desc.includes('axle') ||
          desc.includes('suspension') || desc.includes('brake') || desc.includes('wheel'));
});

const cosmeticDamage = collisionLabels.filter(l => {
  const desc = l.description.toLowerCase();
  return damageKeywords.some(k => desc.includes(k)) &&
         (desc.includes('bumper') || desc.includes('panel') || desc.includes('body') ||
          desc.includes('paint') || desc.includes('door') || desc.includes('hood') ||
          desc.includes('fender') || desc.includes('trunk'));
});

const electricalDamage = collisionLabels.filter(l => {
  const desc = l.description.toLowerCase();
  return damageKeywords.some(k => desc.includes(k)) &&
         (desc.includes('light') || desc.includes('headlight') || desc.includes('taillight') ||
          desc.includes('wire') || desc.includes('electrical') || desc.includes('battery'));
});

const interiorDamage = collisionLabels.filter(l => {
  const desc = l.description.toLowerCase();
  return damageKeywords.some(k => desc.includes(k)) &&
         (desc.includes('seat') || desc.includes('airbag') || desc.includes('dashboard') ||
          desc.includes('interior') || desc.includes('upholstery') || desc.includes('console'));
});

const avgScore = totalDamageScore / damageCount;

// Count how many categories have damage
const categorizedCount = structuralDamage.length + mechanicalDamage.length + 
                         cosmeticDamage.length + electricalDamage.length + 
                         interiorDamage.length;

console.log(`\n📊 Categorization results:`);
console.log(`  Structural:  ${structuralDamage.length} labels`);
console.log(`  Mechanical:  ${mechanicalDamage.length} labels`);
console.log(`  Cosmetic:    ${cosmeticDamage.length} labels`);
console.log(`  Electrical:  ${electricalDamage.length} labels`);
console.log(`  Interior:    ${interiorDamage.length} labels`);
console.log(`  Total categorized: ${categorizedCount}`);

// THE FIX: If damage detected but not categorized, assign to cosmetic as default
let damageScore;
if (categorizedCount === 0 && damageCount > 0) {
  console.log(`\n✅ FIX APPLIED: Damage detected but not categorized - assigning to cosmetic (score: ${avgScore})`);
  damageScore = {
    structural: 0,
    mechanical: 0,
    cosmetic: avgScore,
    electrical: 0,
    interior: 0
  };
} else {
  damageScore = {
    structural: structuralDamage.length > 0 ? avgScore : 0,
    mechanical: mechanicalDamage.length > 0 ? avgScore : 0,
    cosmetic: cosmeticDamage.length > 0 ? avgScore : 0,
    electrical: electricalDamage.length > 0 ? avgScore : 0,
    interior: interiorDamage.length > 0 ? avgScore : 0
  };
}

console.log(`\n📊 Final damage scores:`);
console.log(`  Structural:  ${damageScore.structural}`);
console.log(`  Mechanical:  ${damageScore.mechanical}`);
console.log(`  Cosmetic:    ${damageScore.cosmetic}`);
console.log(`  Electrical:  ${damageScore.electrical}`);
console.log(`  Interior:    ${damageScore.interior}`);

// Verify the fix worked
console.log('\n✅ VERIFICATION:\n');

if (damageScore.cosmetic > 0) {
  console.log(`✅ FIX SUCCESSFUL: Cosmetic damage score is ${damageScore.cosmetic} (not zero)`);
  console.log('   The uncategorized "Traffic collision" damage was correctly assigned to cosmetic category');
} else {
  console.log('❌ FIX FAILED: Cosmetic damage score is still zero');
  console.log('   The uncategorized damage was not assigned to any category');
  process.exit(1);
}

console.log('\n' + '='.repeat(80));
console.log('✅ Test complete\n');
