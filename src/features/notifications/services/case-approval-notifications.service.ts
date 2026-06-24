/**
 * Side effects for case approval/rejection (SMS, email, in-app).
 * Intended to run after the HTTP response via Next.js after().
 */

import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq, and, arrayContains } from 'drizzle-orm';
import { smsService } from '@/features/notifications/services/sms.service';
import { emailService } from '@/features/notifications/services/email.service';
import {
  createNotification,
  createRoleNotifications,
} from '@/features/notifications/services/notification.service';
import { isTestOrPlaceholderEmail } from '@/lib/utils/notification-recipients';
import { formatAssetName } from '@/lib/utils/asset-name';

export interface VendorOutreachContext {
  auctionId: string;
  assetType: string;
  assetDetails?: Record<string, unknown> | null;
  claimReference: string;
  reservePrice: string;
  locationName: string | null;
  endTime: Date;
  appUrl: string;
}

const SUPPORTED_VENDOR_CATEGORIES = [
  'vehicle',
  'property',
  'electronics',
  'machinery',
  'appliance',
  'furniture',
  'jewelry',
  'stock',
  'goods_in_transit',
  'building_materials',
  'scrap',
  'agriculture',
  'medical_equipment',
  'energy_equipment',
  'aviation_equipment',
  'other',
] as const;
type VendorCategory = typeof SUPPORTED_VENDOR_CATEGORIES[number];

function isVendorCategory(value: string): value is VendorCategory {
  return (SUPPORTED_VENDOR_CATEGORIES as readonly string[]).includes(value);
}

export async function notifyMatchingVendorsOfNewAuction(
  context: VendorOutreachContext
): Promise<number> {
  if (!isVendorCategory(context.assetType)) {
    console.warn(`[CaseApproval] Unsupported asset type for vendor outreach: ${context.assetType}`);
    return 0;
  }

  const matchingVendors = await db
    .select({
      vendorId: vendors.id,
      phone: users.phone,
      email: users.email,
      fullName: users.fullName,
    })
    .from(vendors)
    .innerJoin(users, eq(vendors.userId, users.id))
    .where(
      and(
        eq(vendors.status, 'approved'),
        arrayContains(vendors.categories, [context.assetType])
      )
    );

  const realVendors = matchingVendors.filter((vendor) => {
    if (isTestOrPlaceholderEmail(vendor.email)) {
      console.log(`[CaseApproval] Skipping test vendor: ${vendor.email}`);
      return false;
    }
    return true;
  });

  console.log(
    `[CaseApproval] Notifying ${realVendors.length} vendors (${matchingVendors.length - realVendors.length} test skipped)`
  );

  const startLabel = new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' });
  const endLabel = context.endTime.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' });

  const assetName = formatAssetName(
    context.assetType,
    context.assetDetails,
    context.claimReference
  );

  await Promise.allSettled(
    realVendors.map(async (vendor) => {
      const smsMessage = `New auction: ${assetName}. Reserve: ₦${context.reservePrice}. Ends in 5 days. Bid: ${context.appUrl}/vendor/auctions/${context.auctionId}`;

      try {
        await smsService.sendSMS({ to: vendor.phone, message: smsMessage });
      } catch (error) {
        console.error(`[CaseApproval] SMS failed for vendor ${vendor.vendorId}:`, error);
      }

      try {
        await emailService.sendAuctionStartEmail(vendor.email, {
          vendorName: vendor.fullName ?? 'Vendor',
          auctionId: context.auctionId,
          assetType: context.assetType,
          assetName,
          reservePrice: parseFloat(context.reservePrice),
          startTime: startLabel,
          endTime: endLabel,
          location: context.locationName ?? 'Configured pickup location',
          appUrl: context.appUrl,
        });
      } catch (error) {
        console.error(`[CaseApproval] Email failed for vendor ${vendor.vendorId}:`, error);
      }
    })
  );

  return realVendors.length;
}

export interface AdjusterApprovalNotificationContext {
  creatorId: string;
  creatorPhone: string;
  creatorEmail: string;
  creatorName: string;
  caseId: string;
  claimReference: string;
  assetType: string;
  auctionId: string;
  managerName: string;
  appUrl: string;
  scheduleMode: 'now' | 'scheduled';
  comment?: string;
  hasOverrides: boolean;
  priceAdjustments?: Record<string, { original: number; adjusted: number }>;
}

export async function notifyAdjusterOfCaseApproval(
  ctx: AdjusterApprovalNotificationContext
): Promise<void> {
  const smsMessage = ctx.hasOverrides
    ? `Your case ${ctx.claimReference} was approved with price adjustments by ${ctx.managerName}. Check your email for details.`
    : `Your case ${ctx.claimReference} was approved by ${ctx.managerName}. Auction is now live!`;

  try {
    await smsService.sendSMS({ to: ctx.creatorPhone, message: smsMessage });
  } catch (error) {
    console.error(`[CaseApproval] Adjuster SMS failed:`, error);
  }

  try {
    await createNotification({
      userId: ctx.creatorId,
      type: 'case_approved',
      title: 'Case Approved',
      message: `Case ${ctx.claimReference} was approved and ${ctx.scheduleMode === 'scheduled' ? 'scheduled for auction' : 'auction is live'}.`,
      data: {
        caseId: ctx.caseId,
        auctionId: ctx.auctionId,
        url: `/adjuster/cases/${ctx.caseId}`,
      },
    });

    await emailService.sendCaseApprovalEmail(ctx.creatorEmail, {
      adjusterName: ctx.creatorName,
      caseId: ctx.caseId,
      claimReference: ctx.claimReference,
      assetType: ctx.assetType,
      status: 'approved',
      comment: ctx.comment,
      managerName: ctx.managerName,
      appUrl: ctx.appUrl,
      priceAdjustments: ctx.priceAdjustments,
    });
  } catch (error) {
    console.error(`[CaseApproval] Adjuster email/in-app failed:`, error);
  }
}

export async function notifyStaffOfCaseApproval(params: {
  claimReference: string;
  caseId: string;
  auctionId: string;
  scheduleMode: 'now' | 'scheduled';
}): Promise<void> {
  try {
    await createRoleNotifications(
      ['salvage_manager', 'system_admin'],
      {
        type: 'auction_approved',
        title: params.scheduleMode === 'scheduled' ? 'Auction Scheduled' : 'Auction Approved',
        message: `Case ${params.claimReference} has been approved for auction.`,
        data: {
          caseId: params.caseId,
          auctionId: params.auctionId,
          url: '/manager/approvals',
        },
      },
      { excludeTestRecipients: true }
    );
  } catch (error) {
    console.error('[CaseApproval] Staff notifications failed:', error);
  }
}

export async function notifyAdjusterOfCaseRejection(params: {
  creatorId: string;
  creatorPhone: string;
  creatorEmail: string;
  creatorName: string;
  caseId: string;
  claimReference: string;
  assetType: string;
  comment: string;
  managerName: string;
  appUrl: string;
}): Promise<void> {
  const smsMessage = `Your case ${params.claimReference} was rejected. Reason: ${params.comment}. Please review and resubmit.`;

  try {
    await smsService.sendSMS({ to: params.creatorPhone, message: smsMessage });
  } catch (error) {
    console.error('[CaseRejection] Adjuster SMS failed:', error);
  }

  try {
    await createNotification({
      userId: params.creatorId,
      type: 'case_rejected',
      title: 'Case Returned',
      message: `Case ${params.claimReference} was returned for review. Reason: ${params.comment}`,
      data: {
        caseId: params.caseId,
        url: `/adjuster/cases/${params.caseId}`,
      },
    });

    await emailService.sendCaseApprovalEmail(params.creatorEmail, {
      adjusterName: params.creatorName,
      caseId: params.caseId,
      claimReference: params.claimReference,
      assetType: params.assetType,
      status: 'rejected',
      comment: params.comment,
      managerName: params.managerName,
      appUrl: params.appUrl,
    });
  } catch (error) {
    console.error('[CaseRejection] Adjuster email/in-app failed:', error);
  }
}
