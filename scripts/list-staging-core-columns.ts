import postgres from 'postgres';

const url = process.env.STAGING_DATABASE_URL!;
const db = postgres(url, { max: 1, prepare: false });

async function main() {
  for (const table of ['users', 'vendors']) {
    const cols = await db`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
      ORDER BY column_name
    `;
    console.log(`\n${table}:`, cols.map((c) => c.column_name).join(', '));
  }
  await db.end();
}

main();
