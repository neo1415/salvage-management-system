/**
 * Bid Alert Email Template
 * Used for notifying vendors when they are outbid or when their bid is successful
 */

import { getBaseEmailTemplate } from './base.template';

export interface BidAlertTemplateData {
  vendorName: string;
  auctionId: string;
  assetName: string;
  alertType: 'outbid' | 'winning' | 'won';
  yourBid: number;
  currentBid?: number;
  currentBidder?: string;
  timeRemaining?: string;
  appUrl: string;
}

export function getBidAlertEmailTemplate(data: BidAlertTemplateData): string {
  const { vendorName, auctionId, assetName, alertType, yourBid, currentBid, timeRemaining, appUrl } = data;
  
  let statusIcon = '📢';
  let statusTitle = 'Bid Alert';
  let statusMessage = '';
  let actionButton = '';
  let alertColor = '#800020';
  let alertBg = '#f9f9f9';
  
  if (alertType === 'outbid') {
    alertColor = '#dc3545';
    alertBg = '#f8d7da';
    statusIcon = '⚠️';
    statusTitle = 'You\'ve Been Outbid!';
    statusMessage = `Another vendor has placed a higher bid on <strong>${assetName}</strong>. Your bid of <strong>₦${yourBid.toLocaleString()}</strong> is no longer the highest.`;
    actionButton = 'Place Higher Bid';
  } else if (alertType === 'winning') {
    alertColor = '#28a745';
    alertBg = '#d4edda';
    statusIcon = '🎉';
    statusTitle = 'You\'re Winning!';
    statusMessage = `Congratulations! Your bid of <strong>₦${yourBid.toLocaleString()}</strong> is currently the highest for <strong>${assetName}</strong>.`;
    actionButton = 'View Auction';
  } else if (alertType === 'won') {
    alertColor = '#FFD700';
    alertBg = '#fff9e6';
    statusIcon = '🏆';
    statusTitle = 'You Won the Auction!';
    statusMessage = `Congratulations! You have won the auction for <strong>${assetName}</strong> with your bid of <strong>₦${yourBid.toLocaleString()}</strong>.`;
    actionButton = 'Complete Payment';
  }
  
  const content = `
    <p><strong>Dear ${vendorName},</strong></p>
    
    <div style="background-color: ${alertBg}; border-left: 4px solid ${alertColor}; padding: 25px; margin: 25px 0; border-radius: 8px;">
      <h2 style="margin: 0 0 12px 0; font-size: 22px; color: ${alertColor};">${statusIcon} ${statusTitle}</h2>
      <p style="margin: 0; font-size: 16px;">${statusMessage}</p>
    </div>
    
    <div style="background-color: #f9f9f9; padding: 25px; border-radius: 8px; margin: 25px 0;">
      <h3 style="margin: 0 0 15px 0; color: #800020; font-size: 18px;">📋 Bid Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600; color: #800020; width: 45%;">🏷️ Auction:</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0;">${assetName}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600; color: #800020;">💰 Your Bid:</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0;"><strong>₦${yourBid.toLocaleString()}</strong></td>
        </tr>
        ${currentBid ? `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-weight: 600; color: #800020;">📊 Current Highest Bid:</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0;"><strong style="color: #dc3545;">₦${currentBid.toLocaleString()}</strong></td>
        </tr>
        ` : ''}
        ${timeRemaining ? `
        <tr>
          <td style="padding: 12px 0; font-weight: 600; color: #800020;">⏱️ Time Remaining:</td>
          <td style="padding: 12px 0;"><strong>${timeRemaining}</strong></td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    ${alertType === 'outbid' ? `
    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px 20px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; color: #856404;"><strong>⚡ Act Fast!</strong> ${timeRemaining ? `Only ${timeRemaining} left to place a higher bid.` : 'Place a higher bid to win this auction.'}</p>
    </div>
    ` : ''}
    
    ${alertType === 'winning' ? `
    <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px 20px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; color: #155724;"><strong>🎯 Stay Alert!</strong> Other vendors can still outbid you. Keep an eye on the auction until it closes.</p>
    </div>
    ` : ''}
    
    ${alertType === 'won' ? `
    <div style="background-color: #e7f3ff; border-left: 4px solid #0066cc; padding: 20px; margin: 25px 0; border-radius: 4px;">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #0066cc;">📋 Next Steps:</h3>
      <ul style="margin: 10px 0; padding-left: 20px; color: #333;">
        <li style="margin: 8px 0;">Complete payment within 24 hours to secure your purchase</li>
        <li style="margin: 8px 0;">Choose your payment method: Paystack, Flutterwave, or Bank Transfer</li>
        <li style="margin: 8px 0;">After payment verification, you'll receive pickup authorization</li>
        <li style="margin: 8px 0;">Collect the salvage item within the specified timeframe</li>
      </ul>
    </div>
    ` : ''}
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${appUrl}/vendor/auctions/${auctionId}" class="button" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #FFD700 0%, #FFC700 100%); color: #800020 !important; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 18px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">${actionButton}</a>
    </div>
    
    <div style="height: 1px; background: linear-gradient(to right, transparent, #e0e0e0, transparent); margin: 30px 0;"></div>
    
    <p style="margin-top: 25px;">Best regards,</p>
    <p><strong style="color: #800020;">The NEM Insurance Team</strong></p>
  `;
  
  let preheader = '';
  if (alertType === 'outbid') {
    preheader = `You've been outbid on ${assetName}. Current bid: ₦${currentBid?.toLocaleString()}`;
  } else if (alertType === 'winning') {
    preheader = `You're winning the auction for ${assetName} with your bid of ₦${yourBid.toLocaleString()}`;
  } else if (alertType === 'won') {
    preheader = `Congratulations! You won ${assetName} for ₦${yourBid.toLocaleString()}`;
  }
  
  return getBaseEmailTemplate({
    title: statusTitle,
    preheader,
    content
  });
}
