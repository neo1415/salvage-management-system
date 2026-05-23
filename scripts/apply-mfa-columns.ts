/**
 * Applies 0035_add_user_mfa_settings.sql (idempotent).
 * Run: npm run db:apply-mfa-columns
 */
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

config({ path: '.env.local' });
config({ path: '.env' });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Add it to .env or .env.local');
    process.exit(1);
  }

  const sqlPath = join(
    process.cwd(),
    'src/lib/db/migrations/0035_add_user_mfa_settings.sql'
  );
  const sql = readFileSync(sqlPath, 'utf8');

  const db = postgres(url, { max: 1 });
  try {
    await db.unsafe(sql);
    console.log('✅ MFA columns applied (mfa_enabled, mfa_channel, mfa_phone)');
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
