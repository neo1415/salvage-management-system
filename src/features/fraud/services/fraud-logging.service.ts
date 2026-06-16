import { db } from '@/lib/db';
import { fraudAttempts } from '@/lib/db/schema/fraud-tracking';
import { fraudAlerts } from '@/lib/db/schema/intelligence';
import { desc, eq } from 'drizzle-orm';
import crypto from 'crypto';

interface FraudAttemptData {
  type: string;
  userId: string;
  userEmail: string;
  userName: string;
  ipAddress: string;
  userAgent: string | null;
  attemptedData: any;
  matchedCase?: any;
  confidence?: number;
  timestamp: Date;
}

/**
 * Log a fraud attempt with full user details.
 * Creates both a fraud attempt record and a fraud alert for admin review.
 */
export async function logFraudAttempt(data: FraudAttemptData) {
  console.log(`[Fraud] Logging fraud attempt: ${data.type}`);
  console.log(`   User: ${data.userName} (${data.userEmail})`);
  console.log(`   IP: ${data.ipAddress}`);
  console.log(`   Confidence: ${data.confidence || 'N/A'}`);

  try {
    await db.insert(fraudAttempts).values({
      id: crypto.randomUUID(),
      type: data.type,
      userId: data.userId,
      userEmail: data.userEmail,
      userName: data.userName,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent || null,
      attemptedData: data.attemptedData,
      matchedData: data.matchedCase || null,
      confidence: data.confidence ? data.confidence.toString() : null,
      timestamp: data.timestamp,
      reviewed: false,
    });

    const riskScore = Math.max(
      1,
      Math.min(100, Math.round((data.confidence ?? 0.5) * 100))
    );

    await db.insert(fraudAlerts).values({
      entityType: 'user',
      entityId: data.userId,
      riskScore,
      flagReasons: [data.type, generateFraudDescription(data)],
      status: 'pending',
      metadata: {
        source: 'fraud_attempt_logger',
        reasonCodes: [data.type],
        riskLevel: riskScore >= 80 ? 'high' : riskScore >= 50 ? 'medium' : 'low',
        failedChecks: [data.type],
      },
    });

    await logFraudAlertDelivery(data);

    console.log('[Fraud] Fraud attempt logged successfully');
  } catch (error) {
    console.error('[Fraud] Failed to log fraud attempt:', error);
    throw error;
  }
}

function generateFraudDescription(data: FraudAttemptData): string {
  switch (data.type) {
    case 'duplicate_vehicle_submission':
      return `Duplicate vehicle submission attempt by ${data.userName} (${data.userEmail}). ` +
        `Vehicle matches existing case ${data.matchedCase?.claimReference || 'unknown'} ` +
        `with ${Math.round((data.confidence || 0) * 100)}% confidence.`;

    case 'shill_bidding':
      return `Shill bidding pattern detected for ${data.userName} (${data.userEmail}). ` +
        'Suspicious bidding behavior identified.';

    case 'payment_fraud':
      return `Payment fraud attempt by ${data.userName} (${data.userEmail}). ` +
        'Suspicious payment activity detected.';

    case 'account_manipulation':
      return `Account manipulation detected for ${data.userName} (${data.userEmail}). ` +
        'Multiple accounts or suspicious profile changes.';

    default:
      return `Fraud attempt (${data.type}) by ${data.userName} (${data.userEmail})`;
  }
}

async function logFraudAlertDelivery(data: FraudAttemptData) {
  // Alert delivery is handled by the fraud queue/in-app review flow. This keeps
  // fraud persistence reliable even if email delivery is temporarily unavailable.
  console.log('[Fraud] Fraud alert persisted for admin review:');
  console.log(`   Type: ${data.type}`);
  console.log(`   User: ${data.userName} (${data.userEmail})`);
  console.log(`   IP: ${data.ipAddress}`);
  console.log(`   Confidence: ${data.confidence ? Math.round(data.confidence * 100) + '%' : 'N/A'}`);
}

export async function getUserFraudAttempts(userId: string) {
  return await db
    .select()
    .from(fraudAttempts)
    .where(eq(fraudAttempts.userId, userId))
    .orderBy(desc(fraudAttempts.timestamp));
}

export async function getIPFraudAttempts(ipAddress: string) {
  return await db
    .select()
    .from(fraudAttempts)
    .where(eq(fraudAttempts.ipAddress, ipAddress))
    .orderBy(desc(fraudAttempts.timestamp));
}

export async function markFraudAttemptReviewed(
  attemptId: string,
  reviewedBy: string,
  notes: string
) {
  await db
    .update(fraudAttempts)
    .set({
      reviewed: true,
      reviewedBy,
      reviewedAt: new Date(),
      reviewNotes: notes,
    })
    .where(eq(fraudAttempts.id, attemptId));
}
