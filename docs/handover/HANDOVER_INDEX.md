# Handover Index

This is the recommended document pack to give a client, reviewer, or incoming engineer. The repository contains many historical implementation notes; this index names the documents that should be treated as current handover material.

## Client / Executive Pack

- `docs/handover/APPLICATION_DOCUMENTATION.md` - product overview, roles, workflows, architecture, operations, and value.
- `docs/handover/SALVAGE_BRIDGE_FULL_APPLICATION_DOCUMENTATION.md` - full chaptered application documentation for client, operations, and engineering handover.
- `docs/handover/UAT_ACCEPTANCE_CHECKLIST.md` - marked acceptance checklist mapped to the salvage-management scope.
- `docs/handover/TRAINING_GUIDE.md` - role-based training guide for NEM staff.
- `docs/handover/PRODUCTION_MONITORING_AND_INCIDENT_RUNBOOK.md` - monitoring, incident response, backup, and operational runbook.
- `docs/handover/CLIENT_MANUAL_ACTIONS.md` - items that require client/legal/cloud-account action.
- `docs/PRODUCTION_HANDOFF_AUDIT_2026-06-16.md` - production readiness, launch gates, security/scalability/readability posture.

## Procurement / Compliance Pack

- `docs/procurement/salvage-bridge/03-architecture-and-deployment.md` - architecture/deployment procurement pack.
- `docs/compliance-drafts/privacy-notice-template.md` - privacy notice draft.
- `docs/compliance-drafts/data-retention-policy-draft.md` - retention policy draft.
- `docs/compliance-drafts/backup-recovery-policy-draft.md` - backup/recovery policy draft.
- `docs/compliance-drafts/incident-response-policy-draft.md` - incident response draft.
- `docs/compliance-drafts/change-management-policy-draft.md` - change-management draft.
- `docs/compliance-drafts/vulnerability-management-policy-draft.md` - vulnerability-management draft.

## In-App Legal / Privacy Surfaces

- `src/app/(legal)/privacy/page.tsx` - public privacy policy page.
- `src/app/(legal)/terms/page.tsx` - public terms page.
- `src/app/(dashboard)/settings/privacy/page.tsx` - user privacy/data-rights page.
- `src/app/(dashboard)/admin/privacy-requests/page.tsx` - admin privacy request management page.
- `src/app/api/settings/privacy/route.ts` - user privacy request API.
- `src/app/api/admin/privacy-requests/route.ts` and `src/app/api/admin/privacy-requests/[id]/route.ts` - admin privacy request APIs.

## Technical Operator Pack

- `README.md` - project structure and local run basics.
- `SECURITY.md` - security policy and secret-handling guidance.
- `src/app/api/cases/[id]/evidence/export/route.ts` - authorized case evidence packet JSON export endpoint.
- `src/app/api/cases/[id]/evidence/export/pdf/route.ts` - authorized branded case evidence packet PDF export endpoint.
- `src/app/api/notifications/push/health/route.ts` - authenticated push configuration/subscription health and test-push endpoint.
- `src/app/api/cron/daily-maintenance/route.ts` - single Vercel-free-plan cron orchestrator for daily maintenance jobs.
- `src/app/api/cron/daily-backup/route.ts` - protected logical database backup upload endpoint.
- `scripts/backup-database.ts` - manual local/upload database backup script.
- `scripts/launch-reset-preserve-admin.ts` - guarded launch reset dry-run/execution script preserving `adneo502@gmail.com`.
- `docs/PRODUCTION_SETUP_GUIDE.md` - production setup guide.
- `docs/VERCEL_DEPLOYMENT_GUIDE.md` - Vercel deployment guide.
- `docs/DEPLOYMENT_VERIFICATION_CHECKLIST.md` - deployment verification checklist.
- `docs/PAYSTACK_WEBHOOK_SETUP_GUIDE.md` - Paystack webhook setup.
- `docs/PUSH_NOTIFICATION_SETUP_GUIDE.md` - push notification setup.
- `docs/GOOGLE_APIS_REAL_SETUP_GUIDE.md` - Google API setup.
- `docs/planning/PICKUP_AND_TRAINING_DATA_PIPELINE_SPEC.md` - pickup/training-data pipeline context.
- `docs/intelligence/ML_TRAINING_PIPELINE.md` - intelligence/training pipeline context.

## Canonical Launch Commands

```bash
npm run security:scan
npx tsc --noEmit
npm run build
npm run test:unit
npm run test:integration
npm run test:e2e
```

Run targeted integration tests for the flows being changed when the whole suite is too slow.
