import { db } from '@/lib/db/drizzle';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { sanitizeForAudit } from '@/lib/utils/audit-sanitizer';

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
  MFA_CHALLENGE_SENT = 'mfa_challenge_sent',
  MFA_VERIFICATION_SUCCESSFUL = 'mfa_verification_successful',
  MFA_VERIFICATION_FAILED = 'mfa_verification_failed',
  MFA_SETTINGS_UPDATED = 'mfa_settings_updated',
  
  // Case management actions
  CASE_CREATED = 'case_created',
  CASE_UPDATED = 'case_updated',
  CASE_APPROVED = 'case_approved',
  CASE_REJECTED = 'case_rejected',
  CASE_DELETED = 'case_deleted',
  CASE_CREATED_OFFLINE = 'case_created_offline',
  CASE_SYNCED = 'case_synced',
  AI_ASSESSMENT_COMPLETED = 'ai_assessment_completed',
  PRICE_OVERRIDE = 'price_override',
  
  // Bidding actions
  BID_PLACED = 'bid_placed',
  BID_OUTBID = 'bid_outbid',
  BID_CANCELLED = 'bid_cancelled',
  AUCTION_WON = 'auction_won',
  AUCTION_EXTENDED = 'auction_extended',
  AUCTION_CREATED = 'auction_created',
  AUCTION_CLOSED = 'auction_closed',
  AUCTION_CANCELLED = 'auction_cancelled',
  AUCTION_STARTED = 'auction_started',
  AUCTION_RESTARTED = 'auction_restarted',
  AUCTION_CLOSURE_FAILED = 'auction_closure_failed',
  
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
  DOJAH_REFERENCE_CREATED = 'dojah_reference_created',
  DOJAH_VERIFICATION_STARTED = 'dojah_verification_started',
  DOJAH_WORKFLOW_STARTED = 'dojah_workflow_started',
  DOJAH_WEBHOOK_RECEIVED = 'dojah_webhook_received',
  DOJAH_WEBHOOK_MATCHED = 'dojah_webhook_matched',
  DOJAH_WEBHOOK_UNMATCHED = 'dojah_webhook_unmatched',
  DOJAH_WEBHOOK_DUPLICATE_IGNORED = 'dojah_webhook_duplicate_ignored',
  DOJAH_WEBHOOK_SIGNATURE_FAILED = 'dojah_webhook_signature_failed',
  DOJAH_WEBHOOK_PROCESSING_FAILED = 'dojah_webhook_processing_failed',
  DOJAH_KYC_COMPLETED = 'dojah_kyc_completed',
  DOJAH_KYC_PASSED = 'dojah_kyc_passed',
  DOJAH_KYC_FAILED = 'dojah_kyc_failed',
  DOJAH_KYC_REVIEW_REQUIRED = 'dojah_kyc_review_required',
  DOJAH_PROVIDER_EVIDENCE_FETCHED = 'dojah_provider_evidence_fetched',
  DOJAH_PROVIDER_EVIDENCE_REFRESHED = 'dojah_provider_evidence_refreshed',
  DOJAH_BVN_VERIFICATION_STARTED = 'dojah_bvn_verification_started',
  DOJAH_BVN_VERIFICATION_PASSED = 'dojah_bvn_verification_passed',
  DOJAH_BVN_VERIFICATION_FAILED = 'dojah_bvn_verification_failed',
  DOJAH_BUSINESS_VERIFICATION_STARTED = 'dojah_business_verification_started',
  DOJAH_BUSINESS_VERIFICATION_PASSED = 'dojah_business_verification_passed',
  DOJAH_BUSINESS_VERIFICATION_FAILED = 'dojah_business_verification_failed',
  DOJAH_LIVENESS_PASSED = 'dojah_liveness_passed',
  DOJAH_LIVENESS_FAILED = 'dojah_liveness_failed',
  DOJAH_AML_FLAGGED = 'dojah_aml_flagged',
  DOJAH_DUPLICATE_ID_FLAGGED = 'dojah_duplicate_id_flagged',
  DOJAH_IP_DEVICE_FLAGGED = 'dojah_ip_device_flagged',
  DOJAH_ADDRESS_FLAGGED = 'dojah_address_flagged',
  FRAUD_ALERT_CREATED_FROM_DOJAH = 'fraud_alert_created_from_dojah',
  FRAUD_ALERT_UPDATED_FROM_DOJAH = 'fraud_alert_updated_from_dojah',
  PROVIDER_VERIFICATION_STORED = 'provider_verification_stored',
  PROVIDER_EVIDENCE_REFRESHED = 'provider_evidence_refreshed',
  VENDOR_TIER1_VERIFIED = 'vendor_tier1_verified',
  VENDOR_TIER2_PENDING_REVIEW = 'vendor_tier2_pending_review',
  VENDOR_TIER2_APPROVED = 'vendor_tier2_approved',
  VENDOR_TIER2_REJECTED = 'vendor_tier2_rejected',
  VENDOR_TIER2_RESUBMITTED = 'vendor_tier2_resubmitted',
  PROVIDER_VERIFICATION_APPROVED = 'provider_verification_approved',
  PROVIDER_VERIFICATION_REJECTED = 'provider_verification_rejected',
  VENDOR_STATUS_UPDATED = 'vendor_status_updated',
  APPROVAL_EMAIL_SENT = 'approval_email_sent',
  APPROVAL_EMAIL_FAILED = 'approval_email_failed',
  REJECTION_EMAIL_SENT = 'rejection_email_sent',
  REJECTION_EMAIL_FAILED = 'rejection_email_failed',
  VENDOR_VERIFICATION_REVIEWED = 'vendor_verification_reviewed',
  VENDOR_APPROVED_AFTER_VERIFICATION = 'vendor_approved_after_verification',
  VENDOR_REJECTED_AFTER_VERIFICATION = 'vendor_rejected_after_verification',
  MANUAL_DOJAH_REFERENCE_SYNC = 'manual_dojah_reference_sync',
  VENDOR_BLOCKED = 'vendor_blocked',
  VENDOR_DEACTIVATED = 'vendor_deactivated',
  PROVIDER_UNAVAILABLE = 'provider_unavailable',
  VERIFICATION_RETRY_SCHEDULED = 'verification_retry_scheduled',
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
  
  // Document actions
  DOCUMENT_GENERATED = 'document_generated',
  DOCUMENT_SIGNED = 'document_signed',
  DOCUMENT_DOWNLOADED = 'document_downloaded',
  DOCUMENT_VOIDED = 'document_voided',
  PAYMENT_BLOCKED_NO_WAIVER = 'payment_blocked_no_waiver',
  PAYMENT_UNLOCKED_WAIVER_SIGNED = 'payment_unlocked_waiver_signed',
  NOTIFICATION_FAILED = 'notification_failed',
  DOCUMENT_GENERATION_FAILED = 'document_generation_failed',
  DOCUMENT_SIGNING_PROGRESS = 'document_signing_progress',
  
  // Pickup actions
  PICKUP_CONFIRMED_VENDOR = 'pickup_confirmed_vendor',
  PICKUP_CONFIRMED_ADMIN = 'pickup_confirmed_admin',
  
  // Reporting actions
  LEADERBOARD_VIEWED = 'leaderboard_viewed',
  REPORT_GENERATED = 'report_generated',
  POLICY_DECISION_EVALUATED = 'policy_decision_evaluated',
  BUSINESS_POLICY_DRAFT_SAVED = 'business_policy_draft_saved',
  BUSINESS_POLICY_PUBLISHED = 'business_policy_published',
  
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
  DOCUMENT = 'document',
  REPORT = 'report',
  POLICY = 'policy',
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
 * SECURITY: Automatically sanitizes beforeState and afterState to remove sensitive data
 * like password hashes, tokens, and other credentials.
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
 *   beforeState: { email: 'user@example.com', passwordHash: 'hash123' }, // passwordHash will be removed
 *   afterState: { email: 'newemail@example.com', passwordHash: 'hash456' }, // passwordHash will be removed
 * });
 * ```
 */
export async function logAction(data: AuditLogData): Promise<void> {
  try {
    // SECURITY: Sanitize beforeState and afterState to remove sensitive fields
    const sanitizedBeforeState = data.beforeState ? sanitizeForAudit(data.beforeState) : null;
    const sanitizedAfterState = data.afterState ? sanitizeForAudit(data.afterState) : null;
    
    await db.insert(auditLogs).values({
      userId: data.userId,
      actionType: data.actionType,
      entityType: data.entityType,
      entityId: data.entityId,
      ipAddress: data.ipAddress,
      deviceType: data.deviceType,
      userAgent: data.userAgent,
      beforeState: sanitizedBeforeState,
      afterState: sanitizedAfterState,
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
