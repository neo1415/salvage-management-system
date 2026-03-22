# Deployment Seeding Guide

This guide explains how the automatic seed execution works during deployment and how to configure it for different environments.

## Overview

The seed system is now integrated with the deployment pipeline to automatically load vehicle valuation and damage deduction data on fresh deployments. This ensures that new environments (staging, production) are immediately functional with all necessary pricing data.

## How It Works

### Automatic Seed Execution

When you deploy the application, the following happens:

1. **Build Phase**: Application is built
2. **Seed Phase**: All seed scripts are executed automatically
3. **Start Phase**: Application starts with seeded data

The seed system uses a registry to track which seeds have been executed, preventing duplicate data on subsequent deployments.

## Environment Variables

Control seed behavior with these environment variables:

### SKIP_SEEDS

Skip seed execution entirely during deployment.

```bash
SKIP_SEEDS=true
```

**Use cases:**
- Development environments where you manage data manually
- Deployments where data already exists
- Testing deployments without production data

### FORCE_SEEDS

Force re-run all seeds even if they've already been executed.

```bash
FORCE_SEEDS=true
```

**Use cases:**
- Updating existing data with new values
- Recovering from corrupted data
- Testing seed scripts in staging

**⚠️ Warning**: This will update all existing records. Use with caution in production.

## Deployment Platforms

### Vercel Deployment

The `vercel.json` configuration automatically runs seeds after build:

```json
{
  "buildCommand": "npm run build && npm run db:seed"
}
```

**Environment Variables in Vercel:**

1. Go to your project settings
2. Navigate to Environment Variables
3. Add variables:
   - `SKIP_SEEDS=false` (default, can omit)
   - `FORCE_SEEDS=false` (default, can omit)

**Manual Seed Execution on Vercel:**

If seeds fail during deployment or you need to run them manually:

```bash
# SSH into Vercel deployment (if available) or use Vercel CLI
vercel env pull
npm run db:seed
```

### Docker Deployment

The Dockerfile includes seed execution in the startup command:

```dockerfile
CMD ["sh", "-c", "if [ \"$SKIP_SEEDS\" != \"true\" ]; then tsx scripts/seeds/run-all-seeds.ts $([ \"$FORCE_SEEDS\" = \"true\" ] && echo '--force' || echo ''); fi && node server.js"]
```

**Environment Variables in Docker:**

```bash
# Skip seeds
docker run -e SKIP_SEEDS=true your-image

# Force re-run seeds
docker run -e FORCE_SEEDS=true your-image

# Normal execution (seeds run once)
docker run your-image
```

**Docker Compose Example:**

```yaml
version: '3.8'
services:
  app:
    build: .
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/salvage
      - SKIP_SEEDS=false
      - FORCE_SEEDS=false
    ports:
      - "3000:3000"
    depends_on:
      - db
  
  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=salvage
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Manual Deployment

For manual deployments or custom CI/CD pipelines:

```bash
# 1. Build the application
npm run build

# 2. Run database migrations (if needed)
npm run db:migrate

# 3. Run seeds
npm run db:seed

# 4. Start the application
npm start
```

**With environment variables:**

```bash
# Skip seeds
SKIP_SEEDS=true npm run db:seed

# Force re-run
FORCE_SEEDS=true npm run db:seed
```

## Seed Execution Flow

### First Deployment (Fresh Database)

```
1. Database schema created
2. System user created
3. Seeds discovered (7 makes × 2 types = 14 scripts)
4. Seeds executed in order:
   - audi/audi-valuations.seed.ts
   - audi/audi-damage-deductions.seed.ts
   - hyundai/hyundai-valuations.seed.ts
   - hyundai/hyundai-damage-deductions.seed.ts
   - kia/kia-valuations.seed.ts
   - kia/kia-damage-deductions.seed.ts
   - lexus/lexus-valuations.seed.ts
   - lexus/lexus-damage-deductions.seed.ts
   - mercedes/mercedes-valuations.seed.ts
   - mercedes/mercedes-damage-deductions.seed.ts
   - nissan/nissan-valuations.seed.ts
   - nissan/nissan-damage-deductions.seed.ts
   - toyota/toyota-valuations.seed.ts
   - toyota/toyota-damage-deductions.seed.ts
5. Registry updated with execution status
6. Application starts
```

### Subsequent Deployments

```
1. Database schema already exists
2. Seeds check registry
3. Seeds already executed → skipped
4. Application starts immediately
```

### Force Re-run (FORCE_SEEDS=true)

```
1. Database schema exists
2. Seeds check registry
3. Force flag detected → re-run all seeds
4. Existing records updated (idempotent)
5. Registry updated with new execution
6. Application starts
```

## Monitoring Seed Execution

### View Seed Registry

Check which seeds have been executed:

```bash
tsx scripts/seeds/view-registry.ts
```

**Output:**
```
📊 SEED EXECUTION REGISTRY
═══════════════════════════════════════════════════════════

Script: toyota-valuations
Status: completed
Executed: 2024-01-15 10:30:45
Records: 150 imported, 0 updated, 0 skipped
Time: 2.5s

Script: toyota-damage-deductions
Status: completed
Executed: 2024-01-15 10:30:48
Records: 75 imported, 0 updated, 0 skipped
Time: 1.2s

...
```

### Deployment Logs

Seeds log their execution during deployment:

```
🌱 POST-MIGRATION SEED EXECUTION
═══════════════════════════════════════════════════════════

📦 Executing: tsx scripts/seeds/run-all-seeds.ts

🚀 Master Seed Runner
Flags: none

📋 Discovered 14 seed scripts

═══════════════════════════════════════════════════════════
🌱 Running: toyota - valuations
═══════════════════════════════════════════════════════════

🌱 Starting seed: toyota-valuations
📊 Total records to process: 150

✅ Transformed 150 records

📦 Processing batch 1/3 (50 records)...
  ✅ Imported: 50, Updated: 0, Skipped: 0
📦 Processing batch 2/3 (50 records)...
  ✅ Imported: 50, Updated: 0, Skipped: 0
📦 Processing batch 3/3 (50 records)...
  ✅ Imported: 50, Updated: 0, Skipped: 0

═══════════════════════════════════════════════════════════
📈 SEED EXECUTION SUMMARY
═══════════════════════════════════════════════════════════
Script: toyota-valuations
Total Records: 150
✅ Imported: 150
🔄 Updated: 0
⏭️  Skipped: 0
❌ Errors: 0
⏱️  Execution Time: 2.50s
═══════════════════════════════════════════════════════════

...

✅ Seed execution completed successfully
═══════════════════════════════════════════════════════════
```

## Troubleshooting

### Seeds Failed During Deployment

If seeds fail, the deployment continues but logs the error:

```
❌ Seed execution failed:
Error: Connection to database failed

⚠️  Deployment will continue despite seed failure
💡 Seeds can be run manually later with: tsx scripts/seeds/run-all-seeds.ts
💡 Check seed registry for execution history: tsx scripts/seeds/view-registry.ts
```

**Resolution:**

1. Check database connection
2. Verify DATABASE_URL environment variable
3. Run seeds manually after deployment:
   ```bash
   npm run db:seed
   ```

### Seeds Skipped Unexpectedly

If seeds are skipped when you expect them to run:

**Check registry:**
```bash
tsx scripts/seeds/view-registry.ts
```

**Force re-run:**
```bash
FORCE_SEEDS=true npm run db:seed
```

### Partial Seed Failure

If some seeds succeed and others fail:

**Check logs for specific errors:**
```
❌ Failed Seeds:
  - mercedes/mercedes-valuations
```

**Run specific seed manually:**
```bash
tsx scripts/seeds/mercedes/mercedes-valuations.seed.ts --force
```

### Stale Registry Entries

If a seed crashed mid-execution, it may have a stale "running" status:

**Cleanup stale entries:**
```bash
tsx scripts/seeds/cleanup-registry.ts
```

## Best Practices

### Development Environment

```bash
# Skip automatic seeding in development
SKIP_SEEDS=true

# Run seeds manually when needed
npm run db:seed
```

### Staging Environment

```bash
# Run seeds automatically on first deployment
SKIP_SEEDS=false

# Force re-run to test updates
FORCE_SEEDS=true npm run db:seed
```

### Production Environment

```bash
# Run seeds automatically on first deployment
SKIP_SEEDS=false

# Never use FORCE_SEEDS in production without backup
# Always test in staging first
```

### CI/CD Pipeline

```yaml
# Example GitHub Actions workflow
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Run seeds
        run: npm run db:seed
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          SKIP_SEEDS: false
      
      - name: Deploy
        run: npm run deploy
```

## Security Considerations

### System User

Seeds use a special System User (ID: `00000000-0000-0000-0000-000000000001`) for all operations. Ensure this user exists in your database:

```sql
INSERT INTO users (id, email, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'system@salvage.com', 'system')
ON CONFLICT (id) DO NOTHING;
```

### Database Credentials

Never commit database credentials. Use environment variables:

```bash
# .env (not committed)
DATABASE_URL=postgresql://user:password@host:5432/database
```

### Audit Logging

All seed operations are logged to `valuation_audit_logs` table for compliance and debugging.

## Summary

The deployment seeding system provides:

- ✅ Automatic data loading on fresh deployments
- ✅ Idempotent operations (safe to run multiple times)
- ✅ Environment variable control (SKIP_SEEDS, FORCE_SEEDS)
- ✅ Comprehensive logging and monitoring
- ✅ Graceful error handling (deployment continues on failure)
- ✅ Registry tracking (prevents duplicate executions)
- ✅ Platform support (Vercel, Docker, manual)

For more information, see:
- [Seed System README](scripts/seeds/README.md)
- [Master Seed Runner](scripts/seeds/run-all-seeds.ts)
- [Post-Migration Hook](src/lib/db/migrations/run-seeds-after-migration.ts)
