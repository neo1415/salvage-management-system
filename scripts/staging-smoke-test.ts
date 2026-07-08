/**
 * Smoke tests against staging database after bootstrap.
 * Usage: STAGING_DATABASE_URL="..." npx tsx scripts/staging-smoke-test.ts
 */
import { config } from 'dotenv';
import { compare, hash } from 'bcryptjs';
import postgres from 'postgres';

config({ path: '.env.staging', override: false });
config({ path: '.env.local', override: false });
config({ path: '.env', override: false });

const url = process.env.STAGING_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('STAGING_DATABASE_URL required');
  process.exit(1);
}

async function main() {
  const db = postgres(url, { max: 1, prepare: false });
  const results: { name: string; ok: boolean; detail?: string }[] = [];

  try {
    const [{ n: tableCount }] = await db`
      SELECT count(*)::int AS n FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    results.push({
      name: 'Public tables exist',
      ok: tableCount >= 70,
      detail: `${tableCount} tables`,
    });

    const core = await db`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN (
        'users','vendors','salvage_cases','auctions','bids','payments'
      )
    `;
    results.push({
      name: 'Core tables',
      ok: core.length === 6,
      detail: core.map((r) => r.table_name).join(', '),
    });

    const mfa = await db`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
        AND column_name IN ('mfa_enabled','mfa_channel','mfa_phone')
    `;
    results.push({
      name: 'MFA columns on users',
      ok: mfa.length === 3,
      detail: `${mfa.length}/3`,
    });

    const riskMfaTables = await db`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('user_trusted_login_contexts','login_risk_events')
    `;
    results.push({
      name: 'Risk-based MFA tables',
      ok: riskMfaTables.length === 2,
      detail: `${riskMfaTables.length}/2`,
    });

    const [admin] = await db`
      SELECT id, email, role, password_hash FROM users
      WHERE email = 'adedaniel502@gmail.com' LIMIT 1
    `;
    const adminLoginOk = admin
      ? await compare('SalvageStaging2026!', admin.password_hash)
      : false;
    results.push({
      name: 'System admin account + password',
      ok: Boolean(admin && admin.role === 'system_admin' && adminLoginOk),
      detail: admin ? `${admin.role}` : 'not found',
    });

    const testEmail = `staging-smoke-${Date.now()}@example.com`;
    const testPhone = `+23470${String(Date.now()).slice(-8)}`;
    const testHash = await hash('TestVendor123!', 12);

    const [vendorUser] = await db`
      INSERT INTO users (email, phone, password_hash, role, status, full_name, date_of_birth)
      VALUES (
        ${testEmail}, ${testPhone}, ${testHash}, 'vendor', 'unverified_tier_0',
        'Smoke Test Vendor', '1995-06-01'::timestamp
      )
      RETURNING id
    `;

    const [vendorProfile] = await db`
      INSERT INTO vendors (user_id, tier, status, registration_fee_paid, performance_stats, rating)
      VALUES (
        ${vendorUser.id}, 'tier0', 'pending', false,
        '{"totalBids":0,"totalWins":0,"winRate":0,"avgPaymentTimeHours":0,"onTimePickupRate":0,"fraudFlags":0}'::jsonb,
        '0.00'
      )
      RETURNING id
    `;

    results.push({
      name: 'Vendor registration (DB insert)',
      ok: Boolean(vendorUser?.id && vendorProfile?.id),
      detail: `user=${vendorUser.id.slice(0, 8)}… vendor=${vendorProfile.id.slice(0, 8)}…`,
    });

    await db`DELETE FROM vendors WHERE id = ${vendorProfile.id}`;
    await db`DELETE FROM users WHERE id = ${vendorUser.id}`;

    const policy = await db`
      SELECT 1 AS ok FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'business_policy_versions'
      LIMIT 1
    `;
    results.push({
      name: 'Business policy table',
      ok: policy.length === 1,
    });

    const kyc = await db`
      SELECT 1 AS ok FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'provider_verification_records'
      LIMIT 1
    `;
    results.push({
      name: 'KYC provider verification table',
      ok: kyc.length === 1,
    });

    console.log('\nStaging smoke test results:\n');
    let failed = 0;
    for (const r of results) {
      const icon = r.ok ? '✅' : '❌';
      console.log(`${icon} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
      if (!r.ok) failed++;
    }

    console.log(`\n${failed === 0 ? 'All tests passed' : `${failed} test(s) failed`}`);
    if (failed > 0) process.exit(1);
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
