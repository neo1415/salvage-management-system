import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL ?? process.env.STAGING_DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL or STAGING_DATABASE_URL required');
    process.exit(1);
  }

  const db = postgres(url, { max: 1, prepare: false });
  const tables = await db`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  console.log('table count:', tables.length);
  console.log('has users:', tables.some((t) => t.table_name === 'users'));
  console.log('has report_templates:', tables.some((t) => t.table_name === 'report_templates'));
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
