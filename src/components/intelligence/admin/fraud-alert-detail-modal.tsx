'use client';

/**
 * Fraud Alert Detail Modal Component
 * 
 * Displays detailed fraud alert information with action buttons
 * Tasks: 11.2.1-11.2.8
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Ban,
  Image as ImageIcon,
  Users,
  FileText,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface FraudAlert {
  id: string;
  entityType: string;
  entityId: string;
  riskScore: number;
  flagReasons: string[];
  status: string;
  createdAt: string;
  metadata?: any;
}

interface FraudAlertDetailModalProps {
  alert: FraudAlert;
  open: boolean;
  onClose: () => void;
  onAlertUpdated: () => void;
}

export function FraudAlertDetailModal({
  alert,
  open,
  onClose,
  onAlertUpdated,
}: FraudAlertDetailModalProps) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (open) {
      fetchAlertDetails();
    }
  }, [open, alert.id]);

  async function fetchAlertDetails() {
    try {
      setLoading(true);
      const response = await fetch(`/api/intelligence/fraud/alerts/${alert.id}`);
      if (response.ok) {
        const data = await response.json();
        setDetails(data);
      }
    } catch (error) {
      console.error('Error fetching alert details:', error);
      toast.error('Failed to load alert details');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: 'confirm' | 'dismiss' | 'suspend') {
    try {
      setActionLoading(true);
      const response = await fetch(`/api/intelligence/fraud/alerts/${alert.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        toast.success(`Alert ${action}ed successfully`);
        onAlertUpdated();
        onClose();
      } else {
        throw new Error('Failed to update alert');
      }
    } catch (error) {
      console.error('Error updating alert:', error);
      toast.error('Failed to update alert');
    } finally {
      setActionLoading(false);
    }
  }

  function getRiskColor(score: number) {
    if (score >= 75) return 'text-red-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-blue-600';
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Fraud Alert Details
          </DialogTitle>
          <DialogDescription>
            Review and take action on this fraud alert
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center">Loading details...</div>
        ) : (
          <div className="space-y-6">
            {/* Task 11.2.2: Fraud alert summary display */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Risk Score</p>
                <p className={`text-2xl font-bold ${getRiskColor(alert.riskScore)}`}>
                  {alert.riskScore}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Entity Type</p>
                <p className="text-lg font-semibold capitalize">{alert.entityType}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Entity ID</p>
                <p className="text-sm font-mono">{alert.entityId}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="text-sm">{new Date(alert.createdAt).toLocaleString()}</p>
              </div>
            </div>

            <Separator />

            {/* Flag Reasons */}
            <div>
              <h3 className="font-semibold mb-2">Flag Reasons</h3>
              <div className="space-y-2">
                {alert.flagReasons.map((reason, index) => (
                  <Alert key={index}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{reason}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>

            {/* Task 11.2.3: Entity-specific details */}
            {alert.entityType === 'vendor' && details?.vendorDetails && (
              <VendorDetails details={details.vendorDetails} />
            )}

            {alert.entityType === 'case' && details?.caseDetails && (
              <CaseDetails details={details.caseDetails} />
            )}

            {/* Task 11.2.4: Duplicate photo comparison view */}
            {details?.duplicatePhotos && details.duplicatePhotos.length > 0 && (
              <DuplicatePhotoComparison photos={details.duplicatePhotos} />
            )}

            {/* Task 11.2.5: Collusion evidence table */}
            {details?.collusionEvidence && (
              <CollusionEvidence evidence={details.collusionEvidence} />
            )}

            <Separator />

            {/* Task 11.2.6: Action buttons */}
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => handleAction('dismiss')}
                disabled={actionLoading}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Dismiss
              </Button>
              <Button
                variant="default"
                onClick={() => handleAction('confirm')}
                disabled={actionLoading}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirm Fraud
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleAction('suspend')}
                disabled={actionLoading}
              >
                <Ban className="h-4 w-4 mr-2" />
                Suspend Account
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VendorDetails({ details }: { details: any }) {
  return (
    <div>
      <h3 className="font-semibold mb-2 flex items-center gap-2">
        <Users className="h-4 w-4" />
        Vendor Details
      </h3>
      <div className="bg-muted p-4 rounded-lg space-y-2">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Business Name</p>
            <p className="font-medium">{details.businessName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Bids</p>
            <p className="font-medium">{details.totalBids}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Win Rate</p>
            <p className="font-medium">{details.winRate}%</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Account Age</p>
            <p className="font-medium">{details.accountAge} days</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CaseDetails({ details }: { details: any }) {
  return (
    <div>
      <h3 className="font-semibold mb-2 flex items-center gap-2">
        <FileText className="h-4 w-4" />
        Case Details
      </h3>
      <div className="bg-muted p-4 rounded-lg space-y-2">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Asset Type</p>
            <p className="font-medium capitalize">{details.assetType}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Damage Severity</p>
            <p className="font-medium capitalize">{details.damageSeverity}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Market Value</p>
            <p className="font-medium">₦{details.marketValue?.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Photos</p>
            <p className="font-medium">{details.photoCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DuplicatePhotoComparison({ photos }: { photos: any[] }) {
  return (
    <div>
      <h3 className="font-semibold mb-2 flex items-center gap-2">
        <ImageIcon className="h-4 w-4" />
        Duplicate Photos Detected
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {photos.map((photo, index) => (
          <div key={index} className="border rounded-lg p-3">
            <img
              src={photo.url}
              alt={`Duplicate ${index + 1}`}
              className="w-full h-48 object-cover rounded mb-2"
            />
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">
                Similarity: <span className="font-semibold">{photo.similarity}%</span>
              </p>
              <p className="text-muted-foreground">
                Case: <span className="font-mono text-xs">{photo.caseId}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CollusionEvidence({ evidence }: { evidence: any[] }) {
  return (
    <div>
      <h3 className="font-semibold mb-2">Collusion Evidence</h3>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3">Vendor ID</th>
              <th className="text-left p-3">Adjuster ID</th>
              <th className="text-left p-3">Win Rate</th>
              <th className="text-left p-3">Suspicious Wins</th>
            </tr>
          </thead>
          <tbody>
            {evidence.map((item, index) => (
              <tr key={index} className="border-t">
                <td className="p-3 font-mono text-xs">{item.vendorId.substring(0, 8)}...</td>
                <td className="p-3 font-mono text-xs">{item.adjusterId.substring(0, 8)}...</td>
                <td className="p-3 font-semibold text-red-600">{item.winRate}%</td>
                <td className="p-3">{item.suspiciousWins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
