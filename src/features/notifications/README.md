# Email Notification Service

Production-ready email notification service using Resend API with comprehensive templates for all user communications.

## Features

- ✅ **Multiple Email Templates**: Welcome, OTP, Case Approval, Auction Start, Bid Alerts, Payment Confirmation
- ✅ **Retry Logic**: Automatic retry with exponential backoff (3 attempts)
- ✅ **Input Validation**: Email format, required fields, and data sanitization
- ✅ **XSS Protection**: HTML escaping for all user-provided content
- ✅ **Delivery Logging**: Console logging for all email operations
- ✅ **Error Handling**: Graceful error handling with detailed error messages
- ✅ **Mobile-Responsive**: All templates are mobile-optimized
- ✅ **Brand Consistency**: NEM Insurance branding (Burgundy #800020, Gold #FFD700)

## Setup

### 1. Install Dependencies

```bash
npm install resend
```

### 2. Configure Environment Variables

Add to your `.env` file:

```env
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=NEM Insurance <noreply@salvage.nem-insurance.com>
NEXT_PUBLIC_APP_URL=https://salvage.nem-insurance.com
```

### 3. Verify Domain

Before sending emails in production, verify your domain in Resend:
1. Go to https://resend.com/domains
2. Add your domain
3. Add the required DNS records (SPF, DKIM, DMARC)
4. Wait for verification (usually 24-48 hours)

## Usage

### Import the Service

```typescript
import { emailService } from '@/features/notifications/services/email.service';
```

### Send Welcome Email

```typescript
const result = await emailService.sendWelcomeEmail(
  'user@example.com',
  'John Doe'
);

if (result.success) {
  console.log('Email sent:', result.messageId);
} else {
  console.error('Email failed:', result.error);
}
```

### Send OTP Email

```typescript
const result = await emailService.sendOTPEmail(
  'user@example.com',
  'John Doe',
  '123456', // 6-digit OTP
  5 // Expiry in minutes
);
```

### Send Case Approval Email

```typescript
const result = await emailService.sendCaseApprovalEmail(
  'adjuster@example.com',
  {
    adjusterName: 'John Adjuster',
    caseId: 'CASE-001',
    claimReference: 'CLM-2024-001',
    assetType: 'Vehicle',
    status: 'approved', // or 'rejected'
    comment: 'Optional comment for rejection',
    managerName: 'Jane Manager',
    appUrl: process.env.NEXT_PUBLIC_APP_URL!,
  }
);
```

### Send Auction Start Email

```typescript
const result = await emailService.sendAuctionStartEmail(
  'vendor@example.com',
  {
    vendorName: 'Vendor Company',
    auctionId: 'AUC-001',
    assetType: 'Vehicle',
    assetName: '2020 Toyota Camry',
    reservePrice: 500000,
    startTime: 'January 15, 2024 10:00 AM',
    endTime: 'January 16, 2024 10:00 AM',
    location: 'Lagos, Nigeria',
    appUrl: process.env.NEXT_PUBLIC_APP_URL!,
  }
);
```

### Send Bid Alert Email

```typescript
// Outbid alert
const result = await emailService.sendBidAlertEmail(
  'vendor@example.com',
  {
    vendorName: 'Vendor Company',
    auctionId: 'AUC-001',
    assetName: '2020 Toyota Camry',
    alertType: 'outbid',
    yourBid: 500000,
    currentBid: 550000,
    timeRemaining: '2 hours',
    appUrl: process.env.NEXT_PUBLIC_APP_URL!,
  }
);

// Winning alert
const result = await emailService.sendBidAlertEmail(
  'vendor@example.com',
  {
    vendorName: 'Vendor Company',
    auctionId: 'AUC-001',
    assetName: '2020 Toyota Camry',
    alertType: 'winning',
    yourBid: 550000,
    appUrl: process.env.NEXT_PUBLIC_APP_URL!,
  }
);

// Won alert
const result = await emailService.sendBidAlertEmail(
  'vendor@example.com',
  {
    vendorName: 'Vendor Company',
    auctionId: 'AUC-001',
    assetName: '2020 Toyota Camry',
    alertType: 'won',
    yourBid: 550000,
    appUrl: process.env.NEXT_PUBLIC_APP_URL!,
  }
);
```

### Send Payment Confirmation Email

```typescript
const result = await emailService.sendPaymentConfirmationEmail(
  'vendor@example.com',
  {
    vendorName: 'Vendor Company',
    auctionId: 'AUC-001',
    assetName: '2020 Toyota Camry',
    paymentAmount: 550000,
    paymentMethod: 'Paystack',
    paymentReference: 'PAY-REF-001',
    pickupAuthCode: 'AUTH-123456',
    pickupLocation: 'NEM Insurance Warehouse, Lagos',
    pickupDeadline: 'January 20, 2024',
    appUrl: process.env.NEXT_PUBLIC_APP_URL!,
  }
);
```

### Send Generic Email

```typescript
const result = await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Custom Subject',
  html: '<p>Custom HTML content</p>',
  replyTo: 'support@nem-insurance.com', // Optional
});
```

## Email Templates

All templates are located in `src/features/notifications/templates/`:

1. **welcome.template.ts** - Welcome email for new users
2. **otp.template.ts** - OTP verification code
3. **case-approval.template.ts** - Case approval/rejection notification
4. **auction-start.template.ts** - New auction notification
5. **bid-alert.template.ts** - Bid status alerts (outbid, winning, won)
6. **payment-confirmation.template.ts** - Payment confirmation with pickup authorization

### Template Features

- Mobile-responsive design
- NEM Insurance branding
- Clear call-to-action buttons
- Security tips and important notices
- Contact information in footer
- HTML escaping for XSS protection

## Testing

### Run Unit Tests

```bash
npm run test:unit -- tests/unit/notifications/email.service.test.ts --run
```

### Test Email Templates

```bash
npx tsx scripts/test-email-templates.ts
```

This script tests all email templates with sample data. If `RESEND_API_KEY` is configured, it will send actual emails. Otherwise, it validates the templates without sending.

## Error Handling

The service handles errors gracefully:

- **Missing API Key**: Returns error without throwing exception
- **Invalid Email Format**: Validates and returns error
- **Network Errors**: Retries up to 3 times with exponential backoff
- **API Errors**: Logs error and returns detailed error message

## Logging

All email operations are logged to console:

```
✅ Welcome email sent successfully to user@example.com (Message ID: abc123)
❌ Failed to send OTP email to user@example.com: Invalid email format
```

## Rate Limits

Resend rate limits (as of 2024):
- **Free Plan**: 100 emails/day, 3,000 emails/month
- **Pro Plan**: 50,000 emails/month
- **Enterprise**: Custom limits

Monitor your usage at https://resend.com/overview

## Best Practices

1. **Always validate input** before calling email methods
2. **Use environment variables** for configuration
3. **Handle errors gracefully** - don't let email failures break your app
4. **Log all email operations** for debugging and monitoring
5. **Test templates** before deploying to production
6. **Monitor delivery rates** in Resend dashboard
7. **Keep templates mobile-responsive** - 70%+ users are on mobile

## Security

- All user-provided content is HTML-escaped to prevent XSS
- Email addresses are validated before sending
- Sensitive data (like OTP codes) are only sent via email, never logged
- HTTPS-only links in all templates
- SPF, DKIM, and DMARC configured for domain authentication

## Support

For issues or questions:
- Email: nemsupport@nem-insurance.com
- Phone: 234-02-014489560
- Address: 199 Ikorodu Road, Obanikoro, Lagos, Nigeria

## License

Proprietary - NEM Insurance Plc
