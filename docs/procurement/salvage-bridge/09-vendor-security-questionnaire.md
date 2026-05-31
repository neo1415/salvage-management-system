# Vendor Security Questionnaire Starter Answers

These answers are designed for procurement intake. Tailor them to the specific insurer and deployment.

## Organization and Product

**What does Salvage Bridge provide?**  
Salvage Bridge provides a white-label salvage recovery and auction platform for insurers and salvage operators.

**Is the platform single-tenant or multi-tenant?**  
The recommended enterprise model is an isolated deployment per insurer, with separate environment variables, provider credentials, branding, business policy, and database configuration.

**Can each insurer use its own brand?**  
Yes. Branding, public homepage templates, support contacts, document details, and business policy are configurable.

## Security

**Do you support role-based access control?**  
Yes. Roles include vendor, claims adjuster, salvage manager, finance officer, and system admin.

**Do you support MFA?**  
MFA support exists and can be enabled according to deployment policy.

**Do you verify payment webhooks?**  
Yes. Paystack webhooks are verified using signature validation before processing.

**Do you verify KYC webhooks?**  
Yes. Dojah webhook secret/signature validation is implemented and should fail closed in production when the webhook secret is missing.

**Are audit logs supported?**  
Yes. The platform records audit actions across auth, cases, auctions, bids, payments, KYC, documents, reports, business policy, and fraud-related workflows.

**Are audit logs tamper-proof?**  
Not currently. They are stored in the application database. Salvage Bridge recommends external log export or tamper-evident storage for stricter compliance requirements.

## Privacy

**What sensitive data can be processed?**  
Depending on configuration, the platform can process user identity details, BVN/NIN-related KYC data, business registration details, addresses, uploaded documents, payment references, signatures, and provider verification evidence.

**Is sensitive KYC data encrypted?**  
The codebase includes application-level encryption paths for BVN/NIN/provider payload handling. Final deployment should validate encryption key management and provider workflow configuration.

**Do you have a DPA?**  
A DPA draft can be provided for legal review. Final legal terms should be agreed per client.

## Compliance

**Are you SOC 2 certified?**  
No formal SOC 2 certification should be claimed unless a CPA/auditor report has been completed.

**Are you NDPA/NDPC compliant?**  
The platform is designed with privacy and auditability in mind, but formal NDPA/NDPC posture should be reviewed by Nigerian privacy counsel or a licensed DPCO if required.

**Do you have a penetration test report?**  
An independent penetration test should be commissioned before making formal enterprise security claims.

## Operations

**Do you provide backup and restore?**  
Backup and restore arrangements depend on the selected database/hosting provider and deployment plan. A client-specific backup/restore runbook should be agreed before go-live.

**How are incidents handled?**  
Incident response procedures should be defined in the support agreement. A draft incident response policy is available for review.

