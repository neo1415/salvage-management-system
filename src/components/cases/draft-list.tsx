/**
 * Draft List Component
 * 
 * Displays a list of saved drafts with options to resume or delete.
 * Shows draft metadata including last saved time and AI analysis status.
 */

'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { DraftCase } from '@/lib/db/indexeddb';
import { cn } from '@/lib/utils';

export interface DraftListProps {
  drafts: DraftCase[];
  onResume: (draft: DraftCase) => void;
  onDelete: (id: string) => void;
  className?: string;
}

export function DraftList({ drafts, onResume, onDelete, className }: DraftListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this draft?')) {
      return;
    }

    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  if (drafts.length === 0) {
    return (
      <div className={cn('p-6 text-center bg-gray-50 rounded-xl border border-gray-200', className)}>
        <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-gray-600 font-medium">No drafts saved</p>
        <p className="text-sm text-gray-500 mt-1">Your drafts will appear here as you work</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Saved Drafts ({drafts.length})</h3>
        <span className="text-xs text-gray-500">Auto-saved every 30 seconds</span>
      </div>

      {drafts.map((draft) => {
        const assetType = draft.formData.assetType as string;
        const claimReference = draft.formData.claimReference as string;
        const photos = (draft.formData.photos as string[]) || [];
        
        return (
          <div
            key={draft.id}
            className="p-4 bg-white border border-gray-200 rounded-xl hover:border-[#800020]/30 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-start justify-between gap-3">
              {/* Draft Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-gray-900 truncate">
                    {claimReference || 'Untitled Draft'}
                  </h4>
                  {draft.hasAIAnalysis && (
                    <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      AI Analyzed
                    </span>
                  )}
                </div>

                <div className="space-y-1 text-sm text-gray-600">
                  {assetType && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Type:</span>
                      <span className="font-medium capitalize">{assetType}</span>
                    </div>
                  )}
                  
                  {draft.marketValue && draft.marketValue > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Value:</span>
                      <span className="font-medium text-green-600">₦{draft.marketValue.toLocaleString()}</span>
                    </div>
                  )}

                  {photos.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Photos:</span>
                      <span className="font-medium">{photos.length} uploaded</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    <span>
                      Last saved {formatDistanceToNow(new Date(draft.autoSavedAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => onResume(draft)}
                  className="px-4 py-2 bg-[#800020] text-white text-sm font-medium rounded-lg hover:bg-[#a0002a] transition-colors"
                >
                  Resume
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(draft.id)}
                  disabled={deletingId === draft.id}
                  className="px-4 py-2 bg-white border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {deletingId === draft.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
