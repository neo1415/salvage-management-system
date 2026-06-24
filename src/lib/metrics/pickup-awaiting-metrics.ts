import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { caseScopeConditions, pickupQueueScopeConditions, type ManagerDashboardFilters } from '@/lib/metrics/manager-dashboard-filters';

/**
 * Count paid auctions ready for staff pickup confirmation.
 * Criteria aligned with GET /api/admin/pickups (verified payment + pickup auth for winner + not admin-confirmed).
 */
export async function countAwaitingPickupConfirmations(
  filters: ManagerDashboardFilters
): Promise<number> {
  const caseScopeSql = pickupQueueScopeConditions('sc', filters);
  const [row] = (await db.execute(sql`
    SELECT COUNT(DISTINCT a.id)::int AS awaiting_pickup
    FROM auctions a
    INNER JOIN salvage_cases sc ON sc.id = a.case_id
    INNER JOIN payments p ON p.auction_id = a.id
      AND p.status = 'verified'
      AND p.vendor_id = a.current_bidder
    INNER JOIN release_forms pa ON pa.auction_id = a.id
      AND pa.vendor_id = a.current_bidder
      AND pa.document_type = 'pickup_authorization'
      AND COALESCE(pa.disabled, false) = false
      AND pa.status != 'voided'
    WHERE COALESCE(a.pickup_confirmed_admin, false) = false
      AND sc.status != 'draft'
      AND sc.claim_reference NOT LIKE 'TEST%'
      AND ${caseScopeSql}
  `)) as Array<Record<string, unknown>>;

  const parsed = Number(row?.awaiting_pickup ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
