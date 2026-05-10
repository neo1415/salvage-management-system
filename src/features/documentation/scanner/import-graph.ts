/**
 * Import Dependency Graph Builder
 * 
 * Parses TypeScript/JavaScript files to extract import statements and build
 * a bidirectional dependency graph showing which files import which.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { FileEntry, ImportStatement } from '../types';

/**
 * Dependency graph structure
 */
export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: DependencyEdge[];
}

export interface DependencyNode {
  filePath: string;
  imports: string[]; // Files this file imports
  importedBy: string[]; // Files that import this file
}

export interface DependencyEdge {
  from: string; // File that imports
  to: string; // File being imported
  importType: 'default' | 'named' | 'namespace' | 'side-effect';
}

/**
 * Extract import statements from TypeScript/JavaScript code
 */
export function extractImports(code: string, filePath: string): ImportStatement[] {
  const imports: ImportStatement[] = [];
  const seenImports = new Map<string, ImportStatement>();

  // Extract named imports (including type-only)
  const namedImportRegex = /import\s+(type\s+)?{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = namedImportRegex.exec(code)) !== null) {
    const isTypeOnly = !!match[1];
    const importedNames = match[2].split(',').map((s) => s.trim());
    const from = match[3];

    // Merge with existing import from same module
    const existing = seenImports.get(from);
    if (existing) {
      existing.imports.push(...importedNames);
      existing.isTypeOnly = existing.isTypeOnly && isTypeOnly;
    } else {
      const importStmt = {
        from,
        imports: importedNames,
        isTypeOnly,
      };
      seenImports.set(from, importStmt);
      imports.push(importStmt);
    }
  }

  // Extract namespace imports
  const namespaceImportRegex = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = namespaceImportRegex.exec(code)) !== null) {
    const name = match[1];
    const from = match[2];

    const existing = seenImports.get(from);
    if (existing) {
      existing.imports.push(name);
    } else {
      const importStmt = {
        from,
        imports: [name],
        isTypeOnly: false,
      };
      seenImports.set(from, importStmt);
      imports.push(importStmt);
    }
  }

  // Extract default imports
  const defaultImportRegex = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = defaultImportRegex.exec(code)) !== null) {
    const name = match[1];
    const from = match[2];

    // Skip if already captured
    const existing = seenImports.get(from);
    if (existing) {
      // Add default import name if not already present
      if (!existing.imports.includes(name)) {
        existing.imports.push(name);
      }
    } else {
      const importStmt = {
        from,
        imports: [name],
        isTypeOnly: false,
      };
      seenImports.set(from, importStmt);
      imports.push(importStmt);
    }
  }

  // Extract side-effect imports
  const sideEffectImportRegex = /^import\s+['"]([^'"]+)['"];?\s*$/gm;
  while ((match = sideEffectImportRegex.exec(code)) !== null) {
    const from = match[1];

    // Skip if already captured
    if (!seenImports.has(from)) {
      const importStmt = {
        from,
        imports: [],
        isTypeOnly: false,
      };
      seenImports.set(from, importStmt);
      imports.push(importStmt);
    }
  }

  return imports;
}

/**
 * Resolve import path to actual file path
 */
export function resolveImportPath(
  importPath: string,
  fromFile: string,
  rootPath: string
): string | null {
  // Skip external modules (node_modules)
  if (!importPath.startsWith('.') && !importPath.startsWith('/') && !importPath.startsWith('@/')) {
    return null;
  }

  // Handle path aliases (@/ -> src/)
  let resolvedPath = importPath;
  if (importPath.startsWith('@/')) {
    resolvedPath = importPath.replace('@/', 'src/');
  } else if (importPath.startsWith('.')) {
    // Resolve relative path
    const fromDir = path.dirname(fromFile);
    resolvedPath = path.join(fromDir, importPath);
  }

  // Normalize path
  resolvedPath = resolvedPath.replace(/\\/g, '/');

  // Return the resolved path without extension
  // The actual file matching will be done later with extension variants
  return resolvedPath;
}

/**
 * Build dependency graph from file entries
 */
export async function buildDependencyGraph(
  files: FileEntry[],
  rootPath: string
): Promise<DependencyGraph> {
  const graph: DependencyGraph = {
    nodes: new Map(),
    edges: [],
  };

  // Initialize nodes
  for (const file of files) {
    graph.nodes.set(file.path, {
      filePath: file.path,
      imports: [],
      importedBy: [],
    });
  }

  // Process each file to extract imports
  for (const file of files) {
    try {
      const fullPath = path.join(rootPath, file.path);
      const code = await fs.readFile(fullPath, 'utf-8');
      const imports = extractImports(code, file.path);

      for (const importStmt of imports) {
        const resolvedPath = resolveImportPath(
          importStmt.from,
          file.path,
          rootPath
        );

        if (resolvedPath) {
          // Normalize the resolved path
          const normalizedPath = resolvedPath.replace(/\\/g, '/');

          // Check if the imported file is in our file list
          const importedFile = files.find((f) => {
            const fPath = f.path.replace(/\\/g, '/');
            return (
              fPath === normalizedPath ||
              fPath === normalizedPath + '.ts' ||
              fPath === normalizedPath + '.tsx' ||
              fPath === normalizedPath + '.js' ||
              fPath === normalizedPath + '.jsx' ||
              fPath === normalizedPath + '/index.ts' ||
              fPath === normalizedPath + '/index.tsx'
            );
          });

          if (importedFile) {
            // Add to imports list
            const node = graph.nodes.get(file.path);
            if (node && !node.imports.includes(importedFile.path)) {
              node.imports.push(importedFile.path);
            }

            // Add to importedBy list
            const importedNode = graph.nodes.get(importedFile.path);
            if (importedNode && !importedNode.importedBy.includes(file.path)) {
              importedNode.importedBy.push(file.path);
            }

            // Add edge
            graph.edges.push({
              from: file.path,
              to: importedFile.path,
              importType: importStmt.imports.length === 0 ? 'side-effect' : 'named',
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error processing file ${file.path}:`, error);
    }
  }

  return graph;
}

/**
 * Update FileEntry objects with import information from the graph
 */
export function updateFileEntriesWithImports(
  files: FileEntry[],
  graph: DependencyGraph
): FileEntry[] {
  return files.map((file) => {
    const node = graph.nodes.get(file.path);
    if (node) {
      return {
        ...file,
        imports: node.imports,
        importedBy: node.importedBy,
      };
    }
    return file;
  });
}

/**
 * Get files that are not imported by any other file (potential entry points or dead code)
 */
export function getOrphanFiles(graph: DependencyGraph): string[] {
  const orphans: string[] = [];

  for (const [filePath, node] of Array.from(graph.nodes.entries())) {
    if (node.importedBy.length === 0) {
      orphans.push(filePath);
    }
  }

  return orphans;
}

/**
 * Get files that don't import anything (leaf nodes)
 */
export function getLeafFiles(graph: DependencyGraph): string[] {
  const leaves: string[] = [];

  for (const [filePath, node] of Array.from(graph.nodes.entries())) {
    if (node.imports.length === 0) {
      leaves.push(filePath);
    }
  }

  return leaves;
}

/**
 * Get all files that are transitively imported by a given file
 */
export function getTransitiveDependencies(
  filePath: string,
  graph: DependencyGraph,
  visited: Set<string> = new Set()
): string[] {
  if (visited.has(filePath)) {
    return [];
  }

  visited.add(filePath);
  const dependencies: string[] = [];

  const node = graph.nodes.get(filePath);
  if (node) {
    for (const importedFile of node.imports) {
      dependencies.push(importedFile);
      const transitive = getTransitiveDependencies(
        importedFile,
        graph,
        visited
      );
      dependencies.push(...transitive);
    }
  }

  return Array.from(new Set(dependencies)); // Remove duplicates
}

/**
 * Get all files that transitively import a given file
 */
export function getTransitiveImporters(
  filePath: string,
  graph: DependencyGraph,
  visited: Set<string> = new Set()
): string[] {
  if (visited.has(filePath)) {
    return [];
  }

  visited.add(filePath);
  const importers: string[] = [];

  const node = graph.nodes.get(filePath);
  if (node) {
    for (const importerFile of node.importedBy) {
      importers.push(importerFile);
      const transitive = getTransitiveImporters(
        importerFile,
        graph,
        visited
      );
      importers.push(...transitive);
    }
  }

  return Array.from(new Set(importers)); // Remove duplicates
}
