/**
 * PDF Layout Component
 * Provides professional letterhead and footer for PDF exports
 */

import React from 'react';
import Image from 'next/image';

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
  generatedDate = new Date() 
}: PDFLayoutProps) {
  return (
    <div className="pdf-container" style={{ 
      maxWidth: '210mm', 
      margin: '0 auto', 
      background: 'white',
      minHeight: '100vh'
    }}>
      {/* Letterhead */}
      <header className="pdf-header" style={{
        padding: '20mm 15mm',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image 
              src="/icons/Nem-insurance-Logo.jpg" 
              alt="NEM Insurance Logo" 
              width={80} 
              height={80}
              className="object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">NEM Insurance</h1>
              <p className="text-sm text-gray-600">Salvage Management System</p>
            </div>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p>Generated: {generatedDate.toLocaleDateString('en-NG', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
            <p>{generatedDate.toLocaleTimeString('en-NG', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}</p>
          </div>
        </div>
        <div className="mt-4 border-t-2 border-blue-600 pt-4">
          <h2 className="text-xl font-semibold text-gray-900">{reportTitle}</h2>
          {reportSubtitle && (
            <p className="text-sm text-gray-600 mt-1">{reportSubtitle}</p>
          )}
        </div>
      </header>

      {/* Report Content */}
      <main className="pdf-content" style={{
        padding: '15mm',
        minHeight: '200mm'
      }}>
        {children}
      </main>

      {/* Footer */}
      <footer className="pdf-footer" style={{
        padding: '15mm',
        borderTop: '1px solid #e5e7eb',
        background: '#f9fafb'
      }}>
        <div className="border-t-2 border-blue-600 pt-4">
          <div className="grid grid-cols-3 gap-4 text-xs text-gray-600">
            <div>
              <p className="font-semibold text-gray-900 mb-2">Head Office</p>
              <p>NEM Insurance Plc</p>
              <p>274 Ikorodu Road, Obanikoro</p>
              <p>Lagos, Nigeria</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-2">Contact</p>
              <p>Phone: +234 1 271 6820</p>
              <p>Email: info@neminsurance.com.ng</p>
              <p>Website: www.neminsurance.com.ng</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-2">Regional Offices</p>
              <p>Abuja • Port Harcourt • Kano</p>
              <p>Ibadan • Enugu • Kaduna</p>
              <p className="mt-2 text-gray-500">RC: 2739 • Licensed by NAICOM</p>
            </div>
          </div>
          <div className="mt-4 text-center text-xs text-gray-500">
            <p>This is a computer-generated document. No signature is required.</p>
            <p className="mt-1">© {new Date().getFullYear()} NEM Insurance Plc. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          /* Hide everything except PDF container */
          body > *:not(.pdf-container) {
            display: none !important;
          }

          .pdf-container {
            width: 100%;
            max-width: none;
            margin: 0;
            padding: 0;
          }

          /* Ensure letterhead appears on every page */
          .pdf-header {
            position: running(header);
          }

          /* Ensure footer appears on every page */
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

          /* Prevent page breaks inside important elements */
          .pdf-no-break {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          /* Force page breaks where needed */
          .pdf-page-break {
            page-break-before: always;
            break-before: always;
          }
        }

        /* Screen styles for PDF preview */
        @media screen {
          .pdf-container {
            max-width: 210mm; /* A4 width */
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
            min-height: 200mm; /* Approximate A4 height minus header/footer */
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
