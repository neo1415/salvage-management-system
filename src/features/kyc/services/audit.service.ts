import {
  logAction,
  AuditActionType,
  AuditEntityType,
  DeviceType,
} from '@/lib/utils/audit-logger';

interface KYCAuditParams {
  vendorId: string;
  actorId: string;
  action: AuditActionType;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
}

/**
 * KYC-specific audit service.
 * Wraps the existing logAction utility with KYC-specific defaults.
 * Never updates or deletes audit records.
 */
export class KYCAuditService {
  async log(params: KYCAuditParams): Promise<void> {
    await logAction({
      userId: params.actorId,
      actionType: params.action,
      entityType: AuditEntityType.KYC,
      entityId: params.vendorId,
      ipAddress: params.ipAddress ?? 'unknown',
      deviceType: DeviceType.DESKTOP,
      userAgent: params.userAgent ?? 'unknown',
      beforeState: params.beforeState,
      afterState: params.afterState,
    });
  }

  async logWidgetLaunch(vendorId: string, actorId: string, ipAddress: string): Promise<void> {
    await this.log({
      vendorId,
      actorId,
      action: AuditActionType.TIER2_KYC_INITIATED,
      ipAddress,
      afterState: { event: 'widget_launched', timestamp: new Date().toISOString() },
    });
  }

  async logVerificationResult(
    vendorId: string,
    actorId: string,
    referenceId: string,
    result: { livenessScore?: number; biometricMatchScore?: number; amlRiskLevel?: string }
  ): Promise<void> {
    await this.log({
      vendorId,
      actorId,
      action: AuditActionType.TIER2_KYC_SUBMITTED,
      afterState: { referenceId, ...result, timestamp: new Date().toISOString() },
    });
  }

  async logManagerDecision(
    vendorId: string,
    managerId: string,
    decision: 'approve' | 'reject',
    reason?: string
  ): Promise<void> {
    const action =
      decision === 'approve'
        ? AuditActionType.TIER2_APPLICATION_APPROVED
        : AuditActionType.TIER2_APPLICATION_REJECTED;

    await this.log({
      vendorId,
      actorId: managerId,
      action,
      afterState: { decision, reason, timestamp: new Date().toISOString() },
    });
  }

  async logTierChange(
    vendorId: string,
    actorId: string,
    oldTier: string,
    newTier: string,
    reason: string
  ): Promise<void> {
    await this.log({
      vendorId,
      actorId,
      action: AuditActionType.TIER2_APPLICATION_APPROVED,
      beforeState: { tier: oldTier },
      afterState: { tier: newTier, reason, timestamp: new Date().toISOString() },
    });
  }
}

let _instance: KYCAuditService | null = null;

export function getKYCAuditService(): KYCAuditService {
  if (!_instance) _instance = new KYCAuditService();
  return _instance;
}
