import { db } from '@/lib/db';
import { bids } from '@/lib/db/schema/bids';
import { auctions } from '@/lib/db/schema/auctions';
import { vendors } from '@/lib/db/schema/vendors';
import { eq, and, gte, desc, sql } from 'drizzle-orm';

interface ShillBiddingAnalysis {
  vendorId: string;
  totalScore: number;
  patterns: {
    repeatedLosses: RepeatedLossPattern;
    sellerAffinity: SellerAffinityPattern;
    lastMinuteBidding: LastMinuteBiddingPattern;
    bidEscalation: BidEscalationPattern;
    newAccountPattern: NewAccountPattern;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface RepeatedLossPattern {
  totalBids: number;
  totalLosses: number;
  lossRate: number;
  sameWinnerCount: number;
  score: number;
}

interface SellerAffinityPattern {
  totalBids: number;
  bidsOnSameSeller: number;
  bidPercentage: number;
  score: number;
}

interface LastMinuteBiddingPattern {
  totalBids: number;
  lastMinuteBids: number;
  ratio: number;
  score: number;
}

interface BidEscalationPattern {
  totalBids: number;
  rapidBids: number;
  averageTimeBetweenBids: number;
  score: number;
}

interface NewAccountPattern {
  accountAge: number;
  bidsPlaced: number;
  score: number;
}

/**
 * Shill Bidding Detection Service
 * Detects suspicious bidding patterns that indicate shill bidding
 */
export class ShillBiddingDetectionService {
  /**
   * Analyze a vendor for shill bidding patterns
   */
  async analyzeVendorForShillBidding(vendorId: string): Promise<ShillBiddingAnalysis> {
    console.log(`🔍 Analyzing vendor ${vendorId} for shill bidding patterns...`);
    
    try {
      // Get vendor's bid history (last 30 days)
      const bidHistory = await db
        .select()
        .from(bids)
        .where(
          and(
            eq(bids.vendorId, vendorId),
            gte(bids.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
          )
        )
        .orderBy(desc(bids.createdAt))
        .limit(100);
      
      if (bidHistory.length === 0) {
        console.log(`ℹ️  No bid history for vendor ${vendorId}`);
        return this.createEmptyAnalysis(vendorId);
      }
      
      console.log(`📊 Analyzing ${bidHistory.length} bids for vendor ${vendorId}`);
      
      // Run all pattern analyses
      const repeatedLosses = await this.analyzeRepeatedLosses(vendorId, bidHistory);
      const sellerAffinity = await this.analyzeSellerAffinity(vendorId, bidHistory);
      const lastMinuteBidding = await this.analyzeLastMinuteBidding(bidHistory);
      const bidEscalation = this.analyzeBidEscalation(bidHistory);
      const newAccountPattern = await this.analyzeNewAccountPattern(vendorId);
      
      // Calculate total fraud score
      const totalScore = 
        repeatedLosses.score +
        sellerAffinity.score +
        lastMinuteBidding.score +
        bidEscalation.score +
        newAccountPattern.score;
      
      // Determine risk level
      let riskLevel: 'low' | 'medium' | 'high' | 'critical';
      if (totalScore >= 80) riskLevel = 'critical';
      else if (totalScore >= 60) riskLevel = 'high';
      else if (totalScore >= 40) riskLevel = 'medium';
      else riskLevel = 'low';
      
      console.log(`📊 Shill bidding analysis for vendor ${vendorId}:`);
      console.log(`   Total Score: ${totalScore}/100`);
      console.log(`   Risk Level: ${riskLevel}`);
      console.log(`   Repeated Losses: ${repeatedLosses.score}/30`);
      console.log(`   Seller Affinity: ${sellerAffinity.score}/25`);
      console.log(`   Last Minute Bidding: ${lastMinuteBidding.score}/20`);
      console.log(`   Bid Escalation: ${bidEscalation.score}/15`);
      console.log(`   New Account: ${newAccountPattern.score}/10`);
      
      return {
        vendorId,
        totalScore,
        patterns: {
          repeatedLosses,
          sellerAffinity,
          lastMinuteBidding,
          bidEscalation,
          newAccountPattern,
        },
        riskLevel,
      };
    } catch (error) {
      console.error(`❌ Failed to analyze vendor ${vendorId}:`, error);
      return this.createEmptyAnalysis(vendorId);
    }
  }
  
  /**
   * Pattern 1: Repeated losses to same winner
   * Shill bidders often lose to the same person repeatedly
   */
  private async analyzeRepeatedLosses(
    vendorId: string,
    bidHistory: any[]
  ): Promise<RepeatedLossPattern> {
    // Get auctions where vendor bid but didn't win
    const auctionIds = bidHistory.map(b => b.auctionId);
    
    const closedAuctions = await db
      .select()
      .from(auctions)
      .where(
        and(
          sql`${auctions.id} = ANY(${auctionIds})`,
          sql`${auctions.status} IN ('closed', 'completed')`,
          sql`${auctions.winnerId} IS NOT NULL`,
          sql`${auctions.winnerId} != ${vendorId}`
        )
      );
    
    const totalLosses = closedAuctions.length;
    const totalBids = bidHistory.length;
    const lossRate = totalBids > 0 ? totalLosses / totalBids : 0;
    
    // Count how many times they lost to the same winner
    const winnerCounts = new Map<string, number>();
    closedAuctions.forEach(auction => {
      if (auction.winnerId) {
        winnerCounts.set(auction.winnerId, (winnerCounts.get(auction.winnerId) || 0) + 1);
      }
    });
    
    const maxSameWinner = Math.max(...Array.from(winnerCounts.values()), 0);
    const sameWinnerRate = totalLosses > 0 ? maxSameWinner / totalLosses : 0;
    
    // Score: 0-30 points
    let score = 0;
    if (lossRate > 0.8 && sameWinnerRate > 0.5) score = 30; // Very suspicious
    else if (lossRate > 0.7 && sameWinnerRate > 0.4) score = 20;
    else if (lossRate > 0.6 && sameWinnerRate > 0.3) score = 10;
    
    return {
      totalBids,
      totalLosses,
      lossRate,
      sameWinnerCount: maxSameWinner,
      score,
    };
  }
  
  /**
   * Pattern 2: Seller affinity
   * Shill bidders often only bid on specific seller's auctions
   */
  private async analyzeSellerAffinity(
    vendorId: string,
    bidHistory: any[]
  ): Promise<SellerAffinityPattern> {
    // Get auctions and their associated cases (to find sellers)
    const auctionIds = bidHistory.map(b => b.auctionId);
    
    const auctionsWithCases = await db.execute(sql`
      SELECT a.id, c.adjuster_id
      FROM auctions a
      JOIN cases c ON a.case_id = c.id
      WHERE a.id = ANY(${auctionIds})
    `);
    
    const adjusterCounts = new Map<string, number>();
    const results = Array.isArray(auctionsWithCases) ? auctionsWithCases : [];
    
    results.forEach((row: any) => {
      if (row.adjuster_id) {
        adjusterCounts.set(row.adjuster_id, (adjusterCounts.get(row.adjuster_id) || 0) + 1);
      }
    });
    
    const maxSameAdjuster = Math.max(...Array.from(adjusterCounts.values()), 0);
    const totalBids = bidHistory.length;
    const bidPercentage = totalBids > 0 ? maxSameAdjuster / totalBids : 0;
    
    // Score: 0-25 points
    let score = 0;
    if (bidPercentage > 0.7) score = 25; // Very suspicious
    else if (bidPercentage > 0.6) score = 18;
    else if (bidPercentage > 0.5) score = 10;
    
    return {
      totalBids,
      bidsOnSameSeller: maxSameAdjuster,
      bidPercentage,
      score,
    };
  }
  
  /**
   * Pattern 3: Last-minute bidding
   * Shill bidders often bid in the last few minutes to drive up price
   */
  private async analyzeLastMinuteBidding(bidHistory: any[]): Promise<LastMinuteBiddingPattern> {
    // Get auction end times
    const auctionIds = bidHistory.map(b => b.auctionId);
    
    const auctionsData = await db
      .select({
        id: auctions.id,
        endTime: auctions.endTime,
      })
      .from(auctions)
      .where(sql`${auctions.id} = ANY(${auctionIds})`);
    
    const auctionEndTimes = new Map(
      auctionsData.map(a => [a.id, a.endTime])
    );
    
    // Count bids placed in last 5 minutes
    let lastMinuteBids = 0;
    bidHistory.forEach(bid => {
      const endTime = auctionEndTimes.get(bid.auctionId);
      if (endTime) {
        const timeDiff = endTime.getTime() - bid.createdAt.getTime();
        if (timeDiff <= 5 * 60 * 1000) { // 5 minutes
          lastMinuteBids++;
        }
      }
    });
    
    const ratio = bidHistory.length > 0 ? lastMinuteBids / bidHistory.length : 0;
    
    // Score: 0-20 points
    let score = 0;
    if (ratio > 0.6) score = 20; // Very suspicious
    else if (ratio > 0.5) score = 15;
    else if (ratio > 0.4) score = 8;
    
    return {
      totalBids: bidHistory.length,
      lastMinuteBids,
      ratio,
      score,
    };
  }
  
  /**
   * Pattern 4: Rapid bid escalation
   * Shill bidders often place bids very quickly to drive up price
   */
  private analyzeBidEscalation(bidHistory: any[]): BidEscalationPattern {
    if (bidHistory.length < 2) {
      return {
        totalBids: bidHistory.length,
        rapidBids: 0,
        averageTimeBetweenBids: 0,
        score: 0,
      };
    }
    
    // Calculate time between consecutive bids
    const timeDiffs: number[] = [];
    for (let i = 1; i < bidHistory.length; i++) {
      const diff = bidHistory[i - 1].createdAt.getTime() - bidHistory[i].createdAt.getTime();
      timeDiffs.push(Math.abs(diff) / 1000); // Convert to seconds
    }
    
    const averageTimeBetweenBids = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
    const rapidBids = timeDiffs.filter(t => t < 30).length; // Less than 30 seconds
    
    // Score: 0-15 points
    let score = 0;
    if (averageTimeBetweenBids < 30 && rapidBids > 5) score = 15; // Very suspicious
    else if (averageTimeBetweenBids < 60 && rapidBids > 3) score = 10;
    else if (averageTimeBetweenBids < 120 && rapidBids > 2) score = 5;
    
    return {
      totalBids: bidHistory.length,
      rapidBids,
      averageTimeBetweenBids,
      score,
    };
  }
  
  /**
   * Pattern 5: New account with aggressive bidding
   * New accounts that immediately start bidding aggressively are suspicious
   */
  private async analyzeNewAccountPattern(vendorId: string): Promise<NewAccountPattern> {
    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.id, vendorId),
    });
    
    if (!vendor) {
      return {
        accountAge: 0,
        bidsPlaced: 0,
        score: 0,
      };
    }
    
    const accountAge = Math.floor(
      (Date.now() - vendor.createdAt.getTime()) / (24 * 60 * 60 * 1000)
    );
    
    // Count total bids
    const bidCount = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM bids
      WHERE vendor_id = ${vendorId}
    `);
    
    const bidsPlaced = Array.isArray(bidCount) && bidCount[0] ? Number(bidCount[0].count) : 0;
    
    // Score: 0-10 points
    let score = 0;
    if (accountAge < 7 && bidsPlaced > 10) score = 10; // Very suspicious
    else if (accountAge < 14 && bidsPlaced > 15) score = 7;
    else if (accountAge < 30 && bidsPlaced > 20) score = 4;
    
    return {
      accountAge,
      bidsPlaced,
      score,
    };
  }
  
  /**
   * Create empty analysis result
   */
  private createEmptyAnalysis(vendorId: string): ShillBiddingAnalysis {
    return {
      vendorId,
      totalScore: 0,
      patterns: {
        repeatedLosses: {
          totalBids: 0,
          totalLosses: 0,
          lossRate: 0,
          sameWinnerCount: 0,
          score: 0,
        },
        sellerAffinity: {
          totalBids: 0,
          bidsOnSameSeller: 0,
          bidPercentage: 0,
          score: 0,
        },
        lastMinuteBidding: {
          totalBids: 0,
          lastMinuteBids: 0,
          ratio: 0,
          score: 0,
        },
        bidEscalation: {
          totalBids: 0,
          rapidBids: 0,
          averageTimeBetweenBids: 0,
          score: 0,
        },
        newAccountPattern: {
          accountAge: 0,
          bidsPlaced: 0,
          score: 0,
        },
      },
      riskLevel: 'low',
    };
  }
}

// Export singleton instance
export const shillBiddingDetectionService = new ShillBiddingDetectionService();
