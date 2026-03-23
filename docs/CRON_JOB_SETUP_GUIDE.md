# Cron Job Setup Guide

This guide explains how to set up and secure cron jobs for the Salvage Management System.

## Overview

The system uses two cron jobs:
1. **Payment Deadline Enforcement** - Runs every hour to check payment deadlines
2. **Auction Closure** - Runs every 5 minutes to close expired auctions

## Cron Job Configuration

### 1. Vercel Cron Configuration

The cron jobs are configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/payment-deadlines",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/auction-closure",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Schedule Format (Cron Expression):**
- `0 * * * *` = Every hour at minute 0
- `*/5 * * * *` = Every 5 minutes
- Format: `minute hour day month weekday`

### 2. CRON_SECRET Configuration

The `CRON_SECRET` is a security token that prevents unauthorized access to your cron endpoints.

## How to Get/Generate CRON_SECRET

### Option 1: Generate Your Own (Recommended)

You can generate a secure random secret using any of these methods:

#### Method A: Using Node.js
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Method B: Using OpenSSL
```bash
openssl rand -hex 32
```

#### Method C: Using Online Generator
Visit: https://generate-secret.vercel.app/32

#### Method D: Using PowerShell (Windows)
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### Option 2: Use the Pre-Generated Secret (Development Only)

For development, a secret has been pre-generated in `.env`:
```
CRON_SECRET=cron_secret_a8f3b2e9c4d7f1a6b5e8c3d9f2a7b4e1c6d8f3a9b2e5c7d1f4a8b3e6c9d2f5a1
```

**⚠️ IMPORTANT:** For production, you MUST generate a new secret!

## Setup Instructions

### Local Development

1. **Verify `.env` file has CRON_SECRET:**
   ```env
   CRON_SECRET=cron_secret_a8f3b2e9c4d7f1a6b5e8c3d9f2a7b4e1c6d8f3a9b2e5c7d1f4a8b3e6c9d2f5a1
   ```

2. **Test the cron endpoints manually:**
   ```bash
   # Test auction closure
   curl -X GET http://localhost:3000/api/cron/auction-closure \
     -H "Authorization: Bearer cron_secret_a8f3b2e9c4d7f1a6b5e8c3d9f2a7b4e1c6d8f3a9b2e5c7d1f4a8b3e6c9d2f5a1"

   # Test payment deadlines
   curl -X GET http://localhost:3000/api/cron/payment-deadlines \
     -H "Authorization: Bearer cron_secret_a8f3b2e9c4d7f1a6b5e8c3d9f2a7b4e1c6d8f3a9b2e5c7d1f4a8b3e6c9d2f5a1"
   ```

3. **Expected Response:**
   ```json
   {
     "success": true,
     "message": "Auction closure completed",
     "result": {
       "totalProcessed": 0,
       "successful": 0,
       "failed": 0,
       "timestamp": "2024-01-06T12:00:00.000Z"
     }
   }
   ```

### Production Deployment (Vercel)

1. **Generate a new production secret:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   
   Example output: `7f3a9b2e5c8d1f4a6b3e9c2d5f8a1b4e7c0d3f6a9b2e5c8d1f4a7b0e3c6d9f2`

2. **Add to Vercel Environment Variables:**
   - Go to your Vercel project dashboard
   - Navigate to **Settings** → **Environment Variables**
   - Add new variable:
     - **Name:** `CRON_SECRET`
     - **Value:** `7f3a9b2e5c8d1f4a6b3e9c2d5f8a1b4e7c0d3f6a9b2e5c8d1f4a7b0e3c6d9f2`
     - **Environment:** Production, Preview, Development (select all)
   - Click **Save**

3. **Redeploy your application:**
   ```bash
   git push origin main
   ```
   Or trigger a redeploy from Vercel dashboard.

4. **Verify cron jobs are running:**
   - Go to Vercel dashboard → **Deployments** → **Cron Jobs**
   - You should see both cron jobs listed with their schedules
   - Check execution logs to verify they're running successfully

## Security Best Practices

### 1. Keep CRON_SECRET Secure
- ✅ Never commit the production secret to Git
- ✅ Use different secrets for development and production
- ✅ Rotate secrets periodically (every 90 days)
- ✅ Store in environment variables only

### 2. Monitor Cron Job Execution
- Check Vercel logs regularly for errors
- Set up alerts for failed cron jobs
- Monitor execution time and performance

### 3. Rate Limiting
The cron endpoints have built-in protection:
- Require valid `Authorization: Bearer {CRON_SECRET}` header
- Return 401 Unauthorized for invalid/missing secrets
- Log all access attempts

## Troubleshooting

### Cron Job Not Running

**Problem:** Cron jobs don't execute on schedule

**Solutions:**
1. Verify `vercel.json` is in the root directory
2. Check Vercel dashboard → Cron Jobs section
3. Ensure you're on a Vercel Pro plan (Hobby plan has limitations)
4. Check deployment logs for errors

### 401 Unauthorized Error

**Problem:** Cron endpoint returns 401

**Solutions:**
1. Verify `CRON_SECRET` is set in Vercel environment variables
2. Check the Authorization header format: `Bearer {secret}`
3. Ensure no extra spaces or newlines in the secret
4. Redeploy after adding environment variables

### Cron Job Timeout

**Problem:** Cron job times out before completion

**Solutions:**
1. Optimize database queries
2. Add pagination for large datasets
3. Increase Vercel function timeout (Pro plan)
4. Consider splitting into smaller batches

## Alternative Cron Services

If you're not using Vercel, you can use these alternatives:

### 1. GitHub Actions
Create `.github/workflows/cron.yml`:
```yaml
name: Cron Jobs
on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
    - cron: '0 * * * *'    # Every hour

jobs:
  run-cron:
    runs-on: ubuntu-latest
    steps:
      - name: Call Auction Closure
        run: |
          curl -X GET ${{ secrets.APP_URL }}/api/cron/auction-closure \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
      
      - name: Call Payment Deadlines
        run: |
          curl -X GET ${{ secrets.APP_URL }}/api/cron/payment-deadlines \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### 2. External Cron Service (cron-job.org)
1. Sign up at https://cron-job.org
2. Create new cron job
3. Set URL: `https://your-domain.com/api/cron/auction-closure`
4. Add header: `Authorization: Bearer {your-secret}`
5. Set schedule: `*/5 * * * *`

### 3. AWS EventBridge
1. Create EventBridge rule with schedule expression
2. Set target as HTTP endpoint
3. Add authorization header with secret

## Monitoring and Logging

### View Cron Execution Logs

**Vercel:**
```bash
vercel logs --follow
```

**Filter for cron jobs:**
```bash
vercel logs --follow | grep "cron"
```

### Check Execution History

1. Go to Vercel Dashboard
2. Select your project
3. Navigate to **Logs** tab
4. Filter by function: `/api/cron/auction-closure`

### Set Up Alerts

Add monitoring to your cron endpoints:

```typescript
// src/app/api/cron/auction-closure/route.ts
if (result.failed > 0) {
  // Send alert to Slack/Discord/Email
  await sendAlert({
    message: `Auction closure failed: ${result.failed} auctions`,
    severity: 'warning',
  });
}
```

## Testing Cron Jobs

### Manual Testing

```bash
# Test locally
curl -X GET http://localhost:3000/api/cron/auction-closure \
  -H "Authorization: Bearer ${CRON_SECRET}"

# Test production
curl -X GET https://your-domain.com/api/cron/auction-closure \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

### Automated Testing

Create a test script:

```typescript
// scripts/test-cron.ts
import { config } from 'dotenv';
config();

async function testCronEndpoint(endpoint: string) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${process.env.CRON_SECRET}`,
    },
  });
  
  const data = await response.json();
  console.log(`${endpoint}:`, data);
}

testCronEndpoint('/api/cron/auction-closure');
testCronEndpoint('/api/cron/payment-deadlines');
```

Run with:
```bash
npx tsx scripts/test-cron.ts
```

## Cost Considerations

### Vercel Pricing
- **Hobby Plan:** Limited cron jobs (may not work reliably)
- **Pro Plan:** $20/month, includes cron jobs
- **Enterprise:** Custom pricing

### Execution Costs
- Each cron execution counts toward function invocations
- Monitor usage in Vercel dashboard
- Optimize queries to reduce execution time

## Summary

✅ **Setup Complete:**
- `vercel.json` configured with cron schedules
- `CRON_SECRET` added to `.env` and `.env.example`
- Cron endpoints secured with Bearer token authentication
- Documentation provided for production deployment

🔐 **Security:**
- Generate unique secret for production
- Never commit secrets to Git
- Use environment variables only

📊 **Monitoring:**
- Check Vercel dashboard for execution logs
- Set up alerts for failures
- Monitor performance and costs

🚀 **Next Steps:**
1. Generate production CRON_SECRET
2. Add to Vercel environment variables
3. Deploy to production
4. Verify cron jobs are running
5. Monitor execution logs

For questions or issues, refer to:
- Vercel Cron Documentation: https://vercel.com/docs/cron-jobs
- Project README: `README.md`
- Auction Services README: `src/features/auctions/services/README.md`
