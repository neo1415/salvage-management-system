import { and, inArray, notInArray } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { emailService } from '@/features/notifications/services/email.service';
import { createRoleNotifications } from '@/features/notifications/services/notification.service';
import { getEmailBranding } from '@/features/notifications/templates/email-branding';
import { appPath } from '@/features/notifications/templates/email-urls';
import { wrapProfessionalEmail } from '@/features/notifications/templates/wrap-professional-email';
import { escapeHtml } from '@/lib/security/html';
import { isTestOrPlaceholderEmail } from '@/lib/utils/notification-recipients';
import type { PickupContext } from './pickup-confirmation.service';

const STAFF_ROLES = ['salvage_manager'] as const;

async function activePickupStaff() {
  return db
    .select({ id: users.id, email: users.email, fullName: users.fullName, role: users.role })
    .from(users)
    .where(
      and(
        inArray(users.role, [...STAFF_ROLES]),
        notInArray(users.status, ['suspended', 'deleted'])
      )
    );
}

function emailButton(label: string, url: string, primaryColor: string) {
  return `<a href="${url}" style="display:inline-block;padding:12px 20px;background:${primaryColor};color:#ffffff;text-decoration:none;border-radius:6px;font-weight:700;">${label}</a>`;
}

export async function notifyStaffPickupEvidenceSubmitted(input: {
  auctionId: string;
  caseId: string;
  pickupEvidenceId: string;
  claimReference: string;
  assetName: string;
  vendorName: string;
}) {
  const [branding, allStaff] = await Promise.all([getEmailBranding(), activePickupStaff()]);
  const staff = allStaff.filter((recipient) => !isTestOrPlaceholderEmail(recipient.email));

  await Promise.allSettled([
    createRoleNotifications(['salvage_manager'], {
      type: 'system_alert',
      title: 'Pickup evidence submitted',
      message: `${input.vendorName} submitted pickup evidence for ${input.claimReference}. Comparison is in progress.`,
      data: {
        auctionId: input.auctionId,
        caseId: input.caseId,
        pickupEvidenceId: input.pickupEvidenceId,
        pickupEvidenceStatus: 'not_reviewed',
        url: '/manager/pickups',
      },
    }, { excludeTestRecipients: true }),
    createRoleNotifications(['system_admin'], {
      type: 'system_alert',
      title: 'Pickup evidence submitted',
      message: `${input.vendorName} submitted pickup evidence for ${input.claimReference}. Comparison is in progress.`,
      data: {
        auctionId: input.auctionId,
        caseId: input.caseId,
        pickupEvidenceId: input.pickupEvidenceId,
        pickupEvidenceStatus: 'not_reviewed',
        url: '/admin/pickups',
      },
    }, { excludeTestRecipients: true }),
    ...staff.map(async (recipient) => {
      const reviewUrl = appPath('/manager/pickups');
      return emailService.sendEmail({
        to: recipient.email,
        userId: recipient.id,
        category: 'notification',
        subject: `Pickup evidence submitted - ${input.claimReference}`,
        html: await wrapProfessionalEmail(
          'Pickup evidence submitted',
          `<p>Hello ${escapeHtml(recipient.fullName)},</p>
           <p>${escapeHtml(input.vendorName)} submitted pickup evidence for <strong>${escapeHtml(input.claimReference)}</strong>.</p>
           <p><strong>Asset:</strong> ${escapeHtml(input.assetName)}</p>
           <p>The automated comparison is running. Review the evidence before confirming release.</p>
           <p>${emailButton('Review pickup evidence', reviewUrl, branding.primaryColor)}</p>`,
          `Pickup evidence received for ${input.claimReference}`
        ),
      });
    }),
  ]);
}

export async function notifyStaffPickupComparisonResult(input: {
  auctionId: string;
  caseId: string;
  vendorId: string;
  pickupEvidenceId: string;
  claimReference: string;
  status: 'review_needed' | 'material_discrepancy';
  comparisonUnavailable?: boolean;
}) {
  const title = input.comparisonUnavailable
    ? 'Pickup evidence needs manual review'
    : input.status === 'material_discrepancy'
      ? 'Pickup discrepancy detected'
      : 'Pickup evidence needs review';
  const message = input.comparisonUnavailable
    ? `Automated comparison was unavailable for ${input.claimReference}. The submitted evidence is safely stored.`
    : `${input.claimReference} requires staff review after evidence comparison.`;
  const commonData = {
    auctionId: input.auctionId,
    caseId: input.caseId,
    vendorId: input.vendorId,
    pickupEvidenceId: input.pickupEvidenceId,
    pickupEvidenceStatus: input.status,
  };

  await Promise.allSettled([
    createRoleNotifications(['salvage_manager'], {
      type: 'system_alert',
      title,
      message,
      data: { ...commonData, url: '/manager/pickups' },
    }, { excludeTestRecipients: true }),
    createRoleNotifications(['system_admin'], {
      type: 'system_alert',
      title,
      message,
      data: { ...commonData, url: '/admin/pickups' },
    }, { excludeTestRecipients: true }),
  ]);
}

export async function notifyStaffPickupCompleted(context: PickupContext, confirmedAt: Date) {
  const evidencePath = `/api/cases/${context.caseId}/evidence/export/pdf`;
  const evidenceUrl = appPath(evidencePath);
  const [branding, allStaff] = await Promise.all([getEmailBranding(), activePickupStaff()]);
  const staff = allStaff.filter((recipient) => !isTestOrPlaceholderEmail(recipient.email));
  const completedAt = confirmedAt.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' });

  await Promise.allSettled([
    createRoleNotifications(['salvage_manager'], {
      type: 'system_alert',
      title: 'Pickup completed',
      message: `${context.claimReference} is complete. The case evidence file is ready.`,
      data: {
        auctionId: context.auctionId,
        caseId: context.caseId,
        pickupEvidenceStatus: 'completed',
        url: `/manager/cases/${context.caseId}`,
      },
    }, { excludeTestRecipients: true }),
    createRoleNotifications(['system_admin'], {
      type: 'system_alert',
      title: 'Pickup completed',
      message: `${context.claimReference} is complete. The case evidence file is ready.`,
      data: {
        auctionId: context.auctionId,
        caseId: context.caseId,
        pickupEvidenceStatus: 'completed',
        url: '/admin/pickups',
      },
    }, { excludeTestRecipients: true }),
    ...staff.map(async (recipient) => emailService.sendEmail({
      to: recipient.email,
      userId: recipient.id,
      category: 'notification',
      subject: `Pickup completed - ${context.claimReference}`,
      html: await wrapProfessionalEmail(
        'Pickup completed',
        `<p>Hello ${escapeHtml(recipient.fullName)},</p>
         <p>Pickup for <strong>${escapeHtml(context.claimReference)}</strong> was confirmed on ${escapeHtml(completedAt)}.</p>
         <p><strong>Asset:</strong> ${escapeHtml(context.assetName)}<br><strong>Vendor:</strong> ${escapeHtml(context.vendorName)}</p>
         <p>The recovery case is complete and its evidence file is available below.</p>
         <p>${emailButton('Download case evidence', evidenceUrl, branding.primaryColor)}</p>`,
        `Pickup completed for ${context.claimReference}`
      ),
    })),
  ]);
}

export async function sendVendorPickupCompletedEmail(context: PickupContext, confirmedAt: Date) {
  if (!context.vendorEmail) return;

  const branding = await getEmailBranding();
  const auctionUrl = appPath(`/vendor/auctions/${context.auctionId}`);
  const receiptUrl = context.paymentId ? appPath(`/receipt/${context.paymentId}`) : null;
  const completedAt = confirmedAt.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' });
  const collectedAmount = Number(context.collectedAmount || 0);
  const settledAmount = Number(context.saleAmount || 0);
  const hasSettlementAdjustment =
    collectedAmount > 0
    && settledAmount > 0
    && Math.abs(collectedAmount - settledAmount) >= 0.01;
  const settlementDetails = hasSettlementAdjustment
    ? `<div style="background:#fff7ed;border-left:4px solid #f59e0b;padding:16px;margin:20px 0;">
         <p style="margin:0 0 8px 0;"><strong>Final settlement updated</strong></p>
         <p style="margin:4px 0;">Amount collected: <strong>NGN ${collectedAmount.toLocaleString('en-NG')}</strong></p>
         <p style="margin:4px 0;">Final settled sale amount: <strong>NGN ${settledAmount.toLocaleString('en-NG')}</strong></p>
         <p style="margin:8px 0 0 0;">Your revised receipt now reflects this settlement and any outstanding balance or credit.</p>
       </div>`
    : '';
  const receiptButton = receiptUrl
    ? `${emailButton(hasSettlementAdjustment ? 'View revised receipt' : 'View receipt', receiptUrl, branding.primaryColor)} `
    : '';

  await emailService.sendEmail({
    to: context.vendorEmail,
    userId: context.vendorUserId,
    category: 'notification',
    subject: hasSettlementAdjustment
      ? 'Pickup confirmed - revised settlement receipt'
      : 'Pickup confirmed - transaction complete',
    html: await wrapProfessionalEmail(
      'Pickup confirmed',
      `<p>Hello ${escapeHtml(context.vendorName)},</p>
       <p>Your pickup of <strong>${escapeHtml(context.assetName)}</strong> was confirmed on ${escapeHtml(completedAt)}.</p>
       ${settlementDetails}
       <p>${hasSettlementAdjustment ? 'The physical handoff is complete. Review the revised receipt for the settlement position.' : 'The transaction is complete.'} Thank you for doing business with ${escapeHtml(branding.brandName)}.</p>
       <p>${receiptButton}${emailButton('View auction details', auctionUrl, branding.primaryColor)}</p>`,
      `Pickup confirmed for ${context.assetName}`
    ),
  });
}
