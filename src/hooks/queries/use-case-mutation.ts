/**
 * TanStack Query Mutation Hooks for Cases
 * 
 * Provides mutation hooks with optimistic updates for case operations.
 * Implements instant UI feedback with rollback on error.
 * 
 * Requirements: 5.5, 5.6, 5.7, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Case } from './use-cases';

interface CreateCaseInput {
  claimReference: string;
  assetType: 'vehicle' | 'property' | 'electronics';
  assetDetails: Record<string, unknown>;
  marketValue: number;
  photos: string[];
  gpsLocation: { latitude: number; longitude: number };
  locationName: string;
  voiceNotes?: string[];
  status?: 'draft' | 'pending_approval';
  aiAssessmentResult?: {
    damageSeverity: 'none' | 'minor' | 'moderate' | 'severe';
    confidenceScore: number;
    estimatedSalvageValue: number;
    damageDetails: string[];
  };
}

interface CreateCaseResult {
  success: boolean;
  data: Case;
  error?: string;
}

interface DeleteCaseResult {
  success: boolean;
  error?: string;
}

/**
 * Create a new case
 */
async function createCase(input: CreateCaseInput): Promise<Case> {
  const response = await fetch('/api/cases', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create case');
  }

  const result: CreateCaseResult = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to create case');
  }

  return result.data;
}

/**
 * Delete a case
 */
async function deleteCase(caseId: string): Promise<void> {
  const response = await fetch(`/api/cases/${caseId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete case');
  }

  const result: DeleteCaseResult = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete case');
  }
}

/**
 * Hook to create a case with optimistic updates
 * 
 * Features:
 * - Optimistic update: Immediately adds case to cache
 * - Rollback on error: Reverts cache if creation fails
 * - Cache invalidation on success: Refetches to get server data
 * - Loading and error states
 * 
 * @returns Mutation object with mutate function and states
 */
export function useCreateCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCase,
    
    // Optimistic update: Add case to cache immediately
    onMutate: async (newCase) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['cases'] });

      // Snapshot the previous value
      const previousCases = queryClient.getQueryData(['cases']);

      // Optimistically update to the new value
      queryClient.setQueryData(['cases'], (old: Case[] | undefined) => {
        if (!old) return old;
        
        // Create optimistic case object
        const optimisticCase: Case = {
          id: `temp-${Date.now()}`,
          claimReference: newCase.claimReference,
          assetType: newCase.assetType,
          assetDetails: newCase.assetDetails,
          marketValue: newCase.marketValue,
          estimatedSalvageValue: newCase.aiAssessmentResult?.estimatedSalvageValue || null,
          reservePrice: null,
          damageSeverity: newCase.aiAssessmentResult?.damageSeverity || null,
          aiAssessment: newCase.aiAssessmentResult || null,
          gpsLocation: newCase.gpsLocation,
          locationName: newCase.locationName,
          photos: newCase.photos,
          status: newCase.status || 'pending_approval',
          createdAt: new Date().toISOString(),
          adjusterName: null,
        };
        
        return [optimisticCase, ...old];
      });

      // Return context with previous value
      return { previousCases };
    },
    
    // Rollback on error
    onError: (err, newCase, context) => {
      if (context?.previousCases) {
        queryClient.setQueryData(['cases'], context.previousCases);
      }
    },
    
    // Invalidate and refetch on success
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });
}

/**
 * Hook to delete a case with optimistic updates
 * 
 * Features:
 * - Optimistic update: Immediately removes case from cache
 * - Rollback on error: Reverts cache if deletion fails
 * - Cache invalidation on success: Refetches to sync with server
 * - Loading and error states
 * 
 * @returns Mutation object with mutate function and states
 */
export function useDeleteCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCase,
    
    // Optimistic update: Remove case from cache immediately
    onMutate: async (caseId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['cases'] });

      // Snapshot the previous value
      const previousCases = queryClient.getQueryData(['cases']);

      // Optimistically update to the new value
      queryClient.setQueryData(['cases'], (old: Case[] | undefined) => {
        if (!old) return old;
        return old.filter(c => c.id !== caseId);
      });

      // Return context with previous value
      return { previousCases };
    },
    
    // Rollback on error
    onError: (err, caseId, context) => {
      if (context?.previousCases) {
        queryClient.setQueryData(['cases'], context.previousCases);
      }
    },
    
    // Invalidate and refetch on success
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });
}
