/**
 * Create a system_admin user directly in the database (staging/bootstrap).
 *
 * Usage:
 *   STAGING_DATABASE_URL="postgresql://..." npx tsx scripts/create-system-admin.ts <email> [password]
 *
 * Example:
 *   STAGING_DATABASE_URL="..." npx tsx scripts/create-system-admin.ts admin@example.com 'MySecurePass1!'
 */
import { config } from 'dotenv';
import { hash } from 'bcryptjs';
import postgres from 'postgres';

config({ path: '.env.staging', override: false });
config({ path: '.env.local', override: false });
config({ path: '.env', override: false });

const PROD_PROJECT_REF = 'htdehmkqfrwjewzjingm';

function resolveDatabaseUrl(): string {
  const url = process.env.STAGING_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error('STAGING_DATABASE_URL or DATABASE_URL required');
    process.exit(1);
  }
  if (url.includes(PROD_PROJECT_REF)) {
    console.error('Refusing to run against production project.');
    process.exit(1);
  }
  return url;
}

async function main() {
  const email = process.argv[2];
  const password = process.argv[3] ?? 'SalvageStaging2026!';

  if (!email) {
    console.error('Usage: npx tsx scripts/create-system-admin.ts <email> [password]');
    process.exit(1);
  }

  const url = resolveDatabaseUrl();
  const db = postgres(url, { max: 1, prepare: false });

  try {
    const existing = await db`
      SELECT id, email, role FROM users WHERE email = ${email} LIMIT 1
    `;

    const passwordHash = await hash(password, 12);
    const fullName = 'System Administrator';
    const phone = `+23480${String(Date.now()).slice(-8)}`;
    const dateOfBirth = '1990-01-15';

    if (existing.length > 0) {
      const user = existing[0];
      await db`
        UPDATE users SET
          role = 'system_admin',
          status = 'verified_tier_2',
          password_hash = ${passwordHash},
          updated_at = NOW()
        WHERE id = ${user.id}
      `;
      console.log('Updated existing user to system_admin:', user.id);
    } else {
      const [created] = await db`
        INSERT INTO users (
          email, phone, password_hash, role, status, full_name, date_of_birth
        ) VALUES (
          ${email},
          ${phone},
          ${passwordHash},
          'system_admin',
          'verified_tier_2',
          ${fullName},
          ${dateOfBirth}::timestamp
        )
        RETURNING id, email, role
      `;
      console.log('Created system_admin:', created.id, created.email);
    }

    console.log('\nLogin credentials:');
    console.log('  Email:', email);
    console.log('  Password:', password);
    console.log('  Admin URL: /admin/users');
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
