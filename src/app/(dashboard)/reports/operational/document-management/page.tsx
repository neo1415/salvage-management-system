'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, AlertCircle } from 'lucide-react';

export default function DocumentManagementPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Document Management Report</h1>
          <p className="text-muted-foreground mt-2">
            Document tracking and management metrics
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <CardTitle>Coming Soon</CardTitle>
          </div>
          <CardDescription>
            Document management metrics will be available when document tracking is fully implemented
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Document Management Metrics</p>
            <p className="text-sm text-muted-foreground max-w-md">
              This report will track document generation, signing, verification, and compliance metrics
              across all salvage cases and auctions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
