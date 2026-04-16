/**
 * Export History Component
 * 
 * Task 11.5.5: Implement export history table
 * 
 * @module components/intelligence/admin/export
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { ExportJob } from './data-export-content';

interface ExportHistoryProps {
  exports: ExportJob[];
  onRetry: (job: ExportJob) => void;
}

export function ExportHistory({ exports, onRetry }: ExportHistoryProps) {
  const handleDownload = (job: ExportJob) => {
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
    if (!bytes) return '-';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDuration = (start: string, end?: string) => {
    if (!end) return '-';
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const seconds = Math.floor(duration / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  const getStatusBadge = (status: ExportJob['status']) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="default" className="bg-blue-600">
            <Clock className="mr-1 h-3 w-3" />
            Processing
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
    }
  };

  if (exports.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Export History</CardTitle>
          <CardDescription>View and manage your previous exports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-muted-foreground">No exports yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Create your first export using the form above
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export History</CardTitle>
        <CardDescription>
          View and download your previous exports ({exports.length} total)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Type</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date Range</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exports.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">
                    {job.dataType.charAt(0).toUpperCase() + job.dataType.slice(1)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{job.format.toUpperCase()}</Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(job.status)}</TableCell>
                  <TableCell className="text-sm">
                    {job.startDate && job.endDate ? (
                      <>
                        {new Date(job.startDate).toLocaleDateString()} -{' '}
                        {new Date(job.endDate).toLocaleDateString()}
                      </>
                    ) : (
                      'All time'
                    )}
                  </TableCell>
                  <TableCell>{formatFileSize(job.fileSize)}</TableCell>
                  <TableCell>{formatDuration(job.createdAt, job.completedAt)}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(job.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {job.status === 'completed' && job.downloadUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(job)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {job.status === 'failed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRetry(job)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
