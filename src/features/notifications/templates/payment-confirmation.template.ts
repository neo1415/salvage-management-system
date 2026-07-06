/**
 * Payment Confirmation Email Template
 * Used for notifying vendors when their payment is confirmed and pickup authorization is issued
 */

import { getPolicyAwareBaseEmailTemplate } from './base.template';
import { brandTeamName, getEmailBranding } from './email-branding';
import { appPath, getVendorDocumentsUrl, getVendorPickupsUrl } from './email-urls';

export interface PaymentConfirmationTemplateData {
  vendorName: string;
  auctionId: string;
  paymentId: string;
  assetName: string;
  paymentAmount: number;
  paymentMethod: string;
  paymentReference: string;
  pickupAuthCode: string;
  pickupLocation: string;
  pickupDeadline: string;
  appUrl: string;
}

export async function getPaymentConfirmationEmailTemplate(data: PaymentConfirmationTemplateData): Promise<string> {
  const { vendorName, auctionId, assetName, paymentAmount, paymentMethod, pickupAuthCode, pickupLocation, pickupDeadline } = data;
  const documentsUrl = getVendorDocumentsUrl(auctionId);
  const pickupsUrl = getVendorPickupsUrl();
  const receiptUrl = appPath(`/receipt/${data.paymentId}`);
  const branding = await getEmailBranding();
  
  const content = `
    <p><strong>Dear ${vendorName},</strong></p>
    
    <div style="background-color: #d4edda; border: 2px solid #28a745; color: #155724; padding: 25px; text-align: center; border-radius: 8px; margin: 25px 0;">
      <h2 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 700; color: #28a745;">Payment Successful</h2>
      <p style="margin: 5px 0; font-size: 16px;">Your payment has been verified and confirmed.</p>
    </div>
    
    <p>Congratulations! Your payment for <strong>${assetName}</strong> has been successfully processed. You can now proceed to collect your salvage item.</p>
    
    <div style="background: ${branding.primaryColor}; color: #ffffff; padding: 35px; text-align: center; border-radius: 8px; margin: 30px 0; box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);">
      <div style="font-size: 14px; font-weight: 600; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Pickup Authorization Code</div>
      <div style="font-size: 48px; font-weight: 700; letter-spacing: 8px; margin: 15px 0; font-family: 'Courier New', monospace; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">${pickupAuthCode}</div>
      <div style="font-size: 13px; margin-top: 12px; opacity: 0.9;">Present this code at the pickup location</div>
    </div>
    
    <div style="background-color: #f9f9f9; padding: 25px; border-radius: 8px; margin: 25px 0;">
      <h3 style="margin: 0 0 15px 0; color: ${branding.primaryColor}; font-size: 18px;">Payment Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600; color: ${branding.primaryColor}; width: 40%;">Amount Paid:</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0;"><strong style="font-size: 18px; color: #28a745;">₦${paymentAmount.toLocaleString()}</strong></td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600; color: ${branding.primaryColor};">Payment Method:</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0;">${paymentMethod}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; font-weight: 600; color: ${branding.primaryColor};">Item:</td>
          <td style="padding: 12px 0;">${assetName}</td>
        </tr>
      </table>
    </div>
    
    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 25px 0; border-radius: 4px;">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #856404;">Pickup Instructions:</h3>
      <ul style="margin: 10px 0; padding-left: 20px; color: #333;">
        <li style="margin: 10px 0;"><strong>Location:</strong> ${pickupLocation}</li>
        <li style="margin: 10px 0;"><strong>Deadline:</strong> <span style="color: #dc3545; font-weight: 600;">${pickupDeadline}</span></li>
        <li style="margin: 10px 0;"><strong>Required:</strong> Valid ID, Pickup Authorization Code (above), and payment receipt</li>
        <li style="margin: 10px 0;"><strong>Contact:</strong> Call ahead to schedule your pickup time</li>
      </ul>
    </div>

    <div style="background-color: #eef4ff; border-left: 4px solid ${branding.primaryColor}; padding: 20px; margin: 25px 0; border-radius: 4px;">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; color: ${branding.primaryColor};">Record your pickup</h3>
      <p style="margin: 0 0 10px 0;">At the pickup location, open the Pickups page and submit clear photos from different angles.</p>
      <p style="margin: 0;">If the item, quantity, or condition differs from the auction record, describe it in the notes before submitting. Staff will review the evidence and confirm release.</p>
    </div>
    
    <div style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px 20px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; color: #721c24;"><strong>Important:</strong> You must collect the item by <strong>${pickupDeadline}</strong>. Failure to collect within the deadline may result in forfeiture without refund.</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${pickupsUrl}" class="button" style="display: inline-block; padding: 16px 32px; background: ${branding.primaryColor}; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 18px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); margin: 0 6px 12px;">Open Pickups</a>
      <a href="${receiptUrl}" class="button" style="display:inline-block;padding:16px 32px;background:#166534;color:#ffffff !important;text-decoration:none;border-radius:8px;font-weight:700;font-size:18px;margin:0 6px 12px;">View or Download Receipt</a>
      <a href="${documentsUrl}" class="button" style="display: inline-block; padding: 16px 32px; background: ${branding.primaryColor}; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 18px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">View Documents and Receipt</a>
    </div>
    
    <div style="height: 1px; background: linear-gradient(to right, transparent, #e0e0e0, transparent); margin: 30px 0;"></div>
    
    <p style="margin-top: 25px;">Thank you for using ${branding.brandName}.</p>
    <p><strong style="color: ${branding.primaryColor};">${brandTeamName(branding)}</strong></p>
  `;
  
  return getPolicyAwareBaseEmailTemplate({
    title: 'Payment Confirmed - Pickup Authorization',
    preheader: `Payment confirmed for ${assetName}. Your pickup code: ${pickupAuthCode}`,
    content
  });
}
