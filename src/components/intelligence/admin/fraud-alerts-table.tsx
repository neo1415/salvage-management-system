'use client';

/**
 * Fraud Alerts Table Component
 * 
 * Displays pending fraud alerts with action buttons
 * Task: 11.1.4
 */

import { useEffect, useState } from 'react';
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
import { AlertTriangle, Eye, CheckCircle, XCircle } from 'lucide-react';
import { FraudAlertDetailModal } from './fraud-alert-detail-modal';

interface FraudAlert {
  id: string;
  entityType: string;
  entityId: string;
  riskScore: number;
  flagReasons: string[];
  status: string;
  createdAt: string;
}

interface FraudAlertsTableProps {
  onAlertUpdated?: () => void;
}

export function FraudAlertsTable({ onAlertUpdated }: FraudAlertsTableProps) {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    fetchAlerts();
  }, []);

  async function fetchAlerts() {
    try {
      const response = await fetch('/api/intelligence/fraud/alerts?status=pending&limit=10');
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Error fetching fraud alerts:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleViewDetails(alert: FraudAlert) {
    setSelectedAlert(alert);
    setShowDetailModal(true);
  }

  async function handleQuickAction(alertId: string, action: 'confirm' | 'dismiss') {
    try {
      const response = await fetch(`/api/intelligence/fraud/alerts/${alertId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        await fetchAlerts();
        onAlertUpdated?.();
      }
    } catch (error) {
      console.error('Error updating alert:', error);
    }
  }

  function getRiskBadgeVariant(riskScore: number) {
    if (riskScore >= 75) return 'destructive';
    if (riskScore >= 50) return 'default';
    return 'secondary';
  }

  if (loading) {
    return <div className="text-center py-8">Loading alerts...</div>;
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
        <p>No pending fraud alerts</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Risk</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Entity ID</TableHead>
            <TableHead>Reasons</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((alert) => (
            <TableRow key={alert.id}>
              <TableCell>
                <Badge variant={getRiskBadgeVariant(alert.riskScore)}>
                  {alert.riskScore}
                </Badge>
              </TableCell>
              <TableCell className="capitalize">{alert.entityType}</TableCell>
              <TableCell className="font-mono text-xs">{alert.entityId.substring(0, 8)}...</TableCell>
              <TableCell>
                <div className="max-w-xs truncate text-sm">
                  {alert.flagReasons[0]}
                  {alert.flagReasons.length > 1 && (
                    <span className="text-muted-foreground ml-1">
                      +{alert.flagReasons.length - 1} more
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(alert.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewDetails(alert)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleQuickAction(alert.id, 'confirm')}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleQuickAction(alert.id, 'dismiss')}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Dismiss
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedAlert && (
        <FraudAlertDetailModal
          alert={selectedAlert}
          open={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedAlert(null);
          }}
          onAlertUpdated={() => {
            fetchAlerts();
            onAlertUpdated?.();
          }}
        />
      )}
    </>
  );
}
