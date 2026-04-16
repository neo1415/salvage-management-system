/**
 * Export Progress Component
 * 
 * Task 11.5.3: Implement export progress indicator
 * Task 11.5.4: Implement download functionality
 * 
 * @module components/intelligence/admin/export
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { ExportJob } from './data-export-content';

interface ExportProgressProps {
  job: ExportJob;
  onComplete: () => void;
}

export function ExportProgress({ job, onComplete }: ExportProgressProps) {
  const [progress, setProgress] = useState(job.progress);

  useEffect(() => {
    // Simulate progress updates
    if (job.status === 'processing') {
      const interval = setInterval(() => {
        setProgress(prev => {
          // Cap progress at 95% to prevent going over 100%
          if (prev >= 95) return 95;
          return Math.min(95, prev + Math.random() * 10);
        });
      }, 500);

      return () => clearInterval(interval);
    } else if (job.status === 'completed') {
      setProgress(100);
    }
  }, [job.status]);

  const handleDownload = () => {
    if (job.downloadUrl) {
      const link = document.createElement('a');
      link.href = job.downloadUrl;
      link.download = `${job.dataType}_export_${Date.now()}.${job.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatRecordCount = (count?: number) => {
    if (!count) return 'Unknown';
    return count.toLocaleString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {job.status === 'processing' && (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Export in Progress
            </>
          )}
          {job.status === 'completed' && (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Export Completed
            </>
          )}
          {job.status === 'failed' && (
            <>
              <XCircle className="h-5 w-5 text-red-600" />
              Export Failed
            </>
          )}
        </CardTitle>
        <CardDescription>
          {job.dataType.charAt(0).toUpperCase() + job.dataType.slice(1)} export to {job.format.toUpperCase()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        {job.status === 'processing' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Processing...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Success State */}
        {job.status === 'completed' && (
          <>
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Your export is ready for download
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">File Size</p>
                <p className="font-medium">{formatFileSize(job.fileSize)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Records</p>
                <p className="font-medium">{formatRecordCount(job.recordCount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Started</p>
                <p className="font-medium">
                  {new Date(job.createdAt).toLocaleTimeString()}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Completed</p>
                <p className="font-medium">
                  {job.completedAt ? new Date(job.completedAt).toLocaleTimeString() : '-'}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleDownload} className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                Download File
              </Button>
              <Button variant="outline" onClick={onComplete}>
                Done
              </Button>
            </div>
          </>
        )}

        {/* Error State */}
        {job.status === 'failed' && (
          <>
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                {job.error || 'An error occurred during export'}
              </AlertDescription>
            </Alert>

            <Button variant="outline" onClick={onComplete} className="w-full">
              Close
            </Button>
          </>
        )}

        {/* Export Details */}
        <div className="pt-4 border-t space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Export ID</span>
            <span className="font-mono text-xs">{job.id}</span>
          </div>
          {job.startDate && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date Range</span>
              <span>
                {new Date(job.startDate).toLocaleDateString()} -{' '}
                {job.endDate ? new Date(job.endDate).toLocaleDateString() : 'Now'}
              </span>
            </div>
          )}
          {job.filters && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Filters</span>
              <span>
                {job.filters.anonymize && 'Anonymized, '}
                {job.filters.includeFeatures && 'With Features'}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
