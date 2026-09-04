import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import { Redis } from '@upstash/redis';

const env = parse(readFileSync('.env'));
cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET });

async function main() {
  for (const resource_type of ['image', 'raw', 'video']) {
    const prefixes = new Map<string, number>();
    let next_cursor: string | undefined;
    do {
      const page = await cloudinary.api.resources({ resource_type, type: 'upload', max_results: 500, next_cursor });
      for (const resource of page.resources) {
        const prefix = String(resource.public_id).includes('/') ? String(resource.public_id).split('/')[0] : '(root)';
        prefixes.set(prefix, (prefixes.get(prefix) ?? 0) + 1);
      }
      next_cursor = page.next_cursor;
    } while (next_cursor);
    console.log('CLOUDINARY', resource_type, JSON.stringify(Object.fromEntries(prefixes)));
  }
  const redis = new Redis({ url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN });
  let cursor = '0';
  const prefixes = new Map<string, number>();
  do {
    const [next, keys] = await redis.scan(cursor, { count: 500 });
    cursor = String(next);
    for (const key of keys) {
      const prefix = key.split(':')[0];
      prefixes.set(prefix, (prefixes.get(prefix) ?? 0) + 1);
    }
  } while (cursor !== '0');
  console.log('REDIS_PREFIX_COUNTS', JSON.stringify(Object.fromEntries(prefixes)));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Inventory failed');
  process.exitCode = 1;
});
