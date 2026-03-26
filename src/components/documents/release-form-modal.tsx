'use client';

/**
 * Release Form Modal Component
 * 
 * Displays legal document content with embedded signature pad.
 * Enforces scroll-to-sign and terms acceptance.
 */

import { useState, useRef, useEffect } from 'react';
import { DigitalSignaturePad } from './digital-signature-pad';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { lockScroll } from '@/lib/utils/modal-scroll-lock';

interface ReleaseFormModalProps {
  auctionId: string;
  documentType: 'liability_waiver' | 'bill_of_sale' | 'pickup_authorization' | 'salvage_certificate';
  onClose: () => void;
  onSigned: () => void;
}

export function ReleaseFormModal({
  auctionId,
  documentType,
  onClose,
  onSigned,
}: ReleaseFormModalProps) {
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [documentContent, setDocumentContent] = useState<string>('');
  const [documentTitle, setDocumentTitle] = useState<string>('');
  const [assetDescription, setAssetDescription] = useState<string>('');
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Error modal state
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  // Fetch document content when modal opens
  useEffect(() => {
    if (auctionId && documentType) {
      fetchDocumentContent();
      
      // Prevent body scroll
      const unlock = lockScroll();
      return unlock;
    }
  }, [auctionId, documentType]);

  const fetchDocumentContent = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/auctions/${auctionId}/documents/preview?type=${documentType}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch document');
      }

      const data = await response.json();
      setDocumentTitle(data.title);
      setDocumentContent(data.content);
      setAssetDescription(data.assetDescription);
    } catch (error) {
      console.error('Error fetching document:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load document. Please try again.';
      setErrorModal({
        isOpen: true,
        title: 'Error Loading Document',
        message: errorMessage,
      });
      // Don't close modal immediately - let user see error and close manually
    } finally {
      setIsLoading(false);
    }
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    setSignatureData(null);
    setHasScrolledToBottom(false);
    setHasAcceptedTerms(false);
    setIsSubmitting(false);
  }, [auctionId, documentType]);

  // Check if user has scrolled to bottom
  const handleScroll = () => {
    if (contentRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      if (isAtBottom && !hasScrolledToBottom) {
        setHasScrolledToBottom(true);
      }
    }
  };

  const handleSubmit = async () => {
    if (!signatureData || !hasAcceptedTerms) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/auctions/${auctionId}/documents/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentType,
          signatureData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sign document');
      }

      await onSigned();
    } catch (error) {
      console.error('Error signing document:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign document. Please try again.';
      setErrorModal({
        isOpen: true,
        title: 'Signing Failed',
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = signatureData && hasScrolledToBottom && hasAcceptedTerms && !isSubmitting;

  if (isLoading) {
    return (
      <div>
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[9998] transition-opacity" />
        
        {/* Modal Container */}
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
          <div 
            className="relative bg-white rounded-lg shadow-xl p-8 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#800020]"></div>
              <span className="ml-3 text-gray-700">Loading document...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[9998] transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{documentTitle}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Auction: {assetDescription}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div
            ref={contentRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
          >
            <div dangerouslySetInnerHTML={{ __html: documentContent }} />

            {!hasScrolledToBottom && (
              <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-8 pb-4">
                <div className="flex items-center justify-center">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 flex items-center space-x-2">
                    <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    <p className="text-sm text-yellow-800 font-medium">
                      Please scroll to the bottom to continue
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Signature Section */}
          {hasScrolledToBottom && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Digital Signature
              </h3>

              <DigitalSignaturePad
                onSignatureChange={setSignatureData}
                width={600}
                height={150}
              />

              <div className="mt-4">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasAcceptedTerms}
                    onChange={(e) => setHasAcceptedTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 text-[#800020] border-gray-300 rounded focus:ring-[#800020]"
                  />
                  <span className="text-sm text-gray-700">
                    I have read and agree to the terms and conditions stated above. I understand that this is a legally binding document and my digital signature has the same legal effect as a handwritten signature.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-6 py-2 text-sm font-medium text-white bg-[#800020] rounded-md hover:bg-[#a00028] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Signing...' : 'Sign Document'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Error Modal */}
      <ConfirmationModal
        isOpen={errorModal.isOpen}
        onClose={() => {
          setErrorModal({ isOpen: false, title: '', message: '' });
          // If there was a loading error, close the parent modal too
          if (errorModal.title === 'Error Loading Document') {
            onClose();
          }
        }}
        onConfirm={() => {
          setErrorModal({ isOpen: false, title: '', message: '' });
          // If there was a loading error, close the parent modal too
          if (errorModal.title === 'Error Loading Document') {
            onClose();
          }
        }}
        title={errorModal.title}
        message={errorModal.message}
        type="error"
        confirmText="OK"
        cancelText=""
      />
    </div>
  );
}
