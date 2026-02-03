import { db } from '@/lib/db/drizzle';
import { auditLogs } from '@/lib/db/schema/audit-logs';

/**
 * Device types for audit logging
 */
export enum DeviceType {
  MOBILE = 'mobile',
  DESKTOP = 'desktop',
  TABLET = 'tablet',
}

/**
 * Action types for audit logging
 */
export enum AuditActionType {
  // Authentication actions
  LOGIN = 'login',
  LOGOUT = 'logout',
  REGISTER = 'register',
  OTP_SENT = 'otp_sent',
  OTP_VERIFIED = 'otp_verified',
  PASSWORD_RESET = 'password_reset',
  OAUTH_LOGIN = 'oauth_login',
  
  // Case management actions
  CASE_CREATED = 'case_created',
  CASE_UPDATED = 'case_updated',
  CASE_APPROVED = 'case_approved',
  CASE_REJECTED = 'case_rejected',
  CASE_DELETED = 'case_deleted',
  CASE_CREATED_OFFLINE = 'case_created_offline',
  CASE_SYNCED = 'case_synced',
  AI_ASSESSMENT_COMPLETED = 'ai_assessment_completed',
  
  // Bidding actions
  BID_PLACED = 'bid_placed',
  BID_OUTBID = 'bid_outbid',
  BID_CANCELLED = 'bid_cancelled',
  AUCTION_WON = 'auction_won',
  AUCTION_EXTENDED = 'auction_extended',
  AUCTION_CREATED = 'auction_created',
  AUCTION_CLOSED = 'auction_closed',
  AUCTION_CANCELLED = 'auction_cancelled',
  
  // Payment actions
  PAYMENT_INITIATED = 'payment_initiated',
  PAYMENT_VERIFIED = 'payment_verified',
  PAYMENT_AUTO_VERIFIED = 'payment_auto_verified',
  PAYMENT_REJECTED = 'payment_rejected',
  PAYMENT_DEADLINE_MISSED = 'payment_deadline_missed',
  BANK_TRANSFER_PROOF_UPLOADED = 'bank_transfer_proof_uploaded',
  WALLET_FUNDED = 'wallet_funded',
  FUNDS_FROZEN = 'funds_frozen',
  FUNDS_RELEASED = 'funds_released',
  FUNDS_UNFROZEN = 'funds_unfrozen',
  
  // KYC actions
  BVN_VERIFICATION_INITIATED = 'bvn_verification_initiated',
  BVN_VERIFICATION_SUCCESSFUL = 'bvn_verification_successful',
  BVN_VERIFICATION_FAILED = 'bvn_verification_failed',
  TIER2_KYC_INITIATED = 'tier2_kyc_initiated',
  TIER2_KYC_SUBMITTED = 'tier2_kyc_submitted',
  TIER2_APPLICATION_APPROVED = 'tier2_application_approved',
  TIER2_APPLICATION_REJECTED = 'tier2_application_rejected',
  NIN_VERIFIED = 'nin_verified',
  CAC_UPLOADED = 'cac_uploaded',
  BANK_DETAILS_VERIFIED = 'bank_details_verified',
  
  // Profile actions
  PROFILE_UPDATED = 'profile_updated',
  NOTIFICATION_PREFERENCES_UPDATED = 'notification_preferences_updated',
  
  // Admin actions
  USER_CREATED = 'user_created',
  USER_SUSPENDED = 'user_suspended',
  USER_REINSTATED = 'user_reinstated',
  VENDOR_SUSPENDED = 'vendor_suspended',
  VENDOR_AUTO_SUSPENDED = 'vendor_auto_suspended',
  FRAUD_FLAG_RAISED = 'fraud_flag_raised',
  FRAUD_FLAG_DISMISSED = 'fraud_flag_dismissed',
  
  // Notification actions
  OUTBID_NOTIFICATION_SENT = 'outbid_notification_sent',
  NOTIFICATION_SENT = 'notification_sent',
  
  // Reporting actions
  LEADERBOARD_VIEWED = 'leaderboard_viewed',
  REPORT_GENERATED = 'report_generated',
  
  // Rating actions
  VENDOR_RATED = 'vendor_rated',
}

/**
 * Entity types for audit logging
 */
export enum AuditEntityType {
  USER = 'user',
  VENDOR = 'vendor',
  CASE = 'case',
  AUCTION = 'auction',
  BID = 'bid',
  PAYMENT = 'payment',
  WALLET = 'wallet',
  KYC = 'kyc',
  NOTIFICATION = 'notification',
  REPORT = 'report',
  RATING = 'rating',
  FRAUD_FLAG = 'fraud_flag',
}

/**
 * Audit log entry data
 */
export interface AuditLogData {
  userId: string;
  actionType: AuditActionType;
  entityType: AuditEntityType;
  entityId: string;
  ipAddress: string;
  deviceType: DeviceType;
  userAgent: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
}

/**
 * Log an action to the audit trail
 * 
 * @param data - Audit log data
 * @returns Promise<void>
 * 
 * @example
 * ```typescript
 * await logAction({
 *   userId: '123',
 *   actionType: AuditActionType.LOGIN,
 *   entityType: AuditEntityType.USER,
 *   entityId: '123',
 *   ipAddress: '192.168.1.1',
 *   deviceType: DeviceType.MOBILE,
 *   userAgent: 'Mozilla/5.0...',
 * });
 * ```
 */
export async function logAction(data: AuditLogData): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: data.userId,
      actionType: data.actionType,
      entityType: data.entityType,
      entityId: data.entityId,
      ipAddress: data.ipAddress,
      deviceType: data.deviceType,
      userAgent: data.userAgent,
      beforeState: data.beforeState || null,
      afterState: data.afterState || null,
    });
  } catch (error) {
    // Log error but don't throw to prevent audit logging from breaking application flow
    console.error('Failed to log audit action:', error);
  }
}

/**
 * Extract device type from user agent string
 * 
 * @param userAgent - User agent string
 * @returns DeviceType
 */
export function getDeviceTypeFromUserAgent(userAgent: string): DeviceType {
  const ua = userAgent.toLowerCase();
  
  // Check for tablet first (more specific)
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return DeviceType.TABLET;
  }
  
  // Then check for mobile
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return DeviceType.MOBILE;
  }
  
  // Default to desktop
  return DeviceType.DESKTOP;
}

/**
 * Extract IP address from request headers
 * Handles various proxy headers (X-Forwarded-For, X-Real-IP, etc.)
 * 
 * @param headers - Request headers
 * @returns IP address string
 */
export function getIpAddress(headers: Headers): string {
  // Check common proxy headers
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  
  // Fallback to unknown if no IP found
  return 'unknown';
}

/**
 * Create audit log data from request
 * Helper function to extract common audit data from Next.js request
 * 
 * @param request - Next.js request object
 * @param userId - User ID
 * @param actionType - Action type
 * @param entityType - Entity type
 * @param entityId - Entity ID
 * @param beforeState - Optional before state
 * @param afterState - Optional after state
 * @returns AuditLogData
 */
export function createAuditLogData(
  request: Request,
  userId: string,
  actionType: AuditActionType,
  entityType: AuditEntityType,
  entityId: string,
  beforeState?: Record<string, unknown>,
  afterState?: Record<string, unknown>
): AuditLogData {
  const headers = request.headers;
  const userAgent = headers.get('user-agent') || 'unknown';
  const ipAddress = getIpAddress(headers);
  const deviceType = getDeviceTypeFromUserAgent(userAgent);
  
  return {
    userId,
    actionType,
    entityType,
    entityId,
    ipAddress,
    deviceType,
    userAgent,
    beforeState,
    afterState,
  };
}
