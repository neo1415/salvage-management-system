import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuditActionType, AuditEntityType, DeviceType, logAction } from '@/lib/utils/audit-logger';
import { logPolicyDecision } from '@/features/business-policy';

vi.mock('@/lib/utils/audit-logger', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils/audit-logger')>('@/lib/utils/audit-logger');

  return {
    ...actual,
    logAction: vi.fn(),
  };
});

describe('logPolicyDecision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes policy decisions through the existing audit logger', async () => {
    await logPolicyDecision({
      userId: 'user-123',
      entityType: AuditEntityType.BID,
      entityId: 'auction-123',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      deviceType: DeviceType.DESKTOP,
      decision: {
        policyVersion: 'nem-default-v1',
        decisionType: 'vendor_bid_allowed',
        rulePath: 'onboarding.tier1BidLimit',
        outcome: 'allow',
        entityType: 'vendor',
        entityId: 'vendor-123',
        reason: 'Bid is within configured eligibility.',
        inputs: { bidAmount: 450000 },
        resolvedValue: 500000,
        createdAt: '2026-05-24T00:00:00.000Z',
      },
      context: {
        mode: 'shadow',
      },
    });

    expect(logAction).toHaveBeenCalledWith({
      userId: 'user-123',
      actionType: AuditActionType.POLICY_DECISION_EVALUATED,
      entityType: AuditEntityType.BID,
      entityId: 'auction-123',
      ipAddress: '127.0.0.1',
      deviceType: DeviceType.DESKTOP,
      userAgent: 'vitest',
      afterState: {
        policyDecision: expect.objectContaining({
          policyVersion: 'nem-default-v1',
          decisionType: 'vendor_bid_allowed',
          rulePath: 'onboarding.tier1BidLimit',
        }),
        context: { mode: 'shadow' },
      },
    });
  });
});
