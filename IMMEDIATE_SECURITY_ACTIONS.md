# 🚨 IMMEDIATE SECURITY ACTIONS REQUIRED

## Status: CRITICAL - API Keys Exposed on GitHub

Google has detected your API keys in a public repository. Take these actions NOW.

---

## ✅ COMPLETED (by Kiro)

1. ✅ Removed hardcoded API keys from test files
2. ✅ Redacted API keys from documentation files
3. ✅ Created security scanning tools
4. ✅ Updated .gitignore (already had .env)
5. ✅ Created security documentation

---

## 🔴 URGENT - DO THIS NOW (5 minutes)

### Step 1: Revoke Compromised Gemini API Key

1. Go to: https://aistudio.google.com/apikey
2. Find key ending in: `...bQNE`
3. Click **Delete** or **Revoke**
4. Click **Create API Key** to generate a new one
5. Copy the new key

### Step 2: Revoke Compromised Google Maps API Key

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find key ending in: `...mKkM`
3. Click the key, then click **Delete** or **Regenerate**
4. Generate a NEW key with restrictions:
   - **Application restrictions**: HTTP referrers
   - **Website restrictions**: Add:
     - `localhost:3000/*`
     - `*.vercel.app/*`
     - Your production domain
   - **API restrictions**: Select these APIs only:
     - Maps JavaScript API
     - Geolocation API
     - Geocoding API
5. Copy the new key

### Step 3: Update Your .env File

```bash
# Open .env file
code .env

# Replace these lines with your NEW keys:
GEMINI_API_KEY=your-new-gemini-key-here
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-new-maps-key-here
```

### Step 4: Verify .env is Not Tracked

```bash
# This should output: .env
git check-ignore .env

# If it doesn't, add it now:
echo ".env" >> .gitignore
```

---

## 🟠 IMPORTANT - DO THIS TODAY (30 minutes)

### Step 5: Remove Secrets from Git History

Your secrets are in git history. You need to remove them:

#### Option A: BFG Repo-Cleaner (Recommended)

```bash
# 1. Download BFG
# Go to: https://rtyley.github.io/bfg-repo-cleaner/
# Download bfg.jar

# 2. Create a file with secrets to remove
cat > secrets.txt << EOF
AIzaSyD-bn93qeRCc3YsnmOOAw8TUu7hR9ObQNE
AIzaSyBpNs3iZUa16V03YfhypvmXgkxbKXcmKkM
sk_test_45ca11545148bed4becda5de54198e677eecbcbf
EOF

# 3. Run BFG (replace with actual path to bfg.jar)
java -jar bfg.jar --replace-text secrets.txt

# 4. Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 5. Force push (COORDINATE WITH TEAM FIRST!)
git push --force --all
```

#### Option B: Start Fresh (Nuclear Option)

If the repo isn't critical or you're the only developer:

```bash
# 1. Backup current code
cp -r . ../salvage-backup

# 2. Delete .git folder
rm -rf .git

# 3. Initialize new repo
git init
git add .
git commit -m "Initial commit with secrets removed"

# 4. Push to new repo or force push
git remote add origin <your-repo-url>
git push -u origin main --force
```

### Step 6: Monitor for Unauthorized Usage

Check these dashboards for suspicious activity:

1. **Google Cloud Console**: https://console.cloud.google.com/apis/dashboard
   - Look for unusual API usage spikes
   - Check for requests from unknown IPs
   - Review billing for unexpected charges

2. **Paystack Dashboard**: https://dashboard.paystack.com/
   - Check transaction logs
   - Review API call logs
   - Look for failed authorization attempts

3. **Supabase Dashboard**: https://supabase.com/dashboard
   - Check auth logs
   - Review database access logs
   - Look for unusual query patterns

---

## 📋 VERIFICATION CHECKLIST

After completing the above steps, verify:

- [ ] Old Gemini API key is revoked
- [ ] Old Google Maps API key is revoked
- [ ] New keys are in .env file
- [ ] .env is in .gitignore
- [ ] Application works with new keys
- [ ] Secrets removed from git history
- [ ] Force pushed to GitHub
- [ ] Team members notified (if applicable)
- [ ] No unusual activity in dashboards
- [ ] Security scan passes: `npm run security:scan`

---

## 🔐 ONGOING SECURITY

### Daily

- Run security scan before commits: `npm run security:scan`
- Review git diff before pushing: `git diff`

### Weekly

- Check API usage dashboards
- Review access logs
- Monitor billing for anomalies

### Monthly

- Rotate API keys
- Review and update security policies
- Audit user permissions

---

## 📞 NEED HELP?

If you see:
- Unexpected charges on Google Cloud
- Unusual API usage patterns
- Unauthorized transactions
- Suspicious access logs

**IMMEDIATELY**:
1. Revoke ALL API keys
2. Change ALL passwords
3. Enable 2FA on all accounts
4. Contact support for each service

---

## 📚 RESOURCES

- [SECURITY_BREACH_ACTION_PLAN.md](./SECURITY_BREACH_ACTION_PLAN.md) - Detailed recovery plan
- [SECURITY.md](./SECURITY.md) - Security best practices
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)

---

## ✅ WHEN YOU'RE DONE

After completing all steps:

1. Run the security scanner:
   ```bash
   npm run security:scan
   ```

2. If it passes, commit your changes:
   ```bash
   git add .
   git commit -m "security: Remove exposed API keys and implement security measures"
   git push
   ```

3. Delete this file (it's served its purpose):
   ```bash
   git rm IMMEDIATE_SECURITY_ACTIONS.md
   git commit -m "chore: Remove completed security action plan"
   ```

---

**Last Updated**: 2026-03-22
**Status**: ACTIVE - Complete these actions immediately
