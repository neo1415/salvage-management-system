# White-Label and Client Isolation Model

## Intended Isolation Model

Salvage Bridge is designed for insurer-specific white-label deployments. The safest operating model is one deployment/database/environment per insurer.

This means each insurer has its own:

- database
- application URL/domain
- environment variables
- provider credentials
- payment setup
- KYC setup
- branding/business policy
- notification sender setup
- document template settings

## Why This Matters

Per-insurer deployment isolation helps reduce:

- accidental cross-client data access
- shared-provider configuration mistakes
- branding leakage
- legal-template leakage
- policy conflicts between insurers
- payment/KYC reconciliation confusion

## Brand-Specific Configuration

The insurer controls or approves:

- brand name
- logo
- public homepage template
- support email and phone
- legal name and address
- document template content
- auction rules
- payment rules
- KYC/onboarding rules
- notification tone and contact points

## Salvage Bridge-Owned Configuration

Salvage Bridge should retain control of:

- platform source code
- security defaults
- release process
- core architecture
- provider integration framework
- support process
- compliance documentation
- vulnerability management process

## Public / Private Policy Separation

Public policy should expose only what the public app needs, such as branding, public copy, enabled login methods, enabled payment methods, support contact details, and auction-facing rules.

Private policy should keep secrets, provider keys, internal IDs, and operational controls out of public responses.

## Client Onboarding Checklist

1. Confirm insurer legal and brand details.
2. Confirm domain/subdomain.
3. Confirm support contacts.
4. Confirm payment provider account.
5. Confirm KYC provider account.
6. Confirm email/SMS sender identities.
7. Confirm document templates/legal copy.
8. Confirm auction rules and deposit policy.
9. Confirm user roles and staff onboarding.
10. Confirm go-live test plan.

