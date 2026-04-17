import { db } from '@/lib/db';
import { fraudAttempts } from '@/lib/db/schema/fraud-tracking';
import { duplicatePhotoMatches } from '@/lib/db/schema/fraud-detection';
import { eq, desc } from 'drizzle-orm';
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
 * Log a fraud attempt with full user details
 * Creates both a fraud attempt record and a fraud alert for admin
 */
export async function logFraudAttempt(data: FraudAttemptData) {
  console.log(`🚨 Logging fraud attempt: ${data.type}`);
  console.log(`   User: ${data.userName} (${data.userEmail})`);
  console.log(`   IP: ${data.ipAddress}`);
  console.log(`   Confidence: ${data.confidence || 'N/A'}`);
  
  try {
    // Store in fraud_attempts table
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
    
    // TODO: Create fraud alert in proper table
    console.log(`⚠️ Fraud alert would be created: ${data.type}`);
    
    // Send email to admin (async, don't wait)
    sendFraudAlertEmail(data).catch(err => {
      console.error('Failed to send fraud alert email:', err);
    });
    
    console.log('✅ Fraud attempt logged successfully');
  } catch (error) {
    console.error('❌ Failed to log fraud attempt:', error);
    throw error;
  }
}

/**
 * Generate a human-readable fraud description
 */
function generateFraudDescription(data: FraudAttemptData): string {
  switch (data.type) {
    case 'duplicate_vehicle_submission':
      return `Duplicate vehicle submission attempt by ${data.userName} (${data.userEmail}). ` +
             `Vehicle matches existing case ${data.matchedCase?.claimReference || 'unknown'} ` +
             `with ${Math.round((data.confidence || 0) * 100)}% confidence.`;
    
    case 'shill_bidding':
      return `Shill bidding pattern detected for ${data.userName} (${data.userEmail}). ` +
             `Suspicious bidding behavior identified.`;
    
    case 'payment_fraud':
      return `Payment fraud attempt by ${data.userName} (${data.userEmail}). ` +
             `Suspicious payment activity detected.`;
    
    case 'account_manipulation':
      return `Account manipulation detected for ${data.userName} (${data.userEmail}). ` +
             `Multiple accounts or suspicious profile changes.`;
    
    default:
      return `Fraud attempt (${data.type}) by ${data.userName} (${data.userEmail})`;
  }
}

/**
 * Send fraud alert email to admin
 */
async function sendFraudAlertEmail(data: FraudAttemptData) {
  // TODO: Implement email sending
  // For now, just log
  console.log('📧 Fraud alert email would be sent to admin:');
  console.log(`   Type: ${data.type}`);
  console.log(`   User: ${data.userName} (${data.userEmail})`);
  console.log(`   IP: ${data.ipAddress}`);
  console.log(`   Confidence: ${data.confidence ? Math.round(data.confidence * 100) + '%' : 'N/A'}`);
  
  // In production, use your email service:
  // await sendEmail({
  //   to: process.env.ADMIN_EMAIL,
  //   subject: `🚨 Fraud Alert: ${data.type}`,
  //   body: generateEmailBody(data),
  // });
}

/**
 * Get fraud attempts for a specific user
 */
export async function getUserFraudAttempts(userId: string) {
  return await db
    .select()
    .from(fraudAttempts)
    .where(eq(fraudAttempts.userId, userId))
    .orderBy(desc(fraudAttempts.timestamp));
}

/**
 * Get fraud attempts by IP address
 */
export async function getIPFraudAttempts(ipAddress: string) {
  return await db
    .select()
    .from(fraudAttempts)
    .where(eq(fraudAttempts.ipAddress, ipAddress))
    .orderBy(desc(fraudAttempts.timestamp));
}

/**
 * Mark fraud attempt as reviewed
 */
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
