/**
 * Unit tests for documentation system types
 * 
 * These tests verify that the core TypeScript types are correctly defined
 * and can be used throughout the documentation system.
 */

import { describe, it, expect } from 'vitest';
import {
  DocumentationError,
  type FileEntry,
  type FileType,
  type ScanOptions,
  type FileInventory,
  type TypeScriptAST,
  type SchemaDefinition,
  type APIRouteDefinition,
  type ComponentDefinition,
  type UserFlowTrace,
  type DataFlowDiagram,
  type IntegrationMap,
  type CompleteAnalysis,
  type ParseResult,
  type AnalysisResult,
} from '@/features/documentation/types';

describe('Documentation System Types', () => {
  describe('File System Types', () => {
    it('should define FileEntry interface correctly', () => {
      const fileEntry: FileEntry = {
        path: 'src/features/cases/services/case.service.ts',
        type: 'service',
        size: 1024,
        lastModified: new Date(),
        isActive: true,
        importedBy: ['src/app/api/cases/route.ts'],
        imports: ['@/lib/db', '@/lib/auth'],
      };

      expect(fileEntry.path).toBe('src/features/cases/services/case.service.ts');
      expect(fileEntry.type).toBe('service');
      expect(fileEntry.isActive).toBe(true);
    });

    it('should define all FileType values', () => {
      const types: FileType[] = [
        'api-route',
        'component',
        'service',
        'schema',
        'migration',
        'utility',
        'config',
        'hook',
        'type-definition',
      ];

      expect(types).toHaveLength(9);
    });

    it('should define ScanOptions interface correctly', () => {
      const options: ScanOptions = {
        includePatterns: ['src/**/*.ts', 'src/**/*.tsx'],
        excludePatterns: ['scripts/**', 'docs/**', 'tests/**'],
        followImports: true,
      };

      expect(options.includePatterns).toHaveLength(2);
      expect(options.excludePatterns).toHaveLength(3);
      expect(options.followImports).toBe(true);
    });

    it('should define FileInventory interface correctly', () => {
      const inventory: FileInventory = {
        totalFiles: 100,
        productionFiles: 80,
        scriptFiles: 10,
        testFiles: 5,
        docFiles: 5,
        categorizedFiles: {
          apiRoutes: [],
          components: [],
          services: [],
          schemas: [],
          migrations: [],
          hooks: [],
          utilities: [],
          configurations: [],
        },
        activeCodeMap: {},
      };

      expect(inventory.totalFiles).toBe(100);
      expect(inventory.productionFiles).toBe(80);
    });
  });

  describe('Parser Types', () => {
    it('should define TypeScriptAST interface correctly', () => {
      const ast: TypeScriptAST = {
        imports: [],
        exports: [],
        functions: [],
        classes: [],
        interfaces: [],
        types: [],
        constants: [],
      };

      expect(ast.imports).toEqual([]);
      expect(ast.functions).toEqual([]);
    });

    it('should define SchemaDefinition interface correctly', () => {
      const schema: SchemaDefinition = {
        tableName: 'cases',
        columns: [],
        primaryKey: ['id'],
        foreignKeys: [],
        indexes: [],
        enums: [],
        relationships: [],
      };

      expect(schema.tableName).toBe('cases');
      expect(schema.primaryKey).toEqual(['id']);
    });

    it('should define APIRouteDefinition interface correctly', () => {
      const route: APIRouteDefinition = {
        path: '/api/cases',
        methods: ['GET', 'POST'],
        handlers: [],
        middleware: [],
        authentication: { required: true },
        authorization: [],
        requestSchema: { type: 'object' },
        responseSchema: { type: 'object' },
      };

      expect(route.path).toBe('/api/cases');
      expect(route.methods).toEqual(['GET', 'POST']);
    });

    it('should define ComponentDefinition interface correctly', () => {
      const component: ComponentDefinition = {
        name: 'CaseCard',
        props: [],
        hooks: [],
        stateVariables: [],
        apiCalls: [],
        childComponents: [],
      };

      expect(component.name).toBe('CaseCard');
    });
  });

  describe('Analysis Types', () => {
    it('should define UserFlowTrace interface correctly', () => {
      const flow: UserFlowTrace = {
        role: 'vendor',
        flowName: 'Place Bid',
        steps: [],
        uiInteractions: [],
        apiCalls: [],
        databaseOperations: [],
        notifications: [],
      };

      expect(flow.role).toBe('vendor');
      expect(flow.flowName).toBe('Place Bid');
    });

    it('should define DataFlowDiagram interface correctly', () => {
      const dataFlow: DataFlowDiagram = {
        feature: 'case-management',
        entryPoint: 'src/app/(dashboard)/adjuster/cases/new/page.tsx',
        stages: [],
        transformations: [],
        validationPoints: [],
        persistencePoints: [],
      };

      expect(dataFlow.feature).toBe('case-management');
    });

    it('should define IntegrationMap interface correctly', () => {
      const integrations: IntegrationMap = {
        integrations: [],
      };

      expect(integrations.integrations).toEqual([]);
    });

    it('should define CompleteAnalysis interface correctly', () => {
      const analysis: CompleteAnalysis = {
        inventory: {
          totalFiles: 0,
          productionFiles: 0,
          scriptFiles: 0,
          testFiles: 0,
          docFiles: 0,
          categorizedFiles: {
            apiRoutes: [],
            components: [],
            services: [],
            schemas: [],
            migrations: [],
            hooks: [],
            utilities: [],
            configurations: [],
          },
          activeCodeMap: {},
        },
        techStack: {
          coreFrameworks: {},
          frontend: {},
          backend: {},
          database: {},
          externalServices: {},
        },
        database: {
          tables: [],
          relationships: [],
          indexes: [],
          migrations: [],
          enums: [],
          materializedViews: [],
        },
        apiRoutes: [],
        features: [],
        userRoles: [],
        security: {
          authenticationPatterns: [],
          authorizationPatterns: [],
          inputValidation: [],
          dataEncryption: [],
          apiSecurity: [],
        },
        integrations: {
          integrations: [],
        },
        performance: {
          cachingStrategies: [],
          databaseOptimizations: [],
          imageOptimizations: [],
          paginationPatterns: [],
        },
        testing: {
          unitTestFramework: 'vitest',
          integrationTestFramework: 'vitest',
          e2eTestFramework: 'playwright',
          testCoverage: 0,
          testFiles: [],
        },
      };

      expect(analysis.testing.unitTestFramework).toBe('vitest');
    });
  });

  describe('Error Types', () => {
    it('should define DocumentationError enum correctly', () => {
      expect(DocumentationError.FILE_NOT_FOUND).toBe('FILE_NOT_FOUND');
      expect(DocumentationError.PARSE_ERROR).toBe('PARSE_ERROR');
      expect(DocumentationError.INVALID_SYNTAX).toBe('INVALID_SYNTAX');
      expect(DocumentationError.IMPORT_RESOLUTION_FAILED).toBe('IMPORT_RESOLUTION_FAILED');
      expect(DocumentationError.VERIFICATION_FAILED).toBe('VERIFICATION_FAILED');
      expect(DocumentationError.INCOMPLETE_ANALYSIS).toBe('INCOMPLETE_ANALYSIS');
    });

    it('should define ParseResult interface correctly', () => {
      const successResult: ParseResult<TypeScriptAST> = {
        success: true,
        data: {
          imports: [],
          exports: [],
          functions: [],
          classes: [],
          interfaces: [],
          types: [],
          constants: [],
        },
      };

      const errorResult: ParseResult<TypeScriptAST> = {
        success: false,
        error: {
          type: DocumentationError.PARSE_ERROR,
          message: 'Failed to parse file',
          filePath: 'src/test.ts',
        },
      };

      expect(successResult.success).toBe(true);
      expect(successResult.data).toBeDefined();
      expect(errorResult.success).toBe(false);
      expect(errorResult.error).toBeDefined();
    });

    it('should define AnalysisResult interface correctly', () => {
      const result: AnalysisResult = {
        success: true,
        errors: [],
        warnings: [],
      };

      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('Type Compatibility', () => {
    it('should allow FileEntry to be used in arrays', () => {
      const files: FileEntry[] = [
        {
          path: 'src/test1.ts',
          type: 'service',
          size: 100,
          lastModified: new Date(),
          isActive: true,
          importedBy: [],
          imports: [],
        },
        {
          path: 'src/test2.ts',
          type: 'component',
          size: 200,
          lastModified: new Date(),
          isActive: false,
          importedBy: [],
          imports: [],
        },
      ];

      expect(files).toHaveLength(2);
      expect(files[0].type).toBe('service');
      expect(files[1].type).toBe('component');
    });

    it('should allow nested type structures', () => {
      const analysis: CompleteAnalysis = {
        inventory: {
          totalFiles: 10,
          productionFiles: 8,
          scriptFiles: 1,
          testFiles: 1,
          docFiles: 0,
          categorizedFiles: {
            apiRoutes: [
              {
                path: 'src/app/api/test/route.ts',
                type: 'api-route',
                size: 500,
                lastModified: new Date(),
                isActive: true,
                importedBy: [],
                imports: [],
              },
            ],
            components: [],
            services: [],
            schemas: [],
            migrations: [],
            hooks: [],
            utilities: [],
            configurations: [],
          },
          activeCodeMap: {
            'src/app/api/test/route.ts': {
              isActive: true,
              confidence: 'high',
              reason: 'Entry point',
              importedBy: [],
              usedInFeatures: ['test-feature'],
            },
          },
        },
        techStack: {
          coreFrameworks: { nextjs: '16.1.6' },
          frontend: { react: '19.2.4' },
          backend: { nodejs: '22' },
          database: { postgresql: '16' },
          externalServices: { paystack: 'v1' },
        },
        database: {
          tables: [],
          relationships: [],
          indexes: [],
          migrations: [],
          enums: [],
          materializedViews: [],
        },
        apiRoutes: [],
        features: [],
        userRoles: [],
        security: {
          authenticationPatterns: ['NextAuth v5'],
          authorizationPatterns: ['Role-based access control'],
          inputValidation: ['Zod schemas'],
          dataEncryption: ['bcrypt for passwords'],
          apiSecurity: ['Rate limiting', 'CSRF protection'],
        },
        integrations: {
          integrations: [],
        },
        performance: {
          cachingStrategies: ['Redis', 'Vercel KV'],
          databaseOptimizations: ['Indexes', 'Materialized views'],
          imageOptimizations: ['Cloudinary', 'Sharp'],
          paginationPatterns: ['Cursor-based', 'Offset-based'],
        },
        testing: {
          unitTestFramework: 'vitest',
          integrationTestFramework: 'vitest',
          e2eTestFramework: 'playwright',
          testCoverage: 75,
          testFiles: ['tests/unit/**/*.test.ts'],
        },
      };

      expect(analysis.inventory.categorizedFiles.apiRoutes).toHaveLength(1);
      expect(analysis.techStack.coreFrameworks.nextjs).toBe('16.1.6');
      expect(analysis.security.authenticationPatterns).toContain('NextAuth v5');
    });
  });
});
