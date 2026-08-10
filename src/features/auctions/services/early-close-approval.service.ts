import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { departments } from '@/lib/db/schema/departments';
import { users } from '@/lib/db/schema/users';
import { createNotification } from '@/features/notifications/services/notification.service';
import { emailService } from '@/features/notifications/services/email.service';
import { getEmailBranding } from '@/features/notifications/templates/email-branding';
import { wrapProfessionalEmail } from '@/features/notifications/templates/wrap-professional-email';
import { appPath } from '@/features/notifications/templates/email-urls';

type StaffRecipient = { id: string; email: string; fullName: string };

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character);
}

export async function getActiveManagingDirectors(): Promise<StaffRecipient[]> {
  return db.select({ id: users.id, email: users.email, fullName: users.fullName })
    .from(users)
    .innerJoin(departments, eq(users.departmentId, departments.id))
    .where(and(
      eq(departments.code, 'managing_director'),
      eq(departments.isActive, true),
      eq(users.role, 'system_admin'),
      ne(users.status, 'suspended'),
      ne(users.status, 'deleted')
    ));
}

export async function notifyManagingDirectorsOfEarlyClose(input: {
  recipients: StaffRecipient[];
  requestId: string;
  auctionId: string;
  claimReference: string;
  requesterName: string;
  reason: string;
}): Promise<void> {
  const branding = await getEmailBranding();
  const reviewUrl = appPath(`/auction-closure-requests/${input.requestId}`);
  const html = await wrapProfessionalEmail(
    'Auction closure approval required',
    `<p>An early auction closure request requires your decision.</p>
     <p><strong>Case:</strong> ${escapeHtml(input.claimReference)}<br>
     <strong>Requested by:</strong> ${escapeHtml(input.requesterName)}</p>
     <p><strong>Reason</strong></p><p>${escapeHtml(input.reason)}</p>
     <p><a href="${reviewUrl}" style="display:inline-block;padding:12px 20px;background:${branding.primaryColor};color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Review request</a></p>`,
    `Early closure approval requested for ${input.claimReference}`
  );

  await Promise.allSettled(input.recipients.flatMap((recipient) => [
    createNotification({
      userId: recipient.id,
      type: 'system_alert',
      title: 'Auction closure approval required',
      message: `${input.requesterName} requested early closure for ${input.claimReference}.`,
      data: { auctionId: input.auctionId, requestId: input.requestId, url: `/auction-closure-requests/${input.requestId}` },
    }),
    emailService.sendEmail({
      to: recipient.email,
      userId: recipient.id,
      category: 'system',
      subject: `Approval required: early auction closure for ${input.claimReference}`,
      html,
    }),
  ]));
}

export async function notifyEarlyCloseRequester(input: {
  requester: StaffRecipient;
  auctionId: string;
  claimReference: string;
  approved: boolean;
  reviewNote?: string | null;
}): Promise<void> {
  const branding = await getEmailBranding();
  const outcome = input.approved ? 'approved and the auction has closed' : 'rejected';
  const note = input.reviewNote ? `<p><strong>Decision note:</strong> ${escapeHtml(input.reviewNote)}</p>` : '';
  const html = await wrapProfessionalEmail(
    `Early closure request ${input.approved ? 'approved' : 'rejected'}`,
    `<p>Your early closure request for <strong>${escapeHtml(input.claimReference)}</strong> was ${outcome}.</p>${note}
     <p><a href="${appPath('/bid-history')}" style="display:inline-block;padding:12px 20px;background:${branding.primaryColor};color:#fff;text-decoration:none;border-radius:6px;font-weight:600">View auction history</a></p>`
  );

  await Promise.allSettled([
    createNotification({
      userId: input.requester.id,
      type: 'system_alert',
      title: `Early closure request ${input.approved ? 'approved' : 'rejected'}`,
      message: `The request for ${input.claimReference} was ${outcome}.`,
      data: { auctionId: input.auctionId, url: '/bid-history' },
    }),
    emailService.sendEmail({
      to: input.requester.email,
      userId: input.requester.id,
      category: 'system',
      subject: `Early closure request ${input.approved ? 'approved' : 'rejected'}: ${input.claimReference}`,
      html,
    }),
  ]);
}
