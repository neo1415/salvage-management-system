/**
 * Unit tests for active code detector
 */

import { describe, it, expect } from 'vitest';
import { identifyEntryPoints } from '@/features/documentation/scanner/active-code-detector';
import type { FileEntry } from '@/features/documentation/types';

describe('Active Code Detector', () => {
  describe('identifyEntryPoints', () => {
    const createMockFile = (path: string): FileEntry => ({
      path,
      type: 'component',
      size: 1000,
      lastModified: new Date(),
      isActive: false,
      importedBy: [],
      imports: [],
    });

    it('should identify Next.js pages as entry points', () => {
      const files: FileEntry[] = [
        createMockFile('src/app/page.tsx'),
        createMockFile('src/app/(dashboard)/vendor/page.tsx'),
        createMockFile('src/app/(dashboard)/admin/users/page.tsx'),
        createMockFile('src/components/ui/button.tsx'),
      ];

      const entryPoints = identifyEntryPoints(files);

      expect(entryPoints).toHaveLength(3);
      expect(entryPoints.map((f) => f.path)).toContain('src/app/page.tsx');
      expect(entryPoints.map((f) => f.path)).toContain('src/app/(dashboard)/vendor/page.tsx');
      expect(entryPoints.map((f) => f.path)).toContain('src/app/(dashboard)/admin/users/page.tsx');
    });

    it('should identify Next.js layouts as entry points', () => {
      const files: FileEntry[] = [
        createMockFile('src/app/layout.tsx'),
        createMockFile('src/app/(dashboard)/layout.tsx'),
        createMockFile('src/components/ui/button.tsx'),
      ];

      const entryPoints = identifyEntryPoints(files);

      expect(entryPoints).toHaveLength(2);
      expect(entryPoints.map((f) => f.path)).toContain('src/app/layout.tsx');
      expect(entryPoints.map((f) => f.path)).toContain('src/app/(dashboard)/layout.tsx');
    });

    it('should identify API routes as entry points', () => {
      const files: FileEntry[] = [
        createMockFile('src/app/api/cases/route.ts'),
        createMockFile('src/app/api/auctions/[id]/route.ts'),
        createMockFile('src/app/api/webhooks/paystack/route.ts'),
        createMockFile('src/features/cases/services/case.service.ts'),
      ];

      const entryPoints = identifyEntryPoints(files);

      expect(entryPoints).toHaveLength(3);
      expect(entryPoints.map((f) => f.path)).toContain('src/app/api/cases/route.ts');
      expect(entryPoints.map((f) => f.path)).toContain('src/app/api/auctions/[id]/route.ts');
      expect(entryPoints.map((f) => f.path)).toContain('src/app/api/webhooks/paystack/route.ts');
    });

    it('should identify middleware as entry point', () => {
      const files: FileEntry[] = [
        createMockFile('src/middleware.ts'),
        createMockFile('src/lib/auth.ts'),
      ];

      const entryPoints = identifyEntryPoints(files);

      expect(entryPoints).toHaveLength(1);
      expect(entryPoints[0].path).toBe('src/middleware.ts');
    });

    it('should identify Next.js special files as entry points', () => {
      const files: FileEntry[] = [
        createMockFile('src/app/error.tsx'),
        createMockFile('src/app/loading.tsx'),
        createMockFile('src/app/not-found.tsx'),
        createMockFile('src/components/ui/button.tsx'),
      ];

      const entryPoints = identifyEntryPoints(files);

      expect(entryPoints).toHaveLength(3);
      expect(entryPoints.map((f) => f.path)).toContain('src/app/error.tsx');
      expect(entryPoints.map((f) => f.path)).toContain('src/app/loading.tsx');
      expect(entryPoints.map((f) => f.path)).toContain('src/app/not-found.tsx');
    });

    it('should not identify regular components as entry points', () => {
      const files: FileEntry[] = [
        createMockFile('src/components/ui/button.tsx'),
        createMockFile('src/components/admin/user-table.tsx'),
        createMockFile('src/features/cases/services/case.service.ts'),
      ];

      const entryPoints = identifyEntryPoints(files);

      expect(entryPoints).toHaveLength(0);
    });

    it('should identify config files as entry points', () => {
      const files: FileEntry[] = [
        createMockFile('next.config.ts'),
        createMockFile('middleware.ts'),
        createMockFile('src/lib/utils.ts'),
      ];

      const entryPoints = identifyEntryPoints(files);

      expect(entryPoints).toHaveLength(2);
      expect(entryPoints.map((f) => f.path)).toContain('next.config.ts');
      expect(entryPoints.map((f) => f.path)).toContain('middleware.ts');
    });
  });
});
