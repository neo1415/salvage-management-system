# Training Data Pipeline Spec

Date: 2026-06-02

Status: planning/specification only. This document is intentionally separated from pickup workflow planning so it can become the implementation guide for product telemetry, model training datasets, and future ML governance.

## Objective

Build a privacy-aware data capture and training pipeline for the salvage recovery platform. The goal is to collect enough reliable operational and behavioral data to improve:

- salvage value prediction
- final auction price prediction
- vendor recommendations
- fraud and collusion detection
- pickup/payment/document SLA prediction
- vendor reliability scoring
- insurer executive reporting
- operational bottleneck detection

This must not become indiscriminate surveillance. The platform should collect useful, explainable, and legally defensible data with clear controls for sensitive information.

## Current Code Evidence

| Capability | Evidence | Current state |
| --- | --- | --- |
| Prediction records | `src/lib/db/schema/intelligence.ts` | `predictions` table stores predicted price, confidence, method, sample size, accuracy fields, and metadata. |
| Recommendation records | `src/lib/db/schema/intelligence.ts` | `recommendations` table tracks match score, reason codes, clicked, bid placed, and bid amount. |
| Interaction tracking | `src/lib/db/schema/intelligence.ts`, `src/app/api/intelligence/interactions/route.ts` | Basic interaction events exist, but event taxonomy is too narrow. |
| Interaction auth gap | `src/app/api/intelligence/interactions/route.ts` | The route has a TODO to verify `vendorId` belongs to the logged-in user for non-admin users. This must be fixed before treating events as trusted. |
| Enum mismatch | `src/app/api/intelligence/interactions/route.ts`, `src/lib/db/schema/intelligence.ts` | API accepts `click_recommendation`, but DB enum only supports `view`, `bid`, `win`, `watch`, `unwatch`; the route stores it as `view` with original event metadata. |
| Feature engineering | `src/features/intelligence/services/feature-engineering.service.ts` | Feature vectors exist for auctions and vendors, but need richer lifecycle and behavioral features. |
| Dataset export | `src/features/intelligence/services/ml-dataset.service.ts` | Dataset exports exist for price prediction, recommendations, and fraud detection. |
| Intelligence docs | `docs/intelligence/ML_TRAINING_PIPELINE.md`, `docs/intelligence/PREDICTION_ALGORITHM.md`, `docs/intelligence/RECOMMENDATION_ALGORITHM.md` | Useful docs exist, but should be revised after telemetry changes are implemented. |
| Tests | `tests/unit/intelligence`, `tests/integration/intelligence`, `tests/e2e/intelligence` | There is meaningful test coverage around the intelligence feature area. |

## Design Principle

Use three separate records for three separate jobs:

1. Audit logs: legal/security trail. Low volume. Immutable. Human-reviewable. Not the main ML source.
2. Product/domain events: high-volume behavioral and lifecycle events. Used for analytics and model features.
3. Curated datasets: cleaned, versioned, pseudonymized extracts used for training and evaluation.

Do not train directly from raw audit logs. Do not export raw provider payloads, identity documents, pickup codes, BVN/NIN, or unnecessary personal identifiers into model datasets.

## Recommended Data Model

Add a general-purpose `product_events` table.

Suggested fields:

- `id`
- `event_name`
- `event_version`
- `occurred_at`
- `received_at`
- `actor_user_id`
- `actor_role`
- `vendor_id`
- `case_id`
- `auction_id`
- `payment_id`
- `document_id`
- `session_id`
- `request_id`
- `source`: `client`, `server`, `cron`, `webhook`, `admin_action`
- `idempotency_key`
- `client_context`
- `event_context`
- `metadata`
- `privacy_classification`: `public`, `internal`, `personal`, `sensitive`
- `training_allowed`
- `retention_class`
- `created_at`

Keep the existing `interactions` table temporarily for backward compatibility. Either migrate it into `product_events` or expose it as a derived view later.

## Event Taxonomy

### Auction Discovery and Bidding

- `auction_card_seen`
- `auction_viewed`
- `auction_image_viewed`
- `auction_search_performed`
- `auction_filter_applied`
- `auction_sort_changed`
- `auction_watch_added`
- `auction_watch_removed`
- `bid_attempted`
- `bid_rejected`
- `bid_placed`
- `bid_outbid`
- `auction_extended`
- `auction_closed`
- `auction_won`
- `auction_lost`

### Case Creation and Valuation

- `case_created`
- `case_photo_uploaded`
- `case_voice_note_added`
- `location_captured`
- `location_pin_confirmed`
- `ai_assessment_requested`
- `ai_assessment_completed`
- `ai_assessment_failed`
- `valuation_manual_value_used`
- `valuation_market_search_performed`
- `valuation_part_search_performed`
- `case_submitted_for_approval`
- `case_approved`
- `case_rejected`

### KYC and Vendor Onboarding

- `vendor_registered`
- `tier1_started`
- `tier1_completed`
- `tier2_widget_opened`
- `tier2_widget_cancelled`
- `tier2_widget_step_failed`
- `tier2_completed`
- `tier2_manual_review_started`
- `vendor_approved`
- `vendor_rejected`
- `vendor_resubmitted`

### Wallet, Deposits, and Payments

- `wallet_funding_started`
- `wallet_funding_completed`
- `wallet_funding_failed`
- `deposit_frozen`
- `deposit_released`
- `payment_started`
- `payment_webhook_received`
- `payment_verified`
- `payment_retry_requested`
- `payment_failed`
- `refund_initiated`
- `refund_completed`

### Documents and Pickup

- `document_generated`
- `document_viewed`
- `document_signed`
- `document_downloaded`
- `pickup_authorization_issued`
- `pickup_code_lookup_attempted`
- `pickup_code_verified`
- `pickup_code_failed`
- `pickup_confirmed`
- `pickup_overdue`
- `pickup_code_reissued`

### Fraud and Risk

- `fraud_signal_created`
- `fraud_alert_opened`
- `fraud_alert_resolved`
- `duplicate_case_detected`
- `suspicious_bid_pattern_detected`
- `payment_exception_detected`
- `location_mismatch_detected`

## Capture Strategy

### Server-Side Events

Server-side events are authoritative and should be emitted from service/API layers after the database transaction succeeds.

Required server-side sources:

- case creation and approval
- AI assessment completion/failure
- auction creation, start, extension, closure
- bid placement/rejection
- deposit freeze/release
- payment start/webhook/verification/failure
- document generation/signing
- KYC webhook/result/review
- pickup code issuance/verification/confirmation
- fraud alert creation/resolution

Use an outbox pattern for important domain events so analytics writes do not break user-facing requests and successful business events are not lost.

### Client-Side Events

Client-side events should capture user behavior that the server cannot see.

Examples:

- auction card visibility
- image gallery usage
- search/filter/sort changes
- CTA clicks
- KYC widget opened/cancelled
- wallet/payment modal opened
- time-on-page
- abandoned flow markers

Use batching and retry. Do not block the UI on telemetry. Never send raw sensitive input values unless a specific approved event schema requires them.

## Privacy Guardrails

Do not include these in training datasets by default:

- BVN
- NIN
- raw identity images
- raw Dojah payloads
- raw payment provider payloads
- pickup authorization codes
- document file URLs
- full emails/phone numbers
- full addresses where location bucket is enough

Allowed derived fields:

- pseudonymous user/vendor id
- role
- KYC tier/status
- region or location bucket
- payment status and timing
- document completion timing
- pickup timing
- asset type and normalized asset details
- damage severity and normalized damaged parts
- bid amounts and timestamps
- fraud/risk flags

## Dataset Definitions

### Price Prediction Dataset

Purpose: predict likely final auction price and confidence range.

Features:

- asset type
- make/model/year where relevant
- condition
- mileage/hours where relevant
- claims paid / market value
- estimated salvage value
- reserve price
- damage severity
- damaged part count
- normalized damaged part categories
- photo quality flags
- location bucket
- auction duration
- start day/time
- bid count
- unique bidder count
- number of eligible vendors
- final bid
- payment completed flag
- pickup completed flag

Labels:

- final winning bid
- reserve met
- payment completed
- pickup completed

### Recovery Performance Dataset

Purpose: predict and report recovery speed, stuck assets, and value leakage.

Features:

- claim paid / market value
- reserve price
- final winning bid
- recovery ratio
- case created to approved duration
- approved to auction start duration
- auction start to close duration
- close to document signed duration
- document signed to payment duration
- payment to pickup duration
- exception count

Labels:

- total cycle time
- overdue pickup
- payment default
- recovery ratio band

### Vendor Reliability Dataset

Purpose: score vendors and predict payment/pickup risk.

Features:

- account age
- KYC tier
- completed bids
- wins
- payment speed
- pickup speed
- deposit failures
- failed payment count
- forfeitures
- dispute count
- cancelled pickup count
- average bid competitiveness

Labels:

- reliable payment
- reliable pickup
- default/forfeit
- dispute probability

### Fraud and Collusion Dataset

Purpose: flag risky patterns for human review.

Features:

- repeated same-vendor clusters
- bid timing patterns
- same-device or same-network signals where legally usable
- sudden bid jumps
- repeated outbid/rebid timing
- duplicate asset images
- location mismatch
- unusual payment retry behavior

Labels:

- confirmed fraud
- dismissed alert
- manual review outcome

### Recommendation Dataset

Purpose: recommend auctions that vendors are likely to inspect, watch, bid on, or win.

Features:

- vendor historical asset categories
- watched auctions
- viewed auctions
- filters used
- locations viewed
- price bands
- bid history
- win history
- pickup/payment completion

Labels:

- clicked recommendation
- watched auction
- bid placed
- auction won

## Data Quality and Governance

Every curated dataset should include:

- dataset id
- dataset type
- schema version
- source tables
- source query or job id
- date range
- row count
- excluded sensitive fields
- anonymization/pseudonymization status
- generated by
- generated at
- intended use
- retention class

Quality checks:

- missing value rate
- duplicate event rate
- test/internal user contamination
- impossible timestamp sequences
- outlier amount detection
- stale model-feature detection
- label leakage checks

## Implementation Phases

### Phase 1: Fix Current Intelligence Integrity

- Verify vendor ownership in `POST /api/intelligence/interactions`.
- Stop overloading `click_recommendation` as `view`; add proper event support.
- Add event schema versioning.
- Add server-side validation for all event names.

### Phase 2: Add Product Events

- Create `product_events` table.
- Create server-side event emitter.
- Create safe client-side event tracker.
- Add event batching.
- Add idempotency keys.

### Phase 3: Instrument Critical Flows

- Case creation and AI assessment.
- Auction view, filtering, watching, bidding.
- Wallet funding, deposit freezing, payment.
- Document signing.
- Pickup issuance and confirmation.
- KYC widget lifecycle and webhook results.

### Phase 4: Curated Dataset Builder

- Build dataset jobs for price, recovery, vendor reliability, fraud, and recommendation.
- Add privacy filters.
- Add lineage metadata.
- Add admin export UI and access control.

### Phase 5: Model Readiness

- Add baseline metrics.
- Add train/test split logic.
- Track prediction accuracy after auction closure.
- Track model version and feature version.
- Add model monitoring dashboard.

## Acceptance Criteria

- Product events are separate from audit logs.
- Interaction tracking cannot be spoofed with another vendor id.
- Event taxonomy covers discovery, bidding, KYC, payments, documents, pickup, fraud, and reporting.
- Sensitive provider payloads and identity documents are excluded from training exports by default.
- Dataset exports include lineage and privacy metadata.
- Price prediction has enough real features to explain why it predicted a value.
- Vendor reliability and recovery datasets can support future insurer-facing dashboards.

## Open Product Decisions

- Whether clients can opt out of model-training use while still allowing operational analytics.
- Whether each insurer deployment trains independently or contributes to a central Salvage Bridge model.
- Whether cross-client model training is allowed only on anonymized/pseudonymized data.
- Whether exact GPS coordinates are used for model training or only for operational pickup/inspection workflows.
- Whether vendor scoring is visible to vendors, staff only, or only used for internal decisioning.
