/**
 * Export Form Component
 * 
 * Task 11.5.2: Implement export form with filters
 * 
 * @module components/intelligence/admin/export
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Calendar as CalendarIcon } from 'lucide-react';
import { format as formatDate } from 'date-fns';
import { cn } from '@/lib/utils';
import { ExportJob } from './data-export-content';

interface ExportFormProps {
  onExportStart: (job: ExportJob) => void;
  onExportComplete: (jobId: string, downloadUrl: string, metadata: any) => void;
  onExportError: (jobId: string, error: string) => void;
}

export function ExportForm({ onExportStart, onExportComplete, onExportError }: ExportFormProps) {
  const [dataType, setDataType] = useState<ExportJob['dataType']>('predictions');
  const [exportFormat, setExportFormat] = useState<ExportJob['format']>('csv');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [anonymize, setAnonymize] = useState(true);
  const [includeFeatures, setIncludeFeatures] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Create export job
    const jobId = `export_${Date.now()}`;
    const job: ExportJob = {
      id: jobId,
      dataType,
      format: exportFormat,
      status: 'processing',
      progress: 0,
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
      filters: {
        anonymize,
        includeFeatures,
      },
      createdAt: new Date().toISOString(),
    };

    onExportStart(job);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('dataType', dataType);
      params.append('format', exportFormat);
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      if (anonymize) params.append('anonymize', 'true');
      if (includeFeatures) params.append('includeFeatures', 'true');

      // Call export API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      const response = await fetch(`/api/intelligence/export?${params.toString()}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }

      // Get the blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Extract metadata from headers
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || `export.${exportFormat}`;

      onExportComplete(jobId, url, {
        fileSize: blob.size,
        recordCount: 0, // Would be in response headers in production
        filename,
      });

    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error 
        ? (error.name === 'AbortError' ? 'Export timed out after 60 seconds' : error.message)
        : 'Export failed';
      
      onExportError(jobId, errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure Export</CardTitle>
        <CardDescription>
          Select data type, format, and filters for your export
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Data Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="dataType">Data Type</Label>
            <Select value={dataType} onValueChange={(value: any) => setDataType(value)}>
              <SelectTrigger id="dataType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="predictions">Predictions</SelectItem>
                <SelectItem value="recommendations">Recommendations</SelectItem>
                <SelectItem value="interactions">Interactions</SelectItem>
                <SelectItem value="fraud_alerts">Fraud Alerts</SelectItem>
                <SelectItem value="analytics">Analytics Data</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {dataType === 'predictions' && 'Export auction price predictions with accuracy metrics'}
              {dataType === 'recommendations' && 'Export vendor recommendations with effectiveness data'}
              {dataType === 'interactions' && 'Export vendor interaction events and session data'}
              {dataType === 'fraud_alerts' && 'Export fraud detection alerts and review outcomes'}
              {dataType === 'analytics' && 'Export aggregated analytics and performance metrics'}
            </p>
          </div>

          {/* Format Selection */}
          <div className="space-y-2">
            <Label htmlFor="format">Export Format</Label>
            <Select value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
              <SelectTrigger id="format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV (Comma-Separated Values)</SelectItem>
                <SelectItem value="json">JSON (JavaScript Object Notation)</SelectItem>
                <SelectItem value="excel">Excel Workbook (.xlsx)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !startDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? formatDate(startDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      if (date && !(date instanceof Date)) return;
                      setStartDate(date);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !endDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? formatDate(endDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      if (date && !(date instanceof Date)) return;
                      setEndDate(date);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Export Options */}
          <div className="space-y-4">
            <Label>Export Options</Label>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="anonymize"
                checked={anonymize}
                onCheckedChange={(checked) => setAnonymize(checked as boolean)}
              />
              <label
                htmlFor="anonymize"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Anonymize PII (GDPR Compliant)
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeFeatures"
                checked={includeFeatures}
                onCheckedChange={(checked) => setIncludeFeatures(checked as boolean)}
              />
              <label
                htmlFor="includeFeatures"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Include feature vectors (for ML training)
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            <Download className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Preparing Export...' : 'Start Export'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
