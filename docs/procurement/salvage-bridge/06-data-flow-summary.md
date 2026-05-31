# Data Flow Summary

This is a non-exhaustive summary for procurement and security review. A formal data-flow diagram should be prepared for final enterprise onboarding.

## Case Intake Flow

1. Claims adjuster creates case.
2. Photos, voice notes, location, and asset details are uploaded/recorded.
3. AI-assisted assessment and market valuation may be generated.
4. Salvage manager reviews and approves/rejects.
5. Approved case can move into auction workflow.

Data involved:

- claim reference
- asset details
- photos
- voice notes
- location data
- valuation/AI assessment data
- user IDs and approval metadata

## Vendor KYC Flow

1. Vendor registers and signs in.
2. Vendor completes Tier 1 / Tier 2 verification.
3. Dojah provider references and webhook events are recorded.
4. Normalized verification evidence is stored.
5. Salvage manager reviews and approves/rejects where required.

Data involved:

- names, email, phone
- BVN/NIN where configured
- business information
- identity documents
- liveness/selfie data where provider flow requires it
- provider payloads and normalized verification results
- AML/risk signals where provided

## Auction and Bid Flow

1. Manager creates auction from approved salvage case.
2. Eligible vendors browse and bid.
3. Wallet/deposit checks determine bid readiness.
4. Auction closes naturally or manually.
5. Winner is recorded and documents are generated.

Data involved:

- auction IDs
- vendor IDs
- bid amounts
- reserve/current bid
- deposit events
- auction timing/status

## Payment and Settlement Flow

1. Winning vendor signs required documents.
2. Payment method is calculated: wallet, Paystack, or hybrid where enabled.
3. Paystack webhook or verification route confirms payment.
4. Wallet/deposit records are updated.
5. Finance/reconciliation records are available.

Data involved:

- payment references
- wallet balances
- frozen/available amounts
- deposit events
- Paystack webhook payload references
- transaction history

## Document Flow

1. Document is generated from auction/case/vendor/policy data.
2. Vendor signs document.
3. Signed PDF is regenerated/stored.
4. Authorized vendor downloads document through server-mediated routes.
5. Download records/audit events are stored.

Data involved:

- vendor identity
- asset details
- sale price
- document type
- signature data
- PDF URL/public ID
- download metadata

## Notification Flow

Notifications may use:

- in-app notifications
- email
- SMS
- push subscriptions where configured

Notification content should use active brand/business policy details and avoid exposing unnecessary internal IDs.

