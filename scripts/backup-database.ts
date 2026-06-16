import { config } from 'dotenv';
config();

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createCompressedDatabaseBackup } from '../src/lib/maintenance/database-backup';

async function main() {
  const upload = process.argv.includes('--upload');
  const { runDatabaseBackup } = await import('../src/lib/maintenance/database-backup');

  if (upload) {
    const result = await runDatabaseBackup({ source: 'manual-script', uploadToSupabase: true });
    console.log('Backup uploaded:', {
      fileName: result.fileName,
      byteLength: result.byteLength,
      tableCount: result.tableCount,
      rowCount: result.rowCount,
      bucket: result.bucket,
      path: result.path,
    });
    return;
  }

  const { content, fileName, payload } = await createCompressedDatabaseBackup({ source: 'manual-script' });
  const outputDir = join(process.cwd(), 'protected-backups');
  await mkdir(outputDir, { recursive: true });
  const outputPath = join(outputDir, fileName);
  await writeFile(outputPath, content, { flag: 'wx' });

  const rowCount = payload.tables.reduce((sum, table) => sum + table.rows.length, 0);
  console.log('Backup written locally:', {
    outputPath,
    byteLength: content.byteLength,
    tableCount: payload.tableCount,
    rowCount,
  });
  console.log('Keep protected-backups out of git and move this file to encrypted/off-site storage.');
}

main().catch((error) => {
  console.error('Backup failed:', error);
  process.exit(1);
});
