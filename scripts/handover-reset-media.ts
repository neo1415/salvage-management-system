import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import postgres from 'postgres';
import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import { collectUrls, isProtectedEmail, shouldDeleteCloudinaryAsset, shouldDeleteKycObject } from './lib/handover-reset-plan';

const env = parse(readFileSync('.env'));
if (new URL(env.DATABASE_URL).username !== 'postgres.htdehmkqfrwjewzjingm') throw new Error('Unexpected database');
const execute = process.argv.includes('--execute');
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15 });
cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET });

async function main() {
  const users = await sql`SELECT * FROM users ORDER BY id`;
  if (users.length !== 6 || users.some(user => !isProtectedEmail(user.email))) throw new Error('Database reset must complete first');
  const vendors = await sql`SELECT * FROM vendors`;
  const policies = await sql`SELECT policy FROM business_policy_versions WHERE active IS TRUE`;
  const metadata = await sql`SELECT image_url FROM image_upload_metadata`;
  const urls = [...collectUrls([users, vendors, policies, metadata])];
  const ownerIds = [...users, ...vendors].map(row => String(row.id));
  const protectedProductionUrls = [...urls];
  const stagingEnv = parse(readFileSync('.env.staging'));
  if (stagingEnv.CLOUDINARY_CLOUD_NAME === env.CLOUDINARY_CLOUD_NAME) {
    const staging = postgres(stagingEnv.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15 });
    try {
      for (const table of ['users','vendors','business_policy_versions','salvage_cases','pickup_evidence','release_forms','image_upload_metadata','provider_verification_records']) {
        const rows = await staging.unsafe(`SELECT * FROM public."${table}"`);
        urls.push(...collectUrls(rows));
      }
    } finally { await staging.end(); }
  }
  const assets: Array<{ public_id: string; resource_type: string; format?: string }> = [];
  const allAssets: Array<{ public_id: string; format?: string }> = [];
  for (const resource_type of ['image', 'raw', 'video']) {
    let next_cursor: string | undefined;
    do {
      const page = await cloudinary.api.resources({ resource_type, type: 'upload', max_results: 500, next_cursor });
      for (const resource of page.resources) {
        allAssets.push(resource);
        if (shouldDeleteCloudinaryAsset(resource, urls, ownerIds)) assets.push({ ...resource, resource_type });
      }
      next_cursor = page.next_cursor;
    } while (next_cursor);
  }
  const cloudinaryReferences = protectedProductionUrls.filter(value => new URL(value).hostname === 'res.cloudinary.com');
  const missingProtected = cloudinaryReferences.filter(value => {
    const path = decodeURIComponent(new URL(value).pathname);
    return !allAssets.some(asset => path.endsWith(`/${asset.public_id}`)
      || (asset.format && path.endsWith(`/${asset.public_id}.${asset.format}`)));
  });
  if (missingProtected.length) throw new Error(`Protected production media unavailable: ${missingProtected.length} references`);
  console.log('PROTECTED_PRODUCTION_MEDIA_VERIFIED', cloudinaryReferences.length);
  const objects = await sql`SELECT name FROM storage.objects WHERE bucket_id = 'kyc-documents' ORDER BY name`;
  const paths = objects.map(row => String(row.name)).filter(name => shouldDeleteKycObject(name, urls, ownerIds));
  const redis = new Redis({ url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN });
  const keysToDelete = new Set<string>();
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, { count: 500 });
    cursor = String(next);
    for (const key of keys) {
      if (/^(session:|user:|ratelimit:|queue:(payments|documents)$)/.test(key)) keysToDelete.add(key);
    }
  } while (cursor !== '0');
  console.log('PLAN', JSON.stringify({ cloudinaryAssets: assets.length, supabaseKycObjects: paths.length,
    redisKeys: keysToDelete.size, preservedAccounts: users.length, preservedKycProfiles: vendors.length }));
  if (!execute) { console.log('DRY RUN: no external media or cache deleted.'); return; }

  let deletedAssets = 0;
  for (const resource_type of ['image', 'raw', 'video']) {
    const ids = assets.filter(asset => asset.resource_type === resource_type).map(asset => asset.public_id);
    for (let index = 0; index < ids.length; index += 100) {
      const batch = ids.slice(index, index + 100);
      const result = await cloudinary.api.delete_resources(batch, { resource_type, type: 'upload', invalidate: true });
      for (const id of batch) {
        if (!['deleted','not_found'].includes(result.deleted?.[id])) throw new Error(`Cloudinary deletion not confirmed: ${id}`);
      }
      deletedAssets += batch.length;
      console.log('CLOUDINARY_PROGRESS', deletedAssets, '/', assets.length);
    }
  }
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  if (paths.length) {
    const { error } = await supabase.storage.from('kyc-documents').remove(paths);
    if (error) throw new Error(`Supabase media deletion failed: ${error.message}`);
  }
  const keys = [...keysToDelete];
  for (let index = 0; index < keys.length; index += 100) await redis.del(...keys.slice(index, index + 100));
  const remaining = await sql`SELECT name FROM storage.objects WHERE bucket_id = 'kyc-documents'`;
  if (remaining.some(row => shouldDeleteKycObject(String(row.name), urls, ownerIds))) throw new Error('Supabase objects remain');
  console.log('COMPLETED', JSON.stringify({ deletedAssets, deletedKycObjects: paths.length, clearedCacheKeys: keys.length }));
}

main().catch(error => {
  console.error('Media/cache cleanup failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
}).finally(() => sql.end());
