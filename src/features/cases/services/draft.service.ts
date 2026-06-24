/**
 * Draft Service
 * 
 * Manages draft case auto-save functionality with 30-second debounce.
 * Provides methods for saving, loading, listing, and deleting drafts.
 */

import {
  saveDraft,
  updateDraft,
  getDraft,
  getAllDrafts,
  deleteDraft,
  type DraftCase,
} from '@/lib/db/indexeddb';

export interface DraftValidation {
  valid: boolean;
  errors: string[];
}

class DraftServiceClass {
  private autoSaveTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly AUTO_SAVE_INTERVAL = 30000; // 30 seconds

  /**
   * Start auto-save for a draft
   * Debounces saves to avoid excessive writes
   * Checks for existing draft with same claim reference to avoid duplicates
   */
  startAutoSave(
    draftId: string | null,
    formData: Record<string, unknown>,
    hasAIAnalysis: boolean,
    marketValue?: number,
    callback?: (draft: DraftCase) => void
  ): void {
    // Clear existing timer
    this.stopAutoSave(draftId || 'temp');

    // Set new timer
    const timer = setTimeout(async () => {
      try {
        let draft: DraftCase;
        
        if (draftId) {
          // Update existing draft
          draft = await updateDraft(draftId, formData, hasAIAnalysis, marketValue);
        } else {
          // saveDraft will check for existing draft by claim reference
          draft = await saveDraft(formData, hasAIAnalysis, marketValue);
        }
        
        callback?.(draft);
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, this.AUTO_SAVE_INTERVAL);

    this.autoSaveTimers.set(draftId || 'temp', timer);
  }

  /**
   * Stop auto-save for a draft
   */
  stopAutoSave(draftId: string): void {
    const timer = this.autoSaveTimers.get(draftId);
    if (timer) {
      clearTimeout(timer);
      this.autoSaveTimers.delete(draftId);
    }
  }

  /**
   * Save draft manually (immediate)
   * Checks for existing draft with same claim reference to avoid duplicates
   */
  async saveDraftNow(
    draftId: string | null,
    formData: Record<string, unknown>,
    hasAIAnalysis: boolean,
    marketValue?: number
  ): Promise<DraftCase> {
    // If we have a draftId, update that specific draft
    if (draftId) {
      return await updateDraft(draftId, formData, hasAIAnalysis, marketValue);
    }
    
    // Otherwise, saveDraft will check for existing draft by claim reference
    return await saveDraft(formData, hasAIAnalysis, marketValue);
  }

  /**
   * Load draft by ID
   */
  async loadDraft(id: string): Promise<DraftCase | null> {
    const draft = await getDraft(id);
    return draft || null;
  }

  /**
   * List all drafts
   */
  async listDrafts(): Promise<DraftCase[]> {
    return await getAllDrafts();
  }

  /**
   * Delete draft
   */
  async deleteDraft(id: string): Promise<void> {
    this.stopAutoSave(id);
    await deleteDraft(id);
  }

  /**
   * Validate draft for submission
   */
  canSubmit(
    draft: DraftCase,
    options?: { requireMarketValue?: boolean }
  ): DraftValidation {
    const errors: string[] = [];
    const requireMarketValue = options?.requireMarketValue ?? true;

    if (requireMarketValue && (!draft.marketValue || draft.marketValue <= 0)) {
      errors.push('Claims paid / asset value is required. Enter it manually or run AI analysis to estimate it.');
    }

    // Check required fields in formData
    const requiredFields: Array<{ key: string; label: string }> = [
      { key: 'claimReference', label: 'Claim reference' },
      { key: 'assetType', label: 'Asset type' },
      { key: 'locationName', label: 'Location name' },
    ];
    for (const field of requiredFields) {
      const value = draft.formData[field.key];
      const isBlankString = typeof value === 'string' && value.trim().length === 0;
      if (value === null || value === undefined || value === '' || isBlankString) {
        errors.push(`${field.label} is required`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Stop all auto-save timers (cleanup)
   */
  stopAll(): void {
    for (const [draftId] of this.autoSaveTimers) {
      this.stopAutoSave(draftId);
    }
  }
}

// Export singleton instance
export const DraftService = new DraftServiceClass();
