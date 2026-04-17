import { db } from '@/lib/db';
import { payments } from '@/lib/db/schema/payments';
import { vendors } from '@/lib/db/schema/vendors';
import { eq, and, gte, desc, sql } from 'drizzle-orm';

interface PaymentFraudAnalysis {
  vendorId: string;
  totalScore: number;
  patterns: {
    multipleFailedPayments: FailedPaymentPattern;
    overpaymentScam: OverpaymentPattern;
    paymentMethodSwitching: PaymentMethodPattern;
    chargebackPattern: ChargebackPattern;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface FailedPaymentPattern {
  totalPayments: number;
  failedPayments: number;
  failureRate: number;
  recentFailures: number;
  score: number;
}

interface OverpaymentPattern {
  totalPayments: number;
  overpayments: number;
  averageOverpaymentPercent: number;
  score: number;
}

interface PaymentMethodPattern {
  totalPayments: number;
  methodChanges: number;
  score: number;
}

interface ChargebackPattern {
  totalPayments: number;
  chargebacks: number;
  chargebackRate: number;
  score: number;
}

/**
 * Payment Fraud Detection Service
 * Detects suspicious payment patterns that indicate fraud
 */
export class PaymentFraudDetectionService {
  /**
   * Analyze a vendor for payment fraud patterns
   */
  async analyzeVendorForPaymentFraud(vendorId: string): Promise<PaymentFraudAnalysis> {
    console.log(`🔍 Analyzing vendor ${vendorId} for payment fraud patterns...`);
    
    try {
      // Get vendor's payment history (last 30 days)
      const paymentHistory = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.vendorId, vendorId),
            gte(payments.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
          )
        )
        .orderBy(desc(payments.createdAt))
        .limit(100);
      
      if (paymentHistory.length === 0) {
        console.log(`ℹ️  No payment history for vendor ${vendorId}`);
        return this.createEmptyAnalysis(vendorId);
      }
      
      console.log(`📊 Analyzing ${paymentHistory.length} payments for vendor ${vendorId}`);
      
      // Run all pattern analyses
      const multipleFailedPayments = this.analyzeFailedPayments(paymentHistory);
      const overpaymentScam = await this.analyzeOverpayments(vendorId, paymentHistory);
      const paymentMethodSwitching = this.analyzePaymentMethodSwitching(paymentHistory);
      const chargebackPattern = this.analyzeChargebacks(paymentHistory);
      
      // Calculate total fraud score
      const totalScore = 
        multipleFailedPayments.score +
        overpaymentScam.score +
        paymentMethodSwitching.score +
        chargebackPattern.score;
      
      // Determine risk level
      let riskLevel: 'low' | 'medium' | 'high' | 'critical';
      if (totalScore >= 80) riskLevel = 'critical';
      else if (totalScore >= 60) riskLevel = 'high';
      else if (totalScore >= 40) riskLevel = 'medium';
      else riskLevel = 'low';
      
      console.log(`📊 Payment fraud analysis for vendor ${vendorId}:`);
      console.log(`   Total Score: ${totalScore}/100`);
      console.log(`   Risk Level: ${riskLevel}`);
      console.log(`   Failed Payments: ${multipleFailedPayments.score}/30`);
      console.log(`   Overpayment: ${overpaymentScam.score}/30`);
      console.log(`   Method Switching: ${paymentMethodSwitching.score}/20`);
      console.log(`   Chargebacks: ${chargebackPattern.score}/20`);
      
      return {
        vendorId,
        totalScore,
        patterns: {
          multipleFailedPayments,
          overpaymentScam,
          paymentMethodSwitching,
          chargebackPattern,
        },
        riskLevel,
      };
    } catch (error) {
      console.error(`❌ Failed to analyze vendor ${vendorId}:`, error);
      return this.createEmptyAnalysis(vendorId);
    }
  }
  
  /**
   * Pattern 1: Multiple failed payments
   * Fraudsters often have multiple failed payment attempts
   */
  private analyzeFailedPayments(paymentHistory: any[]): FailedPaymentPattern {
    const failedPayments = paymentHistory.filter(
      p => p.status === 'failed' || p.status === 'rejected'
    );
    
    // Count recent failures (last 24 hours)
    const recentFailures = failedPayments.filter(
      p => p.createdAt.getTime() > Date.now() - 24 * 60 * 60 * 1000
    ).length;
    
    const totalPayments = paymentHistory.length;
    const failureRate = totalPayments > 0 ? failedPayments.length / totalPayments : 0;
    
    // Score: 0-30 points
    let score = 0;
    if (recentFailures > 3) score = 30; // Very suspicious
    else if (recentFailures > 2) score = 20;
    else if (failureRate > 0.5 && failedPayments.length > 2) score = 15;
    else if (failureRate > 0.3 && failedPayments.length > 3) score = 8;
    
    return {
      totalPayments,
      failedPayments: failedPayments.length,
      failureRate,
      recentFailures,
      score,
    };
  }
  
  /**
   * Pattern 2: Overpayment scam
   * Fraudsters sometimes overpay and request refund
   */
  private async analyzeOverpayments(
    vendorId: string,
    paymentHistory: any[]
  ): Promise<OverpaymentPattern> {
    const overpayments: number[] = [];
    
    // Check each payment against required amount
    for (const payment of paymentHistory) {
      if (payment.status === 'completed' && payment.auctionId) {
        // Get auction to check required payment
        const auction = await db.execute(sql`
          SELECT 
            COALESCE(current_bid, c.reserve_price) as required_amount
          FROM auctions a
          JOIN cases c ON a.case_id = c.id
          WHERE a.id = ${payment.auctionId}
        `);
        
        if (Array.isArray(auction) && auction[0]) {
          const requiredAmount = parseFloat(auction[0].required_amount || '0');
          const paidAmount = parseFloat(payment.amount);
          
          if (paidAmount > requiredAmount * 1.1) { // More than 10% over
            const overpaymentPercent = ((paidAmount - requiredAmount) / requiredAmount) * 100;
            overpayments.push(overpaymentPercent);
          }
        }
      }
    }
    
    const averageOverpaymentPercent = overpayments.length > 0
      ? overpayments.reduce((a, b) => a + b, 0) / overpayments.length
      : 0;
    
    // Score: 0-30 points
    let score = 0;
    if (overpayments.length > 0 && averageOverpaymentPercent > 20) score = 30; // Very suspicious
    else if (overpayments.length > 1 && averageOverpaymentPercent > 15) score = 20;
    else if (overpayments.length > 0 && averageOverpaymentPercent > 10) score = 10;
    
    return {
      totalPayments: paymentHistory.length,
      overpayments: overpayments.length,
      averageOverpaymentPercent,
      score,
    };
  }
  
  /**
   * Pattern 3: Payment method switching
   * Fraudsters often switch payment methods frequently
   */
  private analyzePaymentMethodSwitching(paymentHistory: any[]): PaymentMethodPattern {
    const paymentMethods = new Set<string>();
    
    paymentHistory.forEach(payment => {
      if (payment.paymentMethod) {
        paymentMethods.add(payment.paymentMethod);
      }
    });
    
    const methodChanges = paymentMethods.size;
    
    // Score: 0-20 points
    let score = 0;
    if (methodChanges > 3) score = 20; // Very suspicious
    else if (methodChanges > 2) score = 12;
    else if (methodChanges > 1) score = 5;
    
    return {
      totalPayments: paymentHistory.length,
      methodChanges,
      score,
    };
  }
  
  /**
   * Pattern 4: Chargeback pattern
   * High chargeback rate indicates fraud
   */
  private analyzeChargebacks(paymentHistory: any[]): ChargebackPattern {
    // Note: Chargebacks might be tracked in payment metadata or status
    const chargebacks = paymentHistory.filter(
      p => p.status === 'refunded' || 
           (p.metadata && (p.metadata as any).chargeback === true)
    );
    
    const totalPayments = paymentHistory.length;
    const chargebackRate = totalPayments > 0 ? chargebacks.length / totalPayments : 0;
    
    // Score: 0-20 points
    let score = 0;
    if (chargebackRate > 0.1) score = 20; // Very suspicious (>10% chargeback rate)
    else if (chargebackRate > 0.05) score = 15; // Suspicious (>5%)
    else if (chargebacks.length > 2) score = 8;
    
    return {
      totalPayments,
      chargebacks: chargebacks.length,
      chargebackRate,
      score,
    };
  }
  
  /**
   * Create empty analysis result
   */
  private createEmptyAnalysis(vendorId: string): PaymentFraudAnalysis {
    return {
      vendorId,
      totalScore: 0,
      patterns: {
        multipleFailedPayments: {
          totalPayments: 0,
          failedPayments: 0,
          failureRate: 0,
          recentFailures: 0,
          score: 0,
        },
        overpaymentScam: {
          totalPayments: 0,
          overpayments: 0,
          averageOverpaymentPercent: 0,
          score: 0,
        },
        paymentMethodSwitching: {
          totalPayments: 0,
          methodChanges: 0,
          score: 0,
        },
        chargebackPattern: {
          totalPayments: 0,
          chargebacks: 0,
          chargebackRate: 0,
          score: 0,
        },
      },
      riskLevel: 'low',
    };
  }
}

// Export singleton instance
export const paymentFraudDetectionService = new PaymentFraudDetectionService();
