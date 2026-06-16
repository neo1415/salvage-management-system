# Client Manual Actions

These items cannot be completed by code alone. They require client, cloud-account, provider, legal, or business approval.

## Before Public Launch

1. **Secrets and provider accounts**
   - Rotate any keys that may have been exposed during development.
   - Confirm production-only keys for Paystack, Dojah, Google, Cloudinary/Supabase, email, SMS, push, and database.
   - Enable GitHub secret scanning and push protection on the repository.

2. **Backups and restore evidence**
   - Confirm production database backup schedule.
   - On Supabase Free tier, use the provided backup route/script with private off-site storage or upgrade to a plan with managed daily backups.
   - Set `SUPABASE_BACKUP_BUCKET` if you want a bucket name other than `app-backups`.
   - Confirm `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available to the server runtime so `/api/cron/daily-backup` can upload private backups.
   - Keep the backup bucket private. Do not make database backup objects public.
   - Run and record one restore drill.
   - Approve RPO/RTO and retention period.

3. **Monitoring accounts**
   - Sentry is wired in code. Add `NEXT_PUBLIC_SENTRY_DSN` or `SENTRY_DSN`, plus `SENTRY_TOKEN` or `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` for source-map upload.
   - Add production webhook/cron/payment/backup alert recipients.
   - Manually call `/api/cron/daily-maintenance` once after deployment with `Authorization: Bearer <CRON_SECRET>` and confirm the response includes the required payment, document, wallet, Paystack, backup, report, and leaderboard jobs.

4. **Push/SMS delivery evidence**
   - Open notification preferences on a deployed HTTPS origin, enable push, and use the in-app push test button.
   - Complete Termii Sender ID/DND registration with Termii and record live SMS delivery evidence.

5. **ClamAV malware scanning**
   - Provision a private `clamd` service.
   - Set `CLAMAV_HOST` or `CLAMD_HOST`.
   - Set `CLAMAV_PORT` or `CLAMD_PORT` if not using `3310`.
   - Set `KYC_VIRUS_SCAN_REQUIRED=true` if uploads must fail closed when the scanner is unavailable.

6. **Legal/privacy approval**
   - Review privacy notice, terms, retention policy, DPA posture, subprocessors, and NDPA/NDPR materials with counsel or DPCO.

7. **Business-policy decisions**
   - Confirm `CRON_SECRET` in Vercel and the single daily cron entry `/api/cron/daily-maintenance`.
   - Confirm forfeiture percentage, fallback winner behavior, and manual override process.
   - Confirm whether the current wallet freeze/release model is accepted for phase one or whether formal escrow provider/legal rollout is a later change request.
   - Confirm payment grace periods and pickup SLA thresholds.

8. **Launch reset**
   - The repository includes a guarded launch reset script for wiping pre-launch data while preserving `adneo502@gmail.com`.
   - Dry run only: `npm run db:launch-reset`.
   - Execute later, only after backup and written approval: `ALLOW_LAUNCH_RESET=true npm run db:launch-reset -- --confirm-launch-reset`.
   - The script is double-guarded; without both the environment variable and confirmation flag, it does not change data.

## Acceptance Evidence

- Signed UAT checklist.
- Training attendance record.
- Production deployment checklist.
- Payment/final acceptance letter.
- Source-transfer approval after full payment.
