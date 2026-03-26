/**
 * AI Analysis Validator
 * 
 * Validates that cases have completed AI analysis before submission.
 * Enforces business rule: AI analysis is mandatory for case submission.
 */

export interface AIAnalysisValidation {
  isValid: boolean;
  hasAnalysis: boolean;
  hasMarketValue: boolean;
  errors: string[];
  warnings: string[];
}

export class AIAnalysisValidator {
  /**
   * Validate case has AI analysis
   */
  static validate(caseData: Record<string, unknown>): AIAnalysisValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for AI analysis completion
    const hasAnalysis = Boolean(caseData.hasAIAnalysis || caseData.aiAnalysisComplete);
    if (!hasAnalysis) {
      errors.push('AI analysis must be completed before submission');
      errors.push('Click "Analyze with AI" to get market value assessment');
    }

    // Check for market value
    const marketValue = caseData.marketValue as number | undefined;
    const hasMarketValue = Boolean(marketValue && marketValue > 0);
    if (!hasMarketValue) {
      errors.push('Market value must be determined by AI analysis');
    }

    // Warnings for incomplete data
    if (!caseData.photos || (Array.isArray(caseData.photos) && caseData.photos.length === 0)) {
      warnings.push('Adding photos improves AI analysis accuracy');
    }

    if (!caseData.assetDetails || Object.keys(caseData.assetDetails as object).length === 0) {
      warnings.push('Providing asset details improves AI analysis accuracy');
    }

    return {
      isValid: errors.length === 0,
      hasAnalysis,
      hasMarketValue,
      errors,
      warnings,
    };
  }

  /**
   * Check if submission is allowed
   */
  static canSubmit(caseData: Record<string, unknown>): boolean {
    const validation = this.validate(caseData);
    return validation.isValid;
  }

  /**
   * Get validation errors
   */
  static getErrors(caseData: Record<string, unknown>): string[] {
    const validation = this.validate(caseData);
    return validation.errors;
  }

  /**
   * Get validation warnings
   */
  static getWarnings(caseData: Record<string, unknown>): string[] {
    const validation = this.validate(caseData);
    return validation.warnings;
  }
}
