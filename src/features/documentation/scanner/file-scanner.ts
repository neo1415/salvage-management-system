/**
 * File System Scanner
 * 
 * Recursively scans directories to discover and categorize source files.
 * This is a READ-ONLY operation that does not modify any files.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  FileEntry,
  FileType,
  ScanOptions,
  FileInventory,
  CategorizedFiles,
} from '../types';

/**
 * Simple glob pattern matcher (supports * and **)
 */
function matchGlob(filePath: string, pattern: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');

  // Convert glob pattern to regex
  let regexPattern = normalizedPattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '___DOUBLESTAR___')
    .replace(/\*/g, '[^/]*')
    .replace(/___DOUBLESTAR___/g, '.*');

  // Add anchors
  regexPattern = '^' + regexPattern + '$';

  const regex = new RegExp(regexPattern);
  return regex.test(normalizedPath);
}

/**
 * Default scan options for production code
 */
export const DEFAULT_SCAN_OPTIONS: ScanOptions = {
  includePatterns: [
    'src/**/*.ts',
    'src/**/*.tsx',
    'src/**/*.js',
    'src/**/*.jsx',
  ],
  excludePatterns: [
    'scripts/**',
    'docs/**',
    'tests/**',
    'test/**',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/build/**',
  ],
  followImports: true,
};

/**
 * Categorize a file based on its path and content
 */
export function categorizeFile(filePath: string): FileType {
  const normalizedPath = filePath.replace(/\\/g, '/');

  // API routes
  if (normalizedPath.includes('/api/') && normalizedPath.includes('/route.')) {
    return 'api-route';
  }

  // Database schemas
  if (normalizedPath.includes('/db/schema/')) {
    return 'schema';
  }

  // Database migrations
  if (normalizedPath.includes('/db/migrations/')) {
    return 'migration';
  }

  // React components (including pages)
  if (
    (normalizedPath.includes('/components/') ||
      normalizedPath.includes('/app/') && normalizedPath.match(/\/page\.(tsx|jsx)$/)) &&
    (normalizedPath.endsWith('.tsx') || normalizedPath.endsWith('.jsx'))
  ) {
    return 'component';
  }

  // Type definitions (check before services since types can be in features/)
  if (
    normalizedPath.match(/\/types\/.*\.(ts|tsx)$/) ||
    normalizedPath.endsWith('.d.ts')
  ) {
    return 'type-definition';
  }

  // Services (feature modules)
  if (
    normalizedPath.includes('/services/') ||
    normalizedPath.includes('/features/')
  ) {
    return 'service';
  }

  // Custom hooks
  if (
    normalizedPath.includes('/hooks/') ||
    normalizedPath.match(/\/use-[a-z-]+\.(ts|tsx)$/)
  ) {
    return 'hook';
  }

  // Configuration files
  if (
    normalizedPath.match(/\/(config|middleware)\.(ts|js)$/) ||
    normalizedPath.endsWith('package.json') ||
    normalizedPath.endsWith('.config.ts') ||
    normalizedPath.endsWith('.config.js')
  ) {
    return 'config';
  }

  // Default to utility
  return 'utility';
}

/**
 * Check if a file path matches any of the patterns
 */
function matchesPatterns(filePath: string, patterns: string[]): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return patterns.some((pattern) => matchGlob(normalizedPath, pattern));
}

/**
 * Check if a file should be included based on scan options
 */
function shouldIncludeFile(
  filePath: string,
  options: ScanOptions
): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Check exclude patterns first
  if (matchesPatterns(normalizedPath, options.excludePatterns)) {
    return false;
  }

  // Check include patterns
  return matchesPatterns(normalizedPath, options.includePatterns);
}

/**
 * Recursively scan a directory and return all matching files
 */
async function scanDirectoryRecursive(
  dirPath: string,
  options: ScanOptions,
  rootPath: string
): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(rootPath, fullPath);

      if (entry.isDirectory()) {
        // Skip excluded directories
        if (!matchesPatterns(relativePath, options.excludePatterns)) {
          const subFiles = await scanDirectoryRecursive(
            fullPath,
            options,
            rootPath
          );
          files.push(...subFiles);
        }
      } else if (entry.isFile()) {
        // Include file if it matches patterns
        if (shouldIncludeFile(relativePath, options)) {
          files.push(relativePath);
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }

  return files;
}

/**
 * Create a FileEntry from a file path
 */
async function createFileEntry(
  filePath: string,
  rootPath: string
): Promise<FileEntry> {
  const fullPath = path.join(rootPath, filePath);
  const stats = await fs.stat(fullPath);

  return {
    path: filePath,
    type: categorizeFile(filePath),
    size: stats.size,
    lastModified: stats.mtime,
    isActive: false, // Will be determined by import tracing
    importedBy: [],
    imports: [],
  };
}

/**
 * Categorize files into different types
 */
function categorizeFiles(files: FileEntry[]): CategorizedFiles {
  const categorized: CategorizedFiles = {
    apiRoutes: [],
    components: [],
    services: [],
    schemas: [],
    migrations: [],
    hooks: [],
    utilities: [],
    configurations: [],
  };

  for (const file of files) {
    switch (file.type) {
      case 'api-route':
        categorized.apiRoutes.push(file);
        break;
      case 'component':
        categorized.components.push(file);
        break;
      case 'service':
        categorized.services.push(file);
        break;
      case 'schema':
        categorized.schemas.push(file);
        break;
      case 'migration':
        categorized.migrations.push(file);
        break;
      case 'hook':
        categorized.hooks.push(file);
        break;
      case 'config':
        categorized.configurations.push(file);
        break;
      case 'utility':
      case 'type-definition':
        categorized.utilities.push(file);
        break;
    }
  }

  return categorized;
}

/**
 * Main scanner function - scans a directory and returns a file inventory
 */
export async function scanDirectory(
  dirPath: string,
  options: ScanOptions = DEFAULT_SCAN_OPTIONS
): Promise<FileInventory> {
  const rootPath = path.resolve(dirPath);

  // Scan for all matching files
  const filePaths = await scanDirectoryRecursive(rootPath, options, rootPath);

  // Create FileEntry objects
  const fileEntries = await Promise.all(
    filePaths.map((filePath) => createFileEntry(filePath, rootPath))
  );

  // Categorize files
  const categorizedFiles = categorizeFiles(fileEntries);

  // Count files by category
  const productionFiles = fileEntries.length;
  const scriptFiles = 0; // Scripts are excluded by default
  const testFiles = 0; // Tests are excluded by default
  const docFiles = 0; // Docs are excluded by default

  return {
    totalFiles: productionFiles,
    productionFiles,
    scriptFiles,
    testFiles,
    docFiles,
    categorizedFiles,
    activeCodeMap: {}, // Will be populated by import tracing
  };
}

/**
 * Get file statistics from inventory
 */
export function getInventoryStats(inventory: FileInventory): {
  totalFiles: number;
  byType: Record<FileType, number>;
  totalSize: number;
} {
  const byType: Record<FileType, number> = {
    'api-route': inventory.categorizedFiles.apiRoutes.length,
    component: inventory.categorizedFiles.components.length,
    service: inventory.categorizedFiles.services.length,
    schema: inventory.categorizedFiles.schemas.length,
    migration: inventory.categorizedFiles.migrations.length,
    hook: inventory.categorizedFiles.hooks.length,
    utility: inventory.categorizedFiles.utilities.length,
    config: inventory.categorizedFiles.configurations.length,
    'type-definition': 0, // Included in utilities
  };

  const allFiles = [
    ...inventory.categorizedFiles.apiRoutes,
    ...inventory.categorizedFiles.components,
    ...inventory.categorizedFiles.services,
    ...inventory.categorizedFiles.schemas,
    ...inventory.categorizedFiles.migrations,
    ...inventory.categorizedFiles.hooks,
    ...inventory.categorizedFiles.utilities,
    ...inventory.categorizedFiles.configurations,
  ];

  const totalSize = allFiles.reduce((sum, file) => sum + file.size, 0);

  return {
    totalFiles: inventory.totalFiles,
    byType,
    totalSize,
  };
}
