#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/features/internet-search/services/internet-search.service.ts';

// Read the file
let content = readFileSync(filePath, 'utf-8');

// Replace the problematic line
content = content.replace(
  /if \(!searchResults\.success \|\| !searchResults\.organic\) \{/g,
  'if (!searchResults.organic || searchResults.organic.length === 0) {'
);

content = content.replace(
  /throw new Error\(searchResults\.error \|\| 'No search results returned'\);/g,
  "throw new Error('No search results returned');"
);

// Write the file back
writeFileSync(filePath, content, 'utf-8');

console.log('✅ Fixed internet search service');