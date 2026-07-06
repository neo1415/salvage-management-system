/**
 * Active Code Detector
 * 
 * Identifies "active" code by tracing import chains from entry points.
 * Files in the import chain are marked as active; files not in the chain
 * are potentially abandoned code.
 */

import type { FileEntry, ActiveCodeMap } from '../types';
import type { DependencyGraph } from './import-graph';
import { getTransitiveDependencies } from './import-graph';

/**
 * Entry point patterns for the application
 */
const ENTRY_POINT_PATTERNS = [
  // Next.js pages (App Router)
  /^src\/app\/.*\/page\.(tsx?|jsx?)$/,
  
  // Next.js layouts
  /^src\/app\/.*\/layout\.(tsx?|jsx?)$/,
  
  // Next.js API routes
  /^src\/app\/api\/.*\/route\.(ts|js)$/,
  
  // Middleware
  /^src\/middleware\.(ts|js)$/,
  
  // Root layout and page
  /^src\/app\/layout\.(tsx?|jsx?)$/,
  /^src\/app\/page\.(tsx?|jsx?)$/,
  
  // Next.js special files
  /^src\/app\/error\.(tsx?|jsx?)$/,
  /^src\/app\/loading\.(tsx?|jsx?)$/,
  /^src\/app\/not-found\.(tsx?|jsx?)$/,
  
  // Configuration files that are executed
  /^next\.config\.(ts|js)$/,
  /^middleware\.(ts|js)$/,
];

/**
 * Check if a file path matches entry point patterns
 */
function isEntryPoint(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return ENTRY_POINT_PATTERNS.some((pattern) => pattern.test(normalizedPath));
}

/**
 * Identify all entry points from the file list
 */
export function identifyEntryPoints(files: FileEntry[]): FileEntry[] {
  return files.filter((file) => isEntryPoint(file.path));
}

/**
 * Trace import chains from entry points to identify active code
 */
export function traceActiveCode(
  files: FileEntry[],
  graph: DependencyGraph
): Set<string> {
  const activeFiles = new Set<string>();

  // Find all entry points
  const entryPoints = identifyEntryPoints(files);

  // Mark entry points as active
  for (const entryPoint of entryPoints) {
    activeFiles.add(entryPoint.path);
  }

  // Trace dependencies from each entry point
  for (const entryPoint of entryPoints) {
    const dependencies = getTransitiveDependencies(entryPoint.path, graph);
    for (const dep of dependencies) {
      activeFiles.add(dep);
    }
  }

  // Also mark schema files as active if they define tables
  // (schemas are used by the ORM even if not directly imported)
  const schemaFiles = files.filter((f) => f.type === 'schema');
  for (const schemaFile of schemaFiles) {
    activeFiles.add(schemaFile.path);
  }

  // Mark migration files as active (they define database structure)
  const migrationFiles = files.filter((f) => f.type === 'migration');
  for (const migrationFile of migrationFiles) {
    activeFiles.add(migrationFile.path);
  }

  return activeFiles;
}

/**
 * Determine confidence level for active code detection
 */
function determineConfidence(
  filePath: string,
  isActive: boolean,
  importedBy: string[],
  fileType: string
): 'high' | 'medium' | 'low' {
  // High confidence for entry points and heavily imported files
  if (isEntryPoint(filePath)) {
    return 'high';
  }

  if (isActive && importedBy.length >= 3) {
    return 'high';
  }

  // High confidence for schema and migration files
  if (fileType === 'schema' || fileType === 'migration') {
    return 'high';
  }

  // Medium confidence for files with some imports
  if (isActive && importedBy.length >= 1) {
    return 'medium';
  }

  // Low confidence for potentially abandoned code
  if (!isActive) {
    return 'low';
  }

  return 'medium';
}

/**
 * Generate reason for active/inactive status
 */
function generateReason(
  filePath: string,
  isActive: boolean,
  importedBy: string[],
  fileType: string
): string {
  if (isEntryPoint(filePath)) {
    return 'Entry point (page, API route, or middleware)';
  }

  if (fileType === 'schema') {
    return 'Database schema file (used by ORM)';
  }

  if (fileType === 'migration') {
    return 'Database migration file';
  }

  if (isActive && importedBy.length > 0) {
    return `Imported by ${importedBy.length} file(s) in active code chain`;
  }

  if (isActive && importedBy.length === 0) {
    return 'In active code chain but not directly imported';
  }

  return 'Not found in import chain from entry points (potentially abandoned)';
}

/**
 * Identify features that use a file
 */
function identifyUsedInFeatures(
  filePath: string,
  importedBy: string[]
): string[] {
  const features = new Set<string>();

  // Extract feature name from file path
  const featureMatch = filePath.match(/src\/features\/([^\/]+)/);
  if (featureMatch) {
    features.add(featureMatch[1]);
  }

  // Extract features from files that import this file
  for (const importer of importedBy) {
    const importerFeatureMatch = importer.match(/src\/features\/([^\/]+)/);
    if (importerFeatureMatch) {
      features.add(importerFeatureMatch[1]);
    }

    // Check for API routes
    const apiMatch = importer.match(/src\/app\/api\/([^\/]+)/);
    if (apiMatch) {
      features.add(apiMatch[1]);
    }
  }

  return Array.from(features);
}

/**
 * Build active code map from files and dependency graph
 */
export function buildActiveCodeMap(
  files: FileEntry[],
  graph: DependencyGraph
): ActiveCodeMap {
  const activeFiles = traceActiveCode(files, graph);
  const activeCodeMap: ActiveCodeMap = {};

  for (const file of files) {
    const isActive = activeFiles.has(file.path);
    const confidence = determineConfidence(
      file.path,
      isActive,
      file.importedBy,
      file.type
    );
    const reason = generateReason(
      file.path,
      isActive,
      file.importedBy,
      file.type
    );
    const usedInFeatures = identifyUsedInFeatures(
      file.path,
      file.importedBy
    );

    activeCodeMap[file.path] = {
      isActive,
      confidence,
      reason,
      importedBy: file.importedBy,
      usedInFeatures,
    };
  }

  return activeCodeMap;
}

/**
 * Update FileEntry objects with active status
 */
export function updateFileEntriesWithActiveStatus(
  files: FileEntry[],
  activeCodeMap: ActiveCodeMap
): FileEntry[] {
  return files.map((file) => {
    const activeInfo = activeCodeMap[file.path];
    return {
      ...file,
      isActive: activeInfo?.isActive ?? false,
    };
  });
}

/**
 * Get statistics about active vs inactive code
 */
export function getActiveCodeStats(activeCodeMap: ActiveCodeMap): {
  totalFiles: number;
  activeFiles: number;
  inactiveFiles: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  entryPoints: number;
  potentiallyAbandoned: number;
} {
  const entries = Object.entries(activeCodeMap);

  const activeFiles = entries.filter(([_, info]) => info.isActive).length;
  const inactiveFiles = entries.filter(([_, info]) => !info.isActive).length;
  const highConfidence = entries.filter(
    ([_, info]) => info.confidence === 'high'
  ).length;
  const mediumConfidence = entries.filter(
    ([_, info]) => info.confidence === 'medium'
  ).length;
  const lowConfidence = entries.filter(
    ([_, info]) => info.confidence === 'low'
  ).length;
  const entryPoints = entries.filter(([path, _]) => isEntryPoint(path)).length;
  const potentiallyAbandoned = entries.filter(
    ([_, info]) => !info.isActive && info.confidence === 'low'
  ).length;

  return {
    totalFiles: entries.length,
    activeFiles,
    inactiveFiles,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    entryPoints,
    potentiallyAbandoned,
  };
}

/**
 * Get list of potentially abandoned files
 */
export function getPotentiallyAbandonedFiles(
  activeCodeMap: ActiveCodeMap
): Array<{ path: string; reason: string }> {
  return Object.entries(activeCodeMap)
    .filter(([_, info]) => !info.isActive && info.confidence === 'low')
    .map(([path, info]) => ({
      path,
      reason: info.reason,
    }));
}

/**
 * Get files by feature
 */
export function getFilesByFeature(
  activeCodeMap: ActiveCodeMap
): Map<string, string[]> {
  const featureMap = new Map<string, string[]>();

  for (const [filePath, info] of Object.entries(activeCodeMap)) {
    for (const feature of info.usedInFeatures) {
      if (!featureMap.has(feature)) {
        featureMap.set(feature, []);
      }
      featureMap.get(feature)!.push(filePath);
    }
  }

  return featureMap;
}
