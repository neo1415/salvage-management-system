import type { BusinessPolicy, PolicyDecision } from './types';
import { createPolicyDecisionRecord } from './policy-decisions';

type CaseAssetTypeDecisionValue = {
  assetType: string;
  label?: string;
  promptProfile?: string;
};

export function resolveCaseAssetTypeAllowed(
  policy: BusinessPolicy,
  assetType: string
): PolicyDecision<CaseAssetTypeDecisionValue> {
  const normalizedAssetType = assetType.trim().toLowerCase();
  const assetPolicy = policy.cases.enabledAssetTypes[normalizedAssetType];
  const allowed = Boolean(assetPolicy?.enabled);

  return {
    allowed,
    value: {
      assetType: normalizedAssetType,
      label: assetPolicy?.label,
      promptProfile: assetPolicy?.promptProfile,
    },
    message: allowed
      ? `${assetPolicy?.label ?? normalizedAssetType} case creation is enabled by policy.`
      : `${assetPolicy?.label ?? normalizedAssetType} case creation is not enabled for this workspace.`,
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: allowed ? 'case_asset_type_allowed' : 'case_asset_type_denied',
      rulePath: assetPolicy
        ? `cases.enabledAssetTypes.${normalizedAssetType}.enabled`
        : 'cases.enabledAssetTypes',
      outcome: allowed ? 'allow' : 'deny',
      entityType: 'case',
      reason: allowed
        ? 'The submitted case asset type is enabled in the active business policy.'
        : 'The submitted case asset type is disabled or not configured in the active business policy.',
      inputs: {
        assetType: normalizedAssetType,
      },
      resolvedValue: allowed,
    }),
  };
}
