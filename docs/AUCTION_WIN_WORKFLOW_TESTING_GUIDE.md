# Auction Win Workflow - Testing Guide

## Quick Test Scenario

### 1. Test Automatic Workflow

**Trigger:** Wait for auction to close OR manually run cron job

```bash
# Manually trigger auction closure (if you have a test endpoint)
curl -X POST http://localhost:3000/api/cron/close-auctions
```

**Expected Results:**
- ✅ Payment record created in database
- ✅ 3 documents generated (bill_of_sale, liability_waiver, pickup_authorization)
- ✅ SMS sent to winner's phone
- ✅ Email sent to winner's email
- ✅ In-app notification created with payment link
- ✅ Console logs show: "✅ Document generated: bill_of_sale for auction..."

**Verify in Database:**
```sql
-- Check payment was created
SELECT * FROM payments WHERE auction_id = 'YOUR_AUCTION_ID';

-- Check documents were generated
SELECT * FROM release_forms WHERE auction_id = 'YOUR_AUCTION_ID';

-- Check notification was created
SELECT * FROM notifications WHERE user_id = 'WINNER_USER_ID' AND type = 'auction_won';
```

### 2. Test Vendor Experience

**Steps:**
1. Login as winning vendor
2. Check notifications bell → should see "You won the auction"
3. Click notification → should redirect to payment page
4. Payment page should show:
   - Item photos and details
   - Countdown timer (24 hours)
   - "Pay Now with Paystack" button
   - Bank transfer option

**Expected URL:** `/vendor/payments/[payment-id]`

### 3. Test Finance Dashboard

**Steps:**
1. Login as finance officer
2. Navigate to finance dashboard
3. Should see pending payment in list

**Expected Data:**
- Pending verification count increased
- Payment shows in pending list
- Total amount updated

### 4. Test Admin Manual Retry

**Steps:**
1. Login as admin
2. Navigate to `/admin/auctions`
3. Find closed auction in list
4. Check document status indicators
5. Click "📄 Generate Documents" if missing
6. Click "📧 Send Notification" if not sent

**Expected Results:**
- Documents generated successfully
- Notification sent successfully
- Status indicators update to green checkmarks


## Environment Variables to Check

Ensure these are configured in `.env`:

```bash
# SMS Service (Termii)
TERMII_API_KEY=your_termii_api_key
TERMII_SENDER_ID=NEM_INS

# Email Service (Resend)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=notifications@nem-insurance.com

# App URL (for payment links)
NEXT_PUBLIC_APP_URL=https://salvage.nem-insurance.com

# Cloudinary (for document storage)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Common Issues & Solutions

### Issue: Documents not generated
**Check:**
- Cloudinary credentials are correct
- Document service has access to auction data
- Console logs for error messages

**Solution:**
- Use admin manual retry: `/admin/auctions` → "Generate Documents"

### Issue: Notifications not sent
**Check:**
- TERMII_API_KEY is valid
- RESEND_API_KEY is valid
- User has valid phone and email

**Solution:**
- Use admin manual retry: `/admin/auctions` → "Send Notification"

### Issue: Payment page not accessible
**Check:**
- Payment record exists in database
- Vendor is logged in
- Payment ID in URL is correct

**Solution:**
- Check payment record: `SELECT * FROM payments WHERE id = 'payment-id'`

### Issue: Finance dashboard empty
**Check:**
- Payments exist with status = 'pending'
- Finance officer role is correct
- Redis cache is working

**Solution:**
- Clear Redis cache
- Check payment status in database
