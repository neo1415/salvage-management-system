import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import postgres from 'postgres';
import { v2 as cloudinary } from 'cloudinary';
import { collectUrls } from './lib/handover-reset-plan';

const env = parse(readFileSync('.env'));
const staging = parse(readFileSync('.env.staging'));
cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET });
const sql = postgres(staging.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15 });

async function main() {
  const urls = new Set<string>();
  for (const table of ['users','vendors','business_policy_versions','salvage_cases','pickup_evidence','release_forms','image_upload_metadata','provider_verification_records']) {
    const rows = await sql.unsafe(`SELECT * FROM public."${table}"`);
    collectUrls(rows, urls);
  }
  const sharedUrls = [...urls].filter(value => {
    try { const url = new URL(value); return url.hostname === 'res.cloudinary.com' && url.pathname.startsWith(`/${env.CLOUDINARY_CLOUD_NAME}/`); }
    catch { return false; }
  });
  console.log('STAGING_SHARED_CLOUDINARY_URL_COUNT', sharedUrls.length);
  const resources: Array<{ public_id: string; format?: string }> = [];
  for (const resource_type of ['image','raw','video']) {
    let next_cursor: string | undefined;
    do {
      const page = await cloudinary.api.resources({ resource_type, type: 'upload', max_results: 500, next_cursor });
      resources.push(...page.resources);
      next_cursor = page.next_cursor;
    } while (next_cursor);
  }
  const missing = sharedUrls.filter(value => {
    const path = decodeURIComponent(new URL(value).pathname);
    return !resources.some(resource => path.endsWith(`/${resource.public_id}`)
      || (resource.format && path.endsWith(`/${resource.public_id}.${resource.format}`)));
  });
  console.log('STAGING_MISSING_RESOURCE_PATHS', JSON.stringify(missing.map(value => new URL(value).pathname)));
  if (process.argv.includes('--restore')) {
    for (const resource_type of ['image','raw','video']) {
      const ids = missing.flatMap(value => {
        const match = decodeURIComponent(new URL(value).pathname).match(/^\/[^/]+\/(image|raw|video)\/upload\/v\d+\/(.+)$/);
        if (!match || match[1] !== resource_type) return [];
        return [resource_type === 'raw' ? match[2] : match[2].replace(/\.[^.]+$/, '')];
      });
      if (ids.length) console.log('RESTORE_RESULT', resource_type, JSON.stringify(await cloudinary.api.restore(ids, { resource_type, type: 'upload' })));
    }
  }
  if (process.argv.includes('--recover-cached')) {
    for (const value of missing) {
      const match = decodeURIComponent(new URL(value).pathname).match(/^\/[^/]+\/(image|raw|video)\/upload\/v\d+\/(.+)$/);
      if (!match) throw new Error('Unexpected shared media URL');
      const response = await fetch(value, { signal: AbortSignal.timeout(15000), redirect: 'error' });
      if (!response.ok) { console.log('CACHE_UNAVAILABLE', response.status, match[2]); continue; }
      const contentType = response.headers.get('content-type') || '';
      if (!/^(image\/|application\/pdf)/.test(contentType)) throw new Error('Unexpected cached media type');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 25 * 1024 * 1024) throw new Error('Unexpected cached media size');
      const public_id = match[1] === 'raw' ? match[2] : match[2].replace(/\.[^.]+$/, '');
      await cloudinary.uploader.upload(`data:${contentType};base64,${bytes.toString('base64')}`, {
        resource_type: match[1] as 'image' | 'raw' | 'video', public_id, type: 'upload', overwrite: false,
      });
      console.log('CACHE_RECOVERED', public_id);
    }
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'Check failed'); process.exitCode = 1; }).finally(() => sql.end());
