import { getEmailDomain, isPersonalEmail } from '@/lib/utils/email-validation';
import type { BusinessPolicy, PolicyDecision } from './types';
import { createPolicyDecisionRecord } from './policy-decisions';

export type AuthProvider = 'credentials' | 'google' | 'facebook';

export function resolveAuthProviderAccess(
  policy: BusinessPolicy,
  provider: AuthProvider
): PolicyDecision<AuthProvider> {
  const enabled =
    provider === 'credentials'
      ? policy.auth.emailPasswordEnabled
      : provider === 'google'
        ? policy.auth.googleOAuthEnabled
        : false;

  return {
    allowed: enabled,
    value: provider,
    message: enabled
      ? `${provider} authentication is enabled by policy.`
      : `${provider} authentication is disabled for this workspace.`,
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: enabled ? 'auth_provider_allowed' : 'auth_provider_denied',
      rulePath: provider === 'credentials' ? 'auth.emailPasswordEnabled' : 'auth.googleOAuthEnabled',
      outcome: enabled ? 'allow' : 'deny',
      entityType: 'vendor',
      reason: enabled ? 'Authentication provider is enabled.' : 'Authentication provider is disabled.',
      inputs: { provider },
      resolvedValue: enabled,
    }),
  };
}

export function resolveEmailDomainAccess(
  policy: BusinessPolicy,
  email: string
): PolicyDecision<string | null> {
  const domain = getEmailDomain(email);
  const allowedDomains = policy.auth.allowedEmailDomains.map((allowedDomain) => allowedDomain.toLowerCase());
  const domainAllowlisted = Boolean(domain && allowedDomains.includes(domain));
  const businessEmailAllowed = !policy.auth.businessEmailOnly || domainAllowlisted || !isPersonalEmail(email);

  return {
    allowed: businessEmailAllowed,
    value: domain,
    message: businessEmailAllowed
      ? 'Email domain is allowed by policy.'
      : 'A business email address is required for this workspace.',
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: businessEmailAllowed ? 'auth_email_domain_allowed' : 'auth_email_domain_denied',
      rulePath: policy.auth.businessEmailOnly ? 'auth.businessEmailOnly' : 'auth.allowedEmailDomains',
      outcome: businessEmailAllowed ? 'allow' : 'deny',
      entityType: 'vendor',
      reason: businessEmailAllowed
        ? 'Email satisfies configured business-email requirements.'
        : 'Email is from a personal/disallowed provider while business-email-only mode is enabled.',
      inputs: {
        domain,
        businessEmailOnly: policy.auth.businessEmailOnly,
      },
      resolvedValue: domainAllowlisted || !isPersonalEmail(email),
    }),
  };
}
