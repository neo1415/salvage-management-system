/**
 * Email Templates Index
 * Exports all email templates for easy import
 */

export { getBaseEmailTemplate } from './base.template';
export type { BaseTemplateProps } from './base.template';

export { getWelcomeEmailTemplate } from './welcome.template';
export type { WelcomeTemplateData } from './welcome.template';

export { getOTPEmailTemplate } from './otp.template';
export type { OTPTemplateData } from './otp.template';

export { getCaseApprovalEmailTemplate } from './case-approval.template';
export type { CaseApprovalTemplateData } from './case-approval.template';

export { getAuctionStartEmailTemplate } from './auction-start.template';
export type { AuctionStartTemplateData } from './auction-start.template';

export { getBidAlertEmailTemplate } from './bid-alert.template';
export type { BidAlertTemplateData } from './bid-alert.template';

export { getPaymentConfirmationEmailTemplate } from './payment-confirmation.template';
export type { PaymentConfirmationTemplateData } from './payment-confirmation.template';

export { documentReadyTemplate } from './document-ready.template';
export type { DocumentReadyTemplateData } from './document-ready.template';

export { documentSignedTemplate } from './document-signed.template';
export type { DocumentSignedTemplateData } from './document-signed.template';
