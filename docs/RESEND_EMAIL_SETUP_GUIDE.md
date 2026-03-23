# Resend Email Setup Guide

## Current Status

✅ **API Key Working**: `re_gococCBw_LHCLa3xSQwRuH4zBPRm33jih`
✅ **Can Send To**: `adedaniel502@gmail.com` (your verified email)
❌ **Cannot Send To**: Other email addresses (domain not verified)
❌ **Cannot Send From**: Gmail addresses (not allowed)

## The Problem

Resend free tier has restrictions:
1. Can only send TO your verified email address
2. Cannot use Gmail/Yahoo/etc as sender
3. Must verify a custom domain to send to anyone

## Solutions

### Option 1: Verify a Custom Domain (Recommended for Production)

**Best for**: Production use, professional emails

**Steps:**

1. **Get a domain** (if you don't have one):
   - Namecheap: ~$10/year
   - GoDaddy: ~$12/year
   - Cloudflare: ~$10/year

2. **Add domain to Resend**:
   - Go to https://resend.com/domains
   - Click "Add Domain"
   - Enter your domain (e.g., `nemsalvage.com`)

3. **Add DNS records**:
   Resend will give you DNS records to add:
   ```
   Type: TXT
   Name: _resend
   Value: [provided by Resend]
   
   Type: MX
   Name: @
   Value: [provided by Resend]
   ```

4. **Wait for verification** (5-30 minutes)

5. **Update .env**:
   ```env
   EMAIL_FROM=noreply@nemsalvage.com
   ```

6. **Done!** Now you can send to ANY email address

**Cost**: $10-15/year for domain

---

### Option 2: Use Resend's Test Domain (Current Setup)

**Best for**: Development/testing only

**Current Setup:**
```env
EMAIL_FROM=onboarding@resend.dev
```

**Limitations:**
- Can only send to `adedaniel502@gmail.com`
- Cannot send to other users
- Not suitable for production

**For Testing:**
Just use console logs and skip email sending. The welcome email is optional.

---

### Option 3: Disable Welcome Emails (Quick Fix)

**Best for**: MVP testing without email

**Update** `src/app/api/auth/register/route.ts`:

```typescript
// Comment out welcome email
// emailService.sendWelcomeEmail(validatedInput.email, validatedInput.fullName).catch((error) => {
//   console.error('Failed to send welcome email:', error);
// });
```

**Pros:**
- No email setup needed
- Focus on core features (OTP is more important)
- Can add later

**Cons:**
- No welcome email for users
- Less professional

---

### Option 4: Use Alternative Email Service

**Best for**: If you need email NOW without domain

**Alternatives:**

#### SendGrid (Free Tier: 100 emails/day)
```bash
npm install @sendgrid/mail
```
- Easier verification
- More generous free tier
- Better for testing

#### Mailgun (Free Tier: 5,000 emails/month)
```bash
npm install mailgun.js
```
- Very generous free tier
- Good for development

#### AWS SES (Free Tier: 62,000 emails/month)
```bash
npm install @aws-sdk/client-ses
```
- Most generous free tier
- Requires AWS account

---

## Recommended Approach

### For NOW (Development):

1. **Disable welcome emails** (Option 3)
2. **Focus on OTP** (SMS is more critical)
3. **Test with console logs**

### For Production:

1. **Buy a domain** (~$10/year)
2. **Verify with Resend** (Option 1)
3. **Professional emails**: `noreply@nemsalvage.com`

---

## Quick Fix Script

I'll update the code to make welcome emails optional:

```typescript
// src/app/api/auth/register/route.ts

// Send welcome email (optional, async)
if (process.env.EMAIL_FROM && !process.env.EMAIL_FROM.includes('resend.dev')) {
  emailService.sendWelcomeEmail(validatedInput.email, validatedInput.fullName).catch((error) => {
    console.error('Failed to send welcome email:', error);
  });
} else {
  console.log('📧 Welcome email skipped (domain not verified)');
}
```

---

## Testing Checklist

- [x] Resend API key working
- [x] Can send to verified email
- [ ] Domain verified (for production)
- [ ] Can send to any email (after domain verification)

---

## Cost Comparison

| Service | Free Tier | Cost After |
|---------|-----------|------------|
| **Resend** | 3,000/month | $20/month (50k) |
| **SendGrid** | 100/day | $15/month (40k) |
| **Mailgun** | 5,000/month | $35/month (50k) |
| **AWS SES** | 62,000/month | $0.10 per 1,000 |

**Recommendation**: Resend + custom domain ($10/year domain + free tier)

---

## Next Steps

1. **For NOW**: Disable welcome emails, focus on OTP
2. **This Week**: Buy domain if you want professional emails
3. **Before Launch**: Verify domain with Resend

---

## Support

- Resend Docs: https://resend.com/docs
- Domain Setup: https://resend.com/docs/dashboard/domains/introduction
- DNS Help: https://resend.com/docs/dashboard/domains/dns-records
