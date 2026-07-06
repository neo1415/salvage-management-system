'use client';

/**
 * PDF Layout Component
 * Provides brand-aware letterhead and footer for PDF exports.
 */

import React from 'react';
import Image from 'next/image';
import { usePublicBranding } from '@/hooks/use-public-branding';

interface PDFLayoutProps {
  children: React.ReactNode;
  reportTitle: string;
  reportSubtitle?: string;
  generatedDate?: Date;
}

export function PDFLayout({
  children,
  reportTitle,
  reportSubtitle,
  generatedDate = new Date(),
}: PDFLayoutProps) {
  const { branding } = usePublicBranding();
  const organizationName = branding.legalName || branding.brandName;
  const logoSrc = branding.logoPath || branding.faviconPath || '/icons/icon-192.png';

  return (
    <div
      className="pdf-container"
      style={{
        maxWidth: '210mm',
        margin: '0 auto',
        background: 'white',
        minHeight: '100vh',
      }}
    >
      {/* Letterhead */}
      <header
        className="pdf-header"
        style={{
          padding: '20mm 15mm',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src={logoSrc}
              alt={`${branding.brandName} logo`}
              width={80}
              height={80}
              unoptimized
              className="object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{organizationName}</h1>
              <p className="text-sm text-gray-600">Salvage Management System</p>
            </div>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p>
              Generated:{' '}
              {generatedDate.toLocaleDateString('en-NG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <p>
              {generatedDate.toLocaleTimeString('en-NG', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
        <div className="mt-4 border-t-2 pt-4" style={{ borderColor: branding.primaryColor }}>
          <h2 className="text-xl font-semibold text-gray-900">{reportTitle}</h2>
          {reportSubtitle && <p className="mt-1 text-sm text-gray-600">{reportSubtitle}</p>}
        </div>
      </header>

      {/* Report Content */}
      <main
        className="pdf-content"
        style={{
          padding: '15mm',
          minHeight: '200mm',
        }}
      >
        {children}
      </main>

      {/* Footer */}
      <footer
        className="pdf-footer"
        style={{
          padding: '15mm',
          borderTop: '1px solid #e5e7eb',
          background: '#f9fafb',
        }}
      >
        <div className="border-t-2 pt-4" style={{ borderColor: branding.primaryColor }}>
          <div className="grid grid-cols-3 gap-4 text-xs text-gray-600">
            <div>
              <p className="mb-2 font-semibold text-gray-900">Organization</p>
              <p>{organizationName}</p>
              <p>{branding.brandName} Salvage Management</p>
            </div>
            <div>
              <p className="mb-2 font-semibold text-gray-900">Contact</p>
              {branding.supportPhone && <p>Phone: {branding.supportPhone}</p>}
              <p>Email: {branding.supportEmail}</p>
            </div>
            <div>
              <p className="mb-2 font-semibold text-gray-900">Document Control</p>
              <p>Generated report package</p>
              <p>For authorized internal review only</p>
            </div>
          </div>
          <div className="mt-4 text-center text-xs text-gray-500">
            <p>This is a computer-generated document. No signature is required.</p>
            <p className="mt-1">
              © {new Date().getFullYear()} {organizationName}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          body > *:not(.pdf-container) {
            display: none !important;
          }

          .pdf-container {
            width: 100%;
            max-width: none;
            margin: 0;
            padding: 0;
          }

          .pdf-header {
            position: running(header);
          }

          .pdf-footer {
            position: running(footer);
          }

          @page {
            margin: 2cm 1.5cm;

            @top-center {
              content: element(header);
            }

            @bottom-center {
              content: element(footer);
            }
          }

          .pdf-no-break {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .pdf-page-break {
            page-break-before: always;
            break-before: always;
          }
        }

        @media screen {
          .pdf-container {
            max-width: 210mm;
            margin: 0 auto;
            background: white;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          }

          .pdf-header {
            padding: 20mm 15mm;
            border-bottom: 1px solid #e5e7eb;
          }

          .pdf-content {
            padding: 15mm;
            min-height: 200mm;
          }

          .pdf-footer {
            padding: 15mm;
            border-top: 1px solid #e5e7eb;
            background: #f9fafb;
          }
        }
      `}</style>
    </div>
  );
}
