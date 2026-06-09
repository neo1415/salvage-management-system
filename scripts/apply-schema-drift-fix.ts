import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

const url = process.env.STAGING_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error('STAGING_DATABASE_URL required');

async function main() {
  const sql = readFileSync(join(process.cwd(), 'src/lib/db/migrations/0042_sync_schema_drift.sql'), 'utf8');
  const db = postgres(url, { max: 1, prepare: false });
  try {
    await db.unsafe(sql);
    console.log('Applied 0042_sync_schema_drift.sql');
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
