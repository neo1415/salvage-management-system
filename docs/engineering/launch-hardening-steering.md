# Launch Hardening Steering

This app handles insurer salvage workflows where retries, weak networks, and delayed background work are normal. Treat every production change as a workflow-safety change, not only a UI change.

## Coding Rules

- Keep role checks on the server route or service that owns the action. UI hiding is only convenience.
- Prefer business policy values over hardcoded insurer names, addresses, signatures, fees, deadlines, and document wording.
- Preserve compatibility fields when changing business language. For example, keep physical asset classification separate from insurer class of business.
- Use idempotent server operations for auction close, document generation, payment verification, pickup confirmation, uploads, and notification sends.
- If a user can retry because of a bad network, the database must still end with one canonical business result.
- Store critical state in the database. Use client storage only for draft/UI state, never authority over payment, auth, signatures, or ownership.
- Keep generated PDFs and exports deterministic from database records and active policy snapshots.

## Security Rules

- Validate ownership and role on every route that returns documents, payments, wallet data, user data, case evidence, or admin controls.
- Do not expose staff-only policy fields through public policy endpoints unless the field is intentionally public.
- Uploads must use signed upload URLs, role gates, size/type checks, and server-side references. Optional antivirus scanning may be enabled without blocking normal launch flow.
- Avoid logging secrets, OTPs, raw tokens, BVN values, full KYC payloads, payment authorization headers, or signed document image data.

## Performance Rules

- Reports and dashboards should use bounded, indexed queries and consistent date filters.
- Heavy work such as PDF generation, AI analysis, notification fanout, and exports should be safe to retry and ready to move behind a queue.
- Polling endpoints should return compact payloads and support 304/cache-friendly responses where practical.

## Offline-First Rules

- Field capture should tolerate bad connectivity: keep drafts local, make uploads retryable, and make final submit idempotent.
- Never mark an irreversible workflow complete only on the client. Confirmation must come from persisted server state.
- When the client recovers from a failed request, refresh canonical state instead of replaying blind side effects.

## Pickup Evidence Rules

- Vendor pickup evidence is a staff-control signal, not an automatic release decision.
- AI comparison may assist staff by comparing original inspection photos against pickup photos, but it must fail open into manual review.
- Do not show reserve, market value, salvage value, or internal AI pricing details to vendors during pickup evidence submission.
- Store the comparison summary with the evidence record so audit, pickup confirmation, and future evidence packet exports all read the same result.
