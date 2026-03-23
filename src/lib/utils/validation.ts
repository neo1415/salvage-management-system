import { z } from 'zod';

/**
 * Password validation schema
 * Requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 number
 * - At least 1 special character
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least 1 number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least 1 special character');

/**
 * Email validation schema
 */
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .toLowerCase();

/**
 * Nigerian phone number validation schema
 * Accepts formats: +234XXXXXXXXXX, 234XXXXXXXXXX, 0XXXXXXXXXX
 */
export const phoneSchema = z
  .string()
  .regex(
    /^(\+?234|0)[7-9][0-1]\d{8}$/,
    'Invalid Nigerian phone number format'
  )
  .transform((phone) => {
    // Normalize to +234XXXXXXXXXX format
    if (phone.startsWith('0')) {
      return `+234${phone.slice(1)}`;
    }
    if (phone.startsWith('234')) {
      return `+${phone}`;
    }
    return phone;
  });

/**
 * User registration validation schema
 */
export const registrationSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(255, 'Full name must not exceed 255 characters'),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  dateOfBirth: z
    .union([z.string(), z.date()])
    .transform((val) => (typeof val === 'string' ? new Date(val) : val))
    .refine((date) => {
      const today = new Date();
      const birthDate = new Date(date);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      // Adjust age if birthday hasn't occurred this year
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      return age >= 18;
    }, 'You must be at least 18 years old'),
  termsAccepted: z
    .boolean()
    .refine((val) => val === true, 'You must accept the terms and conditions'),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
