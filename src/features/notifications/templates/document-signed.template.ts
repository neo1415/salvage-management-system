/**
 * Document Signed Email Template
 * Sent when a vendor successfully signs a document
 */

import { getBaseEmailTemplate } from './base.template';

export interface DocumentSignedTemplateData {
  vendorName: string;
  documentTitle: string;
  signedAt: string;
  nextSteps: string;
  downloadUrl: string;
  pickupAuthCode?: string;
}

export function documentSignedTemplate(data: DocumentSignedTemplateData): string {
  const {
    vendorName,
    documentTitle,
    signedAt,
    nextSteps,
    downloadUrl,
    pickupAuthCode,
  } = data;

  const content = `
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="display: inline-block; background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); border-radius: 50%; padding: 20px; margin-bottom: 20px;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      </div>
      <h2 style="color: #4caf50; font-size: 28px; margin: 0;">Document Signed Successfully!</h2>
    </div>
    
    <p><strong>Dear ${vendorName},</strong></p>
    
    <p>Thank you for signing your <strong>${documentTitle}</strong>. Your digital signature has been recorded and the document is now legally binding.</p>
    
    <div style="background-color: #f9f9f9; border-left: 4px solid #4caf50; padding: 20px; margin: 25px 0; border-radius: 6px;">
      <h3 style="margin: 0 0 15px 0; color: #4caf50; font-size: 18px;">Signature Confirmed</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Document:</strong></td>
          <td style="padding: 8px 0; color: #333; font-size: 14px;">${documentTitle}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Signed At:</strong></td>
          <td style="padding: 8px 0; color: #333; font-size: 14px;">${signedAt}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Status:</strong></td>
          <td style="padding: 8px 0; color: #4caf50; font-size: 14px; font-weight: 600;">Legally Binding</td>
        </tr>
      </table>
    </div>
    
    ${pickupAuthCode ? `
    <div style="background-color: #e8f5e9; border: 3px solid #4caf50; border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center;">
      <h3 style="margin: 0 0 15px 0; color: #2e7d32; font-size: 20px;">Your Pickup Authorization Code</h3>
      <div style="background-color: white; border: 2px dashed #4caf50; border-radius: 8px; padding: 20px; margin: 15px 0;">
        <p style="margin: 0 0 10px 0; color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Authorization Code</p>
        <p style="margin: 0; color: #2e7d32; font-size: 32px; font-weight: 700; font-family: 'Courier New', monospace; letter-spacing: 3px;">
          ${pickupAuthCode}
        </p>
      </div>
      <p style="margin: 15px 0 0 0; color: #2e7d32; font-size: 14px;">
        Present this code at the pickup location. Keep it secure!
      </p>
    </div>
    ` : ''}
    
    <div class="divider"></div>
    
    <h3 style="color: #800020; font-size: 18px; margin: 25px 0 15px 0;">Next Steps</h3>
    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 6px;">
      <p style="margin: 0; color: #856404; font-size: 15px; line-height: 1.8;">
        ${nextSteps}
      </p>
    </div>
    
    <div style="text-align: center; margin: 35px 0;">
      <a href="${downloadUrl}" 
         style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #FFD700 0%, #FFC700 100%); color: #800020 !important; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        Download Signed Document
      </a>
    </div>
    
    <div style="background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; margin: 30px 0; border-radius: 6px;">
      <h4 style="margin: 0 0 10px 0; color: #1976d2; font-size: 16px;">Important Information</h4>
      <ul style="margin: 0; padding-left: 20px; color: #1565c0; font-size: 14px; line-height: 1.8;">
        <li>Your signed document is stored securely in our system</li>
        <li>You can download a copy anytime from your dashboard</li>
        <li>This document is legally binding and cannot be modified</li>
        <li>Keep a copy for your records</li>
      </ul>
    </div>
    
    <p style="margin-top: 30px;">If you have any questions or concerns, please contact our support team:</p>
    <ul style="color: #333; font-size: 15px; line-height: 1.8;">
      <li>Phone: <a href="tel:+2340201448956" style="color: #800020; text-decoration: none; font-weight: 600;">234-02-014489560</a></li>
      <li>Email: <a href="mailto:nemsupport@nem-insurance.com" style="color: #800020; text-decoration: none; font-weight: 600;">nemsupport@nem-insurance.com</a></li>
    </ul>
    
    <p style="margin-top: 30px;">Thank you for your business!<br><strong>NEM Insurance Team</strong></p>
  `;

  return getBaseEmailTemplate({
    title: 'Document Signed Successfully',
    preheader: `Your ${documentTitle} has been signed and is now legally binding`,
    content,
  });
}
