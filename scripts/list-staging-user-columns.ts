import postgres from 'postgres';

const url = process.env.STAGING_DATABASE_URL!;
const db = postgres(url, { max: 1, prepare: false });

async function main() {
  const cols = await db`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
    ORDER BY column_name
  `;
  console.log('users columns:', cols.map((c) => c.column_name).join(', '));
  await db.end();
}

main();
