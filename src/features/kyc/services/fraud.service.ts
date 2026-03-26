import type { DojahAMLResult, DojahAMLMatch } from '../schemas/dojah.schemas';
import type { AMLRiskLevel, FraudFlag, FraudSignals } from '../types/kyc.types';

const TERRORISM_KEYWORDS = ['terrorism', 'terrorist', 'terror'];
const FINANCIAL_CRIME_KEYWORDS = ['fraud', 'money laundering', 'financial crime', 'corruption', 'bribery'];
const ORGANIZED_CRIME_KEYWORDS = ['organized crime', 'gang', 'cartel', 'trafficking'];
const VIOLENT_CRIME_KEYWORDS = ['violent crime', 'murder', 'assault', 'robbery'];

/**
 * FraudService
 *
 * Classifies AML risk levels and calculates composite fraud scores.
 * All methods are pure / deterministic given the same inputs.
 */
export class FraudService {
  /**
   * Classify AML risk level from Dojah AML screening result.
   *
   * Rules (Property 9):
   * - sanctions.length > 0 → High (blocks upgrade)
   * - pep.length > 0 → High
   * - adverse_media with terrorism/financial crime → High
   * - adverse_media with organized/violent crime only → Medium
   * - no matches → Low
   */
  classifyAMLRisk(amlResult: DojahAMLResult): AMLRiskLevel {
    const entity = amlResult.entity;
    if (!entity) return 'Low';

    const sanctions = entity.sanctions ?? [];
    const pep = entity.pep ?? [];
    const adverseMedia = entity.adverse_media ?? [];

    if (sanctions.length > 0) return 'High';
    if (pep.length > 0) return 'High';

    if (adverseMedia.length > 0) {
      const hasHighRiskMedia = adverseMedia.some((m) => this.isHighRiskMedia(m));
      if (hasHighRiskMedia) return 'High';

      const hasMediumRiskMedia = adverseMedia.some((m) => this.isMediumRiskMedia(m));
      if (hasMediumRiskMedia) return 'Medium';
    }

    return 'Low';
  }

  /**
   * Calculate composite fraud risk score (0–100).
   * Higher score = higher risk.
   */
  calculateFraudScore(signals: FraudSignals): number {
    let score = 0;

    // Liveness score contribution (low liveness = higher fraud risk)
    if (signals.livenessScore !== undefined) {
      if (signals.livenessScore < 30) score += 30;
      else if (signals.livenessScore < 50) score += 20;
      else if (signals.livenessScore < 70) score += 10;
    }

    // Biometric match score contribution
    if (signals.biometricMatchScore !== undefined) {
      if (signals.biometricMatchScore < 50) score += 30;
      else if (signals.biometricMatchScore < 70) score += 20;
      else if (signals.biometricMatchScore < 80) score += 10;
    }

    // AML risk level contribution
    if (signals.amlRiskLevel === 'High') score += 30;
    else if (signals.amlRiskLevel === 'Medium') score += 15;

    // Unusually fast completion (potential bot)
    if (signals.completionTimeSeconds !== undefined && signals.completionTimeSeconds < 120) {
      score += 10;
    }

    // Duplicate NIN
    if (signals.duplicateNIN) score += 20;

    // Document tampering
    if (signals.documentTampered) score += 25;

    // Clamp to [0, 100]
    return Math.min(100, Math.max(0, score));
  }

  /**
   * Detect fraud flags from verification data signals.
   */
  detectFraudFlags(signals: FraudSignals): FraudFlag[] {
    const flags: FraudFlag[] = [];
    const now = new Date();

    if (signals.duplicateNIN) {
      flags.push({
        type: 'DUPLICATE_NIN',
        description: 'This NIN has been used by another vendor account',
        severity: 'high',
        detectedAt: now,
      });
    }

    if (signals.documentTampered) {
      flags.push({
        type: 'DOCUMENT_TAMPERED',
        description: 'Document shows signs of tampering or forgery',
        severity: 'high',
        detectedAt: now,
      });
    }

    if (signals.completionTimeSeconds !== undefined && signals.completionTimeSeconds < 120) {
      flags.push({
        type: 'FAST_COMPLETION',
        description: `Verification completed in ${signals.completionTimeSeconds}s — potential bot activity`,
        severity: 'medium',
        detectedAt: now,
      });
    }

    if (signals.livenessScore !== undefined && signals.livenessScore < 50) {
      flags.push({
        type: 'LOW_LIVENESS',
        description: `Liveness score ${signals.livenessScore} is below threshold (50)`,
        severity: signals.livenessScore < 30 ? 'high' : 'medium',
        detectedAt: now,
      });
    }

    if (signals.biometricMatchScore !== undefined && signals.biometricMatchScore < 60) {
      flags.push({
        type: 'LOW_BIOMETRIC_MATCH',
        description: `Biometric match score ${signals.biometricMatchScore} suggests potential impersonation`,
        severity: 'high',
        detectedAt: now,
      });
    }

    if (signals.amlRiskLevel === 'High') {
      flags.push({
        type: 'HIGH_AML_RISK',
        description: 'AML screening returned high-risk matches (PEP, sanctions, or adverse media)',
        severity: 'high',
        detectedAt: now,
      });
    }

    return flags;
  }

  private isHighRiskMedia(match: DojahAMLMatch): boolean {
    const categories = (match.categories ?? []).map((c) => c.toLowerCase());
    const name = (match.name ?? '').toLowerCase();
    const combined = [...categories, name].join(' ');
    return (
      TERRORISM_KEYWORDS.some((k) => combined.includes(k)) ||
      FINANCIAL_CRIME_KEYWORDS.some((k) => combined.includes(k))
    );
  }

  private isMediumRiskMedia(match: DojahAMLMatch): boolean {
    const categories = (match.categories ?? []).map((c) => c.toLowerCase());
    const name = (match.name ?? '').toLowerCase();
    const combined = [...categories, name].join(' ');
    return (
      ORGANIZED_CRIME_KEYWORDS.some((k) => combined.includes(k)) ||
      VIOLENT_CRIME_KEYWORDS.some((k) => combined.includes(k))
    );
  }
}

let _instance: FraudService | null = null;

export function getFraudService(): FraudService {
  if (!_instance) _instance = new FraudService();
  return _instance;
}
