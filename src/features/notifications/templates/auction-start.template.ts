/**
 * Vendor notification for a newly opened auction.
 */

import { getEmailBranding, brandTeamName } from './email-branding';
import { getPolicyAwareBaseEmailTemplate } from './base.template';

export interface AuctionStartTemplateData {
  vendorName: string;
  auctionId: string;
  assetType: string;
  assetName: string;
  startTime: string;
  endTime: string;
  location: string;
  appUrl: string;
}

export async function getAuctionStartEmailTemplate(data: AuctionStartTemplateData): Promise<string> {
  const { vendorName, auctionId, assetType, assetName, startTime, endTime, location, appUrl } = data;
  const branding = await getEmailBranding();
  const content = `
    <p><strong>Dear ${vendorName},</strong></p>
    <p>A new auction matching your interests is now available. Review the lot evidence before placing a bid.</p>
    <div style="background: ${branding.accentColor}; color: ${branding.primaryColor}; padding: 25px; text-align: center; border-radius: 8px; margin: 25px 0;">
      <h2 style="margin: 0; font-size: 28px; font-weight: 700;">${assetName}</h2>
    </div>
    <div style="background-color: #f9f9f9; padding: 25px; border-radius: 8px; margin: 25px 0;">
      <h3 style="margin: 0 0 15px; color: ${branding.primaryColor}; font-size: 18px;">Auction Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600; width: 40%;">Asset Type:</td><td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0;">${assetType}</td></tr>
        <tr><td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600;">Start Time:</td><td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0;">${startTime}</td></tr>
        <tr><td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600;">End Time:</td><td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0;">${endTime}</td></tr>
        <tr><td style="padding: 12px 0; font-weight: 600;">Location:</td><td style="padding: 12px 0;">${location}</td></tr>
      </table>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${appUrl}/vendor/auctions/${auctionId}" style="display: inline-block; padding: 16px 32px; background: ${branding.primaryColor}; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 700;">View Auction</a>
    </div>
    <p>Regards,<br><strong style="color: ${branding.primaryColor};">${brandTeamName(branding)}</strong></p>
  `;

  return getPolicyAwareBaseEmailTemplate({
    title: 'New Auction Available',
    preheader: `A new auction for ${assetName} is now available`,
    content,
  });
}
