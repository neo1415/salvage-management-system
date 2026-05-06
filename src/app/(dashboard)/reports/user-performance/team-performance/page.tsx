'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, AlertCircle } from 'lucide-react';

export default function TeamPerformancePage() {
  return (
    <>
      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          /* Hide UI elements */
          nav, header, footer, .no-print,
          button, [role="button"],
          .sidebar, .navigation,
          input, select, textarea,
          [role="navigation"],
          [role="banner"],
          [role="complementary"] {
            display: none !important;
          }

          /* Reset body and html */
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }

          /* Container adjustments */
          .container {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Page setup */
          @page {
            size: A4 portrait;
            margin: 15mm;
          }

          /* Report content */
          [data-report-content] {
            display: block !important;
            width: 100% !important;
            overflow: visible !important;
            page-break-after: auto;
          }

          /* Cards and sections */
          .space-y-6 > * {
            page-break-inside: avoid;
            margin-bottom: 10px !important;
          }

          /* Cards */
          [class*="card"], [class*="Card"] {
            page-break-inside: avoid;
            break-inside: avoid;
            margin-bottom: 10px !important;
            box-shadow: none !important;
            border: 1px solid #ddd !important;
          }

          /* Ensure all content is visible */
          * {
            overflow: visible !important;
            box-sizing: border-box !important;
          }

          /* Remove shadows and transitions */
          * {
            box-shadow: none !important;
            text-shadow: none !important;
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>

      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between no-print">
          <div>
            <h1 className="text-3xl font-bold">Team Performance Report</h1>
            <p className="text-muted-foreground mt-2">
              Cross-functional team collaboration and performance metrics
            </p>
          </div>
        </div>

        <div data-report-content>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <CardTitle>Coming Soon</CardTitle>
              </div>
              <CardDescription>
                Team performance metrics will be available in a future update
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Team Performance Metrics</p>
                <p className="text-sm text-muted-foreground max-w-md">
                  This report will track team collaboration, cross-functional efficiency, and collective
                  performance metrics across departments.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
