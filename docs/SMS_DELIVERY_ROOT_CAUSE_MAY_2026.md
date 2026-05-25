# SMS Delivery Root Cause (verified May 20, 2026)

## Summary

Termii **accepts** SMS, **deducts balance**, and logs **"Successfully Sent"** — but phones often **do not receive** the message. This is **not** a bug in our API integration. Live API tests against your production Termii account prove the cause.

## Verified facts (live API, your account)

| Check | Result |
|-------|--------|
| Sender IDs | **NEMSAL** and **NEM** are **active** (approved) |
| Balance | ₦3,341+ credits |
| `channel=dnd` (transactional/OTP) | **Rejected:** `"Country Inactive. Contact Administrator to activate country."` |
| `channel=generic` (current `.env`) | **Accepted** with `message_id` and `"Successfully Sent"` |
| Termii message inbox | Mix of `Sent` and **`Failed`** — API success ≠ handset delivery |
| DND on test number (2348141252812) | MTN — not confirmed on DND list |

## Root cause

1. **Wrong Termii route for OTP and transactional SMS**  
   The app uses `TERMII_CHANNEL=generic`. Termii’s [Messaging API](https://developers.termii.com/messaging-api) states:
   - **generic** = promotional only; must not be used for OTP/transactional.
   - OTP/transactional must use **dnd** (bypasses DND, 24/7 on MTN).
   - Using generic for OTP causes **delivery failures** or sender blocking; messages to DND numbers are **not delivered**.

2. **DND route is not enabled on your Termii account**  
   We cannot switch to the correct route until Termii activates it. Until then, the app falls back to `generic`, which Termii will bill but carriers may drop.

3. **"Successfully Sent" is misleading**  
   Termii returns HTTP 200 + `message_id` when the message is **queued to the operator**, not when it reaches the phone. Inbox can later show `Failed` (e.g. grace-period SMS to 2348126462644, OTP to 2348074250008).

## Why it worked once

A single successful delivery on **generic** can happen (number not on DND, daytime, MTN quiet-hours window). It is **not** reliable for OTP. Repeated OTP on generic matches Termii’s documented failure mode.

## Required action (Termii support)

Email **support@termii.com** (or your account manager) and request:

> Please activate the **DND (transactional) route** for **Nigeria** on our account (**The Vaultline** / NEM Insurance). We send OTP and payment notifications and currently receive `Country Inactive` when using `channel: dnd`.

After activation, set in `.env` (and Vercel):

```env
TERMII_TRANSACTIONAL_CHANNEL=dnd
TERMII_CHANNEL=generic
```

The codebase now tries `dnd` first for OTP, auction_won, forfeiture, grace_period, and pickup_code, then falls back to `generic` with a server warning if DND is still inactive.

## Optional improvements

- Configure **Africa's Talking** fallback (`AFRICAS_TALKING_API_KEY`) for when generic fails.
- Keep **email OTP backup** enabled (already in resend flow).
- Avoid emojis in SMS templates (reduces segments and cost).
- Check Termii dashboard **Messaging → inbox** for `Failed` vs `Sent` per number.

## Diagnostic commands

```bash
npx tsx scripts/check-termii-status.ts
npx tsx scripts/diagnose-termii-delivery.ts 2348141252812
npx tsx scripts/check-sender-id-status.ts
```
