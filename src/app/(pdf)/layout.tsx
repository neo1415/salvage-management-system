/**
 * PDF Route Group Layout
 * Clean layout for PDF export routes - no dashboard chrome, no cookie banner
 */

import { ReactNode } from 'react';
import '@/app/globals.css';

export default function PDFGroupLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Report PDF Export</title>
      </head>
      <body className="bg-white">
        {children}
      </body>
    </html>
  );
}
