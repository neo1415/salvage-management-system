# Support, SLA, and Maintenance Overview

This is a procurement draft. Final SLA values should be agreed commercially per client.

## Support Channels

Recommended channels:

- primary support email
- incident escalation email/phone
- shared ticket tracker or support portal
- named technical contact for launch period

## Suggested Severity Levels

| Severity | Description | Example | Target Response |
| --- | --- | --- | --- |
| Sev 1 | Critical production outage or data/security incident | Users cannot access platform; payment/KYC outage affecting all users | Contract-specific, e.g. 1 hour |
| Sev 2 | Major business workflow blocked | Auctions cannot close; payments cannot verify for a client | Contract-specific, e.g. 4 business hours |
| Sev 3 | Non-critical workflow issue | Report export issue; notification delay | Contract-specific, e.g. 1 business day |
| Sev 4 | General support / enhancement | Copy update, training question | Contract-specific |

## Maintenance Windows

Recommended approach:

- planned maintenance communicated in advance
- emergency maintenance communicated as soon as practical
- release notes for material changes
- rollback plan for high-risk deployments

## Availability Language

Use careful language until a formal SLA is signed:

> Salvage Bridge is designed for production operation with monitored provider dependencies and client-specific deployment configuration. Formal uptime commitments are defined in the applicable support agreement.

Avoid guaranteeing uptime without monitoring, incident, and provider-backed commitments.

