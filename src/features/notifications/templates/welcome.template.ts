/**
 * Welcome Email Template
 * Professional welcome email for new users with configured brand styling.
 */

import { getPolicyAwareBaseEmailTemplate } from './base.template';
import { brandLegalName, brandTeamName, getEmailBranding, getSupportEmail, getSupportPhone } from './email-branding';
import { appPath } from './email-urls';

export interface WelcomeTemplateData {
  fullName: string;
}

export async function getWelcomeEmailTemplate(data: WelcomeTemplateData): Promise<string> {
  const { fullName } = data;
  const loginUrl = appPath('/login');
  const branding = await getEmailBranding();
  const brandName = branding.brandName;
  const legalName = brandLegalName(branding);
  const supportEmail = getSupportEmail(branding);
  const supportPhone = getSupportPhone(branding);

  const content = `
    <p style="font-size: 18px; color: ${branding.primaryColor}; font-weight: 600; margin-bottom: 20px;">
      Dear ${fullName},
    </p>

    <p>
      Welcome to <strong>${brandName}</strong>. We're thrilled to have you join our salvage recovery platform.
    </p>

    <p>
      Your account has been successfully created. You can now verify your account, complete KYC, and access eligible auctions.
    </p>

    <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-left: 4px solid ${branding.accentColor}; padding: 25px; border-radius: 8px; margin: 30px 0;">
      <h3 style="margin: 0 0 15px 0; color: ${branding.primaryColor}; font-size: 18px;">Get Started in 3 Easy Steps</h3>
      <ol style="margin: 0; padding-left: 20px; line-height: 1.8;">
        <li style="margin: 10px 0;"><strong>Verify Your Phone Number</strong> - Complete OTP verification.</li>
        <li style="margin: 10px 0;"><strong>Complete KYC</strong> - Verify your identity to unlock eligible bidding.</li>
        <li style="margin: 10px 0;"><strong>Browse & Bid</strong> - Explore available auctions and place your first bid.</li>
      </ol>
    </div>

    <div style="text-align: center; margin: 35px 0;">
      <a href="${loginUrl}" class="button" style="display: inline-block; padding: 16px 32px; background: ${branding.primaryColor}; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        Login to Your Account
      </a>
    </div>

    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; border-radius: 8px; margin: 30px 0;">
      <h3 style="margin: 0 0 10px 0; color: #856404; font-size: 16px;">Why Choose ${brandName}?</h3>
      <ul style="margin: 10px 0; padding-left: 20px; color: #856404;">
        <li style="margin: 8px 0;"><strong>Controlled recovery</strong> - Manage salvage workflows from case creation to payment.</li>
        <li style="margin: 8px 0;"><strong>Mobile-first bidding</strong> - Participate securely from any modern device.</li>
        <li style="margin: 8px 0;"><strong>Verification-led access</strong> - KYC and approval controls protect the marketplace.</li>
        <li style="margin: 8px 0;"><strong>Audit-ready records</strong> - Documents, payments, and reviews stay traceable.</li>
      </ul>
    </div>

    <div style="background-color: #d1ecf1; border-left: 4px solid #0c5460; padding: 20px; border-radius: 8px; margin: 30px 0;">
      <h3 style="margin: 0 0 10px 0; color: #0c5460; font-size: 16px;">Need Help?</h3>
      <p style="margin: 0; color: #0c5460;">
        Our support team is available to assist you:<br>
        <strong>Phone:</strong> ${supportPhone}<br>
        <strong>Email:</strong> ${supportEmail}
      </p>
    </div>

    <div style="height: 1px; background: linear-gradient(to right, transparent, #e0e0e0, transparent); margin: 30px 0;"></div>

    <p style="margin-top: 30px;">
      Thank you for choosing ${legalName}. We look forward to serving you.
    </p>

    <p style="margin-top: 20px;">
      Best regards,<br>
      <strong style="color: ${branding.primaryColor};">${brandTeamName(branding)}</strong>
    </p>
  `;

  return getPolicyAwareBaseEmailTemplate({
    title: `Welcome to ${brandName}`,
    preheader: 'Your account has been created successfully. Get started in 3 easy steps.',
    content,
  });
}
