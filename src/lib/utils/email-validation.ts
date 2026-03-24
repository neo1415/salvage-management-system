/**
 * Email Validation Utilities
 * 
 * Validates business emails for B2B platform
 * Rejects personal email providers to ensure professional use
 */

// Personal email providers that should be rejected for business accounts
const PERSONAL_EMAIL_PROVIDERS = [
  // Major providers
  'gmail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.ca',
  'yahoo.fr',
  'yahoo.de',
  'hotmail.com',
  'hotmail.co.uk',
  'hotmail.fr',
  'outlook.com',
  'live.com',
  'msn.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  
  // Regional providers
  'ymail.com',
  'rocketmail.com',
  'mail.com',
  'gmx.com',
  'gmx.net',
  'protonmail.com',
  'proton.me',
  'zoho.com',
  'mail.ru',
  'yandex.com',
  'qq.com',
  '163.com',
  '126.com',
  
  // Temporary/disposable
  'tempmail.com',
  'guerrillamail.com',
  '10minutemail.com',
  'mailinator.com',
];

/**
 * Check if an email is from a personal email provider
 */
export function isPersonalEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return true; // Treat invalid emails as personal
  }
  
  const domain = email.toLowerCase().split('@')[1];
  if (!domain) {
    return true; // Invalid email format
  }
  
  return PERSONAL_EMAIL_PROVIDERS.includes(domain);
}

/**
 * Check if an email is a valid business email
 */
export function isBusinessEmail(email: string): boolean {
  return !isPersonalEmail(email);
}

/**
 * Get the domain from an email address
 */
export function getEmailDomain(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null;
  }
  
  const parts = email.toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : null;
}

/**
 * Validate email format
 */
export function isValidEmailFormat(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Get a user-friendly error message for rejected personal emails
 */
export function getPersonalEmailErrorMessage(email: string): string {
  const domain = getEmailDomain(email);
  
  return `Business email required. Personal emails from ${domain} are not allowed. Please use your company email address (e.g., yourname@yourcompany.com).`;
}

/**
 * Comprehensive business email validation
 */
export function validateBusinessEmail(email: string): {
  valid: boolean;
  error?: string;
} {
  // Check format
  if (!isValidEmailFormat(email)) {
    return {
      valid: false,
      error: 'Invalid email format. Please enter a valid email address.',
    };
  }
  
  // Check if personal email
  if (isPersonalEmail(email)) {
    return {
      valid: false,
      error: getPersonalEmailErrorMessage(email),
    };
  }
  
  return { valid: true };
}
