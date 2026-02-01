# SMS and Email Configuration Guide

## Overview

This guide explains how to configure SMS (Termii) and Email (Resend) services for the NEM Salvage Management System with smart testing modes to avoid wasting money during development.

---

## SMS Configuration (Termii)

### Current Setup

✅ **Smart Testing Mode Enabled**
- Only sends SMS to verified phone numbers
- Blocks SMS to unverified numbers (logs to console instead)
- Saves money during development

### Verified Phone Numbers

The following numbers are verified for testing:
- `08141252812` / `+2348141252812`
- `07067275658` / `+2347067275658`

### Environment Variables

```env
# .env
TERMII_API_KEY=your_termii_api_key_here
TERMII_SENDER_ID=NEM Salvage
```

### How It Works

1. **Verified Numbers**: SMS is sent normally
   ```
   ✅ SMS sent successfully to 2348141252812 (Message ID: xxx)
   ```

2. **Unverified Numbers**: SMS is blocked and logged
   ```
   📱 [TEST MODE] SMS blocked to 2348123456789 (not verified)
      Message: Your OTP is 123456
      To send to this number, add it to VERIFIED_TEST_NUMBERS
   ```

3. **No API Key**: SMS is logged only
   ```
   📱 [NO API KEY] SMS to 2348141252812: Your OTP is 123456
   ```

### Adding More Test Numbers

Edit `src/features/notifications/services/sms.service.ts`:

```typescript
const VERIFIED_TEST_NUMBERS = [
  '2348141252812',
  '2347067275658',
  '2348012345678', // Add your new number here
];
```

### SMS Templates

The service includes these templates:

1. **OTP**: `sendOTP(phone, otp, userId?)`
2. **Auction Ending**: `sendAuctionEndingSoon(phone, title, time, userId?)`
3. **Outbid Alert**: `sendOutbidAlert(phone, title, amount, userId?)`
4. **Payment Reminder**: `sendPaymentReminder(phone, title, amount, deadline, userId?)`
5. **Pickup Authorization**: `sendPickupAuthorization(phone, code, title, userId?)`
6. **Tier 1 Approval**: `sendTier1ApprovalSMS(phone, fullName)`

### Testing SMS

```bash
# Test with your verified number
curl -X POST http://localhost:3000/api/test-sms \
  -H "Content-Type: application/json" \
  -d '{"phone": "08141252812", "message": "Test SMS"}'

# Test with unverified number (will be blocked)
curl -X POST http://localhost:3000/api/test-sms \
  -H "Content-Type: application/json" \
  -d '{"phone": "08012345678", "message": "Test SMS"}'
```

### Cost Optimization Features

1. **Reduced Retries**: Only 2 attempts (instead of 3) to save money
2. **Smart Retry Logic**: Doesn't retry on authentication/validation errors
3. **Verified Numbers Only**: Blocks SMS to unverified numbers in test mode
4. **Audit Logging**: Tracks all SMS attempts for cost monitoring

### Production Mode

To enable SMS for all numbers (production):

**Option 1**: Remove the verification check
```typescript
// Comment out this block in sendSMS()
if (!this.isVerifiedNumber(normalizedPhone)) {
  // ... blocked
}
```

**Option 2**: Set environment variable
```env
SMS_TEST_MODE=false
```

---

## Email Configuration (Resend)

### Current Setup

✅ **Smart Development Mode Enabled**
- Only sends emails to verified addresses when using `resend.dev` domain
- Blocks emails to unverified addresses (logs to console instead)
- Doesn't block registration or other functionality

### Verified Email Addresses

The following emails are verified for testing:
- `adedaniel502@gmail.com`
- `adetimilehin502@gmail.com`

### Environment Variables

```env
# .env
RESEND_API_KEY=re_gococCBw_LHCLa3xSQwRuH4zBPRm33jih
EMAIL_FROM=onboarding@resend.dev
```

### How It Works

1. **Verified Emails (Dev Mode)**: Email is sent normally
   ```
   ✅ Welcome email sent successfully to adedaniel502@gmail.com
   ```

2. **Unverified Emails (Dev Mode)**: Email is blocked and logged
   ```
   📧 [DEV MODE] Welcome email skipped for user@example.com (domain not verified)
      To send to this email, verify a custom domain in Resend
      See: RESEND_DOMAIN_SETUP_GUIDE.md
   ```

3. **Custom Domain**: All emails are sent (production mode)
   ```
   ✅ Welcome email sent successfully to anyone@anywhere.com
   ```

### Domain Verification (For Production)

To send emails to ANY address, you need to verify a custom domain:

1. **Buy a domain** (~$10/year)
   - Namecheap, Cloudflare, or GoDaddy
   - Suggested: `nemsalvage.com`

2. **Add domain to Resend**
   - Go to https://resend.com/domains
   - Add your domain
   - Get DNS records

3. **Add DNS records**
   - Add TXT and MX records to your domain
   - Wait 5-30 minutes for verification

4. **Update .env**
   ```env
   EMAIL_FROM=noreply@nemsalvage.com
   ```

See `RESEND_DOMAIN_SETUP_GUIDE.md` for detailed instructions.

### Email Templates

The service includes:

1. **Welcome Email**: `sendWelcomeEmail(email, fullName)`
   - Professional HTML template
   - NEM Insurance branding
   - Next steps for users

### Testing Email

```bash
# Test with verified email
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "adedaniel502@gmail.com"}'

# Test with unverified email (will be blocked in dev mode)
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "user@example.com"}'
```

---

## Quick Start Guide

### For Development (NOW)

1. **SMS**: Already configured with your numbers
   ```bash
   # Test SMS
   npm run test:sms
   ```

2. **Email**: Already configured with your emails
   ```bash
   # Test email
   npm run test:email
   ```

3. **Registration**: Works normally
   - SMS OTP sent to verified numbers only
   - Welcome email sent to verified emails only
   - Other users see console logs

### For Production (Before Launch)

1. **SMS**: Remove verification check or add all user numbers
2. **Email**: Verify custom domain with Resend
3. **Test**: Verify both services work for all users

---

## Testing Checklist

- [x] SMS service configured with Termii API key
- [x] SMS sends to verified numbers (08141252812, 07067275658)
- [x] SMS blocks unverified numbers (logs to console)
- [x] Email service configured with Resend API key
- [x] Email sends to verified addresses (adedaniel502@gmail.com, adetimilehin502@gmail.com)
- [x] Email blocks unverified addresses in dev mode (logs to console)
- [ ] Custom domain verified with Resend (for production)
- [ ] SMS verification check removed (for production)

---

## Cost Monitoring

### SMS Costs (Termii)

- **Rate**: ~₦2-4 per SMS
- **Current Setup**: Only sends to 2 verified numbers
- **Estimated Dev Cost**: ₦100-500/month (testing only)
- **Production Cost**: Depends on user volume

### Email Costs (Resend)

- **Free Tier**: 3,000 emails/month
- **Current Setup**: Only sends to 2 verified emails in dev mode
- **Estimated Dev Cost**: FREE
- **Production Cost**: FREE (under 3,000/month)

---

## Troubleshooting

### SMS Not Sending

1. **Check API Key**
   ```bash
   echo $TERMII_API_KEY
   ```

2. **Check Phone Format**
   - Must be Nigerian number
   - Formats accepted: `08141252812`, `+2348141252812`, `2348141252812`

3. **Check Verified Numbers**
   - Is the number in `VERIFIED_TEST_NUMBERS`?
   - Check console logs for blocked messages

4. **Check Termii Balance**
   - Login to Termii dashboard
   - Check account balance

### Email Not Sending

1. **Check API Key**
   ```bash
   echo $RESEND_API_KEY
   ```

2. **Check Email Format**
   - Must be valid email address
   - Check for typos

3. **Check Verified Emails**
   - Is the email in verified list?
   - Check console logs for blocked messages

4. **Check Domain**
   - Using `resend.dev`? Only verified emails work
   - Using custom domain? All emails work

---

## Support

- **Termii Docs**: https://developers.termii.com
- **Resend Docs**: https://resend.com/docs
- **Domain Setup**: See `RESEND_DOMAIN_SETUP_GUIDE.md`

---

## Summary

✅ **SMS**: Smart testing mode enabled - only sends to your 2 verified numbers
✅ **Email**: Smart development mode enabled - only sends to your 2 verified emails
✅ **Cost Optimized**: Won't waste money on test messages
✅ **Production Ready**: Easy to enable for all users when ready

**Next Steps**:
1. Test SMS with your numbers: `08141252812`, `07067275658`
2. Test email with your emails: `adedaniel502@gmail.com`, `adetimilehin502@gmail.com`
3. Before production: Verify custom domain for emails
4. Before production: Remove SMS verification check
