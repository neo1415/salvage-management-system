'use client';

/**
 * Document Viewer Component
 * 
 * PDF preview with download and print buttons.
 */

import { useState } from 'react';

interface DocumentViewerProps {
  pdfUrl: string;
  title: string;
  documentId: string;
  auctionId: string;
}

export function DocumentViewer({
  pdfUrl,
  title,
  documentId,
  auctionId,
}: DocumentViewerProps) {
  const [isLoading, setIsLoading] = useState(true);

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/auctions/${auctionId}/documents/${documentId}/download`);
      if (!response.ok) {
        throw new Error('Download failed');
      }
      // Browser will handle the redirect to Cloudinary URL
      window.open(response.url, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download document');
    }
  };

  const handlePrint = () => {
    const printWindow = window.open(pdfUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex space-x-2">
          <button
            onClick={handleDownload}
            className="px-4 py-2 text-sm font-medium text-white bg-[#800020] rounded-md hover:bg-[#a00028] transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Download</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="relative bg-gray-100" style={{ height: '600px' }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#800020]"></div>
          </div>
        )}
        <iframe
          src={`${pdfUrl}#toolbar=0`}
          className="w-full h-full"
          onLoad={() => setIsLoading(false)}
          title={title}
        />
      </div>
    </div>
  );
}
