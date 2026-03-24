# Manual Test: Missing Documents Cron Job

## Overview
Test the automated missing documents checker cron job that runs every 5 minutes to detect and regenerate missing documents for closed auctions.

## Prerequisites
- Development server running (`npm run dev`)
- At least one closed auction in the database
- CRON_SECRET configured in `.env`

## Test Cases

### Test 1: Local Script Execution
**Purpose:** Verify the cron job logic works correctly

**Steps:**
1. Run the test script:
   ```bash
   npx tsx scripts/test-missing-documents-cron.ts
   ```

**Expected Results:**
- ✅ Script executes without errors
- ✅ Shows count of closed auctions checked
- ✅ Shows count of documents regenerated (if any missing)
- ✅ Shows count of documents failed (should be 0)
- ✅ Displays detailed results for each auction with missing documents

**Sample Output:**
```
🔍 Starting missing documents check...
📋 Found 5 closed auction(s) to check
⚠️  Auction abc123 missing documents: bill_of_sale, liability_waiver
   🔄 Regenerating bill_of_sale...
   ✅ bill_of_sale regenerated successfully
   🔄 Regenerating liability_waiver...
   ✅ liability_waiver regenerated successfully

📊 Missing Documents Check Summary
------------------------------------------------------------
Total auctions checked: 5
Auctions with missing documents: 1
Documents regenerated: 2
Documents failed: 0
Duration: 1234ms

✅ All missing documents regenerated successfully!
```

---

### Test 2: API Endpoint Health Check
**Purpose:** Verify the API endpoint is accessible

**Steps:**
1. Make a GET request to the endpoint:
   ```bash
   curl http://localhost:3000/api/cron/check-missing-documents
   ```

**Expected Results:**
- ✅ Returns 200 status code
- ✅ Returns JSON with endpoint information:
  ```json
  {
    "status": "ok",
    "endpoint": "check-missing-documents",
    "description": "Cron job to check for and regenerate missing auction documents",
    "schedule": "Every 5 minutes (* /5 * * * *)",
    "documents": ["bill_of_sale", "liability_waiver"],
    "lastRun": "Not tracked yet"
  }
  ```

---

### Test 3: API Endpoint Execution (Unauthorized)
**Purpose:** Verify security - endpoint rejects requests without proper authentication

**Steps:**
1. Make a POST request without authorization:
   ```bash
   curl -X POST http://localhost:3000/api/cron/check-missing-documents
   ```

**Expected Results:**
- ✅ Returns 401 status code
- ✅ Returns error message:
  ```json
  {
    "error": "Unauthorized"
  }
  ```

---

### Test 4: API Endpoint Execution (Authorized)
**Purpose:** Verify the cron job executes successfully via API

**Steps:**
1. Get your CRON_SECRET from `.env` file
2. Make a POST request with authorization:
   ```bash
   curl -X POST http://localhost:3000/api/cron/check-missing-documents \
     -H "Authorization: Bearer YOUR_CRON_SECRET_HERE"
   ```

**Expected Results:**
- ✅ Returns 200 status code
- ✅ Returns success response with summary:
  ```json
  {
    "success": true,
    "message": "Missing documents check completed",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "summary": {
      "auctionsChecked": 5,
      "documentsRegenerated": 2,
      "documentsFailed": 0,
      "auctionsWithMissingDocs": 1
    },
    "details": [
      {
        "auctionId": "abc123",
        "winnerId": "vendor456",
        "missingDocuments": ["bill_of_sale", "liability_waiver"],
        "regenerated": ["bill_of_sale", "liability_waiver"],
        "failed": []
      }
    ]
  }
  ```

---

### Test 5: Error Handling
**Purpose:** Verify the cron job handles errors gracefully

**Steps:**
1. Temporarily break the database connection or document generation
2. Run the test script:
   ```bash
   npx tsx scripts/test-missing-documents-cron.ts
   ```

**Expected Results:**
- ✅ Script doesn't crash
- ✅ Logs error messages for failed operations
- ✅ Continues processing other auctions
- ✅ Returns summary with failed count

---

### Test 6: No Missing Documents
**Purpose:** Verify the cron job handles the case when all documents are present

**Steps:**
1. Ensure all closed auctions have complete documents
2. Run the test script:
   ```bash
   npx tsx scripts/test-missing-documents-cron.ts
   ```

**Expected Results:**
- ✅ Script executes successfully
- ✅ Shows "No missing documents found"
- ✅ Summary shows 0 documents regenerated
- ✅ Details array is empty

---

### Test 7: Vercel Cron Configuration
**Purpose:** Verify the cron job can be configured in Vercel

**Steps:**
1. Check if `vercel.json` exists and has cron configuration
2. If not, add the following to `vercel.json`:
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/check-missing-documents",
         "schedule": "*/5 * * * *"
       }
     ]
   }
   ```
3. Deploy to Vercel
4. Check Vercel dashboard for cron job logs

**Expected Results:**
- ✅ Cron job appears in Vercel dashboard
- ✅ Executes every 5 minutes
- ✅ Logs show successful execution
- ✅ Missing documents are automatically regenerated

---

## Verification Checklist

After running all tests, verify:

- [ ] Cron job service executes without errors
- [ ] API endpoint is secured with CRON_SECRET
- [ ] Missing documents are detected correctly
- [ ] Documents are regenerated successfully
- [ ] Errors are logged but don't crash the service
- [ ] No missing documents case is handled correctly
- [ ] Unauthorized requests are rejected
- [ ] Authorized requests return detailed results
- [ ] All actions are logged for audit trail

## Notes

### Cron Schedule
- **Development:** Run manually via script or API
- **Production:** Configure in Vercel to run every 5 minutes
- **Schedule:** `*/5 * * * *` (every 5 minutes)

### Security
- CRON_SECRET must be set in environment variables
- API endpoint requires Bearer token authentication
- Unauthorized requests return 401 status

### Monitoring
- Check server logs for execution details
- Monitor document regeneration success rate
- Alert on high failure rates

### Troubleshooting

**Issue:** Documents not regenerating
- Check if auction status is 'closed'
- Verify auction has a currentBidder
- Check document.service.ts for errors
- Verify Cloudinary credentials

**Issue:** Cron job not running in Vercel
- Verify vercel.json configuration
- Check Vercel dashboard for cron logs
- Ensure CRON_SECRET is set in Vercel environment variables

**Issue:** Unauthorized errors
- Verify CRON_SECRET matches in both .env and request
- Check Authorization header format: `Bearer YOUR_SECRET`
