# Dojah Enterprise KYC Integration

NEM Salvage uses Dojah as the KYC, BVN, business verification, liveness, AML, and fraud-signal provider. NEM Salvage remains the operational system of record: Dojah evidence is stored, normalized, audited, and reviewed inside the app.

## Required Configuration

- `DOJAH_APP_ID`: Dojah app ID from the Dojah dashboard.
- `DOJAH_API_KEY`: server-side secret/API key. Never expose this in client code.
- `DOJAH_PUBLIC_KEY`: public key used only by the Dojah browser widget.
- `DOJAH_WORKFLOW_SLUG`: EasyOnboard flow slug. Current flow is `salvage`.
- `DOJAH_WIDGET_ID` or `DOJAH_EASYONBOARD_FLOW_ID`: optional Dojah widget/EasyOnboard flow ID if provided by Dojah.
- `DOJAH_WEBHOOK_SECRET`: shared secret used to protect `/api/webhooks/dojah`.
- `DOJAH_WEBHOOK_PUBLIC_URL`: optional public HTTPS base URL used by `scripts/dojah-subscribe-webhooks.ts` when registering webhooks. Use this for local tunnel testing only.
- `DOJAH_EASYDETECT_INGEST_KEY`: EasyDetect ingest key from EasyDetect settings. It is separate from the Dojah private API key.
- `DOJAH_BASE_URL`: optional, defaults to `https://api.dojah.io`.
- `NEXT_PUBLIC_TIER2_KYC_PROVIDER`: use `dojah` for the widget flow. Set to `manual` and redeploy to route vendors to the legacy manual Tier 2 page as a temporary fallback.

Environment split:

| Environment | `NEXT_PUBLIC_APP_URL` | `DOJAH_WEBHOOK_PUBLIC_URL` |
| --- | --- | --- |
| Local app/widget testing | `http://localhost:3000` | blank |
| Local webhook testing | `http://localhost:3000` | public HTTPS tunnel, for example `https://abc123.ngrok-free.app` |
| Production | `https://nemsalvage.com` | blank unless Dojah must call a different public domain |

Do not set local `NEXT_PUBLIC_APP_URL` to `https://nemsalvage.com`. That makes local testing look like production and can register or validate the wrong callback/origin.

Production webhook URL to configure in Dojah:

```text
https://nemsalvage.com/api/webhooks/dojah?secret=<DOJAH_WEBHOOK_SECRET>
```

Localhost webhook URLs will not work because Dojah cannot call your private machine directly. For local webhook testing, start an HTTPS tunnel to port 3000 and configure/register:

```text
https://<your-tunnel-host>/api/webhooks/dojah?secret=<DOJAH_WEBHOOK_SECRET>
```

If Dojah provides a signature header for your account, configure the same secret and the app will also accept an HMAC-SHA256 signature in `x-dojah-signature` or `x-signature`.

Recommended webhook subscriptions:

- `KYC Widget` or `kyc_widget`: primary EasyOnboard/KYC widget completion payloads. The current dashboard label is `KYC Widget`; some docs use `kyc_widget`.
- `address`: separate address verification events if your flow sends them separately.
- `Aml Monitoring` / `aml_monitoring`: ongoing AML monitoring alerts outside a single widget run if enabled for your account.
- `Business Registration` / `business_registration`: subscribe if the dashboard accepts it for business/CAC events.

You can register them through the dashboard or run:

```bash
npx tsx scripts/dojah-subscribe-webhooks.ts
```

The script is dry-run by default. It prints `NODE_ENV`, `NEXT_PUBLIC_APP_URL`, `DOJAH_WEBHOOK_PUBLIC_URL`, the final redacted webhook URL, and selected services. It will not register anything unless you add:

```bash
npx tsx scripts/dojah-subscribe-webhooks.ts --confirm
```

The script refuses to register `localhost`, `127.0.0.1`, or non-HTTPS webhook URLs.

## Local Widget Testing

1. Set local `.env`:

```text
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
DOJAH_BASE_URL=https://api.dojah.io
DOJAH_WORKFLOW_SLUG=salvage
DOJAH_WIDGET_ID=<widget_id from the Dojah shareable link>
```

2. In the Dojah dashboard, confirm the widget/shareable link belongs to the same Dojah app as `DOJAH_APP_ID` and `DOJAH_PUBLIC_KEY`.
3. In the Dojah dashboard allowed domains/origins for the app/widget, add:

```text
http://localhost:3000
https://nemsalvage.com
```

4. If Dojah rejects `localhost`, use an HTTPS tunnel for browser testing too, set `NEXT_PUBLIC_APP_URL` and `NEXTAUTH_URL` to that tunnel URL for that local session, and add the tunnel origin in Dojah while testing.
5. The browser must only receive public widget config. Do not return BVN, NIN, full government ID numbers, raw documents, private keys, or raw provider payloads to the client.

## Completion-to-Review Pipeline

The Tier 2 widget must not rely on a browser-only reference. `/api/kyc/widget-config` creates or reuses a server-side `provider_verification_records` row before the widget opens, returns only the safe `verificationReference` to the browser, and passes the same reference to Dojah as `reference_id` plus metadata.

When the widget completes, the app handles both frontend callbacks and webhook delivery:

- Frontend `onSuccess` / `onComplete` calls `/api/kyc/complete` with the reference.
- `/api/webhooks/dojah` accepts Dojah KYC Widget events, resolves the vendor from metadata or the stored provider reference, stores normalized evidence, and marks Tier 2 as pending review.
- NEM Salvage keeps the final decision manual. A completed Dojah workflow creates evidence and moves the vendor to pending review; it does not auto-approve Tier 2 access.

If Dojah says "Verification Complete" but the vendor does not appear in `/manager/vendors?tier=tier2_full&status=pending`, check:

1. `provider_verification_records` has a `dojah` / `tier2` row with the same provider reference.
2. The vendor row has `tier2_submitted_at` and `tier2_dojah_reference_id`.
3. Dojah webhook events are arriving at `/api/webhooks/dojah`.
4. The webhook payload includes either the metadata sent by the widget or the same reference stored before launch.

The Dojah address autocomplete step is controlled by the embedded Dojah widget. If the address step only proceeds after selecting an autocomplete result, treat that as Dojah widget behavior. The app can prefill safe profile metadata, but it should not bypass Dojah's address control or store raw geolocation coordinates.

## Fetch-by-Reference (Server-Side)

Dojah exposes `GET /api/v1/kyc/verification?reference_id=...` (see `DojahService.getVerificationResult`). NEM Salvage uses it only on the server from:

- `/api/kyc/complete` (widget callback)
- `/api/webhooks/dojah` (after a signed webhook)
- `/api/kyc/status` and `/api/kyc/widget-config` (reconcile stored references)
- `POST /api/kyc/approvals/[id]/refresh-evidence` (Salvage Manager manual refresh)

Callbacks and webhooks remain the primary source of truth. Reconcile/fetch is a backfill when Dojah dashboard shows "complete" but NEM Salvage never received the callback/webhook.

If reconcile fails, the manager can sync with an explicit `reference_id` using `/manager/vendors?tier=tier2&status=pending` or `POST /api/kyc/dojah/sync-reference`. This is for early attempts created before the server-side reference fix. The sync route fetches Dojah by reference and only attaches evidence when it can match the vendor by stored reference, metadata, or one unambiguous email/phone match. If matching is ambiguous, pass `vendorId` explicitly.

Data that Dojah does not return on the verification API (e.g. downloadable document binaries) is shown as metadata only in manager review; use Dojah dashboard or export for provider-held files.

## Dojah Widget Notifications vs NEM Emails

Dojah's flow settings include user notification controls such as "Send Verification Status to Users" and dashboard-level branding (logo/brand color/support email). For NEM-owned user communications:

1. In the Dojah dashboard, open the Easy Onboard / verification flow configuration and disable user-facing status emails if available.
2. Keep webhook/business notifications enabled for `kyc_widget`.
3. Let NEM Salvage send branded emails/SMS from its own notification service when webhook/callback/review events move the user to under review, approved, or rejected.
4. Do not include AML/PEP/sanctions details in vendor-facing emails. Show only safe operational status and next steps.

Dojah file links for selfies/documents expire within one hour. NEM Salvage does not expose raw Dojah document URLs in normal manager UI; use server-side refresh or provider metadata.

## Embedded Camera Permissions

The Tier 2 liveness/selfie step runs inside Dojah's embedded verification page, usually from `https://identity.dojah.io` through the Dojah widget script. Browser permission for `http://localhost:3000` and permission for the embedded Dojah origin are not always the same thing.

The app allows Dojah frames in CSP and delegates camera/microphone permissions to `identity.dojah.io` and `widget.dojah.io`. The Tier 2 page also adds `allow="camera; microphone; fullscreen; autoplay"` to Dojah iframes when the widget injects them.

If camera still fails locally:

1. Confirm the browser has camera permission for the current app origin.
2. If Chrome exposes a separate entry for `identity.dojah.io`, allow camera there too.
3. Test through a public HTTPS tunnel such as ngrok/cloudflared instead of `localhost`.
4. Add the exact tunnel origin in Dojah allowed domains/origins while testing.
5. Remember that browser permissions reset when the ngrok/cloudflared URL changes.
6. Retest outside installed PWA mode if needed, because installed PWA camera prompts can behave differently from a normal browser tab.

## Local Webhook Testing

1. Start the app locally on port 3000.
2. Start an HTTPS tunnel to port 3000, for example ngrok or cloudflared.
3. Set:

```text
NEXT_PUBLIC_APP_URL=http://localhost:3000
DOJAH_WEBHOOK_PUBLIC_URL=https://<your-tunnel-host>
```

4. Dry-run the subscription:

```bash
npx tsx scripts/dojah-subscribe-webhooks.ts
```

5. Confirm the printed final webhook URL points to your tunnel, then register:

```bash
npx tsx scripts/dojah-subscribe-webhooks.ts --confirm
```

## Production Webhook Setup

In the deployed environment, set:

```text
NEXT_PUBLIC_APP_URL=https://nemsalvage.com
DOJAH_WEBHOOK_PUBLIC_URL=
DOJAH_BASE_URL=https://api.dojah.io
DOJAH_WORKFLOW_SLUG=salvage
DOJAH_WIDGET_ID=<production widget_id>
```

Then run the subscription script only from an environment that has the production env vars loaded, or configure the URL directly in the Dojah dashboard:

```text
https://nemsalvage.com/api/webhooks/dojah?secret=<DOJAH_WEBHOOK_SECRET>
```

## Widget/App/Key Consistency Checklist

If the Tier 2 widget fails with `Verification Failed` and no reference ID:

- Confirm `DOJAH_WIDGET_ID` is the `widget_id` from the EasyOnboard shareable link, not the app ID.
- Confirm the widget belongs to the same Dojah app as `DOJAH_APP_ID`.
- Confirm `DOJAH_PUBLIC_KEY` belongs to that same app and environment.
- Confirm the current browser origin is allowed in Dojah app/widget settings.
- Confirm production credentials are not being tested on a blocked localhost origin.
- Confirm the browser console shows widget init with `hasWidgetId: true` and the expected `origin`.

## Flow Mapping

- Tier 1 BVN now calls Dojah BVN validation through the existing `/api/vendors/verify-bvn` route.
- Paystack remains unchanged for payments.
- Tier 2 opens the Dojah EasyOnboard/widget flow and posts the reference to `/api/kyc/complete`.
- Dojah webhooks are received at `/api/webhooks/dojah`, deduplicated by event ID, normalized, and stored.
- Dojah evidence is written to `provider_verification_records`; webhook receipts are written to `provider_webhook_events`.
- Risky Dojah evidence creates or updates internal `fraud_alerts`.
- Salvage Managers and System Admins see Dojah evidence in KYC review.

## Review Rules

Dojah is evidence, not the final approver. Because the Dojah workflow review process is manual, Tier 2 remains `pending_review` until a Salvage Manager or System Admin approves or rejects inside NEM Salvage.

## EasyDetect Key

Dojah documents EasyDetect as using an Ingest key in the request body, separate from the `Authorization` secret key. In the dashboard, look under EasyDetect settings for the Ingest key and set it as `DOJAH_EASYDETECT_INGEST_KEY`.

## Sensitive Data

- Raw provider payloads are encrypted before storage with `ENCRYPTION_KEY`.
- BVN/NIN/full document IDs are not shown in normal review screens.
- Audit logs are sanitized for BVN, NIN, secrets, tokens, and raw provider payloads.
