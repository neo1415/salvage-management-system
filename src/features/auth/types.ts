/**
 * Auth Types
 * Type definitions for authentication and authorization
 */

export type UserRole = 'vendor' | 'claims_adjuster' | 'salvage_manager' | 'finance_officer' | 'system_admin';

export type UserStatus = 
  | 'unverified_tier_0' 
  | 'phone_verified_tier_0' 
  | 'verified_tier_1' 
  | 'verified_tier_2' 
  | 'suspended' 
  | 'deleted';

export type DeviceType = 'mobile' | 'desktop' | 'tablet';

export type OAuthProvider = 'google' | 'facebook';

export interface User {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  dateOfBirth: Date;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  loginDeviceType: DeviceType | null;
}

export interface OAuthProfile {
  email: string;
  name: string;
  provider: OAuthProvider;
  providerId: string;
  picture?: string;
  phone?: string;
}

export interface RegistrationInput {
  email: string;
  phone: string;
  password: string;
  fullName: string;
  dateOfBirth: Date;
  termsAccepted: boolean;
}

export interface OAuthRegistrationInput {
  email: string;
  phone: string;
  dateOfBirth: Date;
  provider: OAuthProvider;
  providerId: string;
}

export interface LoginInput {
  emailOrPhone: string;
  password: string;
}

export interface AuthSession {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    status: UserStatus;
  };
  expires: string;
}
