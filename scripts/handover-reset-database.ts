import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import postgres from 'postgres';
import { collectUrls, isProtectedEmail, validateResetTables, WIPE_TABLES } from './lib/handover-reset-plan';

const env = parse(readFileSync('.env'));
const url = new URL(env.DATABASE_URL);
const execute = process.argv.includes('--execute');
const rehearse = process.argv.includes('--rehearse');
if (execute === rehearse) throw new Error('Choose exactly one of --rehearse or --execute');
if (url.username !== 'postgres.htdehmkqfrwjewzjingm' || url.pathname !== '/postgres') {
  throw new Error('Refusing reset: this is not the inventoried production/local database');
}
if (!process.argv.includes('--expected-users=1149')) throw new Error('Explicit inventoried user count is required');
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15, idle_timeout: 5 });
const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;
const rehearsalComplete = new Error('REHEARSAL_ROLLBACK');

async function main() {
  try {
    await sql.begin(async tx => {
      await tx`SET LOCAL lock_timeout = '15s'`;
      await tx`SET LOCAL statement_timeout = '120s'`;
      await tx`SELECT pg_advisory_xact_lock(hashtext('salvage-handover-reset'))`;
      const tables = await tx`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
      const names = tables.map(row => String(row.tablename));
      validateResetTables(names);
      await tx.unsafe(`LOCK TABLE ${names.map(name => `public.${quote(name)}`).join(', ')} IN ACCESS EXCLUSIVE MODE`);

      const users = await tx`SELECT * FROM users ORDER BY id`;
      const keep = users.filter(user => isProtectedEmail(user.email));
      if (users.length !== 1149 || keep.length !== 6 || !keep.some(user => user.role === 'system_admin')) {
        throw new Error('Account inventory changed; refusing reset');
      }
      const ids = keep.map(user => String(user.id));
      const vendors = await tx`SELECT * FROM vendors WHERE user_id IN ${tx(ids)} ORDER BY id`;
      const vendorIds = vendors.map(vendor => String(vendor.id));
      if (vendorIds.length !== 2) throw new Error('Protected vendor inventory changed');
      const userHashes = await tx`SELECT id, md5(to_jsonb(u)::text) AS hash FROM users u WHERE id IN ${tx(ids)} ORDER BY id`;
      const vendorHashes = await tx`
        SELECT id, md5((to_jsonb(v) - ARRAY['performance_stats','rating','approved_by','tier2_approved_by','updated_at'])::text) AS hash
        FROM vendors v WHERE id IN ${tx(vendorIds)} ORDER BY id`;
      const policies = await tx`SELECT * FROM business_policy_versions WHERE active IS TRUE ORDER BY id`;
      if (policies.length !== 1) throw new Error('Expected exactly one active enterprise policy');
      const urls = [...collectUrls([keep, vendors, policies])];
      const triggersBefore = await tx`SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.audit_logs'::regclass AND NOT tgisinternal ORDER BY tgname`;
      const verificationHashes = await tx`
        SELECT id, md5((to_jsonb(p) - 'reviewed_by')::text) AS hash FROM provider_verification_records p
        WHERE user_id IN ${tx(ids)} OR vendor_id IN ${tx(vendorIds)} ORDER BY id`;

      // RESTRICT prevents an unreviewed dependent table from being erased. TRUNCATE is transactional;
      // audit append-only triggers are left installed and enabled for normal application operations.
      await tx.unsafe(`TRUNCATE TABLE ${WIPE_TABLES.map(name => `public.${quote(name)}`).join(', ')} RESTART IDENTITY RESTRICT`);
      await tx`DELETE FROM provider_verification_records
        WHERE NOT (COALESCE(user_id IN ${tx(ids)}, false) OR COALESCE(vendor_id IN ${tx(vendorIds)}, false))`;
      await tx`DELETE FROM provider_webhook_events w WHERE NOT EXISTS (
        SELECT 1 FROM provider_verification_records p WHERE p.provider = w.provider AND
          ((p.provider_reference IS NOT NULL AND p.provider_reference = w.provider_reference)
          OR (p.workflow_reference IS NOT NULL AND p.workflow_reference = w.workflow_reference))
        ) AND NOT EXISTS (SELECT 1 FROM vendors v WHERE v.id IN ${tx(vendorIds)}
          AND v.tier2_dojah_reference_id IS NOT NULL AND v.tier2_dojah_reference_id = w.provider_reference)`;
      await tx`DELETE FROM image_upload_metadata WHERE NOT (
        (entity_type IN ('kyc_document','profile_picture') AND (entity_id IN ${tx(ids)} OR entity_id IN ${tx(vendorIds)}))
        OR image_url = ANY(${tx.array(urls)}::text[]))`;
      await tx`DELETE FROM business_policy_versions WHERE active IS NOT TRUE`;
      await tx`DELETE FROM notification_preferences WHERE user_id NOT IN ${tx(ids)}`;
      await tx`DELETE FROM escrow_wallets WHERE vendor_id NOT IN ${tx(vendorIds)}`;
      await tx`UPDATE escrow_wallets SET balance = 0, frozen_amount = 0, available_balance = 0,
        forfeited_amount = 0, updated_at = NOW()`;
      await tx`DELETE FROM ledger_accounts WHERE NOT (
        (account_type IN ('nem_paystack','nem_bank') AND account_id = 'nem')
        OR (account_type = 'vendor_wallet' AND account_id IN ${tx(vendorIds)}))`;
      await tx`DELETE FROM vendors WHERE user_id NOT IN ${tx(ids)}`;
      await tx`UPDATE vendors SET performance_stats = '{"totalBids":0,"totalWins":0,"winRate":0,"avgPaymentTimeHours":0,"onTimePickupRate":0,"fraudFlags":0}'::jsonb,
        rating = 0, updated_at = NOW()`;

      // Detach only obsolete actor references; never transfer authorship to a different person.
      for (const [table, column] of [
        ['algorithm_config','created_by'], ['business_policy_versions','created_by'],
        ['business_policy_versions','published_by'], ['system_config','updated_by'],
        ['damage_deductions','created_by'], ['vehicle_valuations','created_by'],
        ['image_upload_metadata','uploaded_by'], ['vendors','approved_by'],
        ['vendors','tier2_approved_by'], ['provider_verification_records','reviewed_by'],
      ]) {
        await tx.unsafe(`UPDATE public.${quote(table)} SET ${quote(column)} = NULL
          WHERE ${quote(column)} IS NOT NULL AND ${quote(column)} NOT IN (${ids.map((_, i) => `$${i + 1}`).join(',')})`, ids);
      }
      await tx`DELETE FROM users WHERE id NOT IN ${tx(ids)}`;
      await tx`REFRESH MATERIALIZED VIEW ledger_transaction_summary`;

      const usersAfter = await tx`SELECT id, md5(to_jsonb(u)::text) AS hash FROM users u ORDER BY id`;
      const vendorsAfter = await tx`
        SELECT id, md5((to_jsonb(v) - ARRAY['performance_stats','rating','approved_by','tier2_approved_by','updated_at'])::text) AS hash
        FROM vendors v ORDER BY id`;
      const verificationsAfter = await tx`SELECT id, md5((to_jsonb(p) - 'reviewed_by')::text) AS hash FROM provider_verification_records p ORDER BY id`;
      if (JSON.stringify(userHashes) !== JSON.stringify(usersAfter)
        || JSON.stringify(vendorHashes) !== JSON.stringify(vendorsAfter)
        || JSON.stringify(verificationHashes) !== JSON.stringify(verificationsAfter)) {
        throw new Error('Preserved account or KYC data changed; rolling back');
      }
      const policyAfter = await tx`SELECT policy FROM business_policy_versions WHERE active IS TRUE`;
      if (JSON.stringify(policyAfter[0]?.policy) !== JSON.stringify(policies[0].policy)) throw new Error('Enterprise policy changed');
      for (const table of WIPE_TABLES) {
        const [row] = await tx.unsafe(`SELECT count(*)::int AS count FROM public.${quote(table)}`);
        if (row.count !== 0) throw new Error(`${table} was not emptied`);
      }
      const triggersAfter = await tx`SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.audit_logs'::regclass AND NOT tgisinternal ORDER BY tgname`;
      if (JSON.stringify(triggersBefore) !== JSON.stringify(triggersAfter)) throw new Error('Audit trigger protection changed');
      console.log('VERIFIED', JSON.stringify({ retainedAccounts: keep.map(user => user.email), retainedKycProfiles: vendors.length,
        deletedAccounts: users.length - keep.length, emptiedTables: WIPE_TABLES.length,
        preservedPolicy: policies[0].version, auditProtectionUnchanged: true }));
      if (rehearse) throw rehearsalComplete;
    });
    console.log('COMMITTED: production/local handover database reset completed.');
  } catch (error) {
    if (error === rehearsalComplete) {
      console.log('REHEARSAL PASSED: all changes rolled back; no data permanently deleted.');
      return;
    }
    throw error;
  }
}

main().catch(error => {
  console.error('Reset failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
}).finally(() => sql.end());
