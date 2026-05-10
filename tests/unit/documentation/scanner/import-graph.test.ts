/**
 * Unit tests for import graph builder
 */

import { describe, it, expect } from 'vitest';
import { extractImports, resolveImportPath } from '@/features/documentation/scanner/import-graph';

describe('Import Graph Builder', () => {
  describe('extractImports', () => {
    it('should extract named imports', () => {
      const code = `import { useState, useEffect } from 'react';`;
      const imports = extractImports(code, 'test.ts');

      expect(imports).toHaveLength(1);
      expect(imports[0].from).toBe('react');
      expect(imports[0].imports).toContain('useState');
      expect(imports[0].imports).toContain('useEffect');
      expect(imports[0].isTypeOnly).toBe(false);
    });

    it('should extract type-only imports', () => {
      const code = `import type { User } from './types';`;
      const imports = extractImports(code, 'test.ts');

      expect(imports).toHaveLength(1);
      expect(imports[0].from).toBe('./types');
      expect(imports[0].imports).toContain('User');
      expect(imports[0].isTypeOnly).toBe(true);
    });

    it('should extract namespace imports', () => {
      const code = `import * as React from 'react';`;
      const imports = extractImports(code, 'test.ts');

      expect(imports).toHaveLength(1);
      expect(imports[0].from).toBe('react');
      expect(imports[0].imports).toContain('React');
    });

    it('should extract default imports', () => {
      const code = `import React from 'react';`;
      const imports = extractImports(code, 'test.ts');

      expect(imports).toHaveLength(1);
      expect(imports[0].from).toBe('react');
      expect(imports[0].imports).toContain('React');
    });

    it('should extract side-effect imports', () => {
      const code = `import './styles.css';`;
      const imports = extractImports(code, 'test.ts');

      expect(imports).toHaveLength(1);
      expect(imports[0].from).toBe('./styles.css');
      expect(imports[0].imports).toHaveLength(0);
    });

    it('should extract multiple import statements', () => {
      const code = `
        import React from 'react';
        import { useState } from 'react';
        import type { User } from './types';
        import * as utils from './utils';
        import './styles.css';
      `;
      const imports = extractImports(code, 'test.ts');

      expect(imports.length).toBeGreaterThanOrEqual(4);
    });

    it('should handle path aliases', () => {
      const code = `import { db } from '@/lib/db';`;
      const imports = extractImports(code, 'test.ts');

      expect(imports).toHaveLength(1);
      expect(imports[0].from).toBe('@/lib/db');
    });
  });

  describe('resolveImportPath', () => {
    it('should resolve relative imports', () => {
      const resolved = resolveImportPath(
        './utils',
        'src/features/cases/services/case.service.ts',
        '/project'
      );

      expect(resolved).toContain('src/features/cases/services/utils');
    });

    it('should resolve parent directory imports', () => {
      const resolved = resolveImportPath(
        '../types',
        'src/features/cases/services/case.service.ts',
        '/project'
      );

      expect(resolved).toContain('src/features/cases/types');
    });

    it('should resolve path aliases', () => {
      const resolved = resolveImportPath(
        '@/lib/db',
        'src/features/cases/services/case.service.ts',
        '/project'
      );

      expect(resolved).toBe('src/lib/db');
    });

    it('should return null for external modules', () => {
      const resolved = resolveImportPath(
        'react',
        'src/components/button.tsx',
        '/project'
      );

      expect(resolved).toBeNull();
    });

    it('should return null for node_modules', () => {
      const resolved = resolveImportPath(
        'next/navigation',
        'src/app/page.tsx',
        '/project'
      );

      expect(resolved).toBeNull();
    });
  });
});
