'use client';

/**
 * Schema Evolution Table Component
 * 
 * Displays detected schema changes and evolution log
 * Task: 15.1.4
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
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

interface SchemaChange {
  id: string;
  changeType: 'new_asset_type' | 'new_attribute' | 'schema_update';
  entityType: string;
  entityName: string;
  detectedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  sampleCount: number;
  confidence: number;
  metadata?: any;
}

export function SchemaEvolutionTable() {
  const [changes, setChanges] = useState<SchemaChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSchemaChanges();
  }, []);

  async function fetchSchemaChanges() {
    try {
      const response = await fetch('/api/intelligence/admin/schema/pending');
      if (response.ok) {
        const result = await response.json();
        // API returns { success: true, data: { pendingChanges: [...] } }
        setChanges(result.data?.pendingChanges || []);
      }
    } catch (error) {
      console.error('Error fetching schema changes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(changeId: string) {
    try {
      const response = await fetch('/api/intelligence/admin/schema/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeId, action: 'approve' }),
      });

      if (response.ok) {
        await fetchSchemaChanges();
      }
    } catch (error) {
      console.error('Error approving schema change:', error);
    }
  }

  async function handleReject(changeId: string) {
    try {
      const response = await fetch('/api/intelligence/admin/schema/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeId, action: 'reject' }),
      });

      if (response.ok) {
        await fetchSchemaChanges();
      }
    } catch (error) {
      console.error('Error rejecting schema change:', error);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Schema Evolution</CardTitle>
          <CardDescription>Detected schema changes</CardDescription>
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
        <CardTitle>Schema Evolution</CardTitle>
        <CardDescription>
          {changes.filter(c => c.status === 'pending').length} pending changes
        </CardDescription>
      </CardHeader>
      <CardContent>
        {changes.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground">
            No schema changes detected
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Detected</TableHead>
                <TableHead>Samples</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {changes.map((change) => (
                <TableRow key={change.id}>
                  <TableCell>
                    <Badge variant="outline">
                      {change.changeType.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{change.entityType}</TableCell>
                  <TableCell>{change.entityName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(change.detectedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{change.sampleCount}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={change.confidence >= 0.8 ? 'default' : 'secondary'}
                    >
                      {(change.confidence * 100).toFixed(0)}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {change.status === 'pending' && (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        Pending
                      </Badge>
                    )}
                    {change.status === 'approved' && (
                      <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                        <CheckCircle className="h-3 w-3" />
                        Approved
                      </Badge>
                    )}
                    {change.status === 'rejected' && (
                      <Badge variant="outline" className="gap-1 text-red-600 border-red-600">
                        <XCircle className="h-3 w-3" />
                        Rejected
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {change.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApprove(change.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(change.id)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
