import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { emailService } from '@/features/notifications/services/email.service';
import { getAppUrl } from '@/features/notifications/templates/email-urls';

type NotifyManagerAuctionLiveInput = {
  auctionId: string;
  caseId: string;
  claimReference: string;
  assetType: string;
  endTime: Date;
};

/**
 * Email the salvage manager who approved the case when a scheduled auction goes live.
 */
export async function notifyApprovingManagerScheduledAuctionLive(
  input: NotifyManagerAuctionLiveInput
): Promise<{ sent: boolean; reason?: string }> {
  const [caseRow] = await db
    .select({
      approvedBy: salvageCases.approvedBy,
      locationName: salvageCases.locationName,
      reservePrice: salvageCases.reservePrice,
    })
    .from(salvageCases)
    .where(eq(salvageCases.id, input.caseId))
    .limit(1);

  if (!caseRow?.approvedBy) {
    return { sent: false, reason: 'no_approving_manager' };
  }

  const [manager] = await db
    .select({
      email: users.email,
      fullName: users.fullName,
    })
    .from(users)
    .where(eq(users.id, caseRow.approvedBy))
    .limit(1);

  if (!manager?.email) {
    return { sent: false, reason: 'manager_email_missing' };
  }

  const appUrl = getAppUrl();
  const result = await emailService.sendManagerScheduledAuctionLiveEmail(manager.email, {
    managerName: manager.fullName,
    claimReference: input.claimReference,
    assetType: input.assetType,
    auctionId: input.auctionId,
    reservePrice: parseFloat(caseRow.reservePrice ?? '0'),
    location: caseRow.locationName ?? '—',
    endTime: input.endTime.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
    managerAuctionUrl: `${appUrl}/bid-history/${input.auctionId}`,
    approvalsUrl: `${appUrl}/manager/approvals`,
    managerUserId: caseRow.approvedBy,
  });

  return { sent: result.success && !result.skipped, reason: result.skipped ? 'skipped' : undefined };
}
