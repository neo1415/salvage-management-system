/**
 * Data Export Content Component
 * 
 * Tasks:
 * - 11.5.2: Implement export form with filters
 * - 11.5.3: Implement export progress indicator
 * - 11.5.4: Implement download functionality
 * - 11.5.5: Implement export history table
 * 
 * @module components/intelligence/admin/export
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExportForm } from './export-form';
import { ExportProgress } from './export-progress';
import { ExportHistory } from './export-history';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface ExportJob {
  id: string;
  dataType: 'predictions' | 'recommendations' | 'interactions' | 'fraud_alerts' | 'analytics';
  format: 'csv' | 'json' | 'excel';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  startDate?: string;
  endDate?: string;
  filters?: Record<string, any>;
  downloadUrl?: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
  fileSize?: number;
  recordCount?: number;
}

export function DataExportContent() {
  const [activeExport, setActiveExport] = useState<ExportJob | null>(null);
  const [exportHistory, setExportHistory] = useState<ExportJob[]>([]);

  const handleExportStart = (job: ExportJob) => {
    setActiveExport(job);
    setExportHistory(prev => [job, ...prev]);
  };

  const handleExportComplete = (jobId: string, downloadUrl: string, metadata: any) => {
    setActiveExport(prev => {
      if (prev?.id === jobId) {
        return {
          ...prev,
          status: 'completed',
          progress: 100,
          downloadUrl,
          completedAt: new Date().toISOString(),
          fileSize: metadata.fileSize,
          recordCount: metadata.recordCount,
        };
      }
      return prev;
    });

    setExportHistory(prev =>
      prev.map(job =>
        job.id === jobId
          ? {
              ...job,
              status: 'completed',
              progress: 100,
              downloadUrl,
              completedAt: new Date().toISOString(),
              fileSize: metadata.fileSize,
              recordCount: metadata.recordCount,
            }
          : job
      )
    );
  };

  const handleExportError = (jobId: string, error: string) => {
    setActiveExport(prev => {
      if (prev?.id === jobId) {
        return {
          ...prev,
          status: 'failed',
          error,
          completedAt: new Date().toISOString(),
        };
      }
      return prev;
    });

    setExportHistory(prev =>
      prev.map(job =>
        job.id === jobId
          ? {
              ...job,
              status: 'failed',
              error,
              completedAt: new Date().toISOString(),
            }
          : job
      )
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Data Export</h1>
        <p className="text-muted-foreground mt-2">
          Export intelligence data for analysis, reporting, and ML training
        </p>
      </div>

      <Tabs defaultValue="export" className="space-y-6">
        <TabsList>
          <TabsTrigger value="export">New Export</TabsTrigger>
          <TabsTrigger value="history">Export History</TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="space-y-6">
          <ExportForm
            onExportStart={handleExportStart}
            onExportComplete={handleExportComplete}
            onExportError={handleExportError}
          />

          {activeExport && (
            <ExportProgress
              job={activeExport}
              onComplete={() => setActiveExport(null)}
            />
          )}
        </TabsContent>

        <TabsContent value="history">
          <ExportHistory
            exports={exportHistory}
            onRetry={(job) => {
              // Create new export with same parameters
              const newJob: ExportJob = {
                ...job,
                id: `export_${Date.now()}`,
                status: 'pending',
                progress: 0,
                createdAt: new Date().toISOString(),
                completedAt: undefined,
                downloadUrl: undefined,
                error: undefined,
              };
              handleExportStart(newJob);
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
