import postgres from 'postgres';

const STAGING =
  'postgresql://postgres.esdsufyxydzrertmgyie:AlucArd1415502@aws-0-eu-west-1.pooler.supabase.com:5432/postgres';
const PROD =
  'postgresql://postgres.htdehmkqfrwjewzjingm:K%40tsur0u1415@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';

async function check(url: string, label: string) {
  const db = postgres(url, { max: 1, prepare: false, connect_timeout: 15 });
  try {
    const u = await db`
      SELECT email, role FROM users WHERE email = 'adedaniel502@gmail.com' LIMIT 1
    `;
    const policies = await db`
      SELECT count(*)::int AS n FROM business_policy_versions
    `.catch(() => [{ n: -1 }]);
    console.log(
      `${label}: admin=${u.length ? u[0].role : 'NOT FOUND'}, policy_rows=${policies[0].n}`
    );
  } finally {
    await db.end();
  }
}

async function main() {
  await check(STAGING, 'STAGING');
  await check(PROD, 'PRODUCTION');
}

main().catch(console.error);
