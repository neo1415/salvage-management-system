# Vercel Deployment Guide - NEM Salvage Management System

> **Comprehensive guide for deploying the Next.js salvage management system to Vercel**

## Table of Contents

1. [Pre-Deployment Checklist](#1-pre-deployment-checklist)
2. [Vercel Configuration](#2-vercel-configuration)
3. [Socket.IO Deployment (CRITICAL)](#3-socketio-deployment-critical)
4. [Database & Redis](#4-database--redis)
5. [External Services](#5-external-services)
6. [Cron Jobs & Background Tasks](#6-cron-jobs--background-tasks)
7. [Production Environment Variables](#7-production-environment-variables)
8. [Post-Deployment](#8-post-deployment)
9. [Common Issues & Troubleshooting](#9-common-issues--troubleshooting)
10. [Deployment Commands](#10-deployment-commands)

---

## 1. Pre-Deployment Checklist

### 1.1 Code Preparation

- [ ] All TypeScript errors resolved (`npm run lint`)
- [ ] Build succeeds locally (`npm run build`)
- [ ] Environment variables documented in `.env.example`
- [ ] Database migrations tested
- [ ] All tests passing (`npm run test:unit`)

### 1.2 Environment Variables Audit

Review `.env.example` and ensure all required variables are available:


```bash
# Core Services (REQUIRED)
DATABASE_URL=              # PostgreSQL connection string
NEXTAUTH_URL=              # Production URL
NEXTAUTH_SECRET=           # Strong random secret
CRON_SECRET=               # Secure random key for cron jobs

# Redis (REQUIRED for caching)
KV_REST_API_URL=           # Vercel KV URL
KV_REST_API_TOKEN=         # Vercel KV token
KV_REST_API_READ_ONLY_TOKEN=
KV_URL=
REDIS_URL=

# Payment Gateway (REQUIRED)
PAYSTACK_SECRET_KEY=       # Production key
PAYSTACK_PUBLIC_KEY=       # Production key
PAYSTACK_WEBHOOK_SECRET=   # Webhook secret
PAYSTACK_NEM_RECIPIENT_CODE= # Transfer recipient

# Cloud Storage (REQUIRED)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Email Service (REQUIRED)
RESEND_API_KEY=
EMAIL_FROM=

# AI Services (OPTIONAL but recommended)
GEMINI_API_KEY=            # For damage detection
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_APPLICATION_CREDENTIALS=
```

### 1.3 Database Setup

- [ ] PostgreSQL database provisioned (Neon/Supabase/Railway)
- [ ] Connection pooling configured
- [ ] Migrations executed
- [ ] Seed data loaded (if needed)

### 1.4 External Services Configuration

- [ ] Paystack account configured
- [ ] Cloudinary account set up
- [ ] Resend email service configured
- [ ] Google Cloud AI services enabled (optional)

---

## 2. Vercel Configuration

### 2.1 Project Setup

1. **Import Project to Vercel**
   ```bash
   # Via Vercel CLI
   npm i -g vercel
   vercel login
   vercel
   ```

   Or via Vercel Dashboard:
   - Go to https://vercel.com/new
   - Import your Git repository
   - Select the repository

2. **Framework Preset**
   - Framework: **Next.js**
   - Root Directory: `./` (default)

### 2.2 Build Settings

**IMPORTANT:** The custom server (`server.ts`) with Socket.IO **CANNOT** run on Vercel's serverless infrastructure.

#### Option A: Standard Vercel Deployment (Recommended)

Use Next.js without custom server:

```json
// vercel.json
{
  "buildCommand": "next build",
  "installCommand": "npm install",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "crons": [
    {
      "path": "/api/cron/check-overdue-payments",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**Build Configuration:**
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`
- Development Command: `npm run dev:next`


#### Option B: External Server for Socket.IO (Advanced)

Deploy Socket.IO server separately on a platform that supports WebSockets:

**Recommended Platforms:**
- Railway.app (easiest)
- Render.com
- DigitalOcean App Platform
- AWS EC2/ECS
- Google Cloud Run

**Deployment Steps:**
1. Create separate repository for Socket.IO server
2. Extract `server.ts` and Socket.IO logic
3. Deploy to Railway/Render
4. Update `NEXT_PUBLIC_SOCKET_URL` environment variable

### 2.3 Environment Variables

Add all environment variables in Vercel Dashboard:

1. Go to Project Settings → Environment Variables
2. Add variables for all environments (Production, Preview, Development)
3. Use Vercel's secret encryption for sensitive values

**Quick Add via CLI:**
```bash
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
vercel env add PAYSTACK_SECRET_KEY production
# ... add all required variables
```

### 2.4 Custom Domains

1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS records:
   ```
   Type: A
   Name: @
   Value: 76.76.21.21

   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

---

## 3. Socket.IO Deployment (CRITICAL)

### 🚨 The Problem

**Vercel's serverless functions DO NOT support WebSockets or long-running connections.**

Your custom `server.ts` with Socket.IO will NOT work on Vercel because:
- Serverless functions are stateless and short-lived (10s timeout)
- No persistent WebSocket connections
- Each request creates a new function instance
- No shared memory between instances

### ✅ Solutions

#### Solution 1: Disable Real-Time Features (Quick Fix)

If real-time bidding is not critical for MVP:

1. **Remove Socket.IO dependency**
2. **Use polling instead:**
   ```typescript
   // Replace Socket.IO with polling
   useEffect(() => {
     const interval = setInterval(async () => {
       const response = await fetch(`/api/auctions/${auctionId}`);
       const data = await response.json();
       setAuction(data);
     }, 5000); // Poll every 5 seconds

     return () => clearInterval(interval);
   }, [auctionId]);
   ```

3. **Update package.json:**
   ```json
   {
     "scripts": {
       "dev": "next dev",
       "build": "next build",
       "start": "next start"
     }
   }
   ```


#### Solution 2: External Socket.IO Server (Recommended)

Deploy Socket.IO on a separate platform that supports WebSockets.

**A. Deploy to Railway.app (Easiest)**

1. **Create `socket-server` directory:**
   ```bash
   mkdir socket-server
   cd socket-server
   npm init -y
   ```

2. **Install dependencies:**
   ```bash
   npm install socket.io express cors dotenv jsonwebtoken drizzle-orm postgres
   ```

3. **Create `index.js`:**
   ```javascript
   // Copy Socket.IO server logic from src/lib/socket/server.ts
   // Adapt to standalone Express server
   ```

4. **Deploy to Railway:**
   ```bash
   # Install Railway CLI
   npm i -g @railway/cli
   
   # Login and deploy
   railway login
   railway init
   railway up
   ```

5. **Update Vercel environment variables:**
   ```bash
   NEXT_PUBLIC_SOCKET_URL=https://your-socket-server.railway.app
   ```

**B. Deploy to Render.com**

1. Create new Web Service on Render
2. Connect your repository
3. Configure:
   - Build Command: `npm install`
   - Start Command: `node index.js`
   - Environment: Node
4. Add environment variables
5. Deploy


#### Solution 3: Pusher/Ably (Managed Service)

Use a managed real-time service instead of Socket.IO:

**Pusher Setup:**
```bash
npm install pusher pusher-js
```

```typescript
// Server-side (API route)
import Pusher from 'pusher';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
});

// Broadcast new bid
await pusher.trigger(`auction-${auctionId}`, 'new-bid', {
  bid: bidData,
});
```

```typescript
// Client-side
import Pusher from 'pusher-js';

const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
});

const channel = pusher.subscribe(`auction-${auctionId}`);
channel.bind('new-bid', (data) => {
  setBid(data.bid);
});
```

**Pricing:**
- Pusher: Free tier (100 concurrent connections, 200k messages/day)
- Ably: Free tier (3M messages/month)

### 📊 Comparison

| Solution | Complexity | Cost | Latency | Scalability |
|----------|-----------|------|---------|-------------|
| Polling | Low | Free | 5s | Good |
| External Server | Medium | $5-10/mo | <1s | Excellent |
| Pusher/Ably | Low | Free-$50/mo | <1s | Excellent |

**Recommendation:** Start with **Polling** for MVP, migrate to **Pusher** or **External Server** when real-time is critical.

---

## 4. Database & Redis

### 4.1 PostgreSQL Database

#### Option A: Neon (Recommended for Vercel)

**Why Neon:**
- Serverless PostgreSQL
- Auto-scaling
- Built-in connection pooling
- Free tier: 0.5 GB storage, 1 compute unit

**Setup:**
1. Create account at https://neon.tech
2. Create new project
3. Copy connection string
4. Add to Vercel:
   ```bash
   vercel env add DATABASE_URL production
   # Paste: postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require
   ```

**Connection Pooling (Important):**
```typescript
// Already configured in src/lib/db/drizzle.ts
const client = postgres(connectionString, {
  max: 10,                    // Max 10 connections
  idle_timeout: 30,           // Close idle after 30s
  max_lifetime: 60 * 30,      // Close after 30 min
  connect_timeout: 30,        // 30s timeout
});
```

#### Option B: Supabase

1. Create project at https://supabase.com
2. Get connection string from Settings → Database
3. Use **Transaction** pooler for Vercel:
   ```
   postgresql://postgres:[password]@db.[project].supabase.co:6543/postgres
   ```

#### Option C: Railway

1. Create PostgreSQL database at https://railway.app
2. Copy `DATABASE_URL` from Variables tab
3. Add to Vercel environment variables


### 4.2 Redis (Vercel KV)

**Vercel KV is Upstash Redis** - optimized for serverless.

**Setup:**
1. Go to Vercel Dashboard → Storage → Create Database
2. Select **KV (Redis)**
3. Choose region (same as your deployment)
4. Environment variables are auto-added:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`
   - `KV_URL`

**Pricing:**
- Free tier: 256 MB, 10k commands/day
- Pro: $0.20/100k commands

**Usage in Code:**
```typescript
// Already configured in src/lib/redis/client.ts
import { redis } from '@/lib/redis/client';

// Cache auction data
await redis.set('auction:123', JSON.stringify(auction), { ex: 300 });

// Get cached data
const cached = await redis.get('auction:123');
```

### 4.3 Database Migrations

**Run migrations after deployment:**

```bash
# Option 1: Via Vercel CLI
vercel env pull .env.production
npm run db:migrate

# Option 2: Via build script
# Add to package.json
{
  "scripts": {
    "vercel-build": "npm run db:migrate && next build"
  }
}
```

**⚠️ Warning:** Running migrations in build can cause issues with concurrent deployments. Better to run manually.

---

## 5. External Services

### 5.1 Paystack (Payment Gateway)

**Setup:**
1. Create account at https://paystack.com
2. Get API keys from Settings → API Keys & Webhooks
3. Add to Vercel:
   ```bash
   PAYSTACK_SECRET_KEY=sk_live_xxx
   PAYSTACK_PUBLIC_KEY=pk_live_xxx
   ```

**Webhook Configuration:**
1. Go to Settings → API Keys & Webhooks
2. Add webhook URL:
   ```
   https://your-domain.com/api/webhooks/paystack
   ```
3. Copy webhook secret:
   ```bash
   PAYSTACK_WEBHOOK_SECRET=whsec_xxx
   ```

**Transfer Recipient Setup:**
```bash
# Create transfer recipient for NEM Insurance
npm run create-nem-recipient

# Copy recipient code
PAYSTACK_NEM_RECIPIENT_CODE=RCP_xxx
```

### 5.2 Cloudinary (Image Storage)

**Setup:**
1. Create account at https://cloudinary.com
2. Get credentials from Dashboard
3. Add to Vercel:
   ```bash
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=123456789
   CLOUDINARY_API_SECRET=xxx
   ```

**Configuration:**
- Auto-upload: Enabled
- Folder structure: `/salvage/{caseId}/`
- Transformations: Auto-optimize, auto-format


### 5.3 Google Cloud (AI Services)

**Setup:**
1. Create project at https://console.cloud.google.com
2. Enable APIs:
   - Cloud Vision API
   - Document AI API
   - Gemini API (optional)
3. Create service account
4. Download JSON credentials

**Add to Vercel:**
```bash
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./google-cloud-credentials.json
GEMINI_API_KEY=AIzaSyXXX
```

**⚠️ Important:** For Vercel, encode credentials as base64:
```bash
# Encode credentials
cat google-cloud-credentials.json | base64 > credentials.txt

# Add to Vercel as GOOGLE_CREDENTIALS_BASE64
vercel env add GOOGLE_CREDENTIALS_BASE64 production
# Paste base64 string
```

**Decode in code:**
```typescript
// Add to API route
if (process.env.GOOGLE_CREDENTIALS_BASE64) {
  const credentials = Buffer.from(
    process.env.GOOGLE_CREDENTIALS_BASE64,
    'base64'
  ).toString('utf-8');
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentials;
}
```

**Mock Mode (Development):**
```bash
MOCK_AI_ASSESSMENT=true  # Use fake data instead of API calls
```

### 5.4 Resend (Email Service)

**Setup:**
1. Create account at https://resend.com
2. Verify domain
3. Get API key
4. Add to Vercel:
   ```bash
   RESEND_API_KEY=re_xxx
   EMAIL_FROM=NEM Insurance <noreply@your-domain.com>
   ```

**Pricing:**
- Free tier: 100 emails/day
- Pro: $20/month (50k emails)


### 5.5 SMS Service (Termii)

**Setup:**
1. Create account at https://termii.com
2. Get API key
3. Add to Vercel:
   ```bash
   TERMII_API_KEY=TLxxx
   TERMII_SENDER_ID=NEM_INS
   ```

**Fallback (Africa's Talking):**
```bash
AFRICAS_TALKING_API_KEY=xxx
AFRICAS_TALKING_USERNAME=sandbox
AFRICAS_TALKING_SENDER_ID=NEM
```

### 5.6 Web Push Notifications

**Setup:**
1. Generate VAPID keys:
   ```bash
   npx web-push generate-vapid-keys
   ```

2. Add to Vercel:
   ```bash
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=xxx
   VAPID_PRIVATE_KEY=xxx
   VAPID_SUBJECT=mailto:admin@your-domain.com
   ```

---

## 6. Cron Jobs & Background Tasks

### 6.1 Vercel Cron Configuration

**Current Setup (vercel.json):**
```json
{
  "crons": [
    {
      "path": "/api/cron/check-overdue-payments",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**Schedule Format (Cron Expression):**
```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6)
│ │ │ │ │
* * * * *
```


### 6.2 Available Cron Jobs

**1. Payment Overdue Checker**
- **Path:** `/api/cron/check-overdue-payments`
- **Schedule:** `0 0 * * *` (Daily at midnight)
- **Function:** Check for overdue payments, send escalations
- **Implementation:** `src/lib/cron/payment-overdue-checker.ts`

**2. Auction Expiry Checker**
- **Path:** `/api/auctions/check-expired`
- **Schedule:** `*/5 * * * *` (Every 5 minutes)
- **Function:** Close expired auctions, notify winners
- **Implementation:** `src/app/api/auctions/check-expired/route.ts`

**3. Pickup Reminders**
- **Path:** `/api/cron/pickup-reminders`
- **Schedule:** `0 * * * *` (Every hour)
- **Function:** Send pickup reminders 24h before deadline
- **Implementation:** `src/lib/cron/pickup-reminders.ts`

### 6.3 Complete Cron Configuration

**Update vercel.json:**
```json
{
  "crons": [
    {
      "path": "/api/cron/check-overdue-payments",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/auctions/check-expired",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/pickup-reminders",
      "schedule": "0 * * * *"
    }
  ]
}
```

### 6.4 Cron Security

**Protect cron endpoints:**

```typescript
// In cron route
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Execute cron logic
}
```

**Generate secure secret:**
```bash
# Generate random secret
openssl rand -base64 32

# Add to Vercel
vercel env add CRON_SECRET production
```


### 6.5 Vercel Cron Limitations

**Free Tier:**
- Max 1 cron job
- Runs in single region
- No guaranteed execution time

**Pro Tier ($20/month):**
- Unlimited cron jobs
- Multi-region support
- Guaranteed execution

**Alternative: External Cron Service**

If you need more cron jobs on free tier, use external service:

**Option 1: Cron-job.org**
```bash
# Setup
1. Create account at https://cron-job.org
2. Add jobs:
   - URL: https://your-domain.com/api/cron/check-overdue-payments
   - Schedule: 0 0 * * *
   - Headers: Authorization: Bearer YOUR_CRON_SECRET
```

**Option 2: EasyCron**
```bash
# Similar setup at https://www.easycron.com
```

---

## 7. Production Environment Variables

### 7.1 Complete Environment Variables List

```bash
# ============================================
# CORE CONFIGURATION
# ============================================
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>

# ============================================
# DATABASE
# ============================================
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require

# ============================================
# REDIS (Vercel KV)
# ============================================
KV_REST_API_URL=https://xxx.kv.vercel-storage.com
KV_REST_API_TOKEN=xxx
KV_REST_API_READ_ONLY_TOKEN=xxx
KV_URL=redis://xxx
REDIS_URL=redis://xxx

# ============================================
# AUTHENTICATION (OAuth)
# ============================================
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
FACEBOOK_CLIENT_ID=xxx
FACEBOOK_CLIENT_SECRET=xxx

# ============================================
# PAYMENT GATEWAY (Paystack)
# ============================================
PAYSTACK_SECRET_KEY=sk_live_xxx
PAYSTACK_PUBLIC_KEY=pk_live_xxx
PAYSTACK_WEBHOOK_SECRET=whsec_xxx
PAYSTACK_NEM_RECIPIENT_CODE=RCP_xxx

# ============================================
# CLOUD STORAGE (Cloudinary)
# ============================================
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789
CLOUDINARY_API_SECRET=xxx

# ============================================
# AI SERVICES (Google Cloud)
# ============================================
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CREDENTIALS_BASE64=<base64-encoded-json>
GEMINI_API_KEY=AIzaSyXXX
GOOGLE_CLOUD_VISION_API_KEY=xxx
GOOGLE_CLOUD_DOCUMENT_AI_API_KEY=xxx
MOCK_AI_ASSESSMENT=false

# ============================================
# MAPS & GEOLOCATION
# ============================================
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyXXX

# ============================================
# EMAIL SERVICE (Resend)
# ============================================
RESEND_API_KEY=re_xxx
EMAIL_FROM=NEM Insurance <noreply@your-domain.com>

# ============================================
# SMS SERVICE (Termii)
# ============================================
TERMII_API_KEY=TLxxx
TERMII_SECRET_KEY=xxx
TERMII_SENDER_ID=NEM_INS

# SMS Fallback (Africa's Talking)
AFRICAS_TALKING_API_KEY=xxx
AFRICAS_TALKING_USERNAME=sandbox
AFRICAS_TALKING_SENDER_ID=NEM

# ============================================
# WEB PUSH NOTIFICATIONS
# ============================================
NEXT_PUBLIC_VAPID_PUBLIC_KEY=xxx
VAPID_PRIVATE_KEY=xxx
VAPID_SUBJECT=mailto:admin@your-domain.com

# ============================================
# CRON JOB SECURITY
# ============================================
CRON_SECRET=<generate-with-openssl-rand-base64-32>

# ============================================
# OPTIONAL SERVICES
# ============================================
MONO_SECRET_KEY=xxx  # BVN verification
TINYPNG_API_KEY=xxx  # Image compression

# ============================================
# DEPLOYMENT CONFIGURATION
# ============================================
SKIP_SEEDS=true
FORCE_SEEDS=false

# ============================================
# SUPPORT CONTACT
# ============================================
SUPPORT_PHONE=234-02-014489560
SUPPORT_EMAIL=nemsupport@nem-insurance.com
```


### 7.2 Security Best Practices

**1. Generate Strong Secrets**
```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# CRON_SECRET
openssl rand -base64 32

# PAYSTACK_WEBHOOK_SECRET
# Provided by Paystack
```

**2. Use Vercel's Secret Encryption**
- All environment variables are encrypted at rest
- Use Vercel CLI for sensitive values
- Never commit secrets to Git

**3. Separate Environments**
```bash
# Development
vercel env add VAR_NAME development

# Preview (staging)
vercel env add VAR_NAME preview

# Production
vercel env add VAR_NAME production
```

**4. Rotate Secrets Regularly**
- Rotate API keys every 90 days
- Update webhook secrets after rotation
- Monitor for unauthorized access

### 7.3 Environment Variable Management

**Bulk Import:**
```bash
# Export from .env.production
vercel env pull .env.production

# Import to Vercel
vercel env add < .env.production
```

**Verify Variables:**
```bash
# List all environment variables
vercel env ls

# Pull current values
vercel env pull
```

---

## 8. Post-Deployment

### 8.1 Health Checks

**1. Database Connection**
```bash
# Create health check endpoint
# /api/health/route.ts
export async function GET() {
  const dbHealth = await checkDatabaseConnection();
  const redisHealth = await redis.ping();
  
  return Response.json({
    status: dbHealth.healthy && redisHealth ? 'healthy' : 'unhealthy',
    database: dbHealth,
    redis: redisHealth,
    timestamp: new Date().toISOString(),
  });
}
```

**2. Test Critical Endpoints**
```bash
# Health check
curl https://your-domain.com/api/health

# Authentication
curl https://your-domain.com/api/auth/session

# Cron jobs (with secret)
curl -X POST https://your-domain.com/api/cron/check-overdue-payments \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 8.2 Monitoring Setup

**Vercel Analytics (Built-in)**
1. Go to Project → Analytics
2. Enable Web Analytics
3. Monitor:
   - Page views
   - Response times
   - Error rates
   - Geographic distribution

**Vercel Speed Insights**
1. Install package:
   ```bash
   npm install @vercel/speed-insights
   ```

2. Add to layout:
   ```typescript
   import { SpeedInsights } from '@vercel/speed-insights/next';
   
   export default function RootLayout({ children }) {
     return (
       <html>
         <body>
           {children}
           <SpeedInsights />
         </body>
       </html>
     );
   }
   ```


### 8.3 Error Tracking

**Option 1: Sentry (Recommended)**

1. **Install Sentry:**
   ```bash
   npm install @sentry/nextjs
   npx @sentry/wizard@latest -i nextjs
   ```

2. **Configure:**
   ```typescript
   // sentry.client.config.ts
   import * as Sentry from '@sentry/nextjs';
   
   Sentry.init({
     dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
     environment: process.env.NODE_ENV,
     tracesSampleRate: 1.0,
   });
   ```

3. **Add to Vercel:**
   ```bash
   NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
   SENTRY_AUTH_TOKEN=xxx
   ```

**Option 2: LogRocket**
```bash
npm install logrocket
```

### 8.4 Performance Optimization

**1. Enable Edge Runtime (where possible)**
```typescript
// app/api/route.ts
export const runtime = 'edge';
```

**2. Image Optimization**
- Already configured via Cloudinary
- Use Next.js Image component
- Enable auto-format, auto-quality

**3. Database Query Optimization**
- Use connection pooling (already configured)
- Add indexes for frequently queried fields
- Monitor slow queries

**4. Redis Caching**
- Cache auction data (5 min TTL)
- Cache user profiles (15 min TTL)
- Cache dashboard stats (10 min TTL)

**5. Enable Compression**
```typescript
// next.config.js
module.exports = {
  compress: true,
  poweredByHeader: false,
};
```


### 8.5 Backup Strategy

**1. Database Backups**
```bash
# Neon: Automatic daily backups (7-day retention)
# Supabase: Automatic daily backups
# Railway: Manual backups via CLI

# Manual backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

**2. Redis Backups**
```bash
# Vercel KV: Automatic backups
# Manual export (if needed)
redis-cli --rdb dump.rdb
```

**3. Code Backups**
- Git repository (primary backup)
- Vercel deployment history (90 days)

### 8.6 SSL/TLS Configuration

**Automatic SSL (Vercel):**
- Free SSL certificates via Let's Encrypt
- Auto-renewal
- HTTPS enforced by default

**Custom SSL:**
1. Go to Project Settings → Domains
2. Upload custom certificate (Enterprise only)

---

## 9. Common Issues & Troubleshooting

### 9.1 Socket.IO Connection Issues

**Problem:** Socket.IO not connecting in production

**Solution:**
```typescript
// Check if Socket.IO is disabled
if (process.env.NEXT_PUBLIC_SOCKET_URL) {
  // Use external Socket.IO server
  const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL);
} else {
  // Fallback to polling
  console.warn('Socket.IO not available, using polling');
}
```

**Workaround:** Use polling instead of WebSockets
```typescript
const interval = setInterval(async () => {
  const response = await fetch(`/api/auctions/${auctionId}`);
  const data = await response.json();
  updateAuction(data);
}, 5000);
```


### 9.2 Database Connection Limits

**Problem:** "Too many connections" error

**Causes:**
- Serverless functions create new connections
- Connection pool exhausted
- No connection pooling

**Solutions:**

1. **Use Connection Pooler (Neon/Supabase):**
   ```bash
   # Neon pooled connection
   postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require&pooler=true
   
   # Supabase transaction pooler (port 6543)
   postgresql://postgres:pass@db.xxx.supabase.co:6543/postgres
   ```

2. **Reduce Max Connections:**
   ```typescript
   // src/lib/db/drizzle.ts
   const client = postgres(connectionString, {
     max: 5,  // Reduce from 10 to 5
   });
   ```

3. **Use Prisma Data Proxy (Alternative):**
   ```bash
   npm install @prisma/client @prisma/data-proxy
   ```

### 9.3 Cold Start Problems

**Problem:** First request after inactivity is slow (5-10s)

**Causes:**
- Serverless function cold start
- Database connection initialization
- Large bundle size

**Solutions:**

1. **Keep Functions Warm:**
   ```bash
   # Use external service to ping every 5 minutes
   curl https://your-domain.com/api/health
   ```

2. **Reduce Bundle Size:**
   ```typescript
   // Use dynamic imports
   const { heavyFunction } = await import('./heavy-module');
   ```

3. **Enable Edge Runtime:**
   ```typescript
   export const runtime = 'edge';
   ```

4. **Optimize Database Connection:**
   ```typescript
   // Reuse connection across invocations
   let cachedClient: any = null;
   
   export function getClient() {
     if (!cachedClient) {
       cachedClient = postgres(process.env.DATABASE_URL!);
     }
     return cachedClient;
   }
   ```


### 9.4 Image Optimization Issues

**Problem:** Images not loading or slow

**Solutions:**

1. **Use Cloudinary Transformations:**
   ```typescript
   // Auto-optimize images
   const imageUrl = `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${publicId}`;
   ```

2. **Use Next.js Image Component:**
   ```tsx
   import Image from 'next/image';
   
   <Image
     src={imageUrl}
     alt="Salvage item"
     width={800}
     height={600}
     quality={75}
     loading="lazy"
   />
   ```

3. **Configure Image Domains:**
   ```typescript
   // next.config.js
   module.exports = {
     images: {
       domains: ['res.cloudinary.com'],
       formats: ['image/avif', 'image/webp'],
     },
   };
   ```

### 9.5 Environment Variable Issues

**Problem:** Environment variables not available

**Causes:**
- Not added to Vercel
- Wrong environment (dev/preview/prod)
- Client-side access without `NEXT_PUBLIC_` prefix

**Solutions:**

1. **Verify Variables:**
   ```bash
   vercel env ls
   ```

2. **Pull Latest:**
   ```bash
   vercel env pull .env.local
   ```

3. **Client-Side Variables:**
   ```bash
   # Must have NEXT_PUBLIC_ prefix
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   ```

4. **Redeploy After Adding:**
   ```bash
   vercel --prod
   ```


### 9.6 Cron Job Not Running

**Problem:** Cron jobs not executing

**Causes:**
- Not on Pro plan (free tier limited)
- Incorrect schedule format
- Missing CRON_SECRET
- Function timeout

**Solutions:**

1. **Verify Cron Configuration:**
   ```bash
   # Check vercel.json
   cat vercel.json
   ```

2. **Test Manually:**
   ```bash
   curl -X POST https://your-domain.com/api/cron/check-overdue-payments \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

3. **Check Logs:**
   ```bash
   vercel logs --follow
   ```

4. **Use External Cron (Free Tier):**
   - Cron-job.org
   - EasyCron
   - GitHub Actions

### 9.7 Build Failures

**Problem:** Build fails on Vercel

**Common Causes:**

1. **TypeScript Errors:**
   ```bash
   # Fix locally first
   npm run lint
   npm run build
   ```

2. **Missing Dependencies:**
   ```bash
   # Ensure all deps in package.json
   npm install
   ```

3. **Environment Variables:**
   ```bash
   # Add required build-time variables
   vercel env add DATABASE_URL production
   ```

4. **Memory Limit:**
   ```json
   // vercel.json
   {
     "functions": {
       "api/**/*.ts": {
         "memory": 1024
       }
     }
   }
   ```


### 9.8 Payment Webhook Issues

**Problem:** Paystack webhooks not received

**Solutions:**

1. **Verify Webhook URL:**
   ```bash
   # Should be HTTPS
   https://your-domain.com/api/webhooks/paystack
   ```

2. **Check Webhook Secret:**
   ```typescript
   // Verify signature
   const signature = request.headers.get('x-paystack-signature');
   const hash = crypto
     .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET!)
     .update(JSON.stringify(body))
     .digest('hex');
   
   if (hash !== signature) {
     return Response.json({ error: 'Invalid signature' }, { status: 401 });
   }
   ```

3. **Test Webhook:**
   ```bash
   # Use Paystack test mode
   curl -X POST https://your-domain.com/api/webhooks/paystack \
     -H "Content-Type: application/json" \
     -H "x-paystack-signature: test" \
     -d '{"event":"charge.success","data":{}}'
   ```

4. **Check Logs:**
   ```bash
   vercel logs --follow | grep webhook
   ```

---

## 10. Deployment Commands

### 10.1 Initial Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy to production
vercel --prod

# Or link and deploy
vercel link
vercel --prod
```

### 10.2 Build Configuration

**package.json:**
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

**Vercel Settings:**
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`
- Development Command: `npm run dev`
- Node Version: `20.x` (recommended)


### 10.3 Continuous Deployment

**Automatic Deployment (Recommended):**

1. **Connect Git Repository:**
   - Go to Vercel Dashboard
   - Import Git Repository
   - Select branch (main/master)

2. **Configure Branches:**
   - Production: `main` branch
   - Preview: All other branches
   - Development: Local only

3. **Deployment Triggers:**
   - Push to `main` → Production deployment
   - Push to feature branch → Preview deployment
   - Pull request → Preview deployment

**Manual Deployment:**
```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Deploy specific branch
git checkout feature-branch
vercel
```

### 10.4 Rollback

**Rollback to Previous Deployment:**

1. **Via Dashboard:**
   - Go to Deployments
   - Find previous successful deployment
   - Click "Promote to Production"

2. **Via CLI:**
   ```bash
   # List deployments
   vercel ls
   
   # Promote specific deployment
   vercel promote <deployment-url>
   ```

### 10.5 Preview Deployments

**Test Before Production:**

```bash
# Create preview deployment
vercel

# Get preview URL
# https://your-app-git-feature-branch-username.vercel.app

# Test thoroughly
# If good, merge to main for production
```

**Preview Environment Variables:**
```bash
# Add preview-specific variables
vercel env add DATABASE_URL preview
vercel env add PAYSTACK_SECRET_KEY preview
```


### 10.6 Deployment Checklist

**Before Deploying:**

- [ ] All tests passing locally
- [ ] Build succeeds: `npm run build`
- [ ] Environment variables configured in Vercel
- [ ] Database migrations executed
- [ ] External services configured (Paystack, Cloudinary, etc.)
- [ ] Cron jobs configured in `vercel.json`
- [ ] Domain configured (if using custom domain)
- [ ] SSL certificate active
- [ ] Webhook URLs updated in external services

**After Deploying:**

- [ ] Health check passes: `/api/health`
- [ ] Authentication works
- [ ] Database connection successful
- [ ] Redis connection successful
- [ ] Payment flow works (test mode)
- [ ] Email sending works
- [ ] SMS sending works
- [ ] Image upload works
- [ ] Cron jobs executing
- [ ] Monitoring enabled
- [ ] Error tracking configured

---

## 📊 Quick Reference

### Essential URLs

```bash
# Vercel Dashboard
https://vercel.com/dashboard

# Project Settings
https://vercel.com/[username]/[project]/settings

# Environment Variables
https://vercel.com/[username]/[project]/settings/environment-variables

# Deployments
https://vercel.com/[username]/[project]/deployments

# Logs
https://vercel.com/[username]/[project]/logs
```

### Essential Commands

```bash
# Deploy to production
vercel --prod

# View logs
vercel logs --follow

# List deployments
vercel ls

# Pull environment variables
vercel env pull

# Add environment variable
vercel env add VAR_NAME production

# Promote deployment
vercel promote <deployment-url>
```


### Cost Estimation

**Free Tier (Hobby):**
- 100 GB bandwidth/month
- 100 GB-hours serverless function execution
- 1 cron job
- Unlimited deployments
- **Cost:** $0/month

**Pro Tier:**
- 1 TB bandwidth/month
- 1000 GB-hours serverless function execution
- Unlimited cron jobs
- Team collaboration
- **Cost:** $20/month

**External Services:**
- Neon (Database): Free tier → $19/month
- Vercel KV (Redis): Free tier → $0.20/100k commands
- Cloudinary: Free tier → $0/month
- Resend (Email): Free tier (100/day) → $20/month
- Paystack: Transaction fees only (1.5% + ₦100)
- **Total Estimated:** $0-50/month depending on usage

---

## 🎯 Recommended Deployment Strategy

### Phase 1: MVP (Free Tier)

1. Deploy to Vercel Free tier
2. Use Neon free tier for database
3. Use Vercel KV free tier for Redis
4. Disable Socket.IO, use polling
5. Use 1 cron job (payment checker)
6. Use external cron service for other jobs
7. Monitor usage and costs

### Phase 2: Production (Pro Tier)

1. Upgrade to Vercel Pro ($20/month)
2. Enable all cron jobs
3. Deploy Socket.IO to Railway ($5/month)
4. Upgrade database if needed
5. Enable monitoring and error tracking
6. Set up proper backup strategy
7. Configure custom domain with SSL

### Phase 3: Scale

1. Optimize database queries
2. Implement advanced caching
3. Use CDN for static assets
4. Consider edge functions
5. Implement rate limiting
6. Add load testing
7. Monitor and optimize costs

---

## 🔐 Security Checklist

### Pre-Production Security

- [ ] All secrets use strong random values (32+ characters)
- [ ] No secrets committed to Git
- [ ] Environment variables encrypted in Vercel
- [ ] HTTPS enforced (automatic on Vercel)
- [ ] CORS configured properly
- [ ] Rate limiting implemented
- [ ] SQL injection prevention (using Drizzle ORM)
- [ ] XSS prevention (React escapes by default)
- [ ] CSRF protection (NextAuth handles this)
- [ ] Webhook signature verification
- [ ] API authentication required
- [ ] Input validation on all endpoints
- [ ] File upload restrictions
- [ ] Database connection pooling
- [ ] Error messages don't leak sensitive info

### Post-Production Security

- [ ] Monitor for suspicious activity
- [ ] Set up security alerts
- [ ] Regular dependency updates
- [ ] Rotate secrets every 90 days
- [ ] Review access logs
- [ ] Backup strategy in place
- [ ] Incident response plan
- [ ] Security headers configured

---

## 📞 Support & Resources

### Official Documentation

- **Vercel:** https://vercel.com/docs
- **Next.js:** https://nextjs.org/docs
- **Drizzle ORM:** https://orm.drizzle.team/docs
- **Paystack:** https://paystack.com/docs
- **Cloudinary:** https://cloudinary.com/documentation

### Community Support

- **Vercel Discord:** https://vercel.com/discord
- **Next.js GitHub:** https://github.com/vercel/next.js
- **Stack Overflow:** Tag `vercel` or `next.js`

### Troubleshooting Resources

- **Vercel Status:** https://vercel-status.com
- **Vercel Logs:** `vercel logs --follow`
- **Build Logs:** Check deployment details in dashboard

---

## 📝 Final Notes

### Important Reminders

1. **Socket.IO Limitation:** Custom server with Socket.IO does NOT work on Vercel. Use polling, external server, or managed service (Pusher/Ably).

2. **Database Connections:** Always use connection pooling to avoid "too many connections" errors.

3. **Environment Variables:** Client-side variables MUST have `NEXT_PUBLIC_` prefix.

4. **Cron Jobs:** Free tier limited to 1 cron job. Use external service or upgrade to Pro.

5. **Cold Starts:** First request after inactivity will be slow. Keep functions warm or optimize bundle size.

6. **Webhooks:** Always verify signatures for security.

7. **Monitoring:** Enable Vercel Analytics and error tracking from day one.

8. **Backups:** Set up automated database backups before going live.

### Success Criteria

Your deployment is successful when:

- ✅ Application loads without errors
- ✅ Users can sign in/sign up
- ✅ Database queries work
- ✅ Redis caching works
- ✅ Payments process successfully
- ✅ Emails send correctly
- ✅ SMS notifications work
- ✅ Images upload to Cloudinary
- ✅ Cron jobs execute on schedule
- ✅ Real-time updates work (polling or Socket.IO)
- ✅ No console errors
- ✅ Performance is acceptable (<3s page load)

---

## 🚀 Ready to Deploy?

Follow this guide step-by-step, and you'll have a production-ready deployment on Vercel!

**Need help?** Open an issue or contact the development team.

**Good luck! 🎉**
