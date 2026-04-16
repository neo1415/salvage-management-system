/**
 * Script to fix all auth imports in intelligence API routes
 * Replaces getServerSession(authOptions) with auth()
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const intelligenceApiDir = 'src/app/api/intelligence';

function getAllFiles(dir: string, files: string[] = []): string[] {
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      getAllFiles(fullPath, files);
    } else if (item === 'route.ts') {
      files.push(fullPath);
    }
  }
  
  return files;
}

function fixAuthImports(filePath: string): boolean {
  let content = readFileSync(filePath, 'utf-8');
  let modified = false;
  
  // Check if file uses getServerSession
  if (content.includes('getServerSession')) {
    console.log(`Fixing: ${filePath}`);
    
    // Remove getServerSession import
    content = content.replace(
      /import\s+{\s*getServerSession\s*}\s+from\s+['"]next-auth['"];?\s*\n/g,
      ''
    );
    
    // Remove authOptions import
    content = content.replace(
      /import\s+{\s*authOptions\s*}\s+from\s+['"]@\/lib\/auth(?:\/config)?['"];?\s*\n/g,
      ''
    );
    
    // Add auth import if not present
    if (!content.includes("import { auth }")) {
      // Find the first import statement and add after it
      const firstImportMatch = content.match(/^import\s+.*?from\s+['"].*?['"];?\s*$/m);
      if (firstImportMatch) {
        const insertIndex = content.indexOf(firstImportMatch[0]) + firstImportMatch[0].length;
        content = content.slice(0, insertIndex) + '\nimport { auth } from \'@/lib/auth\';' + content.slice(insertIndex);
      }
    }
    
    // Replace getServerSession(authOptions) with auth()
    content = content.replace(
      /const\s+session\s*=\s*await\s+getServerSession\(authOptions\);?/g,
      'const session = await auth();'
    );
    
    writeFileSync(filePath, content, 'utf-8');
    modified = true;
    console.log(`✓ Fixed: ${filePath}`);
  }
  
  return modified;
}

// Main execution
console.log('Starting auth import fixes...\n');

const files = getAllFiles(intelligenceApiDir);
console.log(`Found ${files.length} route files\n`);

let fixedCount = 0;
for (const file of files) {
  if (fixAuthImports(file)) {
    fixedCount++;
  }
}

console.log(`\n✓ Fixed ${fixedCount} files`);
console.log(`✓ ${files.length - fixedCount} files already correct`);
