'use client';

/**
 * ML Datasets Table Component
 * 
 * Displays available ML training datasets with export functionality
 * Task: 15.1.5
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, Database, Calendar } from 'lucide-react';

interface MLDataset {
  id: string;
  datasetType: 'price_prediction' | 'recommendation' | 'fraud_detection';
  recordCount: number;
  featureCount: number;
  createdAt: string;
  format: 'csv' | 'json' | 'parquet';
  size: number;
  trainSplit: number;
  validationSplit: number;
  testSplit: number;
}

export function MLDatasetsTable() {
  const [datasets, setDatasets] = useState<MLDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetchDatasets();
  }, []);

  async function fetchDatasets() {
    try {
      const response = await fetch('/api/intelligence/ml/datasets');
      if (response.ok) {
        const result = await response.json();
        // API returns { success: true, data: [...] }
        setDatasets(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching datasets:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(datasetId: string) {
    try {
      setDownloading(datasetId);
      const response = await fetch(`/api/intelligence/ml/export-dataset?datasetId=${datasetId}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ml-dataset-${datasetId}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading dataset:', error);
    } finally {
      setDownloading(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ML Training Datasets</CardTitle>
          <CardDescription>Available datasets for model training</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ML Training Datasets</CardTitle>
        <CardDescription>
          {datasets.length} dataset{datasets.length !== 1 ? 's' : ''} available
        </CardDescription>
      </CardHeader>
      <CardContent>
        {datasets.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground">
            No datasets available
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Features</TableHead>
                <TableHead>Split</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datasets.map((dataset) => (
                <TableRow key={dataset.id}>
                  <TableCell>
                    <Badge variant="outline">
                      {dataset.datasetType.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {dataset.recordCount.toLocaleString()}
                  </TableCell>
                  <TableCell>{dataset.featureCount}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex flex-col gap-1">
                      <span>Train: {dataset.trainSplit}%</span>
                      <span>Val: {dataset.validationSplit}%</span>
                      <span>Test: {dataset.testSplit}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{dataset.format.toUpperCase()}</Badge>
                  </TableCell>
                  <TableCell>{formatBytes(dataset.size)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(dataset.createdAt).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(dataset.id)}
                      disabled={downloading === dataset.id}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      {downloading === dataset.id ? 'Downloading...' : 'Download'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Database className="h-4 w-4" />
          <span>
            Total records: {datasets.reduce((sum, d) => sum + d.recordCount, 0).toLocaleString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
