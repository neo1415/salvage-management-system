# Resend Domain Configuration Guide

## Current Situation

You have: `salvage-management-system.vercel.app`
- This is a **Vercel subdomain**, not a custom domain
- Resend **cannot verify** Vercel subdomains
- You need a **custom domain** to send emails to anyone

## Why You Need Domain Verification

**Without Domain Verification:**
- ❌ Can only send to YOUR verified email (adedaniel502@gmail.com)
- ❌ Cannot send to other users
- ❌ Not suitable for production

**With Domain Verification:**
- ✅ Send to ANY email address
- ✅ Professional sender address (noreply@yourdomain.com)
- ✅ Better deliverability
- ✅ Production-ready

---

## Option 1: Buy a Custom Domain (Recommended)

### Step 1: Purchase a Domain

**Recommended Registrars:**
- **Namecheap**: ~$10/year (.com) - https://www.namecheap.com
- **Cloudflare**: ~$10/year (.com) - https://www.cloudflare.com/products/registrar
- **GoDaddy**: ~$12/year (.com) - https://www.godaddy.com

**Suggested Domain Names:**
- `nemsalvage.com`
- `salvagemanagement.com`
- `nemsalvagesystem.com`

### Step 2: Add Domain to Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add your custom domain (e.g., `nemsalvage.com`)
3. Vercel will provide DNS records
4. Add DNS records to your domain registrar
5. Wait for verification (5-30 minutes)

### Step 3: Add Domain to Resend

1. Go to https://resend.com/domains
2. Click "Add Domain"
3. Enter your domain: `nemsalvage.com`
4. Resend will provide DNS records:

```
Type: TXT
Name: resend._domainkey
Value: [long string provided by Resend]

Type: MX
Name: @
Value: feedback-smtp.us-east-1.amazonses.com
Priority: 10
```

### Step 4: Add DNS Records to Your Domain

**In your domain registrar (Namecheap/Cloudflare/etc):**

1. Go to DNS Management
2. Add the TXT record from Resend
3. Add the MX record from Resend
4. Save changes

### Step 5: Wait for Verification

- DNS propagation: 5-30 minutes
- Resend will automatically verify
- You'll get an email when verified

### Step 6: Update Environment Variables

```env
# .env
EMAIL_FROM=noreply@nemsalvage.com
RESEND_API_KEY=re_gococCBw_LHCLa3xSQwRuH4zBPRm33jih
```

### Step 7: Test

```bash
npm run test:email
```

**Done!** Now you can send emails to ANY address.

---

## Option 2: Use Vercel Domain with Workaround (Not Recommended)

Vercel subdomains cannot be verified with Resend. You would need to:
1. Use a different email service (SendGrid, Mailgun)
2. Or stick with development mode (only send to your email)

---

## Option 3: Development Mode (For Now)

**For testing without domain:**

1. Keep using `onboarding@resend.dev`
2. Only send to `adedaniel502@gmail.com`
3. For other emails, log to console instead

**Update code to handle this:**

```typescript
// src/features/notifications/services/email.service.ts

export async function sendWelcomeEmail(to: string, userName: string) {
  // In development, only send to verified email
  if (process.env.EMAIL_FROM?.includes('resend.dev')) {
    if (to !== 'adedaniel502@gmail.com') {
      console.log(`📧 [DEV MODE] Would send welcome email to: ${to}`);
      console.log(`   Subject: Welcome to NEM Salvage Management`);
      console.log(`   Content: Welcome ${userName}!`);
      return;
    }
  }
  
  // Send actual email
  await sendEmail({
    to,
    subject: 'Welcome to NEM Salvage Management',
    html: generateWelcomeEmail(userName),
  });
}
```

---

## Recommended Approach

### For Development/Testing (NOW):
1. Use development mode (Option 3)
2. Log emails to console for non-verified addresses
3. Focus on core features (OTP, bidding, payments)

### For Production (Before Launch):
1. Buy a custom domain (~$10/year)
2. Add to Vercel
3. Verify with Resend
4. Professional email setup

---

## Cost Breakdown

**Custom Domain Setup:**
- Domain: $10-15/year
- Resend: FREE (3,000 emails/month)
- Total: ~$10-15/year

**Benefits:**
- Professional emails
- Unlimited recipients
- Better deliverability
- Production-ready

---

## DNS Records Example

Once you have a domain, you'll add these records:

```
# Resend DNS Records
Type: TXT
Name: resend._domainkey.nemsalvage.com
Value: p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC... (provided by Resend)

Type: MX
Name: nemsalvage.com
Value: feedback-smtp.us-east-1.amazonses.com
Priority: 10

# Vercel DNS Records (for website)
Type: A
Name: nemsalvage.com
Value: 76.76.21.21 (provided by Vercel)

Type: CNAME
Name: www
Value: cname.vercel-dns.com (provided by Vercel)
```

---

## Testing Emails

**Test with verified email:**
```bash
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "adedaniel502@gmail.com"}'
```

**Test with unverified email (will log to console in dev mode):**
```bash
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "adetimilehin502@gmail.com"}'
```

---

## Quick Decision Guide

**Do you need to send emails to multiple users NOW?**
- **YES** → Buy a domain today ($10)
- **NO** → Use development mode, buy domain later

**Is this for production launch?**
- **YES** → Must have custom domain
- **NO** → Development mode is fine

**Budget available?**
- **YES** → Buy domain now
- **NO** → Use development mode

---

## Support Resources

- **Resend Domain Setup**: https://resend.com/docs/dashboard/domains/introduction
- **Vercel Custom Domains**: https://vercel.com/docs/concepts/projects/domains
- **DNS Propagation Check**: https://dnschecker.org

---

## Next Steps

1. **Decide**: Custom domain now or later?
2. **If now**: Buy domain → Add to Vercel → Verify with Resend
3. **If later**: Use development mode → Implement task 49 → Buy domain before launch

Let me know which option you prefer, and I'll help you set it up!
