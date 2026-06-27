/**
 * Start the dev server using .env.staging (staging Supabase, not production .env).
 * Usage: npm run dev:staging
 */
import { config } from 'dotenv';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const stagingPath = join(process.cwd(), '.env.staging');
const altPath = join(process.cwd(), '.env_staging');

if (existsSync(stagingPath)) {
  config({ path: stagingPath, override: true });
} else if (existsSync(altPath)) {
  config({ path: altPath, override: true });
} else {
  console.error('Missing .env.staging or .env_staging');
  process.exit(1);
}

console.log('Using staging env. DATABASE_URL project:', process.env.DATABASE_URL?.match(/postgres\.([^:]+)/)?.[1] ?? 'unknown');

const npxExecutable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const child = spawn(npxExecutable, ['tsx', 'server.ts'], {
  stdio: 'inherit',
  shell: false,
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 0));
