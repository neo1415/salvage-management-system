/**
 * Welcome Email Template
 * Professional welcome email for new users with NEM Insurance branding
 */

import { getBaseEmailTemplate } from './base.template';

export interface WelcomeTemplateData {
  fullName: string;
}

export function getWelcomeEmailTemplate(data: WelcomeTemplateData): string {
  const { fullName } = data;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  const content = `
    <p style="font-size: 18px; color: #800020; font-weight: 600; margin-bottom: 20px;">
      Dear ${fullName},
    </p>
    
    <p>
      Welcome to <strong>NEM Insurance Salvage Management System</strong>! We're thrilled to have you join our platform.
    </p>
    
    <p>
      Your account has been successfully created, and you're now part of Nigeria's most advanced salvage auction platform.
    </p>
    
    <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-left: 4px solid #FFD700; padding: 25px; border-radius: 8px; margin: 30px 0;">
      <h3 style="margin: 0 0 15px 0; color: #800020; font-size: 18px;">🚀 Get Started in 3 Easy Steps:</h3>
      <ol style="margin: 0; padding-left: 20px; line-height: 1.8;">
        <li style="margin: 10px 0;"><strong>Verify Your Phone Number</strong> - Complete SMS OTP verification</li>
        <li style="margin: 10px 0;"><strong>Complete Tier 1 KYC</strong> - Verify with your BVN to start bidding up to ₦500,000</li>
        <li style="margin: 10px 0;"><strong>Browse & Bid</strong> - Explore available auctions and place your first bid</li>
      </ol>
    </div>
    
    <div style="text-align: center; margin: 35px 0;">
      <a href="${appUrl}/login" class="button" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #FFD700 0%, #FFC700 100%); color: #800020 !important; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        Login to Your Account →
      </a>
    </div>
    
    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; border-radius: 8px; margin: 30px 0;">
      <h3 style="margin: 0 0 10px 0; color: #856404; font-size: 16px;">💡 Why Choose NEM Salvage?</h3>
      <ul style="margin: 10px 0; padding-left: 20px; color: #856404;">
        <li style="margin: 8px 0;">⚡ <strong>Instant Payments</strong> - Get paid in minutes via Paystack/Flutterwave</li>
        <li style="margin: 8px 0;">📱 <strong>Mobile-First</strong> - Bid from anywhere using our PWA</li>
        <li style="margin: 8px 0;">🤖 <strong>AI Assessment</strong> - Accurate damage evaluation for fair pricing</li>
        <li style="margin: 8px 0;">🏆 <strong>Gamified Experience</strong> - Earn rewards and climb the leaderboard</li>
      </ul>
    </div>
    
    <div style="background-color: #d1ecf1; border-left: 4px solid #0c5460; padding: 20px; border-radius: 8px; margin: 30px 0;">
      <h3 style="margin: 0 0 10px 0; color: #0c5460; font-size: 16px;">📞 Need Help?</h3>
      <p style="margin: 0; color: #0c5460;">
        Our support team is available 24/7 to assist you:<br>
        <strong>Phone:</strong> 234-02-014489560<br>
        <strong>Email:</strong> nemsupport@nem-insurance.com<br>
        <strong>Address:</strong> 199 Ikorodu Road, Obanikoro, Lagos
      </p>
    </div>
    
    <div style="height: 1px; background: linear-gradient(to right, transparent, #e0e0e0, transparent); margin: 30px 0;"></div>
    
    <p style="margin-top: 30px;">
      Thank you for choosing NEM Insurance. We look forward to serving you!
    </p>
    
    <p style="margin-top: 20px;">
      Best regards,<br>
      <strong style="color: #800020;">The NEM Insurance Team</strong>
    </p>
  `;
  
  return getBaseEmailTemplate({
    title: 'Welcome to NEM Insurance',
    preheader: 'Your account has been created successfully. Get started in 3 easy steps!',
    content,
  });
}
