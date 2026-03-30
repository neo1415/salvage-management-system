/**
 * Test Script for Voice Note Improvements
 * 
 * This script tests the filler word removal functionality
 * Run with: npx tsx scripts/test-voice-note-improvements.ts
 */

/**
 * Comprehensive filler words list for professional transcription cleanup
 */
const FILLER_WORDS_TEST = [
  // Hesitation sounds (most common) - ALWAYS fillers
  'um', 'uh', 'uhm', 'umm', 'er', 'erm', 'ah', 'ahh', 'hmm', 'hm', 'mhm',
  
  // Verbal tics and pause fillers - ALWAYS fillers
  'like', 'you know', 'i mean', 'you know what i mean', 'if you know what i mean',
  
  // Hedge words (uncertainty markers) - ALWAYS fillers
  'sort of', 'kind of', 'kinda', 'sorta', 'basically', 'more or less',
  
  // Discourse markers (conversation flow) - ALWAYS fillers
  'okay', 'ok', 'so', 'well', 'now', 'right', 'alright', 'all right',
  
  // Agreement and acknowledgment sounds - ALWAYS fillers
  'yeah', 'yep', 'yup', 'uh huh', 'mm hmm', 'mmm', 'mhmm',
  
  // Thinking and stalling phrases - ALWAYS fillers
  'let me see', 'let me think', 'lets see', 'you see', 'i guess', 'i suppose',
  
  // Vague expressions - ALWAYS fillers
  'or something', 'or something like that', 'and stuff', 'and things',
  'and all that', 'or whatever', 'whatnot', 'and so on', 'and so forth',
  'et cetera', 'etc',
  
  // Filler phrases (common in casual speech) - ALWAYS fillers
  'at the end of the day', 'believe me', 'trust me', 'to be honest',
  'to tell you the truth', 'as a matter of fact', 'the thing is',
  'the fact of the matter is', 'you know what', 'i mean to say',
  
  // Informal contractions (clean up to formal) - ALWAYS fillers
  'gonna', 'wanna', 'gotta', 'dunno', 'lemme', 'gimme',
  'coulda', 'shoulda', 'woulda', 'hafta', 'oughta',
  
  // Repetitive acknowledgments - ALWAYS fillers
  'oh well', 'oh yeah', 'oh okay', 'oh right', 'oh sure',
  
  // Sentence starters (often unnecessary) - ALWAYS fillers
  'look', 'listen', 'hey', 'man', 'dude', 'guys',
  
  // Thinking sounds - ALWAYS fillers
  'ehh', 'eeh',
  
  // False starts and corrections (common patterns) - ALWAYS fillers
  'i mean like', 'like i said', 'as i said', 'like i mean',
  'you know like', 'i mean you know'
];

/**
 * Remove filler words from transcription text
 */
const removeFillerWordsTest = (text: string): string => {
  let cleaned = text;
  
  // Sort filler words by length (longest first) to handle multi-word phrases correctly
  const sortedFillers = [...FILLER_WORDS_TEST].sort((a, b) => b.length - a.length);
  
  // Create regex pattern for each filler word (case-insensitive, word boundaries)
  sortedFillers.forEach(filler => {
    // Escape special regex characters in the filler word
    const escapedFiller = filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match the filler with optional surrounding punctuation and spaces
    const pattern = new RegExp(`[,\\s]*\\b${escapedFiller}\\b[,\\s]*`, 'gi');
    cleaned = cleaned.replace(pattern, ' ');
  });
  
  // Cleanup punctuation and spacing issues
  cleaned = cleaned
    .replace(/\s+/g, ' ') // Multiple spaces to single space
    .replace(/\s*,\s*,\s*/g, ' ') // Remove double commas with spaces
    .replace(/,\s*,/g, ' ') // Remove double commas
    .replace(/\s*,\s*/g, ' ') // Remove all commas (they're likely orphaned after filler removal)
    .replace(/\s+([.!?])/g, '$1') // Remove space before sentence-ending punctuation
    .replace(/([.!?])\s*([.!?])/g, '$1') // Remove duplicate punctuation
    .replace(/\s+$/gm, '') // Remove trailing spaces on each line
    .trim();
  
  // Capitalize first letter of each sentence
  cleaned = cleaned.replace(/(^|[.!?]\s+)([a-z])/g, (match, separator, letter) => {
    return separator + letter.toUpperCase();
  });
  
  // Capitalize the very first letter if it's lowercase
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  
  return cleaned;
};

// Test case interface
interface VoiceTestCase {
  name: string;
  input: string;
  expected: string;
}

// Test cases
const testCasesVoice: VoiceTestCase[] = [
  {
    name: 'Basic filler words',
    input: 'Um, the vehicle has, like, significant damage to the, uh, front bumper, you know?',
    expected: 'The vehicle has significant damage to the front bumper?'
  },
  {
    name: 'Multiple filler words in sequence',
    input: 'So, um, basically, the car is, like, totally damaged, you know what I mean?',
    expected: 'The car is totally damaged?'
  },
  {
    name: 'Filler words with punctuation',
    input: 'The damage is, um, severe. Like, really bad, you know.',
    expected: 'The damage is severe. Really bad.'
  },
  {
    name: 'No filler words',
    input: 'The vehicle has front bumper damage and needs repair.',
    expected: 'The vehicle has front bumper damage and needs repair.'
  },
  {
    name: 'Case insensitive',
    input: 'UM, the vehicle is LIKE totally damaged, UH, yeah.',
    expected: 'The vehicle is totally damaged.'
  },
  {
    name: 'Filler words at start and end',
    input: 'Um, the vehicle needs repair, you know',
    expected: 'The vehicle needs repair'
  },
  {
    name: 'Complex sentence',
    input: 'So, basically, I mean, the vehicle has, like, front damage, right? And, uh, the bumper is, sort of, crushed, you know?',
    expected: 'The vehicle has front damage? And the bumper is crushed?'
  },
  {
    name: 'Professional language preserved',
    input: 'The vehicle sustained impact damage to the front fascia resulting in structural compromise.',
    expected: 'The vehicle sustained impact damage to the front fascia resulting in structural compromise.'
  }
];

// Run tests
console.log('🧪 Testing Voice Note Filler Word Removal\n');
console.log('='.repeat(80));

let passed = 0;
let failed = 0;

testCasesVoice.forEach((testCase, index) => {
  const result = removeFillerWordsTest(testCase.input);
  const success = result === testCase.expected;
  
  if (success) {
    passed++;
    console.log(`\n✅ Test ${index + 1}: ${testCase.name}`);
  } else {
    failed++;
    console.log(`\n❌ Test ${index + 1}: ${testCase.name}`);
    console.log(`   Input:    "${testCase.input}"`);
    console.log(`   Expected: "${testCase.expected}"`);
    console.log(`   Got:      "${result}"`);
  }
});

console.log('\n' + '='.repeat(80));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCasesVoice.length} tests`);

if (failed === 0) {
  console.log('\n🎉 All tests passed! Filler word removal is working correctly.\n');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Please review the implementation.\n');
  process.exit(1);
}
