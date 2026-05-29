/**
 * Document Ready Email Template
 * Sent when a document is generated and ready for download/signature
 */

import { getPolicyAwareBaseEmailTemplate } from './base.template';
import { brandTeamName, getEmailBranding, getSupportEmail, getSupportPhone } from './email-branding';

export interface DocumentReadyTemplateData {
  vendorName: string;
  documentType: string;
  documentTitle: string;
  auctionId: string;
  assetDescription: string;
  downloadUrl: string;
  expiresAt?: string;
}

export async function documentReadyTemplate(data: DocumentReadyTemplateData): Promise<string> {
  const {
    vendorName,
    documentType,
    documentTitle,
    assetDescription,
    downloadUrl,
    expiresAt,
  } = data;

  const branding = await getEmailBranding();
  const supportEmail = getSupportEmail(branding);
  const supportPhone = getSupportPhone(branding);

  const content = `
    <p><strong>Dear ${vendorName},</strong></p>
    
    <p>Your <strong>${documentTitle}</strong> is now ready for review and signature.</p>
    
    <div style="background-color: #f9f9f9; border-left: 4px solid ${branding.primaryColor}; padding: 20px; margin: 25px 0; border-radius: 6px;">
      <h3 style="margin: 0 0 15px 0; color: ${branding.primaryColor}; font-size: 18px;">Document Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Document Type:</strong></td>
          <td style="padding: 8px 0; color: #333; font-size: 14px;">${documentType}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Asset:</strong></td>
          <td style="padding: 8px 0; color: #333; font-size: 14px;">${assetDescription}</td>
        </tr>
        ${expiresAt ? `
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Expires:</strong></td>
          <td style="padding: 8px 0; color: #d32f2f; font-size: 14px; font-weight: 600;">${expiresAt}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    ${documentType.toLowerCase().includes('waiver') || documentType.toLowerCase().includes('liability') ? `
    <div style="background-color: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 20px; margin: 25px 0;">
      <h3 style="margin: 0 0 10px 0; color: #856404; font-size: 16px;">Action Required</h3>
      <p style="margin: 0; color: #856404; font-size: 14px;">
        This document requires your digital signature before you can proceed with payment. 
        Please review the terms carefully and sign electronically.
      </p>
    </div>
    ` : ''}
    
    <div style="text-align: center; margin: 35px 0;">
      <a href="${downloadUrl}" 
         style="display: inline-block; padding: 16px 40px; background: ${branding.primaryColor}; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        View & Sign Document
      </a>
    </div>
    
    <div class="divider"></div>
    
    <h3 style="color: ${branding.primaryColor}; font-size: 18px; margin: 25px 0 15px 0;">Next Steps</h3>
    <ol style="color: #333; font-size: 15px; line-height: 1.8; padding-left: 20px;">
      <li>Click the button above to view the document</li>
      <li>Read all terms and conditions carefully</li>
      <li>Scroll to the bottom of the document</li>
      <li>Sign electronically using your mouse or touchscreen</li>
      <li>Submit your signature to complete the process</li>
    </ol>
    
    ${expiresAt ? `
    <div style="background-color: #ffebee; border-left: 4px solid #d32f2f; padding: 15px; margin: 25px 0; border-radius: 6px;">
      <p style="margin: 0; color: #c62828; font-size: 14px; font-weight: 600;">
        This document expires on ${expiresAt}. Please sign before the deadline.
      </p>
    </div>
    ` : ''}
    
    <p style="margin-top: 30px;">If you have any questions or need assistance, please contact our support team:</p>
    <ul style="color: #333; font-size: 15px; line-height: 1.8;">
      <li>Phone: <a href="tel:${supportPhone}" style="color: ${branding.primaryColor}; text-decoration: none; font-weight: 600;">${supportPhone}</a></li>
      <li>Email: <a href="mailto:${supportEmail}" style="color: ${branding.primaryColor}; text-decoration: none; font-weight: 600;">${supportEmail}</a></li>
    </ul>
    
    <p style="margin-top: 30px;">Best regards,<br><strong>${brandTeamName(branding)}</strong></p>
  `;

  return getPolicyAwareBaseEmailTemplate({
    title: `Your ${documentTitle} is Ready`,
    preheader: `Review and sign your ${documentType} for ${assetDescription}`,
    content,
  });
}
