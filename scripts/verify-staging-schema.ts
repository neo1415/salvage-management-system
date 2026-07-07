/**
 * Quick staging schema checks for settings/MFA.
 * Usage: STAGING_DATABASE_URL=... npx tsx scripts/verify-staging-schema.ts
 */
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.staging', override: false });
config({ path: '.env.local', override: false });
config({ path: '.env', override: false });

async function main() {
  const url = process.env.STAGING_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error('STAGING_DATABASE_URL or DATABASE_URL required');
    process.exit(1);
  }

  const db = postgres(url, { max: 1 });
  try {
    const mfaCols = await db`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name IN ('mfa_enabled', 'mfa_channel', 'mfa_phone')
      ORDER BY column_name
    `;

    console.log('users MFA columns:', mfaCols.map((r) => r.column_name).join(', ') || '(none)');

    const prefs = await db`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'notification_preferences'
      ) AS ok
    `;
    console.log('notification_preferences table:', prefs[0]?.ok ? 'yes' : 'no');

    const sample = await db`SELECT count(*)::int AS n FROM users`;
    console.log('users row count:', sample[0]?.n);

    if (mfaCols.length < 3) {
      console.error('MFA columns missing - run: npm run db:apply-mfa-columns');
      process.exit(1);
    }
    console.log('Staging schema checks passed for settings');
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
