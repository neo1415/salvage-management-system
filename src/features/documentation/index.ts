/**
 * Comprehensive Application Documentation System
 * 
 * Main entry point for the documentation generation system.
 * This system is READ-ONLY and will not modify any production code.
 * 
 * @module documentation
 */

// Export all types
export * from './types';

// Export scanner functions (to be implemented)
// export * from './scanner';

// Export parser functions (to be implemented)
// export * from './parsers';

// Export analyzer functions (to be implemented)
// export * from './analyzers';

// Export generator functions
export * from './generator';

// Export verification functions (to be implemented)
// export * from './verification';

// Export utility functions (to be implemented)
// export * from './utils';

// Re-export the main documentation generation function
export { generateDocumentation as generateCompleteDocumentation } from './generator';
