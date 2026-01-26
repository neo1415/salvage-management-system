# Email Configuration Guide

## Current Configuration

Your `.env` file is now configured to use:
```env
EMAIL_FROM=Ade Daniel <adedaniel502@gmail.com>
RESEND_API_KEY=re_gococCBw_LHCLa3xSQwRuH4zBPRm33jih
```

## Important: Resend Domain Verification

### What You Need to Know

Resend requires **domain verification** before you can send emails. There are two approaches:

### Option 1: Use Resend's Test Domain (Easiest for Development)

Resend provides a test domain `onboarding@resend.dev` that works immediately without verification:

```env
EMAIL_FROM=onboarding@resend.dev
```

**Pros:**
- ✅ Works immediately
- ✅ No domain verification needed
- ✅ Perfect for development/testing

**Cons:**
- ⚠️ Emails may go to spam
- ⚠️ Not suitable for production
- ⚠️ Limited to 100 emails/day

### Option 2: Verify Your Gmail Address (Current Setup)

To use `adedaniel502@gmail.com`, you need to:

1. **Log into Resend Dashboard**: https://resend.com/domains
2. **Add Domain**: Click "Add Domain"
3. **Enter Domain**: `gmail.com` (or use a custom domain if you have one)
4. **Verify Ownership**: Follow Resend's verification steps

**Note:** Gmail doesn't allow third-party services to send from `@gmail.com` addresses easily. You'll likely need to use a custom domain.

### Option 3: Use a Custom Domain (Recommended for Production)

For production, you should use a custom domain like `salvage.nem-insurance.com`:

1. **Purchase/Use Domain**: Get a domain from Namecheap, GoDaddy, etc.
2. **Add to Resend**: Add the domain in Resend dashboard
3. **Add DNS Records**: Add the DNS records Resend provides to your domain registrar
4. **Verify**: Wait for verification (usually 5-30 minutes)
5. **Update .env**:
   ```env
   EMAIL_FROM=NEM Insurance <noreply@salvage.nem-insurance.com>
   ```

## Quick Fix for Testing Right Now

If you want to test email functionality immediately, use Resend's test domain:

```env
EMAIL_FROM=onboarding@resend.dev
```

This will work instantly without any verification!

## Testing Email Functionality

Once configured, test the registration endpoint:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "your-test-email@gmail.com",
    "phone": "08012345678",
    "password": "SecurePass123!",
    "dateOfBirth": "1990-01-01",
    "termsAccepted": true
  }'
```

Check your email inbox (and spam folder) for the welcome email!

## Production Setup Checklist

When ready for production:

- [ ] Purchase custom domain (e.g., `salvage.nem-insurance.com`)
- [ ] Add domain to Resend dashboard
- [ ] Add DNS records (SPF, DKIM, DMARC)
- [ ] Verify domain ownership
- [ ] Update `EMAIL_FROM` in production `.env`
- [ ] Test email delivery
- [ ] Monitor email delivery rates
- [ ] Set up email analytics in Resend dashboard

## Troubleshooting

### Emails Not Sending

1. **Check Resend API Key**: Ensure `RESEND_API_KEY` is correct
2. **Check Domain Verification**: Verify domain is verified in Resend dashboard
3. **Check Logs**: Look for error messages in console
4. **Check Spam Folder**: Emails might be marked as spam
5. **Check Resend Dashboard**: View email logs and delivery status

### Emails Going to Spam

1. **Verify Domain**: Ensure domain is properly verified
2. **Add SPF Record**: Add SPF DNS record
3. **Add DKIM Record**: Add DKIM DNS record
4. **Add DMARC Record**: Add DMARC DNS record
5. **Warm Up Domain**: Start with low volume, gradually increase

## Current Email Service Features

Your email service includes:

✅ **Retry Logic**: 3 attempts with exponential backoff
✅ **Error Handling**: Graceful degradation if email fails
✅ **XSS Protection**: HTML escaping for user input
✅ **Email Validation**: Format validation before sending
✅ **Professional Templates**: Mobile-responsive HTML emails
✅ **Logging**: Comprehensive error and success logging
✅ **Configuration Check**: `isConfigured()` method to verify setup

## Email Template Customization

The welcome email template is in:
```
src/features/notifications/services/email.service.ts
```

You can customize:
- Email subject
- HTML template
- Colors and branding
- Support contact information
- Call-to-action buttons

## Support Contact Information

The email template includes:
- **Phone**: 234-02-014489560
- **Email**: nemsupport@nem-insurance.com
- **Address**: 199 Ikorodu Road, Obanikoro, Lagos

Update these in the `EmailService` class if needed.

## Next Steps

1. **For immediate testing**: Use `EMAIL_FROM=onboarding@resend.dev`
2. **For development**: Verify your domain in Resend
3. **For production**: Set up custom domain with proper DNS records

## Questions?

If you encounter any issues:
1. Check Resend dashboard for email logs
2. Check application logs for error messages
3. Verify environment variables are loaded correctly
4. Test with Resend's test domain first
