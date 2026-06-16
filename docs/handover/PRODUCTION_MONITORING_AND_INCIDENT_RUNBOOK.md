# Production Monitoring and Incident Runbook

## Purpose

This runbook defines what must be monitored, who responds, and how incidents are handled for the salvage recovery platform.

## Monitoring Coverage

Monitor these services:

- Web application availability.
- Database connectivity and slow queries.
- Paystack webhooks and verification failures.
- Auction closure and scheduled auction cron jobs.
- Payment deadline/document deadline/pickup reminder cron jobs.
- KYC provider failures.
- Email, SMS, and push notification failures.
- Queue/worker health if heavy document, PDF, OCR, or AI work is moved to background processing.
- Error rate by route and role.
- Login/OTP/rate-limit anomalies.

## Minimum Alerts

| Alert | Severity | Response |
| --- | --- | --- |
| Application unavailable | Critical | Investigate hosting, database, deploy health. |
| Database connection failures | Critical | Check provider status, pool exhaustion, credentials. |
| Payment webhook verification failure spike | Critical | Check Paystack secret, webhook URL, replay/idempotency. |
| Auction closure cron failure | High | Run closure endpoint manually with cron secret after root-cause review. |
| Payment deadline cron failure | High | Run deadline endpoint manually and verify finance exceptions. |
| KYC provider outage | Medium | Confirm fallback/manual review behavior and notify managers. |
| Push/email/SMS provider failure | Medium | Confirm in-app notifications are still created. |
| Fraud queue spike | High | Assign manager/admin review and preserve evidence. |

## Incident Response Workflow

1. **Detect**
   - Alert fires or staff reports issue.
   - Record time, affected users, affected workflow, and error IDs/log samples.

2. **Triage**
   - Classify severity: Critical, High, Medium, Low.
   - Determine whether money movement, access control, KYC data, or auction integrity is affected.

3. **Contain**
   - Disable affected feature flag or provider integration where possible.
   - Pause risky cron jobs if they can duplicate financial or auction actions.
   - Preserve logs and audit records.

4. **Recover**
   - Deploy fix or rollback.
   - Replay safe idempotent jobs only after confirming state.
   - Verify affected user journeys.

5. **Communicate**
   - Notify internal owner.
   - Notify client/stakeholders for Critical or High incidents.
   - For personal-data incidents, involve legal/DPCO immediately.

6. **Postmortem**
   - Document root cause, timeline, customer impact, data impact, fix, and prevention.
   - Add tests/alerts for recurrence.

## Backup and Restore

Minimum production standard:

- Daily database backup.
- Separate retention policy for operational logs and audit logs.
- Monthly restore drill before full enterprise rollout.
- Restore drill evidence: date, operator, backup used, restore duration, validation result.

## Dependency and Vulnerability Management

- Run `npm audit --audit-level=high` before release.
- Do not use `npm audit fix --force` without a compatibility test plan.
- Track accepted vulnerabilities with owner, reason, expiry date, and mitigation.
- Run `npm run security:scan` before staging and production deployments.

## Provider Outage Fallbacks

- Paystack down: keep payment status pending/manual review; do not mark payment verified without finance evidence.
- Dojah/KYC down: allow manual review only if business policy permits.
- Email/SMS down: rely on in-app notifications and retry provider delivery.
- Cloudinary/Supabase storage down: block uploads and show user-facing retry guidance.
- Google OCR/AI down: proceed with manual document review and mark OCR unavailable.
