/**
 * Auction Start Email Template
 * Used for notifying vendors when a new auction matching their interests starts
 */

import { getBaseEmailTemplate } from './base.template';

export interface AuctionStartTemplateData {
  vendorName: string;
  auctionId: string;
  assetType: string;
  assetName: string;
  reservePrice: number;
  startTime: string;
  endTime: string;
  location: string;
  appUrl: string;
}

export function getAuctionStartEmailTemplate(data: AuctionStartTemplateData): string {
  const { vendorName, auctionId, assetType, assetName, reservePrice, startTime, endTime, location, appUrl } = data;
  
  const content = `
    <p><strong>Dear ${vendorName},</strong></p>
    
    <p>Great news! A new auction matching your interests has just started. Don't miss this opportunity to bid on a quality salvage item.</p>
    
    <div style="background: linear-gradient(135deg, #FFD700 0%, #FFC700 100%); color: #800020; padding: 25px; text-align: center; border-radius: 8px; margin: 25px 0; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <h2 style="margin: 0 0 10px 0; font-size: 28px; font-weight: 700;">${assetName}</h2>
      <p style="margin: 5px 0; font-size: 18px; font-weight: 600;">Starting Price: ₦${reservePrice.toLocaleString()}</p>
    </div>
    
    <div style="background-color: #f9f9f9; padding: 25px; border-radius: 8px; margin: 25px 0;">
      <h3 style="margin: 0 0 15px 0; color: #800020; font-size: 18px;">📋 Auction Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600; color: #800020; width: 40%;">📦 Asset Type:</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0;">${assetType}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600; color: #800020;">🏷️ Auction ID:</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0;">${auctionId}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600; color: #800020;">⏰ Start Time:</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0;">${startTime}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600; color: #800020;">⏱️ End Time:</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0;">${endTime}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; font-weight: 600; color: #800020;">📍 Location:</td>
          <td style="padding: 12px 0;">${location}</td>
        </tr>
      </table>
    </div>
    
    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px 20px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; color: #856404;"><strong>⚡ Act Fast!</strong> Auctions are competitive. Place your bid early to stay ahead of other vendors.</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${appUrl}/vendor/auctions/${auctionId}" class="button" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #FFD700 0%, #FFC700 100%); color: #800020 !important; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 18px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">View Auction & Place Bid</a>
    </div>
    
    <div style="background-color: #e7f3ff; border-left: 4px solid #0066cc; padding: 20px; margin: 25px 0; border-radius: 4px;">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #0066cc;">💡 Bidding Tips:</h3>
      <ul style="margin: 10px 0; padding-left: 20px; color: #333;">
        <li style="margin: 8px 0;">Review all photos and damage assessment details carefully</li>
        <li style="margin: 8px 0;">Ensure you have sufficient funds in your escrow wallet</li>
        <li style="margin: 8px 0;">Bids are final and require OTP verification</li>
        <li style="margin: 8px 0;">Watch the countdown timer - auctions may auto-extend if bids come in late</li>
      </ul>
    </div>
    
    <div style="height: 1px; background: linear-gradient(to right, transparent, #e0e0e0, transparent); margin: 30px 0;"></div>
    
    <p style="margin-top: 25px;">Good luck with your bidding!</p>
    <p><strong style="color: #800020;">The NEM Insurance Team</strong></p>
    
    <p style="font-size: 13px; color: #666; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
      <em>To stop receiving auction notifications, update your preferences in your account settings.</em>
    </p>
  `;
  
  return getBaseEmailTemplate({
    title: '🎯 New Auction Available',
    preheader: `New auction for ${assetName} - Starting at ₦${reservePrice.toLocaleString()}`,
    content
  });
}
