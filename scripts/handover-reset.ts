import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import postgres from 'postgres';

const protectedTerms = ['adetimilehin', 'adedaniel', 'adneo', 'neowalker', 'alaade', 'mayadenu'];
const env = parse(readFileSync('.env'));
const connectionString = env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const target = new URL(connectionString);
const sql = postgres(connectionString, { max: 1, prepare: false, connect_timeout: 15, idle_timeout: 5 });
const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function main() {
  console.log('TARGET', JSON.stringify({ host: target.hostname, user: target.username, database: target.pathname }));
  const users = await sql`SELECT id, email, role, status FROM public.users ORDER BY email`;
  const keep = users.filter(user => protectedTerms.some(term => String(user.email).toLowerCase().includes(term)));
  console.log('PROTECTED', JSON.stringify(keep));
  console.log('USER_COUNTS', JSON.stringify({ keep: keep.length, remove: users.length - keep.length }));
  if (process.argv.includes('--details')) {
    const ids = keep.map(user => String(user.id));
    console.log('KEPT_VENDOR_STATE', JSON.stringify(await sql`
      SELECT id, user_id, tier, status, registration_fee_paid, bvn_verified_at IS NOT NULL AS has_bvn,
        tier2_approved_at IS NOT NULL AS has_tier2 FROM vendors WHERE user_id IN ${sql(ids)}`));
    console.log('KEPT_VERIFICATION_COUNTS', JSON.stringify(await sql`
      SELECT verification_type, count(*) FROM provider_verification_records
      WHERE user_id IN ${sql(ids)} OR vendor_id IN (SELECT id FROM vendors WHERE user_id IN ${sql(ids)})
      GROUP BY verification_type`));
    console.log('CONFIG_ACTOR_COLUMNS', JSON.stringify(await sql`
      SELECT table_name, column_name, is_nullable, column_default
      FROM information_schema.columns WHERE table_schema = 'public'
        AND table_name IN ('algorithm_config','business_policy_versions','system_config','image_upload_metadata','vendors','escrow_wallets')
        AND (column_name LIKE '%by' OR table_name = 'escrow_wallets')`));
    console.log('LEDGER_ACCOUNT_TYPES', JSON.stringify(await sql`SELECT account_type, count(*) FROM ledger_accounts GROUP BY account_type`));
    console.log('BUCKET_COUNTS', JSON.stringify(await sql`SELECT bucket_id, count(*) FROM storage.objects GROUP BY bucket_id`));
    console.log('STORAGE_PREFIXES', JSON.stringify(await sql`SELECT bucket_id, split_part(name, '/', 1) AS prefix, count(*) FROM storage.objects GROUP BY 1,2 ORDER BY 1,2`));
    console.log('AUTH_USER_COUNT', JSON.stringify(await sql`SELECT count(*) FROM auth.users`));
    console.log('VIEWS', JSON.stringify(await sql`SELECT matviewname FROM pg_matviews WHERE schemaname = 'public'`));
    return;
  }
  const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  for (const table of tables) {
    const [count] = await sql.unsafe(`SELECT count(*)::int AS count FROM public.${quote(table.tablename)}`);
    console.log('TABLE', JSON.stringify({ name: table.tablename, count: count.count }));
  }
  if (process.argv.includes('--counts-only')) return;
  const fks = await sql`
    SELECT conrelid::regclass::text AS child, confrelid::regclass::text AS parent,
      conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace
    ORDER BY conrelid::regclass::text, conname`;
  console.log('FOREIGN_KEYS', JSON.stringify(fks));
  const triggers = await sql`
    SELECT event_object_table, trigger_name, event_manipulation
    FROM information_schema.triggers WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name`;
  console.log('TRIGGERS', JSON.stringify(triggers));
}

main().catch(error => {
  console.error('Inventory failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
}).finally(() => sql.end());
