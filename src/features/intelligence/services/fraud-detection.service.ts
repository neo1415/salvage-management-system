/**
 * FraudDetectionService
 * 
 * Enterprise-grade fraud detection service for marketplace intelligence.
 * Implements photo authenticity detection, shill bidding detection, claim pattern fraud,
 * and vendor-adjuster collusion detection.
 * 
 * @module intelligence/services/fraud-detection
 */

import { db } from '@/lib/db';
import { eq, and, sql, desc, gte, lte, inArray } from 'drizzle-orm';
import { 
  fraudAlerts,
} from '@/lib/db/schema/intelligence';
import {
  photoHashes,
  photoHashIndex,
  duplicatePhotoMatches,
} from '@/lib/db/schema/fraud-detection';
import { fraudDetectionLogs } from '@/lib/db/schema/ml-training';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';
import { bids } from '@/lib/db/schema/bids';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';

/**
 * Photo authenticity result interface
 */
export interface PhotoAuthenticityResult {
  photoUrl: string;
  isAuthentic: boolean;
  riskScore: number;
  flagReasons: string[];
  duplicateMatches: Array<{
    caseId: string;
    photoUrl: string;
    hammingDistance: number;
    similarityScore: number;
  }>;
  exifAnalysis?: {
    hasExif: boolean;
    timestamp?: string;
    gpsCoordinates?: { lat: number; lng: number };
    cameraModel?: string;
  };
  aiAnalysis?: {
    isAiGenerated: boolean;
    confidence: number;
  };
}

/**
 * Shill bidding detection result interface
 */
export interface ShillBiddingResult {
  isShillBidding: boolean;
  riskScore: number;
  flagReasons: string[];
  suspiciousPatterns: Array<{
    vendorId: string;
    pattern: string;
    evidence: any;
  }>;
}

/**
 * Claim pattern fraud result interface
 */
export interface ClaimPatternResult {
  isFraudulent: boolean;
  riskScore: number;
  flagReasons: string[];
  similarClaims: Array<{
    caseId: string;
    similarity: number;
    daysBetween: number;
  }>;
}

/**
 * Collusion detection result interface
 */
export interface CollusionResult {
  isCollusion: boolean;
  riskScore: number;
  flagReasons: string[];
  collusionPairs: Array<{
    vendorId: string;
    adjusterId: string;
    winRate: number;
    suspiciousWins: number;
  }>;
}

export class FraudDetectionService {
  /**
   * Analyze photo authenticity using pHash and Gemini AI
   * Tasks 4.1.1-4.1.7
   */
  async analyzePhotoAuthenticity(
    caseId: string,
    photoUrls: string[]
  ): Promise<PhotoAuthenticityResult[]> {
    const results: PhotoAuthenticityResult[] = [];

    for (let i = 0; i < photoUrls.length; i++) {
      const photoUrl = photoUrls[i];
      
      // Task 4.1.1: Compute perceptual hash
      const pHash = await this.computePerceptualHash(photoUrl);
      
      // Task 4.1.5: Extract EXIF metadata
      const exifData = await this.extractExifMetadata(photoUrl);
      
      // Task 4.1.2-4.1.3: Find duplicate matches using multi-index hashing
      const duplicates = await this.findDuplicatePhotos(pHash, caseId);
      
      // Task 4.1.4: Contextual analysis to reduce false positives
      const contextualRisk = await this.analyzePhotoContext(
        caseId,
        duplicates,
        exifData
      );
      
      // Task 4.1.6: Gemini AI authenticity analysis
      const aiAnalysis = await this.analyzePhotoWithGemini(photoUrl);
      
      // Calculate overall risk score
      const riskScore = this.calculatePhotoRiskScore(
        duplicates,
        contextualRisk,
        exifData,
        aiAnalysis
      );
      
      const flagReasons: string[] = [];
      if (duplicates.length > 0) {
        flagReasons.push(`Found ${duplicates.length} duplicate photo(s)`);
      }
      if (!exifData.hasExif) {
        flagReasons.push('Missing EXIF metadata');
      }
      if (aiAnalysis.isAiGenerated) {
        flagReasons.push('AI-generated image detected');
      }
      
      // Store photo hash
      await this.storePhotoHash(caseId, photoUrl, i, pHash, exifData, aiAnalysis);
      
      results.push({
        photoUrl,
        isAuthentic: riskScore < 50,
        riskScore,
        flagReasons,
        duplicateMatches: duplicates,
        exifAnalysis: exifData,
        aiAnalysis,
      });
    }

    return results;
  }

  /**
   * Compute perceptual hash (pHash) for an image
   * Task 4.1.1: Implement perceptual hashing computation
   */
  private async computePerceptualHash(photoUrl: string): Promise<string> {
    // In production, use a library like 'sharp' + 'phash' or 'jimp'
    // For now, return a placeholder implementation
    // TODO: Implement actual pHash computation using image processing library
    
    // Placeholder: Generate a deterministic hash based on URL
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(photoUrl).digest('hex');
    return hash.substring(0, 64); // 64-character hex string
  }

  /**
   * Extract EXIF metadata from photo
   * Task 4.1.5: Implement EXIF metadata extraction
   */
  private async extractExifMetadata(photoUrl: string): Promise<any> {
    // In production, use 'exif-parser' or 'exifr' library
    // TODO: Implement actual EXIF extraction
    
    return {
      hasExif: false,
      timestamp: undefined,
      gpsCoordinates: undefined,
      cameraModel: undefined,
    };
  }

  /**
   * Find duplicate photos using multi-index hashing
   * Tasks 4.1.2-4.1.3: Multi-index hashing and Hamming distance
   */
  private async findDuplicatePhotos(
    pHash: string,
    excludeCaseId: string
  ): Promise<Array<{ caseId: string; photoUrl: string; hammingDistance: number; similarityScore: number }>> {
    // Split pHash into 4 segments for multi-index lookup
    const segments = [
      pHash.substring(0, 16),
      pHash.substring(16, 32),
      pHash.substring(32, 48),
      pHash.substring(48, 64),
    ];

    // Find potential matches using segment matching
    const potentialMatches: any = await db.execute(sql`
      SELECT DISTINCT
        phi.case_id,
        phi.photo_url,
        phi.full_p_hash
      FROM ${photoHashIndex} phi
      WHERE phi.segment_value IN (${segments[0]}, ${segments[1]}, ${segments[2]}, ${segments[3]})
        AND phi.case_id != ${excludeCaseId}
      LIMIT 100
    `);

    // Calculate Hamming distance for each match
    const matches = [];
    for (const match of potentialMatches) {
      const hammingDistance = this.calculateHammingDistance(pHash, match.full_p_hash);
      
      // Consider it a match if Hamming distance <= 10 (out of 64 bits)
      if (hammingDistance <= 10) {
        const similarityScore = Math.round(((64 - hammingDistance) / 64) * 100);
        matches.push({
          caseId: match.case_id,
          photoUrl: match.photo_url,
          hammingDistance,
          similarityScore,
        });
      }
    }

    return matches.sort((a, b) => a.hammingDistance - b.hammingDistance);
  }

  /**
   * Calculate Hamming distance between two hashes
   */
  private calculateHammingDistance(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) {
      throw new Error('Hashes must be same length');
    }

    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        distance++;
      }
    }
    return distance;
  }

  /**
   * Analyze photo context to reduce false positives
   * Task 4.1.4: Contextual analysis
   */
  private async analyzePhotoContext(
    caseId: string,
    duplicates: any[],
    exifData: any
  ): Promise<number> {
    if (duplicates.length === 0) {
      return 0;
    }

    let contextualRisk = 0;

    // Check if duplicates are from same user
    const caseData = await db
      .select({ userId: salvageCases.userId })
      .from(salvageCases)
      .where(eq(salvageCases.id, caseId))
      .limit(1);

    if (caseData.length > 0) {
      const userId = caseData[0].userId;
      
      for (const dup of duplicates) {
        const dupCase = await db
          .select({ userId: salvageCases.userId, createdAt: salvageCases.createdAt })
          .from(salvageCases)
          .where(eq(salvageCases.id, dup.caseId))
          .limit(1);

        if (dupCase.length > 0) {
          // Same user submitting duplicate photos = high risk
          if (dupCase[0].userId === userId) {
            contextualRisk += 40;
          } else {
            contextualRisk += 20;
          }
        }
      }
    }

    // Missing EXIF data increases risk
    if (!exifData.hasExif) {
      contextualRisk += 15;
    }

    return Math.min(100, contextualRisk);
  }

  /**
   * Analyze photo with Gemini AI
   * Task 4.1.6: Gemini AI integration
   */
  private async analyzePhotoWithGemini(photoUrl: string): Promise<{ isAiGenerated: boolean; confidence: number }> {
    // TODO: Integrate with Gemini AI API for photo authenticity analysis
    // For now, return placeholder
    return {
      isAiGenerated: false,
      confidence: 0.5,
    };
  }

  /**
   * Calculate overall photo risk score
   */
  private calculatePhotoRiskScore(
    duplicates: any[],
    contextualRisk: number,
    exifData: any,
    aiAnalysis: any
  ): number {
    let riskScore = 0;

    // Duplicate photos contribute to risk
    if (duplicates.length > 0) {
      riskScore += Math.min(50, duplicates.length * 25);
    }

    // Add contextual risk
    riskScore += contextualRisk * 0.3;

    // AI-generated images
    if (aiAnalysis.isAiGenerated) {
      riskScore += 30;
    }

    return Math.min(100, Math.round(riskScore));
  }

  /**
   * Store photo hash in database
   */
  private async storePhotoHash(
    caseId: string,
    photoUrl: string,
    photoIndex: number,
    pHash: string,
    exifData: any,
    aiAnalysis: any
  ): Promise<void> {
    // Insert photo hash
    const [photoHashRecord] = await db
      .insert(photoHashes)
      .values({
        caseId,
        photoUrl,
        photoIndex,
        pHash,
        exifData: exifData.hasExif ? exifData : null,
        complexity: 50, // TODO: Calculate actual complexity
        isLowComplexity: false,
        authenticityAnalysis: {
          isAiGenerated: aiAnalysis.isAiGenerated,
          confidence: aiAnalysis.confidence,
        },
      })
      .returning({ id: photoHashes.id });

    // Insert multi-index segments
    const segments = [
      { num: 1, value: pHash.substring(0, 16) },
      { num: 2, value: pHash.substring(16, 32) },
      { num: 3, value: pHash.substring(32, 48) },
      { num: 4, value: pHash.substring(48, 64) },
    ];

    await db.insert(photoHashIndex).values(
      segments.map(seg => ({
        photoHashId: photoHashRecord.id,
        segmentNumber: seg.num,
        segmentValue: seg.value,
        fullPHash: pHash,
        caseId,
        photoUrl,
      }))
    );
  }

  /**
   * Detect shill bidding patterns
   * Tasks 4.2.1-4.2.5
   */
  async detectShillBidding(auctionId: string): Promise<ShillBiddingResult> {
    const flagReasons: string[] = [];
    const suspiciousPatterns: Array<{ vendorId: string; pattern: string; evidence: any }> = [];
    let riskScore = 0;

    // Task 4.2.1: Detect consecutive bids from same vendor
    const consecutiveBids: any = await db.execute(sql`
      WITH bid_sequence AS (
        SELECT 
          b.vendor_id,
          b.amount,
          b.created_at,
          LAG(b.vendor_id) OVER (ORDER BY b.created_at) AS prev_vendor_id,
          LAG(b.created_at) OVER (ORDER BY b.created_at) AS prev_bid_time
        FROM ${bids} b
        WHERE b.auction_id = ${auctionId}
        ORDER BY b.created_at
      )
      SELECT 
        vendor_id,
        COUNT(*) AS consecutive_count
      FROM bid_sequence
      WHERE vendor_id = prev_vendor_id
      GROUP BY vendor_id
      HAVING COUNT(*) >= 3
    `);

    if (consecutiveBids.length > 0) {
      for (const pattern of consecutiveBids) {
        flagReasons.push(`Vendor ${pattern.vendor_id} placed ${pattern.consecutive_count} consecutive bids`);
        suspiciousPatterns.push({
          vendorId: pattern.vendor_id,
          pattern: 'consecutive_bids',
          evidence: { count: pattern.consecutive_count },
        });
        riskScore += 30;
      }
    }

    // Task 4.2.2: Analyze bid timing patterns
    const timingPatterns: any = await db.execute(sql`
      SELECT 
        b.vendor_id,
        COUNT(*) AS bid_count,
        AVG(EXTRACT(EPOCH FROM (b.created_at - LAG(b.created_at) OVER (ORDER BY b.created_at)))) AS avg_time_between_bids
      FROM ${bids} b
      WHERE b.auction_id = ${auctionId}
      GROUP BY b.vendor_id
      HAVING COUNT(*) >= 5
        AND AVG(EXTRACT(EPOCH FROM (b.created_at - LAG(b.created_at) OVER (ORDER BY b.created_at)))) < 60
    `);

    if (timingPatterns.length > 0) {
      for (const pattern of timingPatterns) {
        flagReasons.push(`Vendor ${pattern.vendor_id} has suspicious rapid bidding pattern`);
        suspiciousPatterns.push({
          vendorId: pattern.vendor_id,
          pattern: 'rapid_bidding',
          evidence: { avgTimeBetween: pattern.avg_time_between_bids },
        });
        riskScore += 25;
      }
    }

    // Task 4.2.3: Detect vendor collusion (multiple vendors from same IP/device)
    // Task 4.2.4: Implement IP address and device fingerprint analysis
    const ipCollusion: any = await db.execute(sql`
      WITH vendor_ips AS (
        SELECT 
          b.vendor_id,
          b.metadata->>'ipAddress' AS ip_address,
          b.metadata->>'deviceFingerprint' AS device_fingerprint,
          COUNT(*) AS bid_count
        FROM ${bids} b
        WHERE b.auction_id = ${auctionId}
          AND b.metadata IS NOT NULL
        GROUP BY b.vendor_id, b.metadata->>'ipAddress', b.metadata->>'deviceFingerprint'
      )
      SELECT 
        ip_address,
        device_fingerprint,
        COUNT(DISTINCT vendor_id) AS vendor_count,
        ARRAY_AGG(DISTINCT vendor_id) AS vendor_ids
      FROM vendor_ips
      WHERE ip_address IS NOT NULL OR device_fingerprint IS NOT NULL
      GROUP BY ip_address, device_fingerprint
      HAVING COUNT(DISTINCT vendor_id) >= 2
    `);

    if (ipCollusion.length > 0) {
      for (const pattern of ipCollusion) {
        const vendorIds = pattern.vendor_ids.join(', ');
        if (pattern.ip_address) {
          flagReasons.push(`Multiple vendors (${vendorIds}) bidding from same IP: ${pattern.ip_address}`);
        }
        if (pattern.device_fingerprint) {
          flagReasons.push(`Multiple vendors (${vendorIds}) using same device fingerprint`);
        }
        
        for (const vendorId of pattern.vendor_ids) {
          suspiciousPatterns.push({
            vendorId,
            pattern: 'ip_device_collusion',
            evidence: {
              ipAddress: pattern.ip_address,
              deviceFingerprint: pattern.device_fingerprint,
              colludingVendors: pattern.vendor_ids,
            },
          });
        }
        riskScore += 35;
      }
    }

    return {
      isShillBidding: riskScore >= 50,
      riskScore: Math.min(100, riskScore),
      flagReasons,
      suspiciousPatterns,
    };
  }

  /**
   * Analyze claim patterns for fraud
   * Tasks 4.3.1-4.3.5
   */
  async analyzeClaimPatterns(caseId: string): Promise<ClaimPatternResult> {
    const flagReasons: string[] = [];
    const similarClaims: Array<{ caseId: string; similarity: number; daysBetween: number }> = [];
    let riskScore = 0;

    // Get case details
    const caseData = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.id, caseId))
      .limit(1);

    if (caseData.length === 0) {
      throw new Error('Case not found');
    }

    const targetCase = caseData[0];

    // Task 4.3.1: Detect repeat claimants
    const repeatClaims: any = await db.execute(sql`
      SELECT 
        sc.id,
        sc.created_at,
        sc.asset_details,
        sc.damage_severity,
        EXTRACT(DAY FROM (${new Date()} - sc.created_at)) AS days_ago
      FROM ${salvageCases} sc
      WHERE sc.user_id = ${targetCase.userId}
        AND sc.id != ${caseId}
        AND sc.created_at > NOW() - INTERVAL '12 months'
      ORDER BY sc.created_at DESC
      LIMIT 10
    `);

    if (repeatClaims.length >= 3) {
      flagReasons.push(`User has ${repeatClaims.length} claims in past 12 months`);
      riskScore += 20;
    }

    // Task 4.3.2: Detect similar damage patterns (Jaccard similarity)
    for (const claim of repeatClaims) {
      const similarity = this.calculateDamageSimilarity(
        targetCase.damagedParts as string[] || [],
        claim.damaged_parts || []
      );

      if (similarity > 0.7) {
        const daysBetween = Math.round(claim.days_ago);
        similarClaims.push({
          caseId: claim.id,
          similarity: Math.round(similarity * 100),
          daysBetween,
        });
        
        if (daysBetween < 90) {
          flagReasons.push(`Similar damage pattern found in claim from ${daysBetween} days ago`);
          riskScore += 25;
        }
      }
    }

    // Task 4.3.3: Geographic clustering detection
    const geoClusters: any = await db.execute(sql`
      WITH case_locations AS (
        SELECT 
          sc.id,
          sc.created_at,
          sc.asset_details->>'region' AS region,
          sc.asset_details->>'city' AS city,
          EXTRACT(DAY FROM (${new Date()} - sc.created_at)) AS days_ago
        FROM ${salvageCases} sc
        WHERE sc.user_id = ${targetCase.userId}
          AND sc.id != ${caseId}
          AND sc.created_at > NOW() - INTERVAL '12 months'
          AND sc.asset_details->>'region' IS NOT NULL
      )
      SELECT 
        region,
        city,
        COUNT(*) AS case_count,
        MIN(days_ago) AS most_recent_days_ago
      FROM case_locations
      GROUP BY region, city
      HAVING COUNT(*) >= 2
    `);

    if (geoClusters.length > 0) {
      for (const cluster of geoClusters) {
        const caseCount = parseInt(cluster.case_count);
        const location = cluster.city ? `${cluster.city}, ${cluster.region}` : cluster.region;
        
        if (caseCount >= 3) {
          flagReasons.push(`${caseCount} claims from same location: ${location}`);
          riskScore += 30;
        } else if (caseCount === 2 && cluster.most_recent_days_ago < 60) {
          flagReasons.push(`Multiple recent claims from ${location}`);
          riskScore += 15;
        }
      }
    }

    // Task 4.3.4: Case creation velocity
    const recentCases = repeatClaims.filter((c: any) => c.days_ago < 30);
    if (recentCases.length >= 2) {
      flagReasons.push(`${recentCases.length} cases created in past 30 days`);
      riskScore += 20;
    }

    return {
      isFraudulent: riskScore >= 50,
      riskScore: Math.min(100, riskScore),
      flagReasons,
      similarClaims,
    };
  }

  /**
   * Calculate Jaccard similarity between two damage part sets
   */
  private calculateDamageSimilarity(parts1: string[], parts2: string[]): number {
    if (parts1.length === 0 && parts2.length === 0) return 0;
    
    const set1 = new Set(parts1.map(p => p.toLowerCase()));
    const set2 = new Set(parts2.map(p => p.toLowerCase()));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Detect vendor-adjuster collusion
   * Tasks 4.4.1-4.4.4
   */
  async detectCollusion(vendorId?: string, adjusterId?: string): Promise<CollusionResult> {
    const flagReasons: string[] = [];
    const collusionPairs: Array<{ vendorId: string; adjusterId: string; winRate: number; suspiciousWins: number }> = [];
    let riskScore = 0;

    // Task 4.4.1: Analyze win patterns for vendor-adjuster pairs
    const winPatterns: any = await db.execute(sql`
      WITH vendor_adjuster_pairs AS (
        SELECT 
          a.current_bidder AS vendor_id,
          sc.adjuster_id,
          COUNT(*) AS total_auctions,
          COUNT(*) FILTER (WHERE a.current_bidder IS NOT NULL) AS wins,
          COUNT(*) FILTER (WHERE a.current_bidder IS NOT NULL)::float / NULLIF(COUNT(*), 0) AS win_rate
        FROM ${auctions} a
        JOIN ${salvageCases} sc ON a.case_id = sc.id
        WHERE a.status = 'closed'
          AND a.end_time > NOW() - INTERVAL '6 months'
          ${vendorId ? sql`AND a.current_bidder = ${vendorId}` : sql``}
          ${adjusterId ? sql`AND sc.adjuster_id = ${adjusterId}` : sql``}
        GROUP BY a.current_bidder, sc.adjuster_id
        HAVING COUNT(*) >= 5
      )
      SELECT *
      FROM vendor_adjuster_pairs
      WHERE win_rate > 0.7
      ORDER BY win_rate DESC
      LIMIT 20
    `);

    for (const pair of winPatterns) {
      const winRate = parseFloat(pair.win_rate);
      const wins = parseInt(pair.wins);

      if (winRate > 0.8 && wins >= 5) {
        flagReasons.push(`Vendor ${pair.vendor_id} wins ${Math.round(winRate * 100)}% of auctions with adjuster ${pair.adjuster_id}`);
        collusionPairs.push({
          vendorId: pair.vendor_id,
          adjusterId: pair.adjuster_id,
          winRate: Math.round(winRate * 100),
          suspiciousWins: wins,
        });
        riskScore += 40;
      }
    }

    // Task 4.4.2: Analyze bid timing patterns (last 5 minutes)
    const lastMinuteBids: any = await db.execute(sql`
      SELECT 
        b.vendor_id,
        sc.adjuster_id,
        COUNT(*) AS last_minute_wins
      FROM ${bids} b
      JOIN ${auctions} a ON b.auction_id = a.id
      JOIN ${salvageCases} sc ON a.case_id = sc.id
      WHERE a.status = 'closed'
        AND a.current_bidder = b.vendor_id
        AND b.created_at > a.end_time - INTERVAL '5 minutes'
        AND a.end_time > NOW() - INTERVAL '6 months'
        ${vendorId ? sql`AND b.vendor_id = ${vendorId}` : sql``}
        ${adjusterId ? sql`AND sc.adjuster_id = ${adjusterId}` : sql``}
      GROUP BY b.vendor_id, sc.adjuster_id
      HAVING COUNT(*) >= 3
    `);

    if (lastMinuteBids.length > 0) {
      for (const pattern of lastMinuteBids) {
        flagReasons.push(`Vendor ${pattern.vendor_id} has ${pattern.last_minute_wins} last-minute wins with adjuster ${pattern.adjuster_id}`);
        riskScore += 25;
      }
    }

    return {
      isCollusion: riskScore >= 50,
      riskScore: Math.min(100, riskScore),
      flagReasons,
      collusionPairs,
    };
  }

  /**
   * Create fraud alert and notify admins
   * Tasks 4.5.1-4.5.3
   */
  async createFraudAlert(
    entityType: 'vendor' | 'case' | 'auction' | 'user',
    entityId: string,
    riskScore: number,
    flagReasons: string[],
    metadata?: any
  ): Promise<string> {
    // Task 4.5.1: Create fraud alert
    const [alert] = await db
      .insert(fraudAlerts)
      .values({
        entityType,
        entityId,
        riskScore,
        flagReasons,
        status: 'pending',
        metadata,
      })
      .returning({ id: fraudAlerts.id });

    // Log fraud detection
    await db.insert(fraudDetectionLogs).values({
      fraudAlertId: alert.id,
      entityType,
      entityId,
      detectionType: flagReasons[0] || 'unknown',
      riskScore,
      flagReasons,
      analysisDetails: metadata,
    });

    // Task 4.5.2: Send Socket.IO notification to admins
    try {
      const { emitFraudAlert } = await import('../events/fraud-alert.event');
      await emitFraudAlert(alert.id, entityType, entityId, riskScore, flagReasons);
      console.log(`📢 Fraud alert ${alert.id} broadcast to admins`);
    } catch (error) {
      console.error('Failed to broadcast fraud alert:', error);
      // Don't fail the entire operation if Socket.IO fails
    }

    return alert.id;
  }
}
