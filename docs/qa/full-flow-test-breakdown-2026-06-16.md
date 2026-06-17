# Full Flow Test Breakdown - 2026-06-16

This is a working QA checklist from the latest end-to-end test pass. Mark items done only when the code path is fixed and validated.

## Case Creation

- [x] Electronics AI assessment must not inject a provided year when the electronics form does not collect a year.
- [x] Non-vehicle AI total-loss flags must not force a fixed policy cap when repair/part-pricing evidence does not support total loss.
- [x] GPS capture should retry for a better fix before accepting low accuracy, and copy should explain when device/browser accuracy is the limiting factor.
- [x] Map pin confirmation must either render a usable map or hide the pin instructions when map support is unavailable.
- [x] Voice recorder stop control must remain clickable after recording starts/pauses, including on mobile.
- [x] Mobile My Cases header should put the title at the top and place Export/Create controls in a row under it.
- [x] Review AI warnings for severity/percentage mismatch and market price variance so warnings are useful and not misleading.

## Auction And Prediction

- [x] Auction prediction endpoint must not crash on grouped payment queries.
- [x] Prediction/history logic should use latest verified winner payments only.
- [x] Vendor auction title must use a proper asset display name per asset type, not strings like "apple Electronics".
- [x] Watch count should be consistent across auction details, listing cards, and bid history.
- [x] Bidders should count as watchers where appropriate.
- [x] Scheduled auctions should support Watch and notify vendors by email/push when the auction goes live.

## Bidding, Payment, And Notifications

- [x] Bid OTP should be sent by push notification as a backup to SMS, without persisting exposed OTP beyond expiry.
- [x] Push notification clicks must deep-link directly to the relevant app route, not restart at the splash screen.
- [x] "You won" push notifications should open the auction details/documents flow, not payment receipt/details.
- [x] PWA should avoid unnecessary splash/restart behavior when quickly returning to the app.
- [x] Paystack payment confirmation modal should stop polling/close when backend already shows payment complete.
- [x] Same-IP or coordinated bidding should create admin fraud alerts, email, and push notifications.
- [x] Same-IP fraud alert details should show all involved accounts, not only one account.

## Evidence Packet

- [x] Evidence PDF should render the naira currency cleanly.
- [x] Evidence PDF should include the brand logo in the header.
- [x] Evidence PDF should remove the Security Notes section.

## Reports And Leaderboards

- [x] Leaderboard ranking definition should be explicit and defensible.
- [x] Report PDF exports should include full tables, not UI pagination controls.
- [x] Vendor performance ranking should explain why NEM outranks The Vendor despite lower bids/wins.
- [x] KPI dashboard case breakdown should sort latest first.

## Operational Notes

- Termii DND transactional route activation is still external/vendor-side.
- Some GPS precision limitations are browser/device/network dependent, but the app should retry and communicate clearly.
