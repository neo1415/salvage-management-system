import { db } from '@/lib/db';
import { bids } from '@/lib/db/schema/bids';
import { duplicatePhotoMatches } from '@/lib/db/schema/fraud-detection';
import { eq, and, gte, inArray, sql } from 'drizzle-orm';
import crypto from 'crypto';

interface IPClusterAnalysis {
  ipAddress: string;
  vendorIds: string[];
  competingAuctions: string[];
  isSuspicious: boolean;
  reason: string;
}

/**
 * Smart IP Analysis Service
 * Detects when multiple vendors from same IP are bidding against each other
 * Does NOT flag office workers using same gateway IP
 */
export class IPAnalysisService {
  /**
   * Check if bidding patterns from an IP address are suspicious
   * Only flags if multiple vendors from same IP bid AGAINST each other
   */
  async analyzeBiddingPatterns(vendorId: string, ipAddress: string): Promise<void> {
    console.log(`🔍 Analyzing bidding patterns for vendor ${vendorId} from IP ${ipAddress}`);
    
    try {
      // Get all bids from this IP in last 24 hours
      const recentBids = await db
        .select()
        .from(bids)
        .where(
          and(
            eq(bids.ipAddress, ipAddress),
            gte(bids.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
          )
        );
      
      if (recentBids.length === 0) {
        console.log('✅ No recent bids from this IP');
        return;
      }
      
      // Get unique vendors from this IP
      const uniqueVendors = new Set(recentBids.map(b => b.vendorId));
      
      console.log(`📊 Found ${uniqueVendors.size} unique vendors from IP ${ipAddress}`);
      
      // SMART CHECK: Only flag if multiple vendors AND they're bidding against each other
      if (uniqueVendors.size > 1) {
        const vendorIds = Array.from(uniqueVendors);
        
        // Check if these vendors are bidding on the same auctions
        const competingBids = await db.execute(sql`
          SELECT 
            auction_id,
            array_agg(DISTINCT vendor_id) as vendors,
            count(DISTINCT vendor_id) as vendor_count
          FROM bids
          WHERE vendor_id = ANY(${vendorIds})
          AND created_at >= NOW() - INTERVAL '24 hours'
          GROUP BY auction_id
          HAVING count(DISTINCT vendor_id) > 1
        `);
        
        const competingAuctions = Array.isArray(competingBids) 
          ? competingBids.filter((row: any) => row.vendor_count > 1)
          : [];
        
        if (competingAuctions.length > 0) {
          // FRAUD ALERT: Multiple vendors from same IP bidding against each other
          console.log(`🚨 FRAUD DETECTED: ${uniqueVendors.size} vendors from IP ${ipAddress} are bidding against each other`);
          
          await this.createIPFraudAlert({
            ipAddress,
            vendorIds,
            competingAuctions: competingAuctions.map((a: any) => a.auction_id),
            severity: 'high',
          });
        } else {
          // OK: Multiple vendors from same IP but NOT competing (e.g., office gateway)
          console.log(`✅ Multiple vendors from ${ipAddress} but not competing - likely shared gateway`);
        }
      } else {
        console.log(`✅ Only one vendor from IP ${ipAddress} - no fraud risk`);
      }
    } catch (error) {
      console.error('❌ Failed to analyze bidding patterns:', error);
      // Don't throw - fraud detection should not block normal operations
    }
  }
  
  /**
   * Analyze IP clustering patterns
   * Detects multiple accounts from same IP
   */
  async analyzeIPClustering(ipAddress: string): Promise<IPClusterAnalysis> {
    // Get all vendors who have bid from this IP
    const vendorBids = await db.execute(sql`
      SELECT DISTINCT vendor_id
      FROM bids
      WHERE ip_address = ${ipAddress}
      AND created_at >= NOW() - INTERVAL '7 days'
    `);
    
    const vendorIds = Array.isArray(vendorBids) 
      ? vendorBids.map((row: any) => row.vendor_id)
      : [];
    
    if (vendorIds.length <= 1) {
      return {
        ipAddress,
        vendorIds,
        competingAuctions: [],
        isSuspicious: false,
        reason: 'Single vendor from this IP',
      };
    }
    
    // Check for competing bids
    const competingBids = await db.execute(sql`
      SELECT 
        auction_id,
        count(DISTINCT vendor_id) as vendor_count
      FROM bids
      WHERE vendor_id = ANY(${vendorIds})
      AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY auction_id
      HAVING count(DISTINCT vendor_id) > 1
    `);
    
    const competingAuctions = Array.isArray(competingBids)
      ? competingBids.map((row: any) => row.auction_id)
      : [];
    
    const isSuspicious = competingAuctions.length > 0;
    
    return {
      ipAddress,
      vendorIds,
      competingAuctions,
      isSuspicious,
      reason: isSuspicious
        ? `${vendorIds.length} vendors from same IP bidding on ${competingAuctions.length} shared auctions`
        : `${vendorIds.length} vendors from same IP but not competing`,
    };
  }
  
  /**
   * Create fraud alert for IP-based fraud
   */
  private async createIPFraudAlert(data: {
    ipAddress: string;
    vendorIds: string[];
    competingAuctions: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<void> {
    // TODO: Create fraud alert in proper table
    console.log(`⚠️ Fraud alert would be created for IP ${data.ipAddress}`);
    console.log(`   Vendors: ${data.vendorIds.length}, Auctions: ${data.competingAuctions.length}`);
  }
  
  /**
   * Get fraud history for an IP address
   */
  async getIPFraudHistory(ipAddress: string): Promise<any[]> {
    // TODO: Query fraud alerts table
    return [];
  }
  
  /**
   * Check if IP address is flagged for fraud
   */
  async isIPFlagged(ipAddress: string): Promise<boolean> {
    // TODO: Check fraud alerts table
    return false;
  }
}

// Export singleton instance
export const ipAnalysisService = new IPAnalysisService();
