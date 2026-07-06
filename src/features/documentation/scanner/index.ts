/**
 * Codebase Scanner Module
 * 
 * Main entry point for the codebase scanner that discovers, categorizes,
 * and analyzes source files to identify active code.
 */

import type { FileInventory, ScanOptions } from '../types';
import {
  scanDirectory,
  DEFAULT_SCAN_OPTIONS,
  getInventoryStats,
} from './file-scanner';
import {
  buildDependencyGraph,
  updateFileEntriesWithImports,
} from './import-graph';
import {
  buildActiveCodeMap,
  updateFileEntriesWithActiveStatus,
  getActiveCodeStats,
} from './active-code-detector';

/**
 * Complete codebase scan with import tracing and active code detection
 */
export async function scanCodebase(
  rootPath: string = process.cwd(),
  options: ScanOptions = DEFAULT_SCAN_OPTIONS
): Promise<FileInventory> {
  console.log('Starting codebase scan...');
  console.log(`Root path: ${rootPath}`);

  // Step 1: Scan directory and categorize files
  console.log('Step 1: Scanning directory structure...');
  const inventory = await scanDirectory(rootPath, options);
  console.log(`Found ${inventory.totalFiles} production files`);

  // Get all files as a flat array
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

  // Step 2: Build import dependency graph
  console.log('Step 2: Building import dependency graph...');
  const dependencyGraph = await buildDependencyGraph(allFiles, rootPath);
  console.log(`Built graph with ${dependencyGraph.nodes.size} nodes and ${dependencyGraph.edges.length} edges`);

  // Step 3: Update files with import information
  console.log('Step 3: Updating files with import information...');
  const filesWithImports = updateFileEntriesWithImports(allFiles, dependencyGraph);

  // Step 4: Detect active code through import tracing
  console.log('Step 4: Detecting active code...');
  const activeCodeMap = buildActiveCodeMap(filesWithImports, dependencyGraph);
  const activeStats = getActiveCodeStats(activeCodeMap);
  console.log(`Active files: ${activeStats.activeFiles}/${activeStats.totalFiles}`);
  console.log(`Entry points: ${activeStats.entryPoints}`);
  console.log(`Potentially abandoned: ${activeStats.potentiallyAbandoned}`);

  // Step 5: Update files with active status
  console.log('Step 5: Updating files with active status...');
  const filesWithActiveStatus = updateFileEntriesWithActiveStatus(
    filesWithImports,
    activeCodeMap
  );

  // Step 6: Update categorized files
  const updatedCategorizedFiles = {
    apiRoutes: filesWithActiveStatus.filter((f) => f.type === 'api-route'),
    components: filesWithActiveStatus.filter((f) => f.type === 'component'),
    services: filesWithActiveStatus.filter((f) => f.type === 'service'),
    schemas: filesWithActiveStatus.filter((f) => f.type === 'schema'),
    migrations: filesWithActiveStatus.filter((f) => f.type === 'migration'),
    hooks: filesWithActiveStatus.filter((f) => f.type === 'hook'),
    utilities: filesWithActiveStatus.filter(
      (f) => f.type === 'utility' || f.type === 'type-definition'
    ),
    configurations: filesWithActiveStatus.filter((f) => f.type === 'config'),
  };

  // Return complete inventory
  const completeInventory: FileInventory = {
    ...inventory,
    categorizedFiles: updatedCategorizedFiles,
    activeCodeMap,
  };

  console.log('Codebase scan complete!');
  return completeInventory;
}

/**
 * Print inventory summary to console
 */
export function printInventorySummary(inventory: FileInventory): void {
  const stats = getInventoryStats(inventory);
  const activeStats = getActiveCodeStats(inventory.activeCodeMap);

  console.log('\n=== Codebase Inventory Summary ===\n');
  console.log(`Total Files: ${stats.totalFiles}`);
  console.log(`Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log('');
  console.log('Files by Type:');
  console.log(`  API Routes: ${stats.byType['api-route']}`);
  console.log(`  Components: ${stats.byType.component}`);
  console.log(`  Services: ${stats.byType.service}`);
  console.log(`  Schemas: ${stats.byType.schema}`);
  console.log(`  Migrations: ${stats.byType.migration}`);
  console.log(`  Hooks: ${stats.byType.hook}`);
  console.log(`  Utilities: ${stats.byType.utility}`);
  console.log(`  Configurations: ${stats.byType.config}`);
  console.log('');
  console.log('Active Code Analysis:');
  console.log(`  Active Files: ${activeStats.activeFiles} (${((activeStats.activeFiles / activeStats.totalFiles) * 100).toFixed(1)}%)`);
  console.log(`  Inactive Files: ${activeStats.inactiveFiles} (${((activeStats.inactiveFiles / activeStats.totalFiles) * 100).toFixed(1)}%)`);
  console.log(`  Entry Points: ${activeStats.entryPoints}`);
  console.log(`  Potentially Abandoned: ${activeStats.potentiallyAbandoned}`);
  console.log('');
  console.log('Confidence Levels:');
  console.log(`  High: ${activeStats.highConfidence}`);
  console.log(`  Medium: ${activeStats.mediumConfidence}`);
  console.log(`  Low: ${activeStats.lowConfidence}`);
  console.log('\n=================================\n');
}

// Re-export types and utilities
export type { DependencyGraph, DependencyNode, DependencyEdge } from './import-graph';
export {
  scanDirectory,
  DEFAULT_SCAN_OPTIONS,
  categorizeFile,
  getInventoryStats,
} from './file-scanner';
export {
  buildDependencyGraph,
  extractImports,
  resolveImportPath,
  updateFileEntriesWithImports,
  getOrphanFiles,
  getLeafFiles,
  getTransitiveDependencies,
  getTransitiveImporters,
} from './import-graph';
export {
  buildActiveCodeMap,
  updateFileEntriesWithActiveStatus,
  getActiveCodeStats,
  getPotentiallyAbandonedFiles,
  getFilesByFeature,
  identifyEntryPoints,
} from './active-code-detector';
