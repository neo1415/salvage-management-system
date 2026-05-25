import {
  AuditActionType,
  AuditEntityType,
  DeviceType,
  logAction,
} from '@/lib/utils/audit-logger';
import type { PolicyDecisionRecord } from './types';

type LogPolicyDecisionInput = {
  userId: string;
  entityType: AuditEntityType;
  entityId: string;
  ipAddress: string;
  userAgent: string;
  deviceType?: DeviceType;
  decision: PolicyDecisionRecord;
  context?: Record<string, unknown>;
};

export async function logPolicyDecision(input: LogPolicyDecisionInput): Promise<void> {
  await logAction({
    userId: input.userId,
    actionType: AuditActionType.POLICY_DECISION_EVALUATED,
    entityType: input.entityType,
    entityId: input.entityId,
    ipAddress: input.ipAddress,
    deviceType: input.deviceType ?? DeviceType.DESKTOP,
    userAgent: input.userAgent,
    afterState: {
      policyDecision: input.decision,
      context: input.context ?? {},
    },
  });
}
