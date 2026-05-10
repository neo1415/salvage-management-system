/**
 * Unit tests for file scanner
 */

import { describe, it, expect } from 'vitest';
import { categorizeFile } from '@/features/documentation/scanner/file-scanner';

describe('File Scanner', () => {
  describe('categorizeFile', () => {
    it('should categorize API routes correctly', () => {
      expect(categorizeFile('src/app/api/cases/route.ts')).toBe('api-route');
      expect(categorizeFile('src/app/api/auctions/[id]/route.ts')).toBe('api-route');
      expect(categorizeFile('src/app/api/webhooks/paystack/route.ts')).toBe('api-route');
    });

    it('should categorize components correctly', () => {
      expect(categorizeFile('src/components/ui/button.tsx')).toBe('component');
      expect(categorizeFile('src/components/admin/user-table.tsx')).toBe('component');
      expect(categorizeFile('src/app/(dashboard)/vendor/page.tsx')).toBe('component');
    });

    it('should categorize services correctly', () => {
      expect(categorizeFile('src/features/cases/services/case.service.ts')).toBe('service');
      expect(categorizeFile('src/features/auctions/services/bidding.service.ts')).toBe('service');
      expect(categorizeFile('src/services/email.service.ts')).toBe('service');
    });

    it('should categorize schemas correctly', () => {
      expect(categorizeFile('src/lib/db/schema/cases.ts')).toBe('schema');
      expect(categorizeFile('src/lib/db/schema/auctions.ts')).toBe('schema');
      expect(categorizeFile('src/lib/db/schema/users.ts')).toBe('schema');
    });

    it('should categorize migrations correctly', () => {
      expect(categorizeFile('src/lib/db/migrations/0001_initial.sql')).toBe('migration');
      expect(categorizeFile('src/lib/db/migrations/0028_add_auction_deposit_system.sql')).toBe('migration');
    });

    it('should categorize hooks correctly', () => {
      expect(categorizeFile('src/hooks/use-auth.ts')).toBe('hook');
      expect(categorizeFile('src/hooks/use-socket.ts')).toBe('hook');
      expect(categorizeFile('src/lib/use-toast.ts')).toBe('hook');
    });

    it('should categorize type definitions correctly', () => {
      expect(categorizeFile('src/types/index.ts')).toBe('type-definition');
      expect(categorizeFile('src/features/cases/types/index.ts')).toBe('type-definition');
      expect(categorizeFile('src/lib/types.d.ts')).toBe('type-definition');
    });

    it('should categorize config files correctly', () => {
      expect(categorizeFile('next.config.ts')).toBe('config');
      expect(categorizeFile('src/middleware.ts')).toBe('config');
      expect(categorizeFile('package.json')).toBe('config');
      expect(categorizeFile('vitest.config.ts')).toBe('config');
    });

    it('should categorize utilities as default', () => {
      expect(categorizeFile('src/lib/utils.ts')).toBe('utility');
      expect(categorizeFile('src/lib/auth.ts')).toBe('utility');
      expect(categorizeFile('src/utils/format.ts')).toBe('utility');
    });
  });
});
