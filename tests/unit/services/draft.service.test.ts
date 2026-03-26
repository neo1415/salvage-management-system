/**
 * Draft Service Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DraftService } from '@/features/cases/services/draft.service';
import * as indexeddb from '@/lib/db/indexeddb';

// Mock IndexedDB functions
vi.mock('@/lib/db/indexeddb', () => ({
  saveDraft: vi.fn(),
  updateDraft: vi.fn(),
  getDraft: vi.fn(),
  getAllDrafts: vi.fn(),
  deleteDraft: vi.fn(),
}));

describe('DraftService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    DraftService.stopAll();
  });

  describe('saveDraftNow', () => {
    it('should create new draft when draftId is null', async () => {
      const formData = { claimReference: 'TEST-001' };
      const mockDraft = {
        id: 'draft-123',
        formData,
        status: 'draft' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        autoSavedAt: new Date(),
        hasAIAnalysis: false,
      };

      vi.mocked(indexeddb.saveDraft).mockResolvedValue(mockDraft);

      const result = await DraftService.saveDraftNow(null, formData, false);

      expect(indexeddb.saveDraft).toHaveBeenCalledWith(formData, false, undefined);
      expect(result).toEqual(mockDraft);
    });

    it('should update existing draft when draftId is provided', async () => {
      const draftId = 'draft-123';
      const formData = { claimReference: 'TEST-001' };
      const mockDraft = {
        id: draftId,
        formData,
        status: 'draft' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        autoSavedAt: new Date(),
        hasAIAnalysis: true,
        marketValue: 5000,
      };

      vi.mocked(indexeddb.updateDraft).mockResolvedValue(mockDraft);

      const result = await DraftService.saveDraftNow(draftId, formData, true, 5000);

      expect(indexeddb.updateDraft).toHaveBeenCalledWith(draftId, formData, true, 5000);
      expect(result).toEqual(mockDraft);
    });
  });

  describe('loadDraft', () => {
    it('should load draft by ID', async () => {
      const mockDraft = {
        id: 'draft-123',
        formData: { claimReference: 'TEST-001' },
        status: 'draft' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        autoSavedAt: new Date(),
        hasAIAnalysis: false,
      };

      vi.mocked(indexeddb.getDraft).mockResolvedValue(mockDraft);

      const result = await DraftService.loadDraft('draft-123');

      expect(indexeddb.getDraft).toHaveBeenCalledWith('draft-123');
      expect(result).toEqual(mockDraft);
    });

    it('should return null when draft not found', async () => {
      vi.mocked(indexeddb.getDraft).mockResolvedValue(undefined);

      const result = await DraftService.loadDraft('draft-999');

      expect(result).toBeNull();
    });
  });

  describe('listDrafts', () => {
    it('should return all drafts', async () => {
      const mockDrafts = [
        {
          id: 'draft-1',
          formData: {},
          status: 'draft' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          autoSavedAt: new Date(),
          hasAIAnalysis: false,
        },
        {
          id: 'draft-2',
          formData: {},
          status: 'draft' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          autoSavedAt: new Date(),
          hasAIAnalysis: true,
          marketValue: 3000,
        },
      ];

      vi.mocked(indexeddb.getAllDrafts).mockResolvedValue(mockDrafts);

      const result = await DraftService.listDrafts();

      expect(indexeddb.getAllDrafts).toHaveBeenCalled();
      expect(result).toEqual(mockDrafts);
    });
  });

  describe('deleteDraft', () => {
    it('should delete draft and stop auto-save', async () => {
      vi.mocked(indexeddb.deleteDraft).mockResolvedValue();

      await DraftService.deleteDraft('draft-123');

      expect(indexeddb.deleteDraft).toHaveBeenCalledWith('draft-123');
    });
  });

  describe('canSubmit', () => {
    it('should return valid when all requirements met', () => {
      const draft = {
        id: 'draft-123',
        formData: {
          claimReference: 'TEST-001',
          assetType: 'vehicle',
          locationName: 'Lagos',
        },
        status: 'draft' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        autoSavedAt: new Date(),
        hasAIAnalysis: true,
        marketValue: 5000,
      };

      const result = DraftService.canSubmit(draft);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid when AI analysis missing', () => {
      const draft = {
        id: 'draft-123',
        formData: {
          claimReference: 'TEST-001',
          assetType: 'vehicle',
          locationName: 'Lagos',
        },
        status: 'draft' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        autoSavedAt: new Date(),
        hasAIAnalysis: false,
      };

      const result = DraftService.canSubmit(draft);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('AI analysis is required before submission');
    });

    it('should return invalid when market value missing', () => {
      const draft = {
        id: 'draft-123',
        formData: {
          claimReference: 'TEST-001',
          assetType: 'vehicle',
          locationName: 'Lagos',
        },
        status: 'draft' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        autoSavedAt: new Date(),
        hasAIAnalysis: true,
      };

      const result = DraftService.canSubmit(draft);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Market value must be determined by AI analysis');
    });

    it('should return invalid when required fields missing', () => {
      const draft = {
        id: 'draft-123',
        formData: {},
        status: 'draft' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        autoSavedAt: new Date(),
        hasAIAnalysis: true,
        marketValue: 5000,
      };

      const result = DraftService.canSubmit(draft);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
