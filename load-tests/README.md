# NEM Salvage Load Tests

These scripts are for staging only. Do not run them against production unless a maintenance window and test accounts have been prepared.

## Auction Read Smoke

Installs required: [k6](https://k6.io/).

```powershell
$env:BASE_URL="https://staging.nemsalvage.com"
$env:AUCTION_ID="<staging-auction-id>"
$env:VENDOR_EMAIL="<test-vendor-email>"
$env:VENDOR_PASSWORD="<test-vendor-password>"
$env:VUS="50"
k6 run load-tests/k6/auction-read-smoke.js
```

The script logs in, validates the session, and polls a live auction. It does not place bids or move money. Use it first to baseline auth/session/polling capacity before adding any write-path bidding test.

For a write-path bidding simulation, create dedicated staging vendors, staging wallet balances, staging auctions, and explicit bid ceilings. Keep polling primary until Socket.IO is hosted separately and proven stable under load.
