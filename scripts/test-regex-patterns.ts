// Test the regex patterns directly
const NAIRA_PATTERNS = [
  // Standard formats: ₦1,000,000 or ₦ 1,000,000
  /₦\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
  
  // NGN format: NGN 1,000,000 or NGN1,000,000
  /NGN\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
  
  // Naira word format: 1,000,000 naira or 1000000 naira
  /([0-9,]+(?:\.[0-9]{1,2})?)\s*naira/gi,
  
  // Million/thousand abbreviations: ₦2.5m, ₦500k, ₦1.2million
  /₦\s*([0-9]+(?:\.[0-9]+)?)\s*([mk]|million|thousand)/gi,
  
  // Number followed by million/thousand naira
  /([0-9]+(?:\.[0-9]+)?)\s*(million|thousand)\s*naira/gi,
  
  // Ranges: ₦1m - ₦2m, ₦500k to ₦800k
  /₦\s*([0-9]+(?:\.[0-9]+)?)\s*([mk]|million|thousand)\s*(?:[-–—to]|and)\s*₦?\s*([0-9]+(?:\.[0-9]+)?)\s*([mk]|million|thousand)?/gi
];

function testRegexPatterns() {
  console.log('🧪 Testing Regex Patterns Directly...');
  
  const testTexts = [
    'The new Lamborghini Revuelto costs ₦960,000 down payment',
    'Brand new Lamborghini Revuelto price is ₦450 million in Nigeria',
    'Lamborghini Revuelto 2023 - ₦450m',
    'Price: ₦450,000,000',
    'Cost: 450 million naira',
    'Price range: ₦400m - ₦500m'
  ];
  
  testTexts.forEach((text, textIndex) => {
    console.log(`\n--- Testing: "${text}" ---`);
    
    NAIRA_PATTERNS.forEach((pattern, patternIndex) => {
      // Reset regex lastIndex
      pattern.lastIndex = 0;
      
      const matches = [];
      let match;
      while ((match = pattern.exec(text)) !== null) {
        matches.push({
          fullMatch: match[0],
          groups: match.slice(1)
        });
      }
      
      if (matches.length > 0) {
        console.log(`  Pattern ${patternIndex + 1} matched:`, matches);
      }
    });
  });
}

testRegexPatterns();