import { config } from 'dotenv';
config();

import postgres from 'postgres';

const ADMIN_EMAIL = 'adneo502@gmail.com';
const CONFIRM_FLAG = '--confirm-launch-reset';

type TableRow = {
  table_schema: string;
  table_name: string;
};

const EXCLUDED_TABLES = new Set([
  'users',
  '__drizzle_migrations',
  '_prisma_migrations',
  'drizzle_migrations',
]);

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required.');
  }

  const confirmed = process.argv.includes(CONFIRM_FLAG);
  const allowed = process.env.ALLOW_LAUNCH_RESET === 'true';
  const db = postgres(connectionString, { max: 1, prepare: false });

  try {
    const [admin] = await db<{ id: string; email: string }[]>`
      SELECT id, email
      FROM users
      WHERE lower(email) = lower(${ADMIN_EMAIL})
      LIMIT 1
    `;

    if (!admin) {
      throw new Error(`Refusing reset: required admin account ${ADMIN_EMAIL} was not found.`);
    }

    const tables = await db<TableRow[]>`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name
    `;

    const truncateTables = tables
      .filter((table) => !EXCLUDED_TABLES.has(table.table_name))
      .map((table) => `${quoteIdentifier(table.table_schema)}.${quoteIdentifier(table.table_name)}`);

    console.log('Launch reset dry run');
    console.log('Admin account to preserve:', admin.email, admin.id);
    console.log('Tables to truncate:', truncateTables.length);
    for (const table of truncateTables) {
      console.log(` - ${table}`);
    }
    console.log('Users to delete: every user except', ADMIN_EMAIL);

    if (!confirmed || !allowed) {
      console.log('');
      console.log('No data was changed.');
      console.log(`To execute later, run: ALLOW_LAUNCH_RESET=true npm run db:launch-reset -- ${CONFIRM_FLAG}`);
      console.log('Do not run this against production until final backup and written launch approval are complete.');
      return;
    }

    await db.begin(async (tx) => {
      if (truncateTables.length > 0) {
        await tx.unsafe(`TRUNCATE TABLE ${truncateTables.join(', ')} RESTART IDENTITY CASCADE`);
      }

      await tx`
        DELETE FROM users
        WHERE lower(email) <> lower(${ADMIN_EMAIL})
      `;

      await tx`
        UPDATE users
        SET role = 'system_admin',
            status = 'active',
            updated_at = NOW()
        WHERE lower(email) = lower(${ADMIN_EMAIL})
      `;
    });

    console.log('Launch reset completed. Preserved admin:', ADMIN_EMAIL);
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error('Launch reset failed:', error);
  process.exit(1);
});
