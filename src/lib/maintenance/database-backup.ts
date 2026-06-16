import { gzipSync } from 'node:zlib';
import { createClient } from '@supabase/supabase-js';
import { client } from '@/lib/db/drizzle';

type PublicTableRow = {
  table_schema: string;
  table_name: string;
};

type BackupTable = {
  schema: string;
  name: string;
  rows: unknown[];
};

type BackupPayload = {
  format: 'salvage-bridge-logical-json-v1';
  generatedAt: string;
  source: string;
  tableCount: number;
  tables: BackupTable[];
};

type BackupOptions = {
  source?: string;
  uploadToSupabase?: boolean;
};

type BackupResult = {
  generatedAt: string;
  fileName: string;
  byteLength: number;
  tableCount: number;
  rowCount: number;
  uploaded: boolean;
  bucket?: string;
  path?: string;
};

const EXCLUDED_TABLES = new Set([
  '__drizzle_migrations',
  '_prisma_migrations',
  'drizzle_migrations',
]);

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function listPublicTables() {
  const rows = await client<PublicTableRow[]>`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_schema, table_name
  `;

  return rows.filter((row) => !EXCLUDED_TABLES.has(row.table_name));
}

async function readTableRows(schema: string, table: string) {
  const qualifiedName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
  const [result] = await client.unsafe<{ rows: unknown[] }[]>(`
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) AS rows
    FROM (SELECT * FROM ${qualifiedName}) t
  `);

  return Array.isArray(result?.rows) ? result.rows : [];
}

async function createBackupPayload(options: BackupOptions = {}): Promise<BackupPayload> {
  const tables = await listPublicTables();
  const backupTables: BackupTable[] = [];

  for (const table of tables) {
    const rows = await readTableRows(table.table_schema, table.table_name);
    backupTables.push({
      schema: table.table_schema,
      name: table.table_name,
      rows,
    });
  }

  return {
    format: 'salvage-bridge-logical-json-v1',
    generatedAt: new Date().toISOString(),
    source: options.source ?? 'manual',
    tableCount: backupTables.length,
    tables: backupTables,
  };
}

async function uploadBackupToSupabase(fileName: string, content: Buffer) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE;
  const bucket = process.env.SUPABASE_BACKUP_BUCKET ?? 'app-backups';

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase backup upload requires SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`Unable to list Supabase storage buckets: ${listError.message}`);
  }

  if (!buckets?.some((item) => item.name === bucket)) {
    const { error: createError } = await supabase.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: 1024 * 1024 * 100,
    });

    if (createError) {
      throw new Error(`Unable to create private backup bucket "${bucket}": ${createError.message}`);
    }
  }

  const objectPath = `database/${new Date().toISOString().slice(0, 10)}/${fileName}`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, content, {
    contentType: 'application/gzip',
    upsert: false,
  });

  if (uploadError) {
    throw new Error(`Unable to upload database backup: ${uploadError.message}`);
  }

  return { bucket, path: objectPath };
}

export async function createCompressedDatabaseBackup(options: BackupOptions = {}): Promise<{
  payload: BackupPayload;
  content: Buffer;
  fileName: string;
}> {
  const payload = await createBackupPayload(options);
  const content = gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'));
  const safeTimestamp = payload.generatedAt.replace(/[:.]/g, '-');
  const fileName = `salvage-db-backup-${safeTimestamp}.json.gz`;

  return { payload, content, fileName };
}

export async function runDatabaseBackup(options: BackupOptions = {}): Promise<BackupResult> {
  const { payload, content, fileName } = await createCompressedDatabaseBackup(options);
  const rowCount = payload.tables.reduce((sum, table) => sum + table.rows.length, 0);
  const result: BackupResult = {
    generatedAt: payload.generatedAt,
    fileName,
    byteLength: content.byteLength,
    tableCount: payload.tableCount,
    rowCount,
    uploaded: false,
  };

  if (options.uploadToSupabase) {
    const upload = await uploadBackupToSupabase(fileName, content);
    result.uploaded = true;
    result.bucket = upload.bucket;
    result.path = upload.path;
  }

  return result;
}
