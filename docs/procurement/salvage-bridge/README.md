# Salvage Bridge Procurement Pack

This folder contains client-safe procurement and due diligence material for Salvage Bridge, the business behind the white-label salvage recovery platform.

Use these documents for early insurer conversations, vendor questionnaires, technical reviews, and procurement preparation. They are intentionally written to be useful without oversharing sensitive implementation details.

## Folder Intent

Salvage Bridge-level documents describe the platform, operating model, and security posture that Salvage Bridge provides.

Insurer-specific details should be added during onboarding:

- insurer legal name
- insurer brand name and logo
- insurer support contact details
- insurer domain and sender identity
- insurer payment, KYC, SMS, email, and storage provider choices
- insurer-specific business policy and auction rules
- insurer-specific document templates and legal copy

## Current Documents

1. `01-product-overview.md`
2. `02-security-overview.md`
3. `03-architecture-and-deployment.md`
4. `04-white-label-client-isolation.md`
5. `05-access-control-matrix.md`
6. `06-data-flow-summary.md`
7. `07-subprocessors.md`
8. `08-support-sla-and-maintenance.md`
9. `09-vendor-security-questionnaire.md`
10. `10-procurement-demo-pack.md`
11. `11-remediation-and-evidence-tracker.md`
12. `12-api-route-authorization-inventory.md`

## Language Guardrails

Safe language:

- Built with enterprise security and auditability in mind.
- Supports configurable white-label deployments.
- Supports role-based access control, audit logs, KYC workflows, wallet/deposit records, document workflows, and payment reconciliation.
- Designed for single-client deployment isolation where each insurer has separate infrastructure configuration.

Avoid language unless separately verified:

- SOC 2 compliant.
- NDPA compliant.
- PCI compliant.
- Certified.
- Guaranteed uptime.
- Guaranteed fraud prevention.
- Guaranteed AI valuation accuracy.
