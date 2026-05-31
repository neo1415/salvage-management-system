# Data Retention Policy Draft

Status: Draft for operational/legal review  

## Purpose

This draft defines suggested retention categories for Salvage Bridge and insurer-specific deployments. Final retention periods should be approved by the insurer, legal counsel, finance, compliance, and operations.

## Retention Principles

- Keep data only as long as needed.
- Retain financial, audit, fraud, and legal records where required.
- Minimize raw sensitive KYC/provider payload storage.
- De-identify or delete where business/legal retention no longer applies.
- Document exceptions.

## Suggested Retention Schedule

| Data Type | Suggested Position | Notes |
| --- | --- | --- |
| User account records | Active account plus defined post-closure period | Needed for access, audit, disputes. |
| Vendor KYC verification records | Client-specific period | Must account for regulatory, fraud, and audit needs. |
| Raw provider payloads | Shortest practical period | Retain normalized evidence where possible. |
| BVN/NIN-related values | Only where required | Prefer masked/encrypted storage. |
| Auction and bid records | Long-term business/audit retention | Needed for disputes, finance, audit. |
| Wallet/deposit/payment records | Accounting/legal retention period | Consult finance/legal. |
| Generated documents and signatures | Contract/legal retention period | Needed for ownership transfer and disputes. |
| Audit logs | Long-term retention | Avoid deletion except under defined legal process. |
| Notifications | Limited operational retention | Keep delivery evidence as needed. |
| Uploaded media/photos | Case lifecycle plus legal retention | Consider storage cost and evidence needs. |
| Support tickets | Defined support retention period | Redact sensitive attachments where possible. |

## Deletion and Anonymization

Where deletion is requested, Salvage Bridge should assess:

- legal retention obligations
- payment/accounting retention
- fraud prevention requirements
- open disputes
- active auctions/documents
- insurer instructions

Where full deletion is not possible, anonymization or restricted retention may be used if legally appropriate.

The product now includes a Settings-based data-rights request workflow so users can submit access, export, correction, deactivation, deletion, restriction, or objection requests. Admins can review those requests, record decision notes, and run a dry-run retention/blocker check before fulfilment. That workflow does not replace the approved retention schedule, legal review, or fulfilment SOP, and the dry-run check does not delete or anonymize records.

## Required Next Steps

1. Approve final retention periods.
2. Implement retention jobs where not already present.
3. Define deletion/anonymization SOP.
4. Convert the current dry-run blocker checks into approved fulfilment procedures.
5. Review provider retention settings.
