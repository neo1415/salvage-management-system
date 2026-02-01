/**
 * Case Approval Email Template
 * Professional case approval/rejection notification with NEM Insurance branding
 */

import { getBaseEmailTemplate } from './base.template';

export interface CaseApprovalTemplateData {
  adjusterName: string;
  caseId: string;
  claimReference: string;
  assetType: string;
  status: 'approved' | 'rejected';
  comment?: string;
  managerName: string;
  appUrl: string;
}

export function getCaseApprovalEmailTemplate(data: CaseApprovalTemplateData): string {
  const { adjusterName, caseId, claimReference, assetType, status, comment, managerName, appUrl } = data;
  
  const isApproved = status === 'approved';
  const statusColor = isApproved ? '#28a745' : '#dc3545';
  const statusIcon = isApproved ? '✅' : '❌';
  const statusText = isApproved ? 'APPROVED' : 'REJECTED';
  
  const content = `
    <p style="font-size: 18px; color: #800020; font-weight: 600; margin-bottom: 20px;">
      Dear ${adjusterName},
    </p>
    
    <p>
      Your salvage case has been reviewed by <strong>${managerName}</strong>.
    </p>
    
    <div style="background-color: ${isApproved ? '#d4edda' : '#f8d7da'}; border: 3px solid ${statusColor}; padding: 30px; text-align: center; border-radius: 12px; margin: 35px 0; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
      <div style="font-size: 48px; margin-bottom: 15px;">${statusIcon}</div>
      <div style="font-size: 28px; font-weight: 700; color: ${statusColor}; margin-bottom: 10px;">
        Case ${statusText}
      </div>
      <div style="font-size: 16px; color: ${statusColor}; opacity: 0.9;">
        ${isApproved ? 'Your case has been approved and an auction will be created' : 'Please review the feedback and resubmit'}
      </div>
    </div>
    
    <div style="background-color: #f9f9f9; padding: 25px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #FFD700;">
      <h3 style="margin: 0 0 20px 0; color: #800020; font-size: 18px;">📋 Case Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 12px 0; font-weight: 600; color: #800020; width: 40%;">Case ID:</td>
          <td style="padding: 12px 0;">${caseId}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 12px 0; font-weight: 600; color: #800020;">Claim Reference:</td>
          <td style="padding: 12px 0;">${claimReference}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 12px 0; font-weight: 600; color: #800020;">Asset Type:</td>
          <td style="padding: 12px 0;">${assetType}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; font-weight: 600; color: #800020;">Reviewed By:</td>
          <td style="padding: 12px 0;">${managerName}</td>
        </tr>
      </table>
    </div>
    
    ${comment ? `
    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; border-radius: 8px; margin: 30px 0;">
      <h3 style="margin: 0 0 15px 0; color: #856404; font-size: 16px;">💬 Manager's Feedback:</h3>
      <p style="margin: 0; color: #856404; line-height: 1.6;">
        ${comment}
      </p>
    </div>
    ` : ''}
    
    ${isApproved ? `
    <div style="background-color: #d1ecf1; border-left: 4px solid #0c5460; padding: 20px; border-radius: 8px; margin: 30px 0;">
      <h3 style="margin: 0 0 15px 0; color: #0c5460; font-size: 16px;">🎉 Next Steps:</h3>
      <ul style="margin: 0; padding-left: 20px; color: #0c5460; line-height: 1.8;">
        <li style="margin: 8px 0;">An auction has been automatically created for this case</li>
        <li style="margin: 8px 0;">Vendors matching the asset category will be notified</li>
        <li style="margin: 8px 0;">You can monitor the auction progress in your dashboard</li>
        <li style="margin: 8px 0;">You'll receive updates when bids are placed</li>
      </ul>
    </div>
    ` : `
    <div style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 20px; border-radius: 8px; margin: 30px 0;">
      <h3 style="margin: 0 0 15px 0; color: #721c24; font-size: 16px;">📝 Next Steps:</h3>
      <ul style="margin: 0; padding-left: 20px; color: #721c24; line-height: 1.8;">
        <li style="margin: 8px 0;">Review the manager's feedback above carefully</li>
        <li style="margin: 8px 0;">Make the necessary corrections to your case</li>
        <li style="margin: 8px 0;">Resubmit the case for approval</li>
        <li style="margin: 8px 0;">Contact support if you need clarification</li>
      </ul>
    </div>
    `}
    
    <div style="text-align: center; margin: 35px 0;">
      <a href="${appUrl}/adjuster/cases/${caseId}" class="button" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #FFD700 0%, #FFC700 100%); color: #800020 !important; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        View Case Details →
      </a>
    </div>
    
    <div style="height: 1px; background: linear-gradient(to right, transparent, #e0e0e0, transparent); margin: 30px 0;"></div>
    
    <p style="margin-top: 30px;">
      Best regards,<br>
      <strong style="color: #800020;">The NEM Insurance Team</strong>
    </p>
  `;
  
  return getBaseEmailTemplate({
    title: `Case ${statusText}`,
    preheader: `Your salvage case ${claimReference} has been ${status} by ${managerName}`,
    content,
  });
}
