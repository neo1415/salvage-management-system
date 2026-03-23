# Push Notification Setup Guide

## Overview

This guide explains how to set up PWA push notifications for the Salvage Management System using the Web Push API with VAPID authentication.

## What are VAPID Keys?

VAPID (Voluntary Application Server Identification) keys are cryptographic keys that:
- Identify your application server to push services
- Prove that push notifications come from your authorized server
- Are required by modern browsers (Chrome, Firefox, Edge, Safari)
- Work like API keys but use public-key cryptography

## Step 1: Install web-push Library

```bash
npm install web-push
```

## Step 2: Generate VAPID Keys

Run this command to generate a new key pair:

```bash
npx web-push generate-vapid-keys
```

**Output example:**
```
=======================================

Public Key:
BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBr1vKEgF0RTO4M-eR1E

Private Key:
UUxI4O8-FXScn5895yjJgoZKsEGdgfzQfI3RYP7oZVU

=======================================
```

**⚠️ IMPORTANT:**
- Generate keys ONCE and save them securely
- Never regenerate keys in production (users will lose subscriptions)
- Keep the private key secret (never commit to git)
- The public key can be shared (it's sent to browsers)

## Step 3: Add Keys to Environment Variables

Add to your `.env` file:

```env
# Push Notifications (Web Push API)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBr1vKEgF0RTO4M-eR1E
VAPID_PRIVATE_KEY=UUxI4O8-FXScn5895yjJgoZKsEGdgfzQfI3RYP7oZVU
VAPID_SUBJECT=mailto:nemsupport@nem-insurance.com
```

**Environment Variables Explained:**
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: Public key (sent to browsers, safe to expose)
- `VAPID_PRIVATE_KEY`: Private key (server-side only, keep secret)
- `VAPID_SUBJECT`: Contact email or website URL (required by spec)

## Step 4: Update Production Environment

### Vercel Deployment

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add the three VAPID variables
4. Redeploy your application

### Other Platforms

Add the environment variables to your hosting platform's configuration:
- Heroku: `heroku config:set VAPID_PRIVATE_KEY=...`
- AWS: Add to Parameter Store or Secrets Manager
- Docker: Add to docker-compose.yml or Kubernetes secrets

## Step 5: Test Push Notifications

### Development Testing

1. Start your development server:
```bash
npm run dev
```

2. Open your app in a browser (must be HTTPS or localhost)

3. Log in and grant notification permission when prompted

4. Test notifications using the browser console:
```javascript
// Check if service worker is registered
navigator.serviceWorker.ready.then(registration => {
  console.log('Service Worker ready:', registration);
});

// Check current subscription
navigator.serviceWorker.ready.then(registration => {
  registration.pushManager.getSubscription().then(subscription => {
    console.log('Current subscription:', subscription);
  });
});
```

### Production Testing

1. Deploy to production with VAPID keys configured

2. Test on real devices:
   - iPhone (Safari 16.4+)
   - Android (Chrome, Firefox)
   - Desktop (Chrome, Firefox, Edge)

3. Verify notifications appear:
   - When outbid in auction
   - When auction ending soon
   - When payment confirmed
   - When leaderboard position changes

## Browser Support

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 50+ | ✅ Full |
| Firefox | 44+ | ✅ Full |
| Edge | 17+ | ✅ Full |
| Safari | 16.4+ | ✅ Full (iOS 16.4+) |
| Opera | 37+ | ✅ Full |

## Security Best Practices

### 1. Key Management
- Store private key in environment variables (never in code)
- Use different keys for development and production
- Rotate keys annually (requires re-subscribing users)

### 2. HTTPS Requirement
- Push notifications ONLY work on HTTPS
- Exception: localhost for development
- Use Let's Encrypt for free SSL certificates

### 3. Permission Handling
- Request permission at appropriate time (not on page load)
- Explain why notifications are useful before requesting
- Respect user's choice if they deny permission

### 4. Rate Limiting
- Don't spam users with notifications
- Implement server-side rate limiting
- Allow users to configure notification preferences

## Troubleshooting

### "Push service not configured" Warning

**Cause:** VAPID keys not set in environment variables

**Solution:**
1. Generate keys: `npx web-push generate-vapid-keys`
2. Add to `.env` file
3. Restart development server

### Notifications Not Appearing

**Check:**
1. Browser supports push notifications
2. User granted notification permission
3. Service worker is registered
4. HTTPS is enabled (or using localhost)
5. VAPID keys are correctly configured

**Debug:**
```javascript
// Check permission status
console.log('Notification permission:', Notification.permission);

// Check service worker
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('Service worker:', reg);
});
```

### "Failed to subscribe" Error

**Possible causes:**
1. Invalid VAPID public key format
2. Service worker not registered
3. Browser doesn't support push
4. User denied permission

**Solution:**
- Verify VAPID key is base64url encoded
- Check browser console for detailed errors
- Ensure service worker is active

## Cost Considerations

### Free Tier
- Web Push API is FREE (no per-notification cost)
- No limits on number of notifications
- No third-party service fees

### Infrastructure Costs
- Server costs for sending notifications (minimal)
- Database storage for subscriptions (minimal)
- No per-message charges like SMS/Email

### Comparison
- SMS: ₦4-8 per message
- Email: ₦0.50-2 per message
- Push: ₦0 per message ✅

## Monitoring

### Track Metrics
- Subscription rate (% of users who enable push)
- Delivery rate (% of notifications delivered)
- Click-through rate (% of notifications clicked)
- Unsubscribe rate (% of users who disable push)

### Logging
All push notifications are logged in the audit trail:
- User ID
- Notification type
- Delivery status
- Timestamp
- Fallback channel used (if any)

## Next Steps

1. ✅ Generate VAPID keys
2. ✅ Add to environment variables
3. ✅ Install web-push library
4. ⏳ Test on development
5. ⏳ Deploy to production
6. ⏳ Test on real devices
7. ⏳ Monitor delivery rates

## Support

For issues or questions:
- Email: nemsupport@nem-insurance.com
- Phone: 234-02-014489560
- Documentation: https://web.dev/push-notifications/

## References

- [Web Push Protocol](https://datatracker.ietf.org/doc/html/rfc8030)
- [VAPID Specification](https://datatracker.ietf.org/doc/html/rfc8292)
- [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [web-push Library](https://github.com/web-push-libs/web-push)
