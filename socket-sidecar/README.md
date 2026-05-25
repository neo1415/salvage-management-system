# NEM Salvage Socket.io Sidecar

This folder is a standalone Socket.io service that can be moved into its own repository and deployed to Render or another long-running Node host.

The main NEM Salvage app can remain on Vercel. Polling should stay primary until this sidecar is deployed and tested.

## Why This Exists

Vercel serverless/App Router routes cannot hold a long-lived Socket.io server. The current app has Socket.io logic tied into `server.ts`, which is fine for a custom Node server but not for Vercel production.

This sidecar keeps realtime UI delivery separate from the business-critical app:

- REST APIs remain the source of truth.
- Bids, payments, wallet changes, documents, and KYC decisions still happen in the main app.
- Socket.io broadcasts are read-only UI updates.
- Polling remains the fallback.

## Local Setup

```bash
cd socket-sidecar
npm install
npm run dev
```

Create `.env` from `.env.example`.

## Render Setup

Use these settings:

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Node version: 20+

Required environment variables:

- `PORT`: Render usually supplies this automatically.
- `APP_ORIGIN`: production web app origin, for example `https://nemsalvage.com`.
- `AUTH_SECRET` or `NEXTAUTH_SECRET`: must match the main app JWT signing secret.
- `SOCKET_INTERNAL_SECRET`: private secret used by the main app to call `/internal/broadcast`.

Recommended environment variables:

- `DATABASE_URL`: read-only or least-privilege database URL so the sidecar can verify user status.
- `REQUIRE_DB_USER_CHECK=true`: keep this true in production.
- `INTERNAL_BROADCAST_RATE_LIMIT=120`: per-minute limit for the internal broadcast endpoint.

## Vercel App Integration Plan

Do not switch behavior all at once.

1. Deploy this sidecar to Render.
2. Set the frontend variable in the main app:
   - `NEXT_PUBLIC_SOCKET_URL=https://your-render-socket-service.onrender.com`
3. Keep polling primary.
4. Set the server-only broadcast variables in the main app:
   - `SOCKET_INTERNAL_URL=https://your-render-socket-service.onrender.com/internal/broadcast`
   - `SOCKET_INTERNAL_SECRET=...`
5. Test auction watch counts first. This is the lowest-risk event because it does not mutate auctions, bids, wallets, payments, documents, or KYC records.
6. Then test bid updates, winner notifications, document updates, and reconnect behavior.
7. Only then consider making Socket.io primary.

Local values should stay local:

- Main app local: `NEXT_PUBLIC_SOCKET_URL=http://localhost:4001`, `SOCKET_INTERNAL_URL=http://localhost:4001/internal/broadcast`
- Main app production: `NEXT_PUBLIC_SOCKET_URL=https://your-render-socket-service.onrender.com`, `SOCKET_INTERNAL_URL=https://your-render-socket-service.onrender.com/internal/broadcast`
- Never put `SOCKET_INTERNAL_SECRET` in a `NEXT_PUBLIC_*` variable.

## Internal Broadcast API

The main app can call:

```http
POST /internal/broadcast
Authorization: Bearer <SOCKET_INTERNAL_SECRET>
Content-Type: application/json
```

Payload:

```json
{
  "type": "auction:update",
  "target": {
    "room": "auction:auction-id"
  },
  "payload": {
    "auctionId": "auction-id"
  }
}
```

Supported target shapes:

- `{ "room": "auction:<id>" }`
- `{ "userId": "<user-id>" }`
- `{ "vendorId": "<vendor-id>" }`
- `{ "auctionId": "<auction-id>" }`
- `{ "allAuctions": true }`

## Security Notes

- Never expose `SOCKET_INTERNAL_SECRET` to the browser.
- Keep `APP_ORIGIN` tight. Do not use `*` in production.
- Keep `REQUIRE_DB_USER_CHECK=true` in production so suspended/deleted users cannot keep realtime access.
- Socket events should not place bids or mutate money.
- `/internal/broadcast` has an in-process shared-secret check, payload validation, and basic rate limiting. Still rate-limit it at the platform/WAF layer if available.

## Current Limitations

- This sidecar does not yet replace app-side broadcasts automatically. It is intentionally isolated so it can be deployed and tested without breaking existing flows.
- Multi-instance scaling requires a Socket.io adapter or broker, such as Redis pub/sub on a real Redis server. Upstash REST Redis is not a drop-in pub/sub adapter for Socket.io.
