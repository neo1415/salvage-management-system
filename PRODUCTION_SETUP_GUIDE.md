# Production Setup Guide

This guide explains how to make the authentication system production-ready with real SMS and email delivery.

## Current Status (Development Mode)

✅ **Working:**
- User registration
- OTP generation and storage
- OTP verification
- Database operations
- Redis caching

⚠️ **Development Mode:**
- SMS: OTP logged to console instead of sent via SMS
- Email: Only sends to verified email addresses

## For Testing NOW

**Use the OTP from console logs:**

1. Register a new user
2. Check your terminal/console for:
   ```
   [DEV] OTP for +234XXXXXXXXXX: 123456
   ```
3. Copy the 6-digit OTP
4. Enter it on the verification page
5. ✅ You're verified!

---

## Production Setup

### 1. SMS Setup (Termii)

**You already have a Termii API key configured!**

To enable real SMS sending:

#### Option A: Use Termii REST API (Recommended)

Replace the Termii SDK with direct API calls since the SDK has initialization issues.

**Update `src/features/auth/services/otp.service.ts`:**

```typescript
// Remove: import * as TermiiModule from 'termii-node';

// In constructor, replace Termii initialization with:
constructor() {
  const apiKey = process.env.TERMII_API_KEY;
  
  if (!apiKey) {
    console.warn('TERMII_API_KEY not configured. OTP service will work in dev mode only.');
    this.termii = null;
  } else {
    // Store API key for direct API calls
    this.termii = { apiKey };
    console.log('Termii configured for production SMS sending');
  }
}

// Update sendMessage call to use fetch:
if (this.termii) {
  const response = await fetch('https://api.ng.termii.com/api/sms/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: phone,
      from: senderId,
      sms: message,
      type: 'plain',
      channel: 'generic',
      api_key: this.termii.apiKey,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to send SMS via Termii');
  }
}
```

#### Option B: Keep Dev Mode

If you want to keep testing with console logs, just leave it as is. The OTP will be logged to the console.

---

### 2. Email Setup (Resend)

**Current Issue:** Resend free tier only sends to verified email addresses.

#### Option A: Verify Your Domain (Recommended for Production)

1. Go to [resend.com/domains](https://resend.com/domains)
2. Add your domain (e.g., `nemsalvage.com`)
3. Add DNS records as instructed
4. Update `.env`:
   ```
   EMAIL_FROM=noreply@nemsalvage.com
   ```

#### Option B: Use Your Verified Email for Testing

Update `.env` to send from your verified email:
```
EMAIL_FROM=adedaniel502@gmail.com
```

Then you can send to any recipient.

#### Option C: Disable Welcome Emails (Quick Fix)

Comment out the email sending in `src/app/api/auth/register/route.ts`:

```typescript
// Send welcome email (async, don't wait for it)
// emailService.sendWelcomeEmail(validatedInput.email, validatedInput.fullName).catch((error) => {
//   console.error('Failed to send welcome email:', error);
// });
```

---

## Environment Variables Checklist

### Required for Production:

```env
# Database
DATABASE_URL=postgresql://...

# NextAuth
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-secret-key

# Redis (Vercel KV)
KV_REST_API_URL=...
KV_REST_API_TOKEN=...

# SMS (Termii)
TERMII_API_KEY=TLVAlHZOyIHrIgYxSDvpkNEWMdrlDIRaissglqmEpwCqBrfVuWObKLECzBqYFX
TERMII_SENDER_ID=NEMSAL

# Email (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com  # Must be verified domain

# OAuth (Optional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

---

## Testing Checklist

### Development Testing (Current):
- [x] Registration creates user in database
- [x] OTP is generated and stored in Redis
- [x] OTP is logged to console
- [x] OTP verification works
- [x] User status updates after verification

### Production Testing (After Setup):
- [ ] SMS is sent to real phone number
- [ ] Email is sent to user's email
- [ ] OTP arrives within 30 seconds
- [ ] Rate limiting works (max 3 OTPs per 30 min)
- [ ] OTP expires after 5 minutes
- [ ] Max 3 verification attempts

---

## Quick Production Deployment

### 1. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### 2. Set Environment Variables

In Vercel Dashboard:
1. Go to Project Settings → Environment Variables
2. Add all variables from `.env`
3. Redeploy

### 3. Update NEXTAUTH_URL

```env
NEXTAUTH_URL=https://your-app.vercel.app
```

### 4. Test Production

1. Register with real phone number
2. Check if SMS arrives
3. Verify OTP
4. ✅ Production ready!

---

## Cost Estimates

### Termii SMS:
- ₦2.50 - ₦4.00 per SMS
- 1000 OTPs = ₦2,500 - ₦4,000

### Resend Email:
- Free: 3,000 emails/month
- Pro: $20/month for 50,000 emails

### Vercel Hosting:
- Free: Hobby plan (good for MVP)
- Pro: $20/month (for production)

### Supabase Database:
- Free: 500MB database
- Pro: $25/month (8GB database)

### Vercel KV (Redis):
- Free: 256MB storage
- Pro: $20/month (1GB storage)

---

## Support

If you encounter issues:

1. Check console logs for detailed error messages
2. Verify all environment variables are set
3. Test with Postman/curl to isolate issues
4. Check Termii dashboard for SMS delivery status
5. Check Resend dashboard for email delivery status
