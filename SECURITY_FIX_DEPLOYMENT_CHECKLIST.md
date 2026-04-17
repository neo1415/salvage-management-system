# 🚨 CRITICAL SECURITY FIXES - DEPLOYMENT CHECKLIST

## Issue 1: Cron Jobs Violating Vercel Hobby Tier Limits

### Problem
The cron job `/api/cron/start-scheduled-auctions` was configured to run every minute (`* * * * *`), which violates Vercel's Hobby tier limit of once per day.

### Fix Applied
✅ Removed the problematic cron job from `vercel.json`

### Remaining Cron Jobs (Compliant)
- `/api/cron/check-overdue-payments` - Runs once daily at midnight (0 0 * * *)
- `/api/cron/check-missing-documents` - Runs once daily at 2 AM (0 2 * * *)

### Alternative Solution for Scheduled Auctions
Instead of a cron job, use client-side polling:
- The frontend already has `use-scheduled-auction-checker.ts` hook
- Polls `/api/auctions/check-and-activate-scheduled` endpoint
- No server-side cron needed

---

## Issue 2: Credential Leaks in Repository

### Critical Files with Exposed Credentials

#### A. `.env` file (CRITICAL)
**Status:** ✅ Now properly gitignored
**Action Required:** 
1. Rotate ALL credentials immediately
2. Remove from Git history using BFG Repo-Cleaner

#### B. `.env.example` file
**Status:** ✅ Now gitignored to prevent accidental credential commits
**Note:** This file should contain placeholder values only

#### C. Documentation files with hardcoded credentials:
1. `SECURITY_AUDIT_CRITICAL_VULNERABILITIES.md`
2. `docs/CRITICAL_SECURITY_FIX_AUTHENTICATION.md`
3. `docs/DATABASE_CONNECTION_FIX.md`
4. `docs/POSTGRESQL_STATUS_AND_NEXT_STEPS.md`
5. `docs/TASK_7_FINAL_SUMMARY.md`
6. `backups/backup.sh`
7. `backups/restore.sh`

---

## IMMEDIATE ACTIONS REQUIRED (Before Deployment)

### Step 1: Rotate All Exposed Credentials (URGENT)

```bash
# 1. Database Password
# Go to Supabase Dashboard → Settings → Database → Reset Password
# Update in Vercel Environment Variables

# 2. Paystack Keys
# Go to Paystack Dashboard → Settings → API Keys & Webhooks → Regenerate
PAYSTACK_SECRET_KEY=<new_secret_key>
PAYSTACK_PUBLIC_KEY=<new_public_key>

# 3. Gemini API Key
# Go to https://aistudio.google.com/apikey → Create New Key
GEMINI_API_KEY=<new_api_key>

# 4. Google OAuth Credentials
# Go to Google Cloud Console → APIs & Services → Credentials → Regenerate
GOOGLE_CLIENT_SECRET=<new_client_secret>

# 5. NextAuth Secret
# Generate new secret:
openssl rand -base64 32
NEXTAUTH_SECRET=<new_secret>

# 6. Cloudinary API Secret
# Go to Cloudinary Dashboard → Settings → Security → Regenerate
CLOUDINARY_API_SECRET=<new_secret>

# 7. Vercel KV Token
# Go to Vercel Dashboard → Storage → KV → Regenerate Token
KV_REST_API_TOKEN=<new_token>

# 8. Cron Secret
# Generate new secret:
openssl rand -base64 32
CRON_SECRET=<new_secret>
```

### Step 2: Clean Git History

```bash
# Install BFG Repo-Cleaner
brew install bfg  # macOS
# or download from: https://rtyley.github.io/bfg-repo-cleaner/

# Clone a fresh copy
git clone --mirror https://github.com/your-repo.git repo-mirror
cd repo-mirror

# Remove .env files from history
bfg --delete-files .env
bfg --delete-files google-cloud-credentials.json

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (WARNING: This rewrites history)
git push --force
```

### Step 3: Redact Credentials from Documentation

Run the provided script to automatically redact credentials:

```bash
npx tsx scripts/redact-credentials-from-docs.ts
```

Or manually replace in these files:
- Replace actual database URLs with: `postgresql://user:password@host:5432/database`
- Replace actual API keys with: `your-api-key-here`
- Replace actual secrets with: `your-secret-here`

### Step 4: Update Backup Scripts

Edit `backups/backup.sh` and `backups/restore.sh`:

```bash
# BEFORE (INSECURE):
DATABASE_URL="postgresql://postgres.htdehmkqfrwjewzjingm:K%40tsur0u1415@..."

# AFTER (SECURE):
DATABASE_URL="${DATABASE_URL}"  # Read from environment
```

### Step 5: Configure Vercel Environment Variables

```bash
# In Vercel Dashboard → Settings → Environment Variables
# Add all variables from .env.example with actual values
# Enable for: Production, Preview, Development

# CRITICAL: Set these in Vercel (not in code):
DATABASE_URL=<from_supabase>
NEXTAUTH_SECRET=<generated_secret>
PAYSTACK_SECRET_KEY=<from_paystack>
GEMINI_API_KEY=<from_google>
GOOGLE_CLIENT_SECRET=<from_google_cloud>
CLOUDINARY_API_SECRET=<from_cloudinary>
KV_REST_API_TOKEN=<from_vercel_kv>
CRON_SECRET=<generated_secret>
```

### Step 6: Enable GitHub Secret Scanning

1. Go to GitHub Repository → Settings → Security → Code security and analysis
2. Enable "Secret scanning"
3. Enable "Push protection"
4. Review and close any existing alerts

### Step 7: Add Pre-commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Prevent committing sensitive files

if git diff --cached --name-only | grep -E '\.env$|google-cloud-credentials\.json'; then
  echo "❌ ERROR: Attempting to commit sensitive files!"
  echo "Files blocked: .env, google-cloud-credentials.json"
  exit 1
fi

# Check for potential secrets in staged files
if git diff --cached | grep -E 'sk_test_|sk_live_|AIza|postgresql://.*:.*@'; then
  echo "⚠️  WARNING: Potential secrets detected in staged changes!"
  echo "Please review your changes before committing."
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

---

## VERIFICATION CHECKLIST

Before deploying, verify:

- [ ] All credentials rotated
- [ ] `.env` file not in Git history
- [ ] `.env.example` contains only placeholders
- [ ] Documentation files redacted
- [ ] Backup scripts use environment variables
- [ ] Vercel environment variables configured
- [ ] GitHub secret scanning enabled
- [ ] Pre-commit hook installed
- [ ] `vercel.json` has only daily cron jobs
- [ ] Test deployment in preview environment

---

## POST-DEPLOYMENT MONITORING

### Monitor for:
1. Failed authentication attempts (old credentials)
2. Cron job execution logs in Vercel
3. GitHub secret scanning alerts
4. Unusual API usage patterns

### Set up alerts:
```bash
# Vercel Dashboard → Settings → Notifications
# Enable alerts for:
- Deployment failures
- Function errors
- Cron job failures
```

---

## ADDITIONAL SECURITY RECOMMENDATIONS

### 1. Enable 2FA on All Services
- GitHub
- Vercel
- Supabase
- Paystack
- Google Cloud
- Cloudinary

### 2. Implement Secret Rotation Schedule
- Database passwords: Every 90 days
- API keys: Every 180 days
- OAuth secrets: Every 180 days
- Cron secrets: Every 90 days

### 3. Use Secret Management Service
Consider migrating to:
- AWS Secrets Manager
- HashiCorp Vault
- Vercel Environment Variables (current)

### 4. Regular Security Audits
- Run `npm audit` weekly
- Review access logs monthly
- Conduct penetration testing quarterly

---

## EMERGENCY CONTACTS

If credentials are compromised:
1. Immediately rotate affected credentials
2. Review access logs for unauthorized access
3. Notify affected users if data breach occurred
4. Document incident for compliance

---

## FILES MODIFIED

✅ `vercel.json` - Removed problematic cron job
✅ `.gitignore` - Added .env.example to prevent accidental commits

## FILES REQUIRING MANUAL REVIEW

⚠️ `SECURITY_AUDIT_CRITICAL_VULNERABILITIES.md` - Contains exposed credentials
⚠️ `docs/CRITICAL_SECURITY_FIX_AUTHENTICATION.md` - Contains database URL
⚠️ `docs/DATABASE_CONNECTION_FIX.md` - Contains database URL
⚠️ `docs/POSTGRESQL_STATUS_AND_NEXT_STEPS.md` - Contains database URL
⚠️ `docs/TASK_7_FINAL_SUMMARY.md` - Contains database URL
⚠️ `backups/backup.sh` - Contains hardcoded database URL
⚠️ `backups/restore.sh` - Contains hardcoded database URL

---

## DEPLOYMENT COMMAND

Once all steps are complete:

```bash
# 1. Commit the fixes
git add vercel.json .gitignore
git commit -m "fix: remove problematic cron job and secure credentials"

# 2. Push to repository
git push origin main

# 3. Verify deployment in Vercel
# Check: https://vercel.com/your-project/deployments

# 4. Test cron jobs
# Vercel Dashboard → Cron Jobs → View Logs
```

---

## SUCCESS CRITERIA

✅ Deployment succeeds without cron job errors
✅ No credentials in Git history
✅ All environment variables set in Vercel
✅ GitHub secret scanning shows no alerts
✅ Application functions normally with new credentials
✅ Cron jobs execute on schedule (daily)

---

**Last Updated:** $(date)
**Status:** READY FOR DEPLOYMENT (after credential rotation)
