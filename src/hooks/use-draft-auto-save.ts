/**
 * useDraftAutoSave Hook
 * 
 * Provides draft auto-save functionality with 30-second debounce.
 * Manages draft state, auto-save timers, and provides draft operations.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DraftService } from '@/features/cases/services/draft.service';
import type { DraftCase } from '@/lib/db/indexeddb';

export interface UseDraftAutoSaveOptions {
  interval?: number; // Default: 30000ms
  enabled?: boolean; // Default: true
  onSave?: (draft: DraftCase) => void;
  onError?: (error: Error) => void;
}

export interface UseDraftAutoSaveReturn {
  currentDraftId: string | null;
  isSaving: boolean;
  lastSaved: Date | null;
  saveDraft: () => Promise<void>;
  loadDraft: (id: string) => Promise<void>;
  drafts: DraftCase[];
  deleteDraft: (id: string) => Promise<void>;
  canSubmit: boolean;
  validationErrors: string[];
  refreshDrafts: () => Promise<void>;
}

export function useDraftAutoSave(
  formData: Record<string, unknown>,
  hasAIAnalysis: boolean,
  marketValue?: number,
  options: UseDraftAutoSaveOptions = {}
): UseDraftAutoSaveReturn {
  const { enabled = true, onSave, onError } = options;

  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [drafts, setDrafts] = useState<DraftCase[]>([]);
  const [canSubmit, setCanSubmit] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const formDataRef = useRef(formData);
  const hasAIAnalysisRef = useRef(hasAIAnalysis);
  const marketValueRef = useRef(marketValue);

  // Update refs when props change
  useEffect(() => {
    formDataRef.current = formData;
    hasAIAnalysisRef.current = hasAIAnalysis;
    marketValueRef.current = marketValue;
  }, [formData, hasAIAnalysis, marketValue]);

  // Load drafts on mount
  const refreshDrafts = useCallback(async () => {
    try {
      const allDrafts = await DraftService.listDrafts();
      setDrafts(allDrafts);
    } catch (error) {
      console.error('Failed to load drafts:', error);
      onError?.(error as Error);
    }
  }, [onError]);

  // CRITICAL FIX: Use a ref to track if initial load is done
  const initialLoadDone = useRef(false);
  
  useEffect(() => {
    // Only load drafts once on mount
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      refreshDrafts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run on mount

  // Start auto-save when enabled
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Check if form has any data
    const hasData = Object.keys(formDataRef.current).some(key => {
      const value = formDataRef.current[key];
      return value !== null && value !== undefined && value !== '';
    });

    if (!hasData) {
      return;
    }

    DraftService.startAutoSave(
      currentDraftId,
      formDataRef.current,
      hasAIAnalysisRef.current,
      marketValueRef.current,
      (draft) => {
        setCurrentDraftId(draft.id);
        setLastSaved(draft.autoSavedAt);
        onSave?.(draft);
        // CRITICAL FIX: Don't call refreshDrafts here - it causes infinite loops
        // The drafts list will be refreshed when the user opens it
      }
    );

    return () => {
      if (currentDraftId) {
        DraftService.stopAutoSave(currentDraftId);
      }
    };
  }, [enabled, currentDraftId, onSave]); // CRITICAL FIX: Removed formData from dependencies - use ref instead

  // Validate draft for submission
  useEffect(() => {
    // CRITICAL FIX: Validate even without a draft ID
    // This allows submission when user fills form for the first time
    const draft: DraftCase = {
      id: currentDraftId || 'temp',
      formData: formDataRef.current,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      autoSavedAt: new Date(),
      hasAIAnalysis: hasAIAnalysisRef.current,
      marketValue: marketValueRef.current,
    };

    const validation = DraftService.canSubmit(draft);
    setCanSubmit(validation.valid);
    setValidationErrors(validation.errors);
  }, [currentDraftId]); // CRITICAL FIX: Only depend on currentDraftId, use refs for other values

  // Manual save
  const saveDraft = useCallback(async () => {
    setIsSaving(true);
    try {
      const draft = await DraftService.saveDraftNow(
        currentDraftId,
        formDataRef.current,
        hasAIAnalysisRef.current,
        marketValueRef.current
      );
      setCurrentDraftId(draft.id);
      setLastSaved(draft.autoSavedAt);
      onSave?.(draft);
      await refreshDrafts();
    } catch (error) {
      console.error('Failed to save draft:', error);
      onError?.(error as Error);
    } finally {
      setIsSaving(false);
    }
  }, [currentDraftId, onSave, onError, refreshDrafts]);

  // Load draft
  const loadDraft = useCallback(async (id: string) => {
    try {
      const draft = await DraftService.loadDraft(id);
      if (draft) {
        setCurrentDraftId(draft.id);
        setLastSaved(draft.autoSavedAt);
        // Caller should update form with draft.formData
      }
    } catch (error) {
      console.error('Failed to load draft:', error);
      onError?.(error as Error);
    }
  }, [onError]);

  // Delete draft
  const deleteDraft = useCallback(async (id: string) => {
    try {
      await DraftService.deleteDraft(id);
      if (currentDraftId === id) {
        setCurrentDraftId(null);
        setLastSaved(null);
      }
      await refreshDrafts();
    } catch (error) {
      console.error('Failed to delete draft:', error);
      onError?.(error as Error);
    }
  }, [currentDraftId, onError, refreshDrafts]);

  return {
    currentDraftId,
    isSaving,
    lastSaved,
    saveDraft,
    loadDraft,
    drafts,
    deleteDraft,
    canSubmit,
    validationErrors,
    refreshDrafts,
  };
}
