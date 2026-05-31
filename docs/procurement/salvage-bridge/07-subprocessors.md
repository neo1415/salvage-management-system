# Subprocessor List

This is a procurement-ready draft. Final entries should be validated against the actual providers selected for each insurer deployment.

| Provider | Purpose | Data Categories | Client-Specific? | Notes |
| --- | --- | --- | --- | --- |
| Supabase / PostgreSQL | Database hosting and storage | Platform operational data, user records, cases, auctions, payments, KYC metadata | Yes | Exact project/region should be client-specific. |
| Vercel or selected hosting provider | Application hosting | Web/API traffic, logs, deployment metadata | Yes | Depends on deployment architecture. |
| Cloudinary | Media and PDF storage | Photos, uploaded documents, generated PDFs, branding assets | Yes | Access controls and URL expiry should be reviewed per deployment. |
| Paystack | Payment processing | Payment references, transaction metadata, payment status | Yes | Card/payment data should be handled by Paystack, not stored directly by Salvage Bridge. |
| Dojah | KYC/identity verification | BVN/NIN-related data, identity evidence, liveness/AML/risk results depending on configured workflow | Yes | Requires DPA/security review before enterprise onboarding. |
| Resend | Email delivery | Email address, message content, delivery metadata | Yes | Sender/domain should be insurer-specific where possible. |
| Termii / SMS provider | SMS delivery | Phone number, SMS content, delivery metadata | Yes | Route capability and DND/transactional setup should be confirmed. |
| Google / OAuth provider | Optional login and/or cloud integrations | OAuth profile data or service credentials depending on use | Optional | Only if enabled. |
| AI providers | Optional AI assessment support | Images/asset context sent for assessment where enabled | Optional | Data minimization and provider terms must be reviewed. |

## Client-Specific Addendum

For each insurer deployment, maintain:

- provider account owner
- provider region if available
- data processed
- retention controls
- breach notification route
- provider compliance links/reports
- whether the provider is mandatory or optional

## Safe Procurement Language

Salvage Bridge can provide a current subprocessor list for the deployment and update it as providers change. Formal provider certifications should be obtained from each provider directly or through their security portals.

