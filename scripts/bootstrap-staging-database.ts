/**
 * Bootstrap a fresh Supabase/Postgres database to match the app schema.
 *
 * Strategy for an empty DB:
 * 1. drizzle-kit push creates/updates tables from src/lib/db/schema/*.ts.
 * 2. Post SQL applies idempotent extras: RLS lockdown, indexes, materialized views, policies.
 *
 * This intentionally does not run legacy incremental migrations 0002-0034 one by one
 * because many overlap or conflict after a schema push. Rollback migrations are excluded.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npm run db:bootstrap-staging
 *
 * Optional after bootstrap:
 *   npm run db:seed
 */

import { execSync } from 'child_process';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

config({ path: '.env.local' });
config({ path: '.env' });

const POST_PUSH_MIGRATIONS = [
  '0033_lock_down_public_schema_rls.sql',
  '0036_add_scalability_indexes.sql',
  '0037_add_business_policy_versions.sql',
  '0025_add_intelligence_materialized_views.sql',
  '0035_add_user_mfa_settings.sql',
];

async function runPostMigrations(url: string) {
  const migrationsDir = join(process.cwd(), 'src/lib/db/migrations');
  const db = postgres(url, { max: 1, prepare: false });

  try {
    for (const file of POST_PUSH_MIGRATIONS) {
      const path = join(migrationsDir, file);
      console.log(`\nPost-migration: ${file}`);
      const sql = readFileSync(path, 'utf8');
      try {
        await db.unsafe(sql);
        console.log(`   Applied: ${file}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('already exists') || msg.includes('duplicate')) {
          console.log(`   Skipped, already applied: ${file}`);
        } else {
          throw err;
        }
      }
    }
  } finally {
    await db.end();
  }
}

async function verifySchema(url: string) {
  const db = postgres(url, { max: 1, prepare: false });
  try {
    const tables = await db`
      SELECT count(*)::int AS n
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const core = await db`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'users', 'vendors', 'salvage_cases', 'auctions', 'bids',
          'payments', 'notification_preferences', 'audit_logs'
        )
      ORDER BY table_name
    `;
    const mfa = await db`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
        AND column_name IN ('mfa_enabled', 'mfa_channel', 'mfa_phone')
    `;

    console.log('\nVerification');
    console.log(`   Public tables: ${tables[0]?.n ?? 0}`);
    console.log(`   Core tables: ${core.map((r) => r.table_name).join(', ')}`);
    console.log(`   MFA columns: ${mfa.map((r) => r.column_name).join(', ') || '(missing)'}`);

    if ((tables[0]?.n ?? 0) < 20 || core.length < 6) {
      throw new Error('Schema verification failed - too few tables');
    }
    if (mfa.length < 3) {
      throw new Error('MFA columns missing on users');
    }
    console.log('\nStaging database bootstrap complete');
  } finally {
    await db.end();
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Set DATABASE_URL to the staging direct or pooler connection string');
    process.exit(1);
  }

  console.log('Salvage staging database bootstrap');
  console.log('   Step 1/3: drizzle-kit push, full schema from TypeScript\n');

  try {
    execSync('npx drizzle-kit push --force', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: url },
    });
  } catch {
    console.error('\ndrizzle-kit push failed.');
    console.error('   Tip: use Supabase session pooler on port 5432 or direct connection for DDL.');
    process.exit(1);
  }

  console.log('\n   Step 2/3: post-push SQL migrations');
  await runPostMigrations(url);

  console.log('\n   Step 3/3: verify');
  await verifySchema(url);

  console.log('\nOptional: seed reference data with `npm run db:seed`');
  console.log('Rotate staging credentials if they were shared in chat.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
