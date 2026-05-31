# Incident Response Policy Draft

Status: Draft for operational/legal review  

## Purpose

This policy defines a practical response process for suspected or confirmed security, privacy, availability, or payment-impacting incidents.

## Severity Levels

| Severity | Description |
| --- | --- |
| Critical | Confirmed breach, production outage, payment integrity issue, or KYC/document exposure. |
| High | Major workflow disruption, suspected unauthorized access, repeated provider failure. |
| Medium | Limited user impact or contained security issue. |
| Low | Informational issue or low-risk anomaly. |

## Response Steps

1. Detect and record issue.
2. Triage severity.
3. Preserve evidence.
4. Contain impact.
5. Notify internal stakeholders.
6. Investigate root cause.
7. Remediate.
8. Communicate to client if applicable.
9. Document post-incident review.
10. Track corrective actions.

## Client Notification

Client notification should occur without undue delay after confirmation and initial containment. Final timelines should be defined in the applicable agreement and adjusted for legal obligations.

## Evidence to Preserve

- timestamps
- user IDs
- affected entities
- logs
- provider webhook events
- payment references
- deployment/version details
- screenshots where relevant
- communications

## External Support

Depending on severity, Salvage Bridge may need:

- hosting/database provider support
- payment provider support
- KYC provider support
- legal counsel
- privacy counsel/DPCO
- external incident response or forensics

