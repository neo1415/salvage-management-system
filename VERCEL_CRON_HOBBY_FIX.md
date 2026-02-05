# Vercel Cron Jobs - Hobby Plan Fix

## Issue
Vercel Hobby plan has strict cron job limitations:
- **Daily execution limit**: Cron jobs can only run once per day
- **Timing precision**: ±59 minutes (e.g., 1:00 AM could run anywhere between 1:00-1:59 AM)
- Expressions that run more frequently will fail deployment with error: "Hobby accounts are limited to daily cron jobs"

## Problem Cron Job
The `fraud-auto-suspend` cron was configured to run every hour:
```json
{
  "path": "/api/cron/fraud-auto-suspend",
  "schedule": "0 * * * *"  // Every hour - NOT ALLOWED on Hobby
}
```

This caused deployment failures on Vercel.

## Solution
Removed the hourly fraud-auto-suspend cron job from `vercel.json`.

### Current Cron Jobs (All Daily)
```json
{
  "crons": [
    {
      "path": "/api/cron/payment-deadlines",
      "schedule": "0 2 * * *"  // Daily at 2 AM
    },
    {
      "path": "/api/cron/auction-closure",
      "schedule": "0 3 * * *"  // Daily at 3 AM
    },
    {
      "path": "/api/cron/leaderboard-update",
      "schedule": "0 0 * * 1"  // Weekly on Monday at midnight
    }
  ]
}
```

All remaining cron jobs run once per day or less frequently, which is compliant with Hobby plan limits.

## Alternative for Fraud Detection
Since the fraud-auto-suspend cron can't run hourly on Hobby plan, you have these options:

### Option 1: Manual Trigger (Current)
The fraud detection API endpoint still exists at `/api/cron/fraud-auto-suspend` and can be:
- Called manually by admins
- Triggered via external cron service (like cron-job.org)
- Called from admin dashboard with a button

### Option 2: Upgrade to Pro Plan
Pro plan allows:
- Cron jobs every minute
- Per-minute scheduling precision
- 100 cron jobs per project

### Option 3: Event-Driven Detection
Instead of scheduled checks, trigger fraud detection:
- When a new bid is placed
- When a payment is made
- When suspicious activity is reported
- On-demand from admin dashboard

## Files Modified
- `vercel.json` - Removed hourly fraud-auto-suspend cron

## Deployment
This fix allows the app to deploy successfully on Vercel Hobby plan without cron job errors.

## Future Considerations
When upgrading to Pro plan, you can re-enable the fraud-auto-suspend cron:
```json
{
  "path": "/api/cron/fraud-auto-suspend",
  "schedule": "0 * * * *"  // Every hour (Pro plan only)
}
```
