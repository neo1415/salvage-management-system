/**
 * Applies 0038_add_user_legal_names.sql (idempotent).
 * Run: npm run db:apply-legal-names
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
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const sql = readFileSync(
    join(process.cwd(), 'src/lib/db/migrations/0038_add_user_legal_names.sql'),
    'utf8'
  );

  const db = postgres(url, { max: 1 });
  try {
    await db.unsafe(sql);
    console.log('✅ Legal name columns applied (first_name, middle_name, last_name)');
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
