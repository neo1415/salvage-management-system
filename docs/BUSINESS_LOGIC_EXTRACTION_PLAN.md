# Business Logic Extraction Plan

Last updated: 2026-05-23

## Purpose

NEM Salvage currently works as a focused insurance salvage auction platform. The next product step is to make it configurable enough for enterprise white-label deployments without turning it into an unsafe pile of toggles.

The goal is to extract business rules into a versioned policy layer while preserving the current NEM behavior as the default. This lets future customers choose onboarding, verification, payment, escrow, auction, branding, notification, and document rules from an admin experience without changing code.

This plan must remain phased. Do not attempt to extract every rule in one large change. Every phase should keep the application runnable, preserve current NEM behavior unless explicitly migrated, and end with validation.

## Current State

The application already has a useful first-generation configuration surface:

- `src/features/auction-deposit/services/config.service.ts`
- `src/components/admin/config-form.tsx`
- `src/app/api/admin/config/route.ts`
- `src/app/api/config/system/route.ts`

Those cover:

- vendor registration fee
- deposit rate
- minimum deposit floor
- Tier 1 bid limit
- minimum bid increment
- document signing deadline
- grace extension count and duration
- fallback bidder buffer period
- number of top bidders to keep frozen
- forfeiture percentage
- payment deadline after signing

This is a good start, but it is too narrow for white-label enterprise usage. Business logic still exists across services, UI, email/SMS templates, auth, documents, reports, AI valuation, and notification workflows.

## Research Anchors

This plan follows these architecture principles:

- Treat tenant isolation as a spectrum. For high-trust or regulated customers, a separate deployment and database is safer than shared-everything multitenancy.
- Keep feature and policy evaluation contextual, not scattered as hardcoded booleans.
- Treat MFA and identity proofing as configurable risk controls, not one global checkbox.
- Preserve auditability, rollback, and policy snapshots for workflows already in progress.

Sources reviewed:

- Microsoft Azure Architecture Center: multitenant tenancy models and tenant isolation.
- AWS Well-Architected SaaS Lens: tenant-aware operations, onboarding, tenant tiers, and isolation.
- OpenFeature: evaluation context for feature and policy decisions.
- OWASP MFA Cheat Sheet: adaptive MFA and risk-based authentication.
- NIST SP 800-63: identity proofing and authentication assurance concepts.

## Policy Domains To Extract

### 1. Brand And White Label

Current examples:

- hardcoded `NEM Salvage` display text
- hardcoded burgundy/gold colors
- static logo paths
- hardcoded support copy in email, PDF, and UI
- homepage content tied to NEM positioning

Target configuration:

- brand name
- legal name
- short name
- primary/accent colors
- logo and favicon/PWA icons
- support email and phone
- homepage mode: landing page, login first, or custom template
- email letterhead
- PDF/document letterhead
- receipt/document footer
- custom domain metadata

### 2. Auth And Registration

Current examples:

- Google/Facebook OAuth code exists, but UI paths are partly disabled.
- Business-email validation exists in OAuth flow.
- MFA now works when enabled per user, while global enforcement is env-based.
- Vendor BVN gates are implemented through route allowlists.

Target configuration:

- email/password enabled
- Google OAuth enabled
- allowed email domains
- business email only
- staff MFA required
- vendor MFA optional/required
- MFA channel policy: email, SMS, authenticator app later
- session duration
- high-risk login reauthentication rules
- account lockout thresholds

Security note:

- OAuth and MFA must remain server-side enforced. UI toggles are not enough.

### 3. Vendor Onboarding

Current examples:

- Tier 1 BVN is the first meaningful gate.
- Tier 1 can bid up to `tier1Limit`.
- registration fee unlocks Tier 2 KYC.
- Tier 2 uses Dojah and remains manual-review evidence.

Target configuration:

- onboarding mode:
  - BVN first, limited bidding, fee, then Tier 2
  - registration fee before Tier 1
  - full Tier 2 before any bidding
  - single full KYC flow
  - no registration fee
  - fee after approval
- whether vendors can browse auctions before KYC
- whether vendors can bid before registration fee
- tier labels and descriptions
- approval role and review SLA
- retry rules for failed verification

Critical implementation rule:

- Onboarding changes must not retroactively rewrite vendors already in the middle of a flow unless an admin intentionally migrates them.

### 4. KYC And Verification

Current examples:

- Dojah now handles BVN/KYC provider flow.
- provider verification records store Dojah evidence.
- manual review is preserved.
- legacy KYC data still exists.

Target configuration:

- provider: Dojah initially, abstraction later
- Tier 1 required checks
- Tier 2 required checks
- liveness required
- address required
- CAC/business registration required
- AML/PEP required
- duplicate ID/face handling
- high-risk review routing
- what evidence staff can see
- what evidence can be exported

Security note:

- BVN, NIN, raw identity documents, raw provider payloads, and full ID numbers must never be exposed in public-safe config or normal UI.

### 5. Payments

Current examples:

- Paystack is directly used for registration fees and auction payments.
- wallet, Paystack-only, and hybrid routes exist.
- registration fee deadline is still hardcoded as 7 days in the registration fee service.

Target configuration:

- enabled payment providers
- default provider
- registration fee provider
- auction payment provider
- wallet enabled
- hybrid payment enabled
- bank transfer/manual payment enabled
- payment deadline rules
- payment verification fallback behavior
- receipt generation behavior

Implementation note:

- Paystack payments must remain untouched while provider abstractions are added around them.

### 6. Escrow, Wallet, Deposit, And Forfeiture

Current examples:

- deposit system feature flag exists.
- deposit rate/floor/freeze/forfeiture are already configurable.
- top bidders can stay frozen while winner is pending.

Target configuration:

- escrow wallet enabled
- deposit required
- deposit percentage
- minimum floor
- maximum cap
- frozen bidder count
- forfeiture percentage
- forfeiture transfer timing
- fallback release behavior
- refund/release policy

Audit note:

- Financial policy changes must require reason text, audit logs, and preferably a publish step.

### 7. Auction Rules

Current examples:

- minimum increment is configurable in some places but duplicated in some frontend/API fallbacks.
- fallback bidder promotion exists.
- grace period and payment/document deadlines exist.
- polling is primary while Socket.IO is secondary.

Target configuration:

- auction duration defaults
- bid increment rules
- reserve price strategy
- anti-sniping extension window
- extension duration
- max extensions
- fallback bidder ladder
- bidder anonymity/visibility rules
- watch count enabled
- polling interval
- socket sidecar enabled

Performance note:

- Bidding rules must be enforced inside a transaction or atomic path. Client-side validation should only assist UX.

### 8. Case Creation And Asset Types

Current examples:

- asset types have been moving from vehicle-only toward universal assets.
- machinery is now supported in UI.
- AI analysis must use asset-specific language.

Target configuration:

- enabled asset types
- required fields per asset type
- supported AI analysis providers
- AI provider priority and fallback
- market search provider
- reserve value strategy
- salvage value strategy
- manual override requirements
- whether part/service breakdowns are visible to vendors

Implementation note:

- Asset type enablement belongs in business policy, not commented UI code.

### 9. AI Valuation And Search

Current examples:

- Gemini/Claude/Serper are used in analysis.
- severity should come from AI signal when available.
- reserve/salvage heuristics need to become configurable.

Target configuration:

- provider order
- timeout per provider
- fallback model
- confidence thresholds
- damaged-part pricing search templates
- repair-vs-replace policy
- market value sources
- manual review threshold

Performance note:

- Slow AI/search work should be queued or cached. Case creation should not block indefinitely on external model latency.

### 10. Notifications

Current examples:

- email, SMS, push, and in-app notifications exist.
- SMS category filtering exists.
- role notifications can fan out broadly.

Target configuration:

- event-to-recipient matrix
- event-to-channel matrix
- SMS allowed categories
- push enabled
- email enabled
- notification frequency
- digest vs immediate
- quiet hours
- per-role routing
- per-event templates

Performance note:

- Role fan-out should be batched or queued for large staff lists. Logs currently show very noisy notification fan-out.

### 11. Documents And Receipts

Current examples:

- bill of sale and liability waiver exist.
- receipt can be attached beside auction documents.
- letterhead and logo behavior is partly repeated.

Target configuration:

- required document types by asset/auction
- document generation timing
- signature deadline
- receipt attachment behavior
- document templates
- letterhead/footer
- brand/legal language
- export permissions

Compliance note:

- Documents created under one policy version should keep that version for auditability.

### 12. Fraud And Risk

Current examples:

- Dojah risk results map into provider verification and fraud alerts.
- IP fraud detection can be toggled.
- app-native bidding fraud logic exists.

Target configuration:

- Dojah risk mapping
- IP/device detection enabled
- bid fraud thresholds
- same-device bidding policy
- auto-suspend threshold
- manual-review threshold
- demo-safe fraud mode
- alert routing

Security note:

- Fraud policies should never expose sensitive evidence to vendors.

### 13. Reports And Dashboards

Current examples:

- reports and dashboards have had inconsistent metric definitions.
- some defaults and lookbacks were hardcoded.

Target configuration:

- report date default
- status mapping
- test-data exclusion strategy
- KPI definitions
- revenue recognition rules
- role-specific dashboard widgets
- export permissions

### 14. Roles And Permissions

Current examples:

- role checks exist across routes and pages.
- some admin config routes allow both `system_admin` and `salvage_manager`.

Target configuration:

- role capability matrix
- approval permissions
- export permissions
- fraud action permissions
- config edit permissions
- config publish permissions

Security note:

- Permission policy must be enforced server-side and tested. Navigation hiding is not access control.

## White-Label Deployment Model

### Recommended Short-Term Model

Use one codebase, but deploy each customer as a separate Vercel project with a separate Supabase database, storage bucket, env vars, and webhook endpoints.

Why:

- fastest path to sellable white-label deployments
- lowest cross-customer data leakage risk
- simpler compliance story
- easier customer-specific backups and migration
- safer than rushing shared multitenancy

### Recommended Mid-Term Model

Keep one codebase and add a repeatable customer provisioning script:

- create database/schema
- seed default business policy
- seed branding
- configure Dojah/Paystack/Termii keys
- configure domain
- configure storage
- configure webhook URLs

### Long-Term SaaS Model

Move to true multitenancy only after:

- every tenant-scoped table has `tenant_id`
- all queries are tenant-filtered
- RLS policies are complete
- file storage is tenant-scoped
- background jobs are tenant-aware
- cache keys include tenant ID
- webhooks resolve tenant safely
- test suite includes tenant isolation tests

## Policy Architecture

### Principles

- Current NEM behavior remains the default policy.
- Policy changes are drafted, validated, reviewed, and then published.
- Active workflows snapshot the effective policy version.
- Public-safe config is separate from sensitive operational config.
- Provider secrets stay in env/secret storage, not database policies.
- Every policy change has an audit trail.
- Important business decisions record the policy version and rule path that produced the outcome.
- Invalid or contradictory policy drafts are rejected before publish.
- Convenience matters: common white-label changes should be possible without code edits, while dangerous settings remain protected.

### Public-Safe Versus Private Configuration

Public-safe configuration may be sent to the browser or used in unauthenticated pages:

- branding
- colors
- logo URLs
- display labels
- enabled modules
- client-facing copy
- non-sensitive onboarding labels and limits

Private or sensitive configuration must remain server-side only:

- Paystack keys
- Dojah keys
- email credentials
- webhook secrets
- provider API URLs when sensitive
- fraud thresholds if they reveal internal detection logic
- internal risk scoring rules
- raw provider payload access rules
- audit retention controls

Implementation rule:

- Public config must be created through an explicit sanitizer. Never return the full policy object to browser-facing routes by accident.

### Policy Decision Logging

For important business decisions, the app should record enough context to explain why the decision happened.

Examples:

- vendor can or cannot bid
- vendor bid limit resolved
- deposit amount required
- auction close behavior selected
- document deadline resolved
- KYC approval requirement resolved
- fraud/risk gate applied
- reserve price rule applied

Each decision record should include:

- policy version
- rule path, for example `onboarding.tier1BidLimit`
- decision type
- outcome
- entity type and ID
- safe inputs used for the decision
- resolved value, if applicable
- human-readable reason
- timestamp

Sensitive values such as BVN, NIN, full ID numbers, raw Dojah payloads, provider secrets, and payment authorization data must never be logged as policy decision inputs.

Runtime migration mode:

- `BUSINESS_POLICY_RUNTIME_MODE=shadow` is the default and safest mode.
- `BUSINESS_POLICY_RUNTIME_MODE=enforce` should only be enabled after compatibility tests prove the published policy matches current NEM behavior for the target rule.
- Any enforcement migration must move one decision at a time, with a rollback plan and policy decision logs.
- Do not use loose truthy values like `true` or `1`; only the exact value `enforce` enables live policy enforcement.

### Policy Validation Before Publish

Policy drafts must be validated before they can be published. Validation should reject contradictions and highlight risky but technically valid choices.

Required validation examples:

- reminder schedule cannot exceed the document deadline
- Tier 1 bid cap cannot exceed a configured higher tier cap if tier caps are enabled
- deposit percentage must be between sane minimum and maximum values
- minimum deposit floor cannot be negative
- auction duration and deadlines must be positive
- approval workflow cannot reference disabled roles
- enabled asset types must have required field definitions
- enabled asset types that require AI must have prompt mappings/provider support
- payment provider choices cannot reference disabled providers
- registration fee cannot be required with a zero or negative amount
- at least one asset type must be enabled
- public-safe policy output must not include private provider credentials

Validation should support:

- blocking errors
- non-blocking warnings
- impact preview before publish
- reason text for sensitive changes

### Backward Compatibility And Historical Stability

Current NEM behavior must remain the default.

Existing records must not silently change behavior:

- auctions
- vendors
- payments
- documents
- KYC records
- provider verification records
- fraud alerts
- audit logs

When a workflow begins, snapshot the effective policy version. For example:

- auction created -> auction policy snapshot
- vendor onboarding started -> onboarding/KYC policy snapshot
- document generated -> document policy snapshot
- payment initialized -> payment policy snapshot

Policy changes should only affect new workflows unless an admin intentionally runs a migration with explicit review and audit logging.

### Rule Extraction Test Standards

Every extracted rule needs focused tests:

- default NEM policy produces current behavior
- changed policy produces expected behavior
- invalid policy is rejected before publish
- public config does not leak private/sensitive config
- policy snapshots keep historical auctions/documents stable
- important decisions generate decision records with policy version and rule path
- sensitive values are not logged in decision records

### Suggested Runtime Shape

```ts
effectivePolicy = {
  tenant: TenantPolicy,
  branding: BrandingPolicy,
  auth: AuthPolicy,
  onboarding: VendorOnboardingPolicy,
  kyc: KycPolicy,
  payments: PaymentPolicy,
  escrow: EscrowPolicy,
  auctions: AuctionPolicy,
  cases: CasePolicy,
  ai: AiValuationPolicy,
  notifications: NotificationPolicy,
  documents: DocumentPolicy,
  fraud: FraudPolicy,
  reports: ReportPolicy,
  permissions: PermissionPolicy,
}
```

### Storage Direction

Start with a typed service and current config table compatibility.

Then add tables:

- `business_policy_versions`
- `business_policy_change_requests`
- `tenant_branding`
- `message_templates`
- `document_templates`
- `policy_snapshots`

Do not add these tables until the typed defaults are stable.

## Admin UX Plan

Create a new System Admin area:

- Enterprise Setup
- Business Rules
- Onboarding And KYC
- Payments And Wallet
- Auctions And Fallbacks
- Notifications
- Branding
- Documents
- Fraud And Risk
- Reports And KPIs

The first version should include a guided setup wizard:

1. Brand
2. Access and login
3. Vendor onboarding
4. KYC and review
5. Payments and wallet
6. Auction rules
7. Notifications
8. Documents
9. Review and publish

UX rules:

- use plain English labels
- show business impact summaries
- show warnings for risky changes
- require reason text for sensitive changes
- preview the vendor journey before publishing
- keep advanced controls collapsed
- provide safe presets

Example preset:

> Balanced onboarding: BVN first, vendors can bid up to Tier 1 limit, registration fee unlocks Tier 2, full Tier 2 approval required for unlimited bidding.

## Phased Implementation Plan

### Phase 0: Inventory

No behavior changes.

- document every hardcoded business rule
- map rule to owning domain
- record file path and current fallback
- record risk if extracted incorrectly
- identify duplicate defaults

### Phase 1: Typed Policy Foundation

No behavior changes.

- add typed `business-policy` module
- encode current NEM defaults
- add helpers for public-safe vs private policy
- add policy validation helpers
- add policy decision logging types/helpers
- map existing auction config into the new policy shape
- keep all existing services working as-is
- add tests for default policy validity and public-safe sanitization

### Phase 2: Admin IA And Read-Only Preview

Low risk.

- add admin pages that display effective policy
- no publishing yet
- show simulated vendor journey
- show policy health warnings
- show public/private separation clearly
- show validation warnings before editing is enabled

### Phase 3: Onboarding And KYC Extraction

High value.

- move Tier 1/Tier 2/fee gate logic behind policy service
- support legacy and Dojah records
- snapshot policy for vendor onboarding attempts
- add tests for each configured flow
- log bid eligibility and KYC review decisions with policy version/rule path

### Phase 4: Payments, Escrow, And Auction Rules

High risk, migrate carefully.

- move deposit/wallet/payment settings behind policy
- keep Paystack implementation intact
- add provider abstraction around Paystack
- snapshot policy per auction
- add tests for forfeiture/fallback/payment deadline
- log deposit, reserve, close, document deadline, and fallback decisions with policy version/rule path

### Phase 5: Branding, Templates, And Documents

Medium risk.

- extract brand strings, colors, logos
- extract email/SMS/push templates
- extract PDF/document templates
- add template preview and test-send tools

### Phase 6: Notifications, Fraud, Reports

Medium risk.

- event/channel routing matrix
- fraud threshold policy
- report metric definitions
- role dashboard configuration

### Phase 7: White-Label Provisioning

Operational.

- create customer provisioning checklist/script
- seed policy defaults
- configure env values
- configure domains/webhooks
- configure storage
- run smoke tests per tenant

## Security And Performance Watchlist

### Security

- Do not expose provider secrets through admin policy APIs.
- Do not expose BVN/NIN/raw Dojah payloads in public-safe config.
- Do not rely on hidden UI for access control.
- Add audit logs for policy draft/publish/rollback.
- Require reason text for financial, KYC, fraud, and document policy changes.
- Use policy snapshots for historical auditability.
- Do not allow unaudited hard-delete in white-label deployments.

### Performance

- Avoid fetching policy from the database on every hot-path bid.
- Cache effective policy briefly and invalidate on publish.
- Include tenant/customer in future cache keys.
- Keep bidding enforcement atomic and server-side.
- Queue slow notification, AI, PDF, and report work.
- Avoid role notification fan-out inside request paths.

## Immediate Next Step

Create the typed business policy foundation and start mapping current values into it without changing runtime behavior.
