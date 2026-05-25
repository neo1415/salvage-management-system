import type { MfaChannel } from '@/lib/db/schema/users';
import { otpService } from '@/features/auth/services/otp.service';
import { normalizeNigerianPhone } from '@/lib/utils/phone';

export type MfaUser = {
  id: string;
  role: string;
  email: string;
  fullName: string;
  phone: string;
  mfaEnabled?: boolean | null;
  mfaChannel?: string | null;
  mfaPhone?: string | null;
};

export const MFA_LOGIN_ENFORCED = process.env.MFA_LOGIN_ENFORCED === 'true';
export const MFA_STAFF_LOGIN_REQUIRED = process.env.MFA_STAFF_LOGIN_REQUIRED === 'true';
export const MFA_VENDOR_LOGIN_ENFORCED = process.env.MFA_VENDOR_LOGIN_ENFORCED === 'true';

export function normalizeMfaChannel(value: string | null | undefined): MfaChannel {
  if (value === 'sms' || value === 'both') return value;
  return 'email';
}

export function isStaffRole(role: string | null | undefined): boolean {
  return (
    role === 'system_admin' ||
    role === 'salvage_manager' ||
    role === 'finance_officer' ||
    role === 'claims_adjuster'
  );
}

export function isMfaRequiredForUser(user: MfaUser): boolean {
  if (user.mfaEnabled === true) return true;

  if (!MFA_LOGIN_ENFORCED) return false;

  if (user.role === 'vendor') {
    return MFA_VENDOR_LOGIN_ENFORCED;
  }

  if (isStaffRole(user.role)) {
    return MFA_STAFF_LOGIN_REQUIRED;
  }

  return false;
}

export function getMfaPhone(user: MfaUser): string {
  const phone = user.mfaPhone || user.phone;
  return normalizeNigerianPhone(phone);
}

export async function sendLoginMfaCode(
  user: MfaUser,
  ipAddress: string,
  deviceType: 'mobile' | 'desktop' | 'tablet'
): Promise<{ success: boolean; message: string; channel: MfaChannel; maskedDestination: string }> {
  const channel = normalizeMfaChannel(user.mfaChannel);
  const phone = getMfaPhone(user);

  const result = await otpService.sendOTP(
    phone,
    ipAddress,
    deviceType,
    channel === 'email' || channel === 'both' ? user.email : undefined,
    user.fullName,
    'authentication'
  );

  return {
    success: result.success,
    message: result.message,
    channel,
    maskedDestination:
      channel === 'email'
        ? maskEmail(user.email)
        : channel === 'both'
          ? `${maskPhone(phone)} and ${maskEmail(user.email)}`
          : maskPhone(phone),
  };
}

export async function verifyLoginMfaCode(
  user: MfaUser,
  code: string
): Promise<{ success: boolean; message: string }> {
  return otpService.verifyOTPCode(getMfaPhone(user), code);
}

function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!name || !domain) return 'your email';
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return 'your phone';
  return `***${phone.slice(-4)}`;
}
