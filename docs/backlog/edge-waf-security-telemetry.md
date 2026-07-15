# Edge/WAF Security Telemetry Backlog

Status: backlog

Anonymous public-page visits must not be written to the business audit log. The audit log is for business actions such as authentication, case work, bidding, payments, approvals, and administrative changes.

Build a separate edge/WAF security telemetry stream for:

- blocked IP requests and temporary containment hits;
- suspicious route probes and malformed requests;
- authentication failures and MFA challenge failures;
- rate-limit events;
- repeated `401`, `403`, `404`, and `429` responses by IP prefix, account, route, and user agent.

Implementation notes:

- Prefer Vercel Firewall/WAF or edge-log export as the first capture point.
- Store only security-relevant metadata with retention limits and privacy review.
- Keep hardcoded IP blocks temporary; durable deny rules belong in managed WAF configuration.
- Surface aggregated trends in a security dashboard instead of mixing them into finance, case, or claims audit trails.
