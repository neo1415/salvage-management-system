import { config } from 'dotenv';
config();

// Test the exact regex patterns from the price extraction service
const USD_PATTERNS = [
  /\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi, 
  /USD\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi
];

function testRegexExtraction() {
  console.log('🧪 Testing Regex Extraction...');
  
  // Test strings from the actual search results
  const testStrings = [
    "Price: Starts at over $600,000. Hybrid Powertrain",
    "Davido just bought a brand new Lamborghini Revuelto worth over $600000.",
    "With a base price of $600,000, the Revuelto's cost soars",
    "valued at $650,000, combines luxury",
    "reportedly worth $1.6 million",
    "The comedian and streamer splashed a whopping $700,000"
  ];
  
  testStrings.forEach((text, index) => {
    console.log(`\n--- Test ${index + 1}: "${text}" ---`);
    
    USD_PATTERNS.forEach((pattern, patternIndex) => {
      // Reset regex lastIndex
      pattern.lastIndex = 0;
      
      let match;
      while ((match = pattern.exec(text)) !== null) {
        console.log(`Pattern ${patternIndex + 1} found: "${match[0]}" -> extracted: "${match[1]}"`);
        
        // Parse the extracted value
        const extractedValue = parseFloat(match[1].replace(/,/g, ''));
        console.log(`  Parsed value: ${extractedValue}`);
        console.log(`  Converted to NGN: ₦${(extractedValue * 1600).toLocaleString()}`);
      }
    });
  });
  
  // Test the specific problematic case
  console.log('\n🔍 Testing specific problematic case...');
  const problematicText = "Price: Starts at over $600,000. Hybrid Powertrain: Combines a V12 engine with three electric motors, producing 1001 hp. • Performance: 0-60 mph ...";
  
  console.log(`Text: "${problematicText}"`);
  
  USD_PATTERNS.forEach((pattern, patternIndex) => {
    pattern.lastIndex = 0;
    const matches = [];
    let match;
    
    while ((match = pattern.exec(problematicText)) !== null) {
      matches.push({
        fullMatch: match[0],
        extracted: match[1],
        index: match.index
      });
    }
    
    console.log(`\nPattern ${patternIndex + 1}: ${pattern}`);
    console.log(`Matches found: ${matches.length}`);
    matches.forEach((m, i) => {
      console.log(`  ${i + 1}. "${m.fullMatch}" at index ${m.index} -> "${m.extracted}"`);
    });
  });
}

testRegexExtraction();