# SOC 2-Style Readiness Control Map

Status: Internal readiness draft. Not a SOC 2 report.

## Security

Current evidence:

- role-based access model
- secure session cookie configuration
- password hashing
- account lockout
- optional MFA
- webhook signature validation
- audit logging
- audit log hash-chain metadata and append-only database trigger migration
- high-risk API route authorization guardrail test
- full API route inventory guardrail test
- KYC encryption paths
- sensitive audit-data sanitization

Needed:

- formal access review process
- privileged access approvals
- secure SDLC policy
- vulnerability management evidence
- incident response evidence
- third-party penetration test

## Availability

Current evidence:

- retry helpers
- cron jobs
- provider integrations
- backup scripts

Needed:

- RTO/RPO
- tested restore evidence
- monitoring/alerting
- uptime commitments
- incident response drills
- provider outage playbooks

## Processing Integrity

Current evidence:

- payment webhook verification
- wallet row locking
- payment/reconciliation jobs
- policy validation
- KYC normalization
- document progress checks
- deposit freeze policy regression guardrail

Needed:

- financial reconciliation sign-off
- payment exception workflow
- DB-backed integration tests for payment edge cases
- report validation
- manual adjustment controls

## Confidentiality

Current evidence:

- selected encryption for sensitive KYC data
- audit sanitization
- server-mediated document downloads
- role-based access checks

Needed:

- data classification
- key management and rotation policy
- document URL exposure review
- least-privilege provider access review
- secure deletion process

## Privacy

Current evidence:

- legal page structure
- KYC data modeling
- masking and audit sanitization
- authenticated privacy/data-rights request workflow in Settings
- admin privacy request review workflow
- retention/blocker dry-run for privacy request fulfilment

Needed:

- legal-approved privacy notice
- legal-approved DPA
- deployment-specific subprocessor list
- final DSAR fulfilment SOP and owner assignment
- retention/deletion schedule and enforcement jobs
- NDPA/NDPC review
