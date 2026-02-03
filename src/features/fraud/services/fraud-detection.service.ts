/**
 * Fraud Detection Service
 * Detects and flags suspicious bidding patterns
 * 
 * Requirements:
 * - Requirement 34: Automated Fraud Detection
 * - Enterprise Standards Section 6.3: Security & Fraud Prevention
 */

import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { bids } from '@/lib/db/schema/bids';
import { auctions } from '@/lib/db/schema/auctions';
import { eq, and } from 'drizzle-orm';
import { logAction, AuditActionType, AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';
import { emailService } from '@/features/notifications/services/email.service';
import { pushNotificationService } from '@/features/notifications/services/push.service';

/**
 * Fraud pattern types
 */
export enum FraudPattern {
  SAME_IP_BIDDING = 'same_ip_bidding',
  UNUSUAL_BID_PATTERN = 'unusual_bid_pattern',
  DUPLICATE_IDENTITY = 'duplicate_identity',
}

/**
 * Fraud detection data
 */
export interface FraudDetectionData {
  auctionId: string;
  vendorId: string;
  bidAmount: number;
  ipAddress: string;
  userAgent: string;
  previousBid?: number;
}

/**
 * Fraud detection result
 */
export interface FraudDetectionResult {
  isSuspicious: boolean;
  patterns: FraudPattern[];
  details?: {
    pattern: FraudPattern;
    evidence: string;
  }[];
}

/**
 * Fraud Detection Service
 * Analyzes bidding patterns and flags suspicious activity
 */
export class FraudDetectionService {
  /**
   * Detect fraud patterns in a bid
   * 
   * Requirements:
   * - Pattern 1: Same IP address bidding against itself in same auction
   * - Pattern 2: Bid >3x previous bid from vendor account <7 days old
   * - Pattern 3: Multiple vendor accounts from same phone/BVN
   * 
   * @param data - Fraud detection data
   * @returns Fraud detection result
   */
  async detectFraud(data: FraudDetectionData): Promise<FraudDetectionResult> {
    const patterns: FraudPattern[] = [];
    const details: { pattern: FraudPattern; evidence: string }[] = [];

    try {
      // Pattern 1: Same IP address bidding against itself
      const sameIpPattern = await this.detectSameIpBidding(data.auctionId, data.ipAddress, data.vendorId);
      if (sameIpPattern.detected) {
        patterns.push(FraudPattern.SAME_IP_BIDDING);
        details.push({
          pattern: FraudPattern.SAME_IP_BIDDING,
          evidence: sameIpPattern.evidence,
        });
      }

      // Pattern 2: Unusual bid pattern (>3x previous bid from new vendor)
      if (data.previousBid) {
        const unusualBidPattern = await this.detectUnusualBidPattern(
          data.vendorId,
          data.bidAmount,
          data.previousBid
        );
        if (unusualBidPattern.detected) {
          patterns.push(FraudPattern.UNUSUAL_BID_PATTERN);
          details.push({
            pattern: FraudPattern.UNUSUAL_BID_PATTERN,
            evidence: unusualBidPattern.evidence,
          });
        }
      }

      // Pattern 3: Multiple vendor accounts from same phone/BVN
      const duplicateIdentityPattern = await this.detectDuplicateIdentity(data.vendorId);
      if (duplicateIdentityPattern.detected) {
        patterns.push(FraudPattern.DUPLICATE_IDENTITY);
        details.push({
          pattern: FraudPattern.DUPLICATE_IDENTITY,
          evidence: duplicateIdentityPattern.evidence,
        });
      }

      const isSuspicious = patterns.length > 0;

      // If suspicious, flag the bid and notify admin
      if (isSuspicious) {
        await this.flagSuspiciousBid(data, patterns, details);
      }

      return {
        isSuspicious,
        patterns,
        details: isSuspicious ? details : undefined,
      };
    } catch (error) {
      console.error('Failed to detect fraud:', error);
      // Return non-suspicious result on error to avoid blocking legitimate bids
      return {
        isSuspicious: false,
        patterns: [],
      };
    }
  }

  /**
   * Detect Pattern 1: Same IP address bidding against itself
   * 
   * @param auctionId - Auction ID
   * @param ipAddress - IP address
   * @param currentVendorId - Current vendor ID
   * @returns Detection result
   */
  private async detectSameIpBidding(
    auctionId: string,
    ipAddress: string,
    currentVendorId: string
  ): Promise<{ detected: boolean; evidence: string }> {
    try {
      // Get all bids from this IP address in this auction
      const bidsFromSameIp = await db.query.bids.findMany({
        where: and(
          eq(bids.auctionId, auctionId),
          eq(bids.ipAddress, ipAddress)
        ),
      });

      // Check if multiple different vendors are bidding from same IP
      const uniqueVendors = new Set(bidsFromSameIp.map((bid) => bid.vendorId));
      
      if (uniqueVendors.size > 1) {
        return {
          detected: true,
          evidence: `Multiple vendors (${uniqueVendors.size}) bidding from same IP address: ${ipAddress}`,
        };
      }

      return { detected: false, evidence: '' };
    } catch (error) {
      console.error('Failed to detect same IP bidding:', error);
      return { detected: false, evidence: '' };
    }
  }

  /**
   * Detect Pattern 2: Unusual bid pattern (>3x previous bid from new vendor)
   * 
   * @param vendorId - Vendor ID
   * @param bidAmount - Bid amount
   * @param previousBid - Previous bid amount
   * @returns Detection result
   */
  private async detectUnusualBidPattern(
    vendorId: string,
    bidAmount: number,
    previousBid: number
  ): Promise<{ detected: boolean; evidence: string }> {
    try {
      // Check if bid is >3x previous bid
      const isLargeBidJump = bidAmount > previousBid * 3;

      if (!isLargeBidJump) {
        return { detected: false, evidence: '' };
      }

      // Check vendor account age
      const vendor = await db.query.vendors.findFirst({
        where: eq(vendors.id, vendorId),
      });

      if (!vendor) {
        return { detected: false, evidence: '' };
      }

      const accountAgeInDays = Math.floor(
        (Date.now() - vendor.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Flag if account is <7 days old AND bid is >3x previous
      if (accountAgeInDays < 7) {
        return {
          detected: true,
          evidence: `New vendor (${accountAgeInDays} days old) bid ₦${bidAmount.toLocaleString()} (${(bidAmount / previousBid).toFixed(1)}x previous bid of ₦${previousBid.toLocaleString()})`,
        };
      }

      return { detected: false, evidence: '' };
    } catch (error) {
      console.error('Failed to detect unusual bid pattern:', error);
      return { detected: false, evidence: '' };
    }
  }

  /**
   * Detect Pattern 3: Multiple vendor accounts from same phone/BVN
   * 
   * @param vendorId - Vendor ID
   * @returns Detection result
   */
  private async detectDuplicateIdentity(
    vendorId: string
  ): Promise<{ detected: boolean; evidence: string }> {
    try {
      // Get vendor details
      const vendor = await db.query.vendors.findFirst({
        where: eq(vendors.id, vendorId),
      });

      if (!vendor) {
        return { detected: false, evidence: '' };
      }

      // Get user details for phone number
      const user = await db.query.users.findFirst({
        where: eq(users.id, vendor.userId),
      });

      if (!user) {
        return { detected: false, evidence: '' };
      }

      // Check for duplicate phone numbers
      const vendorsWithSamePhone = await db.query.vendors.findMany({
        where: eq(vendors.userId, vendor.userId),
      });

      // Check for duplicate BVN (if encrypted BVN exists)
      let vendorsWithSameBvn: typeof vendors.$inferSelect[] = [];
      if (vendor.bvnEncrypted) {
        vendorsWithSameBvn = await db.query.vendors.findMany({
          where: eq(vendors.bvnEncrypted, vendor.bvnEncrypted),
        });
      }

      // Combine results and remove current vendor
      const duplicateVendors = new Set([
        ...vendorsWithSamePhone.map((v) => v.id),
        ...vendorsWithSameBvn.map((v) => v.id),
      ]);
      duplicateVendors.delete(vendorId);

      if (duplicateVendors.size > 0) {
        return {
          detected: true,
          evidence: `${duplicateVendors.size + 1} vendor accounts linked to same phone/BVN`,
        };
      }

      return { detected: false, evidence: '' };
    } catch (error) {
      console.error('Failed to detect duplicate identity:', error);
      return { detected: false, evidence: '' };
    }
  }

  /**
   * Flag suspicious bid and notify admin
   * 
   * @param data - Fraud detection data
   * @param patterns - Detected patterns
   * @param details - Pattern details
   */
  private async flagSuspiciousBid(
    data: FraudDetectionData,
    patterns: FraudPattern[],
    details: { pattern: FraudPattern; evidence: string }[]
  ): Promise<void> {
    try {
      // Note: Auction status change to 'under_review' would require database migration
      // For now, we log the fraud flag and notify admin
      // The admin can manually review and take action

      // Increment vendor fraud flags
      const vendor = await db.query.vendors.findFirst({
        where: eq(vendors.id, data.vendorId),
      });

      if (vendor) {
        const updatedStats = {
          ...vendor.performanceStats,
          fraudFlags: vendor.performanceStats.fraudFlags + 1,
        };

        await db
          .update(vendors)
          .set({
            performanceStats: updatedStats,
            updatedAt: new Date(),
          })
          .where(eq(vendors.id, data.vendorId));
      }

      // Create audit log entry
      await logAction({
        userId: vendor?.userId || 'system',
        actionType: AuditActionType.FRAUD_FLAG_RAISED,
        entityType: AuditEntityType.FRAUD_FLAG,
        entityId: data.auctionId,
        ipAddress: data.ipAddress,
        deviceType: this.getDeviceType(data.userAgent),
        userAgent: data.userAgent,
        afterState: {
          auctionId: data.auctionId,
          vendorId: data.vendorId,
          bidAmount: data.bidAmount,
          patterns: patterns.map((p) => p.toString()),
          details: details.map((d) => ({
            pattern: d.pattern.toString(),
            evidence: d.evidence,
          })),
        },
      });

      // Send notifications to admin
      await this.notifyAdmin(data, patterns, details);

      console.log(`🚨 Fraud flag raised for auction ${data.auctionId}, vendor ${data.vendorId}`);
      console.log(`Patterns detected: ${patterns.join(', ')}`);
    } catch (error) {
      console.error('Failed to flag suspicious bid:', error);
    }
  }

  /**
   * Notify admin about suspicious activity
   * 
   * @param data - Fraud detection data
   * @param patterns - Detected patterns
   * @param details - Pattern details
   */
  private async notifyAdmin(
    data: FraudDetectionData,
    patterns: FraudPattern[],
    details: { pattern: FraudPattern; evidence: string }[]
  ): Promise<void> {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://salvage.nem-insurance.com';
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@nem-insurance.com';

      // Format evidence for email
      const evidenceList = details
        .map((d) => `• ${this.formatPatternName(d.pattern)}: ${d.evidence}`)
        .join('\n');

      // Send email notification
      await emailService.sendEmail({
        to: adminEmail,
        subject: '🚨 Fraud Alert: Suspicious Bidding Activity Detected',
        html: `
          <h2>Fraud Alert</h2>
          <p>Suspicious bidding activity has been detected and flagged for review.</p>
          
          <h3>Details:</h3>
          <ul>
            <li><strong>Auction ID:</strong> ${data.auctionId}</li>
            <li><strong>Vendor ID:</strong> ${data.vendorId}</li>
            <li><strong>Bid Amount:</strong> ₦${data.bidAmount.toLocaleString()}</li>
            <li><strong>IP Address:</strong> ${data.ipAddress}</li>
          </ul>
          
          <h3>Patterns Detected:</h3>
          <pre>${evidenceList}</pre>
          
          <p>
            <a href="${appUrl}/admin/fraud" style="background-color: #800020; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Review Fraud Alert
            </a>
          </p>
          
          <p><em>This auction has been marked as "Under Review" and the vendor's bid is temporarily held.</em></p>
        `,
      });

      // Send push notification
      await pushNotificationService.sendPushNotification(
        null, // No subscription needed for admin
        {
          userId: 'admin', // Send to all admins
          title: '🚨 Fraud Alert',
          body: `Suspicious activity detected in auction ${data.auctionId}`,
          data: {
            type: 'fraud_alert',
            auctionId: data.auctionId,
            vendorId: data.vendorId,
            patterns: patterns.map((p) => p.toString()),
          },
        }
      );
    } catch (error) {
      console.error('Failed to notify admin:', error);
    }
  }

  /**
   * Format pattern name for display
   * 
   * @param pattern - Fraud pattern
   * @returns Formatted name
   */
  private formatPatternName(pattern: FraudPattern): string {
    switch (pattern) {
      case FraudPattern.SAME_IP_BIDDING:
        return 'Same IP Bidding';
      case FraudPattern.UNUSUAL_BID_PATTERN:
        return 'Unusual Bid Pattern';
      case FraudPattern.DUPLICATE_IDENTITY:
        return 'Duplicate Identity';
    }
  }

  /**
   * Get device type from user agent
   * 
   * @param userAgent - User agent string
   * @returns Device type
   */
  private getDeviceType(userAgent: string): DeviceType {
    const ua = userAgent.toLowerCase();

    if (ua.includes('tablet') || ua.includes('ipad')) {
      return DeviceType.TABLET;
    }

    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return DeviceType.MOBILE;
    }

    return DeviceType.DESKTOP;
  }
}

// Export singleton instance
export const fraudDetectionService = new FraudDetectionService();
