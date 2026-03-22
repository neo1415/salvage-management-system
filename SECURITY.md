# Security Policy

## 🚨 Reporting Security Issues

If you discover a security vulnerability, please email [security@nemsalvage.com] immediately. Do NOT create a public GitHub issue.

## 🔐 Security Best Practices

### 1. Environment Variables

All sensitive data MUST be stored in environment variables, never hardcoded:

```typescript
// ✅ GOOD
const apiKey = process.env.GEMINI_API_KEY;

// ❌ BAD
const apiKey = 'AIzaSyD-bn93qeRCc3YsnmOOAw8TUu7hR9ObQNE';
```

### 2. .gitignore Configuration

Ensure these files are NEVER committed:

```
.env
.env.local
.env*.local
*-credentials.json
google-cloud-credentials.json
```

### 3. Test Files

Use mock keys or environment variables in tests:

```typescript
// ✅ GOOD
beforeEach(() => {
  process.env.API_KEY = process.env.API_KEY || 'mock-key-for-tests';
});

// ❌ BAD
beforeEach(() => {
  process.env.API_KEY = 'real-api-key-here';
});
```

### 4. Documentation

Never include real API keys in documentation:

```markdown
<!-- ✅ GOOD -->
GEMINI_API_KEY=your-api-key-here

<!-- ❌ BAD -->
GEMINI_API_KEY=AIzaSyD-bn93qeRCc3YsnmOOAw8TUu7hR9ObQNE
```

## 🔍 Security Scanning

### Automated Scanning

Run the security scanner before every commit:

```bash
npm run security:scan
```

This will detect:
- Google API keys
- AWS credentials
- Stripe keys
- Database connection strings
- Generic API keys and secrets
- Private keys

### Manual Review

Before pushing code:

1. Review all changes: `git diff`
2. Check for hardcoded secrets
3. Verify .env is not staged: `git status`
4. Run security scan: `npm run security:scan`

## 🛡️ API Key Management

### Google Cloud APIs

1. **Restrict API Keys**:
   - Go to: https://console.cloud.google.com/apis/credentials
   - Set HTTP referrers (for frontend keys)
   - Set IP restrictions (for backend keys)
   - Enable only required APIs

2. **Rotate Keys Regularly**:
   - Rotate every 90 days
   - Immediately after any suspected exposure
   - When team members leave

3. **Monitor Usage**:
   - Check API dashboard daily
   - Set up billing alerts
   - Review access logs weekly

### Paystack/Payment APIs

1. **Use Test Keys in Development**:
   - Never use live keys locally
   - Test keys start with `sk_test_`
   - Live keys start with `sk_live_`

2. **Webhook Security**:
   - Verify webhook signatures
   - Use HTTPS only
   - Validate IP addresses

### Database Credentials

1. **Connection Pooling**:
   - Use connection poolers (Supabase Pooler)
   - Never expose direct database URLs
   - Use read-only credentials where possible

2. **Access Control**:
   - Implement Row Level Security (RLS)
   - Use service roles sparingly
   - Audit database access logs

## 🚨 Incident Response

### If a Secret is Exposed

1. **Immediate Actions** (within 5 minutes):
   - Revoke the exposed key immediately
   - Generate a new key
   - Update .env file
   - Notify team

2. **Short-term Actions** (within 1 hour):
   - Remove secret from git history
   - Force push to remote
   - Scan for unauthorized usage
   - Check billing/usage dashboards

3. **Long-term Actions** (within 24 hours):
   - Review all API keys
   - Implement additional monitoring
   - Update security procedures
   - Document the incident

### Git History Cleanup

If secrets are in git history:

```bash
# Option 1: BFG Repo-Cleaner (recommended)
# Download from: https://rtyley.github.io/bfg-repo-cleaner/
java -jar bfg.jar --replace-text passwords.txt

# Option 2: git-filter-repo
pip install git-filter-repo
git filter-repo --invert-paths --path 'path/to/file'

# Force push (coordinate with team first!)
git push --force --all
```

## 📋 Security Checklist

### Before Every Commit

- [ ] Run `npm run security:scan`
- [ ] Review `git diff` for secrets
- [ ] Verify .env is not staged
- [ ] Check test files for hardcoded keys

### Before Every Deploy

- [ ] Verify environment variables are set
- [ ] Check API key restrictions
- [ ] Review access logs
- [ ] Test with test keys first

### Monthly

- [ ] Rotate API keys
- [ ] Review access logs
- [ ] Audit user permissions
- [ ] Update dependencies
- [ ] Review security incidents

### Quarterly

- [ ] Full security audit
- [ ] Penetration testing
- [ ] Review and update security policies
- [ ] Team security training

## 🔗 Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Google Cloud Security Best Practices](https://cloud.google.com/security/best-practices)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [Git-secrets](https://github.com/awslabs/git-secrets)
- [Gitleaks](https://github.com/gitleaks/gitleaks)

## 📞 Contact

For security concerns, contact:
- Email: [security@nemsalvage.com]
- Emergency: [emergency-contact]

## 📝 Version History

- v1.0.0 (2026-03-22): Initial security policy
