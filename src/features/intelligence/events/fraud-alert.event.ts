/**
 * Fraud Alert Event Emitter
 * Task 8.1.4: Implement fraud:alert event emission to admins
 * 
 * Emits fraud alert events to all admin users for immediate review.
 */

import { getSocketServer } from '@/lib/socket/server';

export interface FraudAlertPayload {
  alertId: string;
  entityType: 'vendor' | 'case' | 'auction' | 'user';
  entityId: string;
  riskScore: number;
  flagReasons: string[];
  timestamp: Date;
}

/**
 * Emit fraud alert event to all admins
 * 
 * @param alertId - UUID of the fraud alert
 * @param entityType - Type of entity flagged
 * @param entityId - UUID of the flagged entity
 * @param riskScore - Risk score (0-100)
 * @param flagReasons - Array of reasons for flagging
 */
export async function emitFraudAlert(
  alertId: string,
  entityType: 'vendor' | 'case' | 'auction' | 'user',
  entityId: string,
  riskScore: number,
  flagReasons: string[]
): Promise<void> {
  const io = getSocketServer();
  
  if (!io) {
    console.warn('Socket.IO server not initialized - cannot emit fraud:alert');
    return;
  }

  const payload: FraudAlertPayload = {
    alertId,
    entityType,
    entityId,
    riskScore,
    flagReasons,
    timestamp: new Date(),
  };

  try {
    console.log(`🚨 Emitting fraud:alert to admin room for ${entityType} ${entityId} (risk: ${riskScore})`);
    // Emit to all admins
    io.to('admin').emit('fraud:alert', payload);
    console.log(`✅ Fraud alert emitted successfully to admins (alert ID: ${alertId})`);
  } catch (error) {
    console.error(`❌ Failed to emit fraud:alert for ${entityType} ${entityId}:`, error);
  }
}
