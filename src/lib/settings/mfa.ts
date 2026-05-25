import type { MfaChannel } from '@/lib/db/schema/users';
export {
  MFA_LOGIN_ENFORCED,
  MFA_STAFF_LOGIN_REQUIRED,
  MFA_VENDOR_LOGIN_ENFORCED,
  normalizeMfaChannel,
} from '@/lib/auth/mfa';

export const MFA_CHANNELS: MfaChannel[] = ['email', 'sms', 'both'];
