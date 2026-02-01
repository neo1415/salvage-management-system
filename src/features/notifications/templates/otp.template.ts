/**
 * OTP Email Template
 * Professional OTP verification email with NEM Insurance branding
 */

import { getBaseEmailTemplate } from './base.template';

export interface OTPTemplateData {
  fullName: string;
  otpCode: string;
  expiryMinutes: number;
}

export function getOTPEmailTemplate(data: OTPTemplateData): string {
  const { fullName, otpCode, expiryMinutes } = data;
  
  const content = `
    <p style="font-size: 18px; color: #800020; font-weight: 600; margin-bottom: 20px;">
      Dear ${fullName},
    </p>
    
    <p>
      You have requested a One-Time Password (OTP) to verify your account. Please use the code below to complete your verification:
    </p>
    
    <div style="background: linear-gradient(135deg, #800020 0%, #a00028 100%); color: white; padding: 40px; text-align: center; border-radius: 12px; margin: 35px 0; box-shadow: 0 8px 16px rgba(128, 0, 32, 0.3);">
      <div style="font-size: 14px; opacity: 0.9; margin-bottom: 15px; letter-spacing: 2px; text-transform: uppercase;">
        Your Verification Code
      </div>
      <div style="font-size: 56px; font-weight: 700; letter-spacing: 12px; margin: 15px 0; font-family: 'Courier New', monospace; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);">
        ${otpCode}
      </div>
      <div style="font-size: 13px; opacity: 0.85; margin-top: 15px;">
        This code will expire in ${expiryMinutes} minutes
      </div>
    </div>
    
    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; border-radius: 8px; margin: 30px 0;">
      <p style="margin: 0; color: #856404;">
        <strong>⏰ Important:</strong> This code will expire in <strong>${expiryMinutes} minutes</strong>. Please use it immediately.
      </p>
    </div>
    
    <div style="background-color: #d1ecf1; border-left: 4px solid #0c5460; padding: 20px; border-radius: 8px; margin: 30px 0;">
      <h3 style="margin: 0 0 15px 0; color: #0c5460; font-size: 16px;">🛡️ Security Tips:</h3>
      <ul style="margin: 0; padding-left: 20px; color: #0c5460; line-height: 1.8;">
        <li style="margin: 8px 0;">Never share this code with anyone, including NEM Insurance staff</li>
        <li style="margin: 8px 0;">We will never ask for your OTP via phone or email</li>
        <li style="margin: 8px 0;">If you didn't request this code, please ignore this email and contact support immediately</li>
      </ul>
    </div>
    
    <div style="height: 1px; background: linear-gradient(to right, transparent, #e0e0e0, transparent); margin: 30px 0;"></div>
    
    <p style="margin-top: 30px;">
      Best regards,<br>
      <strong style="color: #800020;">The NEM Insurance Team</strong>
    </p>
  `;
  
  return getBaseEmailTemplate({
    title: '🔐 OTP Verification Code',
    preheader: `Your verification code is ${otpCode}. Valid for ${expiryMinutes} minutes.`,
    content,
  });
}
