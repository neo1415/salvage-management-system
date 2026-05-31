# Data Processing Addendum Draft

Status: Draft for legal review  
Owner: Salvage Bridge  
Applies to: insurer-specific white-label deployments  

## 1. Parties

This draft is intended for use between Salvage Bridge as the platform provider and the insurer or salvage operator as the client.

The final agreement should clarify whether Salvage Bridge acts as:

- processor/service provider for insurer-controlled data;
- independent controller for limited account, billing, security, and support data; or
- another arrangement agreed by counsel.

## 2. Processing Purpose

Salvage Bridge processes personal data to provide the salvage recovery platform, including:

- user authentication
- vendor onboarding and KYC workflows
- salvage case management
- auction participation
- wallet/deposit and payment status workflows
- document generation/signing
- notifications
- fraud/risk review
- audit logs
- reporting and support

## 3. Data Categories

Depending on configuration, processed data may include:

- names, email addresses, phone numbers
- business names and vendor profile details
- BVN/NIN-related KYC data where enabled
- identity documents, CAC documents, selfies/liveness evidence where enabled
- addresses and location data
- payment references, wallet/deposit records, transaction metadata
- case details, asset photos, voice notes, documents
- audit logs and device/IP metadata
- notification delivery metadata

## 4. Sensitive Data

Sensitive data should be processed only where required for the configured workflow. Salvage Bridge should apply data minimization and should avoid storing raw provider data unless needed for verification, audit, fraud review, legal defense, or agreed retention requirements.

## 5. Subprocessors

The client-specific subprocessor list should identify providers used for:

- hosting/database
- file/media storage
- KYC verification
- payments
- email/SMS/push
- AI/assessment services where enabled

Provider changes should be communicated according to the final commercial agreement.

## 6. Security Measures

Salvage Bridge maintains technical and organizational measures appropriate to the service, including:

- role-based access controls
- authentication controls
- audit logging
- webhook verification
- sensitive audit-data sanitization
- application-level encryption for selected sensitive data
- environment-based secret management
- rate limiting on high-risk routes
- provider-specific access controls where configured

Final commitments should reference an attached security schedule rather than overstate controls in the main agreement.

## 7. Data Subject Requests

The insurer should remain the primary contact for data subject requests unless otherwise agreed. Salvage Bridge should provide reasonable assistance for access, correction, export, deletion, restriction, or objection requests, subject to legal, financial, audit, fraud, and operational retention obligations.

## 8. Retention and Deletion

Retention periods should be set in a client-specific schedule. Some data may need to be retained for audit, legal, accounting, fraud, payment, or dispute-resolution purposes.

## 9. Incident Notification

Salvage Bridge should notify the client without undue delay after confirming a security incident affecting client data. Final notice timelines should account for detection, containment, investigation, and legal obligations.

## 10. Audit Assistance

Salvage Bridge may provide security documentation, control summaries, relevant provider references, and reasonable audit cooperation. Formal audits, penetration tests, or certifications should be scoped separately.

## 11. International Transfer

Cross-border transfer terms depend on provider locations, client requirements, and applicable law. This section requires legal review.

## 12. Carve-Outs

Salvage Bridge should not be responsible for:

- incorrect client-provided legal copy or branding;
- client-controlled provider credentials;
- client staff misuse;
- unsupported provider outages beyond Salvage Bridge's control;
- data imported by the client in violation of law or policy;
- inaccurate third-party verification results where Salvage Bridge reasonably processes provider responses.

