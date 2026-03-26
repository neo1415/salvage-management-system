/**
 * AI Analysis Validator Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { AIAnalysisValidator } from '@/features/cases/services/ai-analysis-validator';

describe('AIAnalysisValidator', () => {
  describe('validate', () => {
    it('should return valid when all requirements met', () => {
      const caseData = {
        hasAIAnalysis: true,
        marketValue: 5000,
        photos: ['photo1.jpg', 'photo2.jpg'],
        assetDetails: { make: 'Toyota', model: 'Camry' },
      };

      const result = AIAnalysisValidator.validate(caseData);

      expect(result.isValid).toBe(true);
      expect(result.hasAnalysis).toBe(true);
      expect(result.hasMarketValue).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should return invalid when AI analysis missing', () => {
      const caseData = {
        hasAIAnalysis: false,
        marketValue: 5000,
      };

      const result = AIAnalysisValidator.validate(caseData);

      expect(result.isValid).toBe(false);
      expect(result.hasAnalysis).toBe(false);
      expect(result.errors).toContain('AI analysis must be completed before submission');
    });

    it('should return invalid when market value missing', () => {
      const caseData = {
        hasAIAnalysis: true,
      };

      const result = AIAnalysisValidator.validate(caseData);

      expect(result.isValid).toBe(false);
      expect(result.hasMarketValue).toBe(false);
      expect(result.errors).toContain('Market value must be determined by AI analysis');
    });

    it('should return invalid when market value is zero', () => {
      const caseData = {
        hasAIAnalysis: true,
        marketValue: 0,
      };

      const result = AIAnalysisValidator.validate(caseData);

      expect(result.isValid).toBe(false);
      expect(result.hasMarketValue).toBe(false);
    });

    it('should warn when photos missing', () => {
      const caseData = {
        hasAIAnalysis: true,
        marketValue: 5000,
        photos: [],
      };

      const result = AIAnalysisValidator.validate(caseData);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Adding photos improves AI analysis accuracy');
    });

    it('should warn when asset details missing', () => {
      const caseData = {
        hasAIAnalysis: true,
        marketValue: 5000,
        assetDetails: {},
      };

      const result = AIAnalysisValidator.validate(caseData);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Providing asset details improves AI analysis accuracy');
    });

    it('should handle aiAnalysisComplete flag', () => {
      const caseData = {
        aiAnalysisComplete: true,
        marketValue: 5000,
      };

      const result = AIAnalysisValidator.validate(caseData);

      expect(result.hasAnalysis).toBe(true);
    });
  });

  describe('canSubmit', () => {
    it('should return true when valid', () => {
      const caseData = {
        hasAIAnalysis: true,
        marketValue: 5000,
      };

      const result = AIAnalysisValidator.canSubmit(caseData);

      expect(result).toBe(true);
    });

    it('should return false when invalid', () => {
      const caseData = {
        hasAIAnalysis: false,
      };

      const result = AIAnalysisValidator.canSubmit(caseData);

      expect(result).toBe(false);
    });
  });

  describe('getErrors', () => {
    it('should return errors array', () => {
      const caseData = {
        hasAIAnalysis: false,
      };

      const errors = AIAnalysisValidator.getErrors(caseData);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('AI analysis must be completed before submission');
    });

    it('should return empty array when valid', () => {
      const caseData = {
        hasAIAnalysis: true,
        marketValue: 5000,
      };

      const errors = AIAnalysisValidator.getErrors(caseData);

      expect(errors).toHaveLength(0);
    });
  });

  describe('getWarnings', () => {
    it('should return warnings array', () => {
      const caseData = {
        hasAIAnalysis: true,
        marketValue: 5000,
        photos: [],
      };

      const warnings = AIAnalysisValidator.getWarnings(caseData);

      expect(warnings.length).toBeGreaterThan(0);
    });

    it('should return empty array when no warnings', () => {
      const caseData = {
        hasAIAnalysis: true,
        marketValue: 5000,
        photos: ['photo1.jpg'],
        assetDetails: { make: 'Toyota' },
      };

      const warnings = AIAnalysisValidator.getWarnings(caseData);

      expect(warnings).toHaveLength(0);
    });
  });
});
