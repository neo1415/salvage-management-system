/**
 * Bootstrap a fresh Supabase/Postgres database to match the app.
 *
 * Default for Supabase pooler URLs: SQL forward migrations (reliable; no drizzle hang).
 * Optional: --use-push uses drizzle-kit against DIRECT host (not pooler introspection).
 *
 * Usage (never uses .env DATABASE_URL — prod-safe):
 *   STAGING_DATABASE_URL="postgresql://postgres.<staging-ref>:..." npm run db:bootstrap-staging
 *   npm run db:bootstrap-staging -- --url "postgresql://..."
 *
 * Supabase: session pooler port 5432. Set DATABASE_DIRECT_URL only for --use-push.
 */

import { config } from 'dotenv';
import { spawnSync } from 'child_process';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

// Never override STAGING_DATABASE_URL / --url passed from the shell
config({ path: '.env.staging', override: false });
config({ path: '.env.local', override: false });
config({ path: '.env', override: false });

const ROLLBACK_PATTERN = /rollback/i;

const POST_PUSH_MIGRATIONS = [
  '0033_lock_down_public_schema_rls.sql',
  '0036_add_scalability_indexes.sql',
  '0037_add_business_policy_versions.sql',
  '0025_add_intelligence_materialized_views.sql',
  '0035_add_user_mfa_settings.sql',
];

/** Mask password in logs */
function redactUrl(url: string): string {
  return url.replace(/:([^:@/]+)@/, ':****@');
}

/** Known production project ref — block accidental bootstrap against prod. */
const PROD_PROJECT_REF = 'htdehmkqfrwjewzjingm';

function resolveStagingDatabaseUrl(): string {
  const urlArgIndex = process.argv.indexOf('--url');
  const fromFlag = urlArgIndex >= 0 ? process.argv[urlArgIndex + 1] : null;
  const url = fromFlag ?? process.env.STAGING_DATABASE_URL;

  if (!url) {
    console.error(
      '❌ Refusing to use DATABASE_URL from .env (that is usually production).\n' +
        '   Set STAGING_DATABASE_URL or pass --url with your staging connection string.\n' +
        '   Example:\n' +
        '   STAGING_DATABASE_URL="postgresql://postgres.<staging-ref>:...@...pooler...:5432/postgres" npm run db:bootstrap-staging'
    );
    process.exit(1);
  }

  if (url.includes(PROD_PROJECT_REF)) {
    console.error(
      `❌ Refusing to run: connection targets production project "${PROD_PROJECT_REF}".\n` +
        '   Use your staging project ref (esdsufyxydzrertmgyie) in STAGING_DATABASE_URL.'
    );
    process.exit(1);
  }

  if (process.env.DATABASE_URL?.includes(PROD_PROJECT_REF) && url === process.env.DATABASE_URL) {
    console.error('❌ STAGING_DATABASE_URL must not be the same as production DATABASE_URL.');
    process.exit(1);
  }

  return url;
}

function printTarget(url: string): void {
  const ref = url.match(/postgres\.([^:]+)/)?.[1] ?? 'unknown';
  const host = url.match(/@([^/]+)/)?.[1] ?? 'unknown';
  const port = url.match(/:(\d+)\//)?.[1] ?? '?';
  console.log(`   Target: project=${ref} host=${host} port=${port}`);
  console.log(`   URI: ${redactUrl(url)}\n`);
}

/**
 * drizzle-kit push introspection often hangs on *.pooler.supabase.com (even port 5432).
 * Direct host avoids that: db.<project-ref>.supabase.co:5432
 */
function resolveDrizzlePushUrl(url: string): string {
  if (process.env.DATABASE_DIRECT_URL) {
    return process.env.DATABASE_DIRECT_URL;
  }
  const refMatch = url.match(/\/\/postgres\.([^:]+):/);
  if (refMatch && url.includes('pooler.supabase.com')) {
    const ref = refMatch[1];
    return url.replace(/@[^/]+/, `@db.${ref}.supabase.co:5432`);
  }
  return url;
}

/** Semicolons inside CREATE MATERIALIZED VIEW bodies must not start a new statement. */
const DDL_BOUNDARY =
  /;\s*(?=\r?\n\s*(?:CREATE\s+(?:OR\s+REPLACE\s+)?(?:UNIQUE\s+)?INDEX|CREATE\s+MATERIALIZED\s+VIEW|REFRESH\s+MATERIALIZED\s+VIEW|DROP\s+MATERIALIZED\s+VIEW))/i;

function splitOnDdlBoundaries(content: string): string[] {
  return content
    .split(DDL_BOUNDARY)
    .map((part) => {
      const stmt = part.trim();
      if (!stmt) return '';
      return stmt.endsWith(';') ? stmt : `${stmt};`;
    })
    .filter(Boolean);
}

/** Split SQL into executable statements; keeps DO $$ ... $$ blocks intact. */
function splitSqlStatements(content: string): string[] {
  if (content.includes('--> statement-breakpoint')) {
    return content
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (/CREATE\s+MATERIALIZED\s+VIEW/i.test(content)) {
    return splitOnDdlBoundaries(content);
  }

  const statements: string[] = [];
  let current = '';
  let i = 0;
  let dollarTag: string | null = null;

  while (i < content.length) {
    if (dollarTag) {
      if (content.startsWith(dollarTag, i)) {
        current += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      current += content[i];
      i++;
      continue;
    }

    if (content[i] === '$') {
      const rest = content.slice(i);
      const match = rest.match(/^(\$[A-Za-z0-9_]*\$)/);
      if (match) {
        dollarTag = match[1];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }

    if (content[i] === ';') {
      const stmt = current.trim();
      if (stmt) statements.push(stmt);
      current = '';
      i++;
      continue;
    }

    current += content[i];
    i++;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

function normalizeStatement(stmt: string): string | null {
  const t = stmt.trim();
  if (!t) return null;
  if (/^BEGIN\s*;?$/i.test(t) || /^COMMIT\s*;?$/i.test(t) || /^ROLLBACK\s*;?$/i.test(t)) {
    return null;
  }
  return t;
}

/** Run as one query batch — avoids splitter edge cases on large DDL. */
function shouldRunAsSingleBatch(filename: string, raw: string): boolean {
  return (
    filename.includes('materialized_views') ||
    (raw.includes('CREATE MATERIALIZED VIEW') && raw.includes('--> statement-breakpoint'))
  );
}

function isSkippableError(msg: string): boolean {
  return (
    msg.includes('already exists') ||
    msg.includes('duplicate key') ||
    msg.includes('duplicate column') ||
    (msg.includes('does not exist') && msg.includes('DROP'))
  );
}

function parseFromArg(files: string[]): string[] {
  const idx = process.argv.indexOf('--from');
  if (idx === -1 || !process.argv[idx + 1]) return files;
  const from = process.argv[idx + 1].replace(/\.sql$/i, '');
  const prefix = from.includes('_') ? from : `${from}_`;
  const start = files.findIndex((f) => f.startsWith(prefix) || f.includes(from));
  if (start === -1) {
    console.warn(`⚠️  --from ${from} not found; running all files`);
    return files;
  }
  console.log(`   Resuming from ${files[start]} (${files.length - start} files left)\n`);
  return files.slice(start);
}

function createSqlClient(url: string) {
  return postgres(url, {
    max: 1,
    prepare: false,
    connect_timeout: 30,
    onnotice: () => {},
  });
}

function listForwardMigrationFiles(): string[] {
  const dir = join(process.cwd(), 'src/lib/db/migrations');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql') && !ROLLBACK_PATTERN.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function testConnection(url: string): Promise<void> {
  const db = postgres(url, { max: 1, prepare: false, connect_timeout: 20 });
  try {
    await db`SELECT 1 AS ok`;
    console.log('✅ Database connection OK');
  } finally {
    await db.end();
  }
}

async function isMigrationApplied(
  url: string,
  filename: string
): Promise<boolean> {
  const db = createSqlClient(url);
  try {
    if (filename === '0007_add_make_specific_deductions.sql') {
      const [row] = await db`
        SELECT 1 AS ok FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'damage_deductions' AND column_name = 'make'
        LIMIT 1
      `;
      return Boolean(row);
    }
    if (filename === '0008_add_seed_registry.sql') {
      const [row] = await db`
        SELECT 1 AS ok FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'seed_registry'
        LIMIT 1
      `;
      return Boolean(row);
    }
    if (filename === '0025_add_intelligence_materialized_views.sql') {
      const [row] = await db`
        SELECT 1 AS ok FROM pg_matviews
        WHERE schemaname = 'public' AND matviewname = 'vendor_bidding_patterns_mv'
        LIMIT 1
      `;
      return Boolean(row);
    }
    return false;
  } finally {
    await db.end();
  }
}

async function runSqlFile(url: string, filename: string): Promise<void> {
  const path = join(process.cwd(), 'src/lib/db/migrations', filename);
  const raw = readFileSync(path, 'utf8');
  const db = createSqlClient(url);

  const execOne = async (sql: string, label: string) => {
    try {
      await db.unsafe(sql);
    } catch (err) {
      try {
        await db.unsafe('ROLLBACK');
      } catch {
        /* connection may already be idle */
      }
      const msg = err instanceof Error ? err.message : String(err);
      if (isSkippableError(msg)) return;
      console.error(`   ❌ ${filename} ${label}: ${msg}`);
      throw err;
    }
  };

  try {
    if (shouldRunAsSingleBatch(filename, raw)) {
      const sql = raw.replace(/\s*--> statement-breakpoint\s*/g, '\n').trim();
      await execOne(sql, '[full file]');
      return;
    }

    const parts = splitSqlStatements(raw)
      .map(normalizeStatement)
      .filter((s): s is string => s !== null);

    for (let i = 0; i < parts.length; i++) {
      await execOne(parts[i], `[stmt ${i + 1}/${parts.length}]`);
    }
  } finally {
    await db.end();
  }
}

async function runSqlOnlyBootstrap(url: string): Promise<void> {
  const files = parseFromArg(listForwardMigrationFiles());
  console.log(`   Applying ${files.length} forward SQL files (5–15 min on fresh DB)…\n`);
  for (const file of files) {
    process.stdout.write(`   • ${file} … `);
    if (await isMigrationApplied(url, file)) {
      console.log('skip (already applied)');
      continue;
    }
    await runSqlFile(url, file);
    console.log('ok');
  }
}

async function runDrizzlePush(appUrl: string): Promise<boolean> {
  const pushUrl = resolveDrizzlePushUrl(appUrl);
  console.log(`   drizzle-kit push via: ${redactUrl(pushUrl)}`);
  console.log('   (If this hangs at "Pulling schema", cancel and re-run without --use-push)\n');

  const npxExecutable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(npxExecutable, ['drizzle-kit', 'push', '--force'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: pushUrl },
    shell: false,
    timeout: 300000,
  });

  if (result.error?.message?.includes('ETIMEDOUT') || result.signal === 'SIGTERM') {
    console.error('\n⚠️  drizzle-kit push timed out (common on Supabase pooler).');
    return false;
  }
  if (result.status !== 0) {
    console.error('\n⚠️  drizzle-kit push exited with error.');
    return false;
  }
  return true;
}

async function runPostMigrations(url: string): Promise<void> {
  for (const file of POST_PUSH_MIGRATIONS) {
    console.log(`   • ${file}`);
    await runSqlFile(url, file);
  }
}

async function verifySchema(url: string): Promise<void> {
  const db = postgres(url, { max: 1, prepare: false });
  try {
    const [{ n }] = await db`
      SELECT count(*)::int AS n FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const core = await db`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN (
        'users','vendors','salvage_cases','auctions','bids',
        'payments','notification_preferences','audit_logs'
      )
    `;
    const mfa = await db`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
        AND column_name IN ('mfa_enabled','mfa_channel','mfa_phone')
    `;

    console.log(`\n📊 Public tables: ${n} | core: ${core.length}/8 | MFA cols: ${mfa.length}/3`);
    if (n < 25 || core.length < 6) throw new Error('Too few tables');
    if (mfa.length < 3) throw new Error('MFA columns missing');
    console.log('✅ Schema verification passed');
  } finally {
    await db.end();
  }
}

async function main() {
  const url = resolveStagingDatabaseUrl();

  const usePush = process.argv.includes('--use-push');
  const forceSql = process.argv.includes('--sql-only');
  const useSql =
    forceSql || (!usePush && url.includes('pooler.supabase.com'));

  console.log('🚀 Salvage database bootstrap (staging only)\n');
  printTarget(url);
  if (useSql && !forceSql) {
    console.log(
      'ℹ️  Using SQL migrations by default (drizzle-kit push often hangs on Supabase pooler).\n' +
        '   To try push anyway: npm run db:bootstrap-staging -- --use-push\n'
    );
  }

  await testConnection(url);

  if (url.includes(':6543') || url.includes('pgbouncer=true')) {
    console.warn(
      '⚠️  DATABASE_URL looks like transaction pooler (6543). Use session pooler port 5432 for DDL.\n'
    );
  }

  if (useSql) {
    console.log('\nStep 1/2: SQL forward migrations…');
    await runSqlOnlyBootstrap(url);
  } else {
    console.log('\nStep 1/3: drizzle-kit push…');
    const ok = await runDrizzlePush(url);
    if (!ok) {
      console.log('\n↩️  Falling back to SQL migrations…');
      await runSqlOnlyBootstrap(url);
    } else {
      console.log('\nStep 2/3: post-push SQL…');
      await runPostMigrations(url);
    }
  }

  if (useSql) {
    console.log('\nStep 2/2: post-bootstrap SQL…');
    await runPostMigrations(url);
  }

  console.log('\nVerify…');
  await verifySchema(url);
  console.log('\n💡 Optional: npm run db:seed\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
