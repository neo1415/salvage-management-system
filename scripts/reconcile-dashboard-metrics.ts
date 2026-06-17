import 'dotenv/config';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
});

async function main() {
  const [summary] = await sql`
    WITH verified_winner_payments AS (
      SELECT DISTINCT ON (p.auction_id)
        p.id,
        p.auction_id,
        p.vendor_id,
        p.amount,
        p.verified_at,
        p.created_at
      FROM payments p
      INNER JOIN auctions a ON a.id = p.auction_id
      WHERE p.status = 'verified'
        AND p.auction_id IS NOT NULL
        AND p.vendor_id = a.current_bidder
      ORDER BY p.auction_id, p.verified_at DESC NULLS LAST, p.created_at DESC
    ),
    paid_awaiting_pickup AS (
      SELECT DISTINCT a.id
      FROM auctions a
      INNER JOIN verified_winner_payments p ON p.auction_id = a.id
      WHERE COALESCE(a.pickup_confirmed_admin, false) = false
    ),
    payment_scope_30d_case_created AS (
      SELECT p.*
      FROM payments p
      INNER JOIN auctions a ON a.id = p.auction_id
      INNER JOIN salvage_cases sc ON sc.id = a.case_id
      WHERE p.status = 'verified'
        AND p.vendor_id = a.current_bidder
        AND sc.created_at >= NOW() - INTERVAL '30 days'
    )
    SELECT
      (SELECT COUNT(*)::int FROM payments) AS all_payments_count,
      (SELECT COUNT(*)::int FROM payments WHERE status = 'verified') AS verified_payment_count,
      (SELECT COALESCE(SUM(amount::numeric), 0)::numeric FROM payments WHERE status = 'verified') AS verified_payment_sum,
      (SELECT COUNT(*)::int FROM payments WHERE status = 'verified' AND auction_id IS NULL) AS verified_non_auction_count,
      (SELECT COALESCE(SUM(amount::numeric), 0)::numeric FROM payments WHERE status = 'verified' AND auction_id IS NULL) AS verified_non_auction_sum,
      (SELECT COUNT(*)::int FROM verified_winner_payments) AS winner_payment_count,
      (SELECT COALESCE(SUM(amount::numeric), 0)::numeric FROM verified_winner_payments) AS winner_payment_sum,
      (SELECT COUNT(*)::int FROM paid_awaiting_pickup) AS paid_awaiting_pickup_count,
      (SELECT COALESCE(SUM(market_value::numeric), 0)::numeric FROM salvage_cases) AS control_tower_claims_value,
      (SELECT COALESCE(SUM(COALESCE(reserve_price::numeric, estimated_salvage_value::numeric, 0)), 0)::numeric FROM salvage_cases) AS control_tower_expected_recovery,
      (SELECT COUNT(DISTINCT auction_id)::int FROM payment_scope_30d_case_created) AS manager_30d_case_winner_count,
      (SELECT COALESCE(SUM(amount::numeric), 0)::numeric FROM payment_scope_30d_case_created) AS manager_30d_case_winner_sum
  `;

  const adjusters = await sql`
    SELECT id, email, full_name
    FROM users
    WHERE role = 'claims_adjuster'
    ORDER BY created_at ASC
  `;

  const adjusterBreakdown = [];
  for (const adjuster of adjusters) {
    const [row] = await sql`
      WITH case_scope AS (
        SELECT id
        FROM salvage_cases
        WHERE created_by = ${adjuster.id}
      ),
      all_verified_case_payments AS (
        SELECT p.id, p.auction_id, p.vendor_id, p.amount
        FROM payments p
        INNER JOIN auctions a ON a.id = p.auction_id
        INNER JOIN case_scope cs ON cs.id = a.case_id
        WHERE p.status = 'verified'
      ),
      verified_winner_payments AS (
        SELECT DISTINCT ON (p.auction_id)
          p.id,
          p.auction_id,
          p.vendor_id,
          p.amount,
          p.verified_at,
          p.created_at
        FROM payments p
        INNER JOIN auctions a ON a.id = p.auction_id
        INNER JOIN case_scope cs ON cs.id = a.case_id
        WHERE p.status = 'verified'
          AND p.vendor_id = a.current_bidder
        ORDER BY p.auction_id, p.verified_at DESC NULLS LAST, p.created_at DESC
      )
      SELECT
        (SELECT COUNT(*)::int FROM case_scope) AS case_count,
        (SELECT COUNT(*)::int FROM all_verified_case_payments) AS all_verified_case_payment_count,
        (SELECT COALESCE(SUM(amount::numeric), 0)::numeric FROM all_verified_case_payments) AS all_verified_case_payment_sum,
        (SELECT COUNT(*)::int FROM verified_winner_payments) AS winner_payment_count,
        (SELECT COALESCE(SUM(amount::numeric), 0)::numeric FROM verified_winner_payments) AS winner_payment_sum
    `;

    adjusterBreakdown.push({
      id: adjuster.id,
      email: adjuster.email,
      fullName: adjuster.full_name,
      ...row,
    });
  }

  const duplicateOrNonWinnerPayments = await sql`
    WITH ranked_verified AS (
      SELECT
        p.id,
        p.auction_id,
        p.vendor_id,
        p.amount,
        p.payment_method,
        p.escrow_status,
        p.payment_reference,
        p.created_at,
        p.verified_at,
        a.current_bidder,
        ROW_NUMBER() OVER (
          PARTITION BY p.auction_id
          ORDER BY p.verified_at DESC NULLS LAST, p.created_at DESC
        ) AS payment_rank
      FROM payments p
      INNER JOIN auctions a ON a.id = p.auction_id
      WHERE p.status = 'verified'
        AND p.auction_id IS NOT NULL
    )
    SELECT
      id,
      auction_id,
      vendor_id,
      current_bidder,
      amount,
      payment_method,
      escrow_status,
      payment_reference,
      created_at,
      verified_at,
      payment_rank,
      vendor_id = current_bidder AS is_current_winner
    FROM ranked_verified
    WHERE vendor_id IS DISTINCT FROM current_bidder
       OR payment_rank > 1
    ORDER BY created_at DESC
    LIMIT 25
  `;

  console.log(JSON.stringify(
    {
      summary,
      adjusterBreakdown,
      duplicateOrNonWinnerPayments,
    },
    null,
    2,
  ));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
