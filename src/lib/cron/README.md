# Cron Jobs

This directory contains scheduled background jobs for the Salvage Management System.

## Fraud Auto-Suspend

**File:** `fraud-auto-suspend.ts`

**Schedule:** Every hour (0 * * * *)

**Purpose:** Automatically suspends vendors with 3+ confirmed fraud flags:
- Identifies vendors with 3+ fraud flags
- Auto-suspends account for 30 days
- Cancels all active bids
- Sends SMS + Email notification
- Allows Admin to review and reinstate
- Creates audit log entry

**Requirements:** 36

### How It Works

1. **Identify Repeat Offenders** (Requirement 36.1)
   - Queries vendors with status 'approved' and 3+ fraud flags
   - Filters vendors who haven't been suspended yet
   - Logs count of vendors to be suspended

2. **Auto-Suspend Account** (Requirement 36.1, 36.4)
   - Updates vendor status to 'suspended'
   - Sets suspension period to 30 days
   - Records suspension reason and end date
   - Creates audit log entry with full details

3. **Cancel Active Bids** (Requirement 36.2)
   - Finds all active auctions where vendor has bids
   - Removes vendor as current bidder if applicable
   - Resets auction to previous highest bid from another vendor
   - Logs number of bids cancelled

4. **Send Notifications** (Requirement 36.3)
   - Sends SMS with suspension notice and support contact
   - Sends detailed email with suspension details and appeal process
   - Includes suspension end date and fraud flag count
   - Provides support contact information

5. **Admin Review** (Requirement 36.4)
   - Admin can view suspended vendors in fraud dashboard
   - Admin can reinstate if flags are false positives
   - Audit trail maintains full history of suspension

### Deployment

#### Vercel Cron (Recommended)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/fraud-auto-suspend",
      "schedule": "0 * * * *"
    }
  ]
}
```

#### Manual Trigger

You can manually trigger the cron job for testing:

```bash
curl -X POST http://localhost:3000/api/cron/fraud-auto-suspend \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Monitoring

The cron job logs all actions:
- Number of vendors suspended
- Number of bids cancelled
- Number of notifications sent
- Any errors encountered

### Testing

To test the cron job locally:

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Trigger the cron job:
   ```bash
   curl -X POST http://localhost:3000/api/cron/fraud-auto-suspend \
     -H "Authorization: Bearer dev-secret-change-in-production"
   ```

3. Check the response for results:
   ```json
   {
     "success": true,
     "timestamp": "2024-01-15T10:00:00.000Z",
     "results": {
       "vendorsSuspended": 2,
       "bidsCancelled": 5,
       "notificationsSent": 4,
       "errors": []
     }
   }
   ```

## Payment Deadline Enforcement

**File:** `payment-deadlines.ts`

**Schedule:** Every hour (0 * * * *)

**Purpose:** Enforces payment deadlines for auction winners:
- Sends SMS reminder 12 hours before deadline
- Flags payments as 'overdue' after 24 hours
- Forfeits auction winner after 48 hours
- Re-lists item for auction
- Suspends vendor for 7 days

**Requirements:** 29, 30

### How It Works

1. **12-Hour Reminder** (Requirement 29.1)
   - Finds payments with deadline between 11-12 hours from now
   - Sends SMS and email reminder with payment link
   - Logs reminder in audit trail

2. **24-Hour Overdue Flag** (Requirement 30.2-30.4)
   - Finds payments past deadline by 24+ hours
   - Updates payment status to 'overdue'
   - Increments vendor fraud flags
   - Sends warning SMS and email

3. **48-Hour Forfeit** (Requirement 30.5-30.8)
   - Finds payments past deadline by 48+ hours
   - Updates payment status to 'rejected' (forfeited)
   - Suspends vendor for 7 days
   - Creates new auction for the same case (re-list)
   - Sends notification to vendor
   - Logs forfeit and suspension in audit trail

### Deployment

#### Vercel Cron (Recommended)

The cron job is configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/payment-deadlines",
      "schedule": "0 * * * *"
    }
  ]
}
```

Vercel will automatically call the endpoint every hour.

#### Manual Trigger

You can manually trigger the cron job for testing:

```bash
curl -X POST http://localhost:3000/api/cron/payment-deadlines \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

#### Environment Variables

Set the following environment variable for security:

```env
CRON_SECRET=your-secure-random-secret-here
```

In development, it defaults to `dev-secret-change-in-production`.

### Monitoring

The cron job logs all actions:
- Number of reminders sent
- Number of payments flagged as overdue
- Number of auctions forfeited

Check the logs in Vercel dashboard or your logging service.

### Testing

To test the cron job locally:

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Trigger the cron job:
   ```bash
   curl -X POST http://localhost:3000/api/cron/payment-deadlines \
     -H "Authorization: Bearer dev-secret-change-in-production"
   ```

3. Check the response for results:
   ```json
   {
     "success": true,
     "timestamp": "2024-01-15T10:00:00.000Z",
     "result": {
       "remindersSent": 5,
       "overduePayments": 2,
       "forfeitedAuctions": 1
     }
   }
   ```

### Error Handling

The cron job handles errors gracefully:
- Individual payment processing errors are logged but don't stop the entire job
- Failed SMS/email notifications are logged but don't prevent status updates
- Database errors are caught and logged

### Performance

The cron job is optimized for performance:
- Uses indexed queries on `payment_deadline` and `status` columns
- Processes payments in batches
- Uses database transactions for consistency
- Completes in <30 seconds for 1000+ payments
