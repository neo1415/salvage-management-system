import postgres from 'postgres';

const TX_POOLER =
  'postgresql://postgres.esdsufyxydzrertmgyie:AlucArd1415502@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';
const SESSION_POOLER =
  'postgresql://postgres.esdsufyxydzrertmgyie:AlucArd1415502@aws-0-eu-west-1.pooler.supabase.com:5432/postgres';

async function test(url: string, label: string, prepare: boolean) {
  const db = postgres(url, { max: 1, prepare, connect_timeout: 15 });
  try {
    await db`SELECT 1 AS ok`;
    await db.begin(async (tx) => {
      await tx`SELECT count(*)::int AS n FROM users`;
    });
    console.log(`${label} (prepare=${prepare}): transaction OK`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`${label} (prepare=${prepare}): FAILED — ${msg.slice(0, 120)}`);
  } finally {
    await db.end();
  }
}

async function main() {
  await test(TX_POOLER, '6543 transaction pooler', true);
  await test(TX_POOLER, '6543 transaction pooler', false);
  await test(SESSION_POOLER, '5432 session pooler', true);
  await test(SESSION_POOLER, '5432 session pooler', false);
}

main();
