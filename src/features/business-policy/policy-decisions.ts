import type { BusinessPolicy, PolicyDecisionRecord, PolicyDecisionType } from './types';

type CreatePolicyDecisionRecordInput = {
  policy: Pick<BusinessPolicy, 'version'>;
  decisionType: PolicyDecisionType;
  rulePath: string;
  outcome: PolicyDecisionRecord['outcome'];
  entityType: PolicyDecisionRecord['entityType'];
  entityId?: string;
  reason: string;
  inputs?: PolicyDecisionRecord['inputs'];
  resolvedValue?: PolicyDecisionRecord['resolvedValue'];
};

export function createPolicyDecisionRecord(input: CreatePolicyDecisionRecordInput): PolicyDecisionRecord {
  return {
    policyVersion: input.policy.version,
    decisionType: input.decisionType,
    rulePath: input.rulePath,
    outcome: input.outcome,
    entityType: input.entityType,
    entityId: input.entityId,
    reason: input.reason,
    inputs: input.inputs,
    resolvedValue: input.resolvedValue,
    createdAt: new Date().toISOString(),
  };
}

