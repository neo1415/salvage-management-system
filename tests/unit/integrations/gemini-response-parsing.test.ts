/**
 * Unit Tests: Gemini Response Parsing
 * 
 * Tests the response parsing and validation logic for Gemini damage detection.
 * 
 * Test Coverage:
 * 1. Valid JSON response parsing - all fields present and valid
 * 2. Non-JSON response - should throw error
 * 3. Missing required fields - should throw error
 * 4. Out-of-range scores - should clamp to 0-100
 * 5. Invalid severity - should default to "moderate"
 * 6. Summary > 500 chars - should truncate
 * 7. Empty summary - should use default
 * 
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  parseAndValidateResponse,
  validateDamageScore,
  validateSeverity,
  validateSummary,
  validateBoolean,
} from '@/lib/integrations/gemini-damage-detection';

describe('Gemini Response Parsing', () => {
  const testRequestId = 'test-request-123';

  beforeEach(() => {
    // Clear console mocks before each test
    vi.clearAllMocks();
  });

  /**
   * Test 1: Valid JSON response parsing
   * 
   * Validates that a properly formatted JSON response with all required fields
   * is parsed correctly and returns a valid GeminiDamageAssessment object.
   * 
   * Requirements: 15.1, 15.2, 15.5, 15.6
   */
  test('should parse valid JSON response with all fields', () => {
    // Arrange
    const validResponse = {
      structural: 45,
      mechanical: 30,
      cosmetic: 60,
      electrical: 15,
      interior: 25,
      severity: 'moderate',
      airbagDeployed: true,
      totalLoss: false,
      summary: 'Front-end collision with moderate damage to bumper and hood. Airbags deployed. Vehicle is repairable.',
    };

    // Act
    const result = parseAndValidateResponse(JSON.stringify(validResponse), testRequestId);

    // Assert
    expect(result).toBeDefined();
    expect(result.structural).toBe(45);
    expect(result.mechanical).toBe(30);
    expect(result.cosmetic).toBe(60);
    expect(result.electrical).toBe(15);
    expect(result.interior).toBe(25);
    expect(result.severity).toBe('moderate');
    expect(result.airbagDeployed).toBe(true);
    expect(result.totalLoss).toBe(false);
    expect(result.summary).toBe(validResponse.summary);
    expect(result.confidence).toBe(85);
    expect(result.method).toBe('gemini');
  });

  /**
   * Test 2: Non-JSON response handling
   * 
   * Validates that when Gemini returns a non-JSON response (plain text),
   * the parser throws an error with appropriate message.
   * 
   * Requirements: 15.1
   */
  test('should throw error for non-JSON response', () => {
    // Arrange
    const nonJsonResponse = 'This is plain text, not JSON';

    // Act & Assert
    expect(() => {
      parseAndValidateResponse(nonJsonResponse, testRequestId);
    }).toThrow(/Failed to parse Gemini response as JSON/);
  });

  /**
   * Test 3: Missing required fields
   * 
   * Validates that when Gemini returns JSON missing required fields,
   * the parser throws an error listing the missing fields.
   * 
   * Requirements: 15.2
   */
  test('should throw error when JSON is missing required fields', () => {
    // Arrange - missing 'severity', 'airbagDeployed', and 'totalLoss'
    const incompleteResponse = {
      structural: 45,
      mechanical: 30,
      cosmetic: 60,
      electrical: 15,
      interior: 25,
      summary: 'Incomplete response',
    };

    // Act & Assert
    expect(() => {
      parseAndValidateResponse(JSON.stringify(incompleteResponse), testRequestId);
    }).toThrow(/missing required fields/);
  });

  /**
   * Test 4: Out-of-range damage scores (should clamp)
   * 
   * Validates that damage scores outside the 0-100 range are clamped
   * to valid values (0 or 100).
   * 
   * Requirements: 15.3
   */
  test('should clamp damage scores outside 0-100 range', () => {
    // Arrange - scores outside valid range
    const outOfRangeResponse = {
      structural: 150,    // Should clamp to 100
      mechanical: -20,    // Should clamp to 0
      cosmetic: 200,      // Should clamp to 100
      electrical: -5,     // Should clamp to 0
      interior: 50,       // Valid, no change
      severity: 'severe',
      airbagDeployed: true,
      totalLoss: true,
      summary: 'Extreme damage values',
    };

    // Act
    const result = parseAndValidateResponse(JSON.stringify(outOfRangeResponse), testRequestId);

    // Assert - scores should be clamped
    expect(result.structural).toBe(100);  // Clamped from 150
    expect(result.mechanical).toBe(0);    // Clamped from -20
    expect(result.cosmetic).toBe(100);    // Clamped from 200
    expect(result.electrical).toBe(0);    // Clamped from -5
    expect(result.interior).toBe(50);     // Unchanged
  });

  /**
   * Test 5: Invalid severity value (should default to "moderate")
   * 
   * Validates that when severity is not one of the valid values
   * (minor/moderate/severe), it defaults to "moderate".
   * 
   * Requirements: 15.4
   */
  test('should default to "moderate" for invalid severity value', () => {
    // Arrange - invalid severity value
    const invalidSeverityResponse = {
      structural: 45,
      mechanical: 30,
      cosmetic: 60,
      electrical: 15,
      interior: 25,
      severity: 'catastrophic',  // Invalid value
      airbagDeployed: false,
      totalLoss: false,
      summary: 'Invalid severity test',
    };

    // Act
    const result = parseAndValidateResponse(JSON.stringify(invalidSeverityResponse), testRequestId);

    // Assert - severity should default to "moderate"
    expect(result.severity).toBe('moderate');
  });

  /**
   * Test 6: Summary exceeding 500 characters (should truncate)
   * 
   * Validates that summaries longer than 500 characters are truncated
   * to 500 characters with ellipsis.
   * 
   * Requirements: 15.6
   */
  test('should truncate summary exceeding 500 characters', () => {
    // Arrange - summary with 600 characters
    const longSummary = 'A'.repeat(600);
    const longSummaryResponse = {
      structural: 45,
      mechanical: 30,
      cosmetic: 60,
      electrical: 15,
      interior: 25,
      severity: 'moderate',
      airbagDeployed: false,
      totalLoss: false,
      summary: longSummary,
    };

    // Act
    const result = parseAndValidateResponse(JSON.stringify(longSummaryResponse), testRequestId);

    // Assert - summary should be truncated to 500 characters
    expect(result.summary.length).toBe(500);
    expect(result.summary).toMatch(/\.\.\.$/);  // Should end with ellipsis
  });

  /**
   * Test 7: Empty summary (should use default)
   * 
   * Validates that when summary is empty or whitespace-only,
   * a default summary message is used.
   * 
   * Requirements: 15.6
   */
  test('should use default summary when summary is empty', () => {
    // Arrange - empty summary
    const emptySummaryResponse = {
      structural: 45,
      mechanical: 30,
      cosmetic: 60,
      electrical: 15,
      interior: 25,
      severity: 'moderate',
      airbagDeployed: false,
      totalLoss: false,
      summary: '',  // Empty summary
    };

    // Act
    const result = parseAndValidateResponse(JSON.stringify(emptySummaryResponse), testRequestId);

    // Assert - should use default summary
    expect(result.summary).toBe('Damage assessment completed. Please review detailed scores.');
  });

  /**
   * Test 8: Invalid damage score types (should default to 50)
   * 
   * Validates that when damage scores are not numbers (e.g., strings, null),
   * they default to 50.
   * 
   * Requirements: 15.3
   */
  test('should default to 50 for non-numeric damage scores', () => {
    // Arrange - non-numeric scores
    // Note: undefined values are omitted by JSON.stringify, so we test them separately
    const invalidScoresResponse = {
      structural: 'high',     // String instead of number
      mechanical: null,       // Null instead of number
      cosmetic: 'medium',     // String instead of number
      electrical: 15,         // Valid
      interior: 25,           // Valid
      severity: 'moderate',
      airbagDeployed: false,
      totalLoss: false,
      summary: 'Invalid score types',
    };

    // Act
    const result = parseAndValidateResponse(JSON.stringify(invalidScoresResponse), testRequestId);

    // Assert - invalid scores should default to 50
    expect(result.structural).toBe(50);   // Defaulted from 'high'
    expect(result.mechanical).toBe(50);   // Defaulted from null
    expect(result.cosmetic).toBe(50);     // Defaulted from 'medium'
    expect(result.electrical).toBe(15);   // Valid, unchanged
    expect(result.interior).toBe(25);     // Valid, unchanged
  });

  /**
   * Test 9: Invalid boolean flags (should default to false)
   * 
   * Validates that when boolean flags are not true/false,
   * they default to false.
   * 
   * Requirements: 15.5
   */
  test('should default to false for invalid boolean flags', () => {
    // Arrange - invalid boolean values
    const invalidBooleansResponse = {
      structural: 45,
      mechanical: 30,
      cosmetic: 60,
      electrical: 15,
      interior: 25,
      severity: 'moderate',
      airbagDeployed: 'yes',  // String instead of boolean
      totalLoss: 1,           // Number instead of boolean
      summary: 'Invalid boolean test',
    };

    // Act
    const result = parseAndValidateResponse(JSON.stringify(invalidBooleansResponse), testRequestId);

    // Assert - invalid booleans should default to false
    expect(result.airbagDeployed).toBe(false);  // Defaulted from 'yes'
    expect(result.totalLoss).toBe(false);       // Defaulted from 1
  });

  /**
   * Test 10: Whitespace-only summary (should use default)
   * 
   * Validates that summaries containing only whitespace are treated
   * as empty and replaced with default message.
   * 
   * Requirements: 15.6
   */
  test('should use default summary for whitespace-only summary', () => {
    // Arrange - whitespace-only summary
    const whitespaceSummaryResponse = {
      structural: 45,
      mechanical: 30,
      cosmetic: 60,
      electrical: 15,
      interior: 25,
      severity: 'moderate',
      airbagDeployed: false,
      totalLoss: false,
      summary: '   \n\t   ',  // Only whitespace
    };

    // Act
    const result = parseAndValidateResponse(JSON.stringify(whitespaceSummaryResponse), testRequestId);

    // Assert - should use default summary
    expect(result.summary).toBe('Damage assessment completed. Please review detailed scores.');
  });

  /**
   * Test 11: Summary exactly 500 characters (should not truncate)
   * 
   * Validates that summaries exactly at the 500 character limit
   * are not truncated.
   * 
   * Requirements: 15.6
   */
  test('should not truncate summary at exactly 500 characters', () => {
    // Arrange - summary with exactly 500 characters
    const exactLengthSummary = 'A'.repeat(500);
    const exactLengthResponse = {
      structural: 45,
      mechanical: 30,
      cosmetic: 60,
      electrical: 15,
      interior: 25,
      severity: 'moderate',
      airbagDeployed: false,
      totalLoss: false,
      summary: exactLengthSummary,
    };

    // Act
    const result = parseAndValidateResponse(JSON.stringify(exactLengthResponse), testRequestId);

    // Assert - summary should remain unchanged
    expect(result.summary.length).toBe(500);
    expect(result.summary).toBe(exactLengthSummary);
    expect(result.summary).not.toMatch(/\.\.\.$/);  // Should NOT end with ellipsis
  });

  /**
   * Test 12: All severity values (minor, moderate, severe)
   * 
   * Validates that all three valid severity values are accepted
   * without modification.
   * 
   * Requirements: 15.4
   */
  test.each([
    { severity: 'minor', expected: 'minor' },
    { severity: 'moderate', expected: 'moderate' },
    { severity: 'severe', expected: 'severe' },
  ])('should accept valid severity value: $severity', ({ severity, expected }) => {
    // Arrange
    const validSeverityResponse = {
      structural: 45,
      mechanical: 30,
      cosmetic: 60,
      electrical: 15,
      interior: 25,
      severity,
      airbagDeployed: false,
      totalLoss: false,
      summary: `Testing ${severity} severity`,
    };

    // Act
    const result = parseAndValidateResponse(JSON.stringify(validSeverityResponse), testRequestId);

    // Assert
    expect(result.severity).toBe(expected);
  });

  /**
   * Test 13: Boundary damage scores (0 and 100)
   * 
   * Validates that boundary values (0 and 100) are accepted
   * without modification.
   * 
   * Requirements: 15.3
   */
  test('should accept boundary damage scores (0 and 100)', () => {
    // Arrange - boundary values
    const boundaryScoresResponse = {
      structural: 0,      // Minimum valid
      mechanical: 100,    // Maximum valid
      cosmetic: 0,        // Minimum valid
      electrical: 100,    // Maximum valid
      interior: 50,       // Mid-range
      severity: 'moderate',
      airbagDeployed: false,
      totalLoss: false,
      summary: 'Boundary score test',
    };

    // Act
    const result = parseAndValidateResponse(JSON.stringify(boundaryScoresResponse), testRequestId);

    // Assert - boundary values should be unchanged
    expect(result.structural).toBe(0);
    expect(result.mechanical).toBe(100);
    expect(result.cosmetic).toBe(0);
    expect(result.electrical).toBe(100);
    expect(result.interior).toBe(50);
  });

  /**
   * Test 14: Multiple missing fields
   * 
   * Validates that when multiple required fields are missing,
   * the error message lists all missing fields.
   * 
   * Requirements: 15.2
   */
  test('should list all missing fields in error message', () => {
    // Arrange - missing multiple fields
    const multipleMissingResponse = {
      structural: 45,
      mechanical: 30,
      // Missing: cosmetic, electrical, interior, severity, airbagDeployed, totalLoss, summary
    };

    // Act & Assert
    expect(() => {
      parseAndValidateResponse(JSON.stringify(multipleMissingResponse), testRequestId);
    }).toThrow(/cosmetic.*electrical.*interior.*severity.*airbagDeployed.*totalLoss.*summary/);
  });

  /**
   * Test 15: Non-string summary type (should use default)
   * 
   * Validates that when summary is not a string (e.g., number, object),
   * it is replaced with default message.
   * 
   * Requirements: 15.6
   */
  test('should use default summary for non-string summary', () => {
    // Arrange - non-string summary
    const nonStringSummaryResponse = {
      structural: 45,
      mechanical: 30,
      cosmetic: 60,
      electrical: 15,
      interior: 25,
      severity: 'moderate',
      airbagDeployed: false,
      totalLoss: false,
      summary: 12345,  // Number instead of string
    };

    // Act
    const result = parseAndValidateResponse(JSON.stringify(nonStringSummaryResponse), testRequestId);

    // Assert - should use default summary
    expect(result.summary).toBe('Damage assessment completed. Please review detailed scores.');
  });

  /**
   * Test 16: Malformed JSON (syntax error)
   * 
   * Validates that malformed JSON (syntax errors) throws appropriate error.
   * 
   * Requirements: 15.1
   */
  test('should throw error for malformed JSON', () => {
    // Arrange - malformed JSON with syntax error
    const malformedJson = '{ "structural": 45, "mechanical": 30, }';  // Trailing comma

    // Act & Assert
    expect(() => {
      parseAndValidateResponse(malformedJson, testRequestId);
    }).toThrow(/Failed to parse Gemini response as JSON/);
  });

  /**
   * Test 17: Valid response with all edge cases combined
   * 
   * Validates that a response with multiple edge cases (boundary scores,
   * valid severity, valid booleans, valid summary) is parsed correctly.
   * 
   * Requirements: 15.3, 15.4, 15.5, 15.6
   */
  test('should handle valid response with all edge cases', () => {
    // Arrange - comprehensive valid response
    const comprehensiveResponse = {
      structural: 0,          // Boundary: minimum
      mechanical: 100,        // Boundary: maximum
      cosmetic: 50,           // Mid-range
      electrical: 1,          // Near minimum
      interior: 99,           // Near maximum
      severity: 'severe',     // Valid severity
      airbagDeployed: true,   // Valid boolean
      totalLoss: true,        // Valid boolean
      summary: 'Comprehensive test with all valid edge cases. This summary is under 500 characters.',
    };

    // Act
    const result = parseAndValidateResponse(JSON.stringify(comprehensiveResponse), testRequestId);

    // Assert - all values should be preserved
    expect(result.structural).toBe(0);
    expect(result.mechanical).toBe(100);
    expect(result.cosmetic).toBe(50);
    expect(result.electrical).toBe(1);
    expect(result.interior).toBe(99);
    expect(result.severity).toBe('severe');
    expect(result.airbagDeployed).toBe(true);
    expect(result.totalLoss).toBe(true);
    expect(result.summary).toBe(comprehensiveResponse.summary);
    expect(result.confidence).toBe(85);
    expect(result.method).toBe('gemini');
  });
});

/**
 * Unit Tests: Individual Validation Functions
 * 
 * Tests each validation function in isolation to ensure correct behavior.
 */
describe('Individual Validation Functions', () => {
  const testRequestId = 'test-request-456';

  describe('validateDamageScore', () => {
    test('should accept valid scores (0-100)', () => {
      expect(validateDamageScore(0, 'structural', testRequestId)).toBe(0);
      expect(validateDamageScore(50, 'mechanical', testRequestId)).toBe(50);
      expect(validateDamageScore(100, 'cosmetic', testRequestId)).toBe(100);
    });

    test('should clamp scores above 100', () => {
      expect(validateDamageScore(150, 'structural', testRequestId)).toBe(100);
      expect(validateDamageScore(200, 'mechanical', testRequestId)).toBe(100);
    });

    test('should clamp scores below 0', () => {
      expect(validateDamageScore(-10, 'structural', testRequestId)).toBe(0);
      expect(validateDamageScore(-50, 'mechanical', testRequestId)).toBe(0);
    });

    test('should default to 50 for non-numeric values', () => {
      expect(validateDamageScore('high', 'structural', testRequestId)).toBe(50);
      expect(validateDamageScore(null, 'mechanical', testRequestId)).toBe(50);
      expect(validateDamageScore(undefined, 'cosmetic', testRequestId)).toBe(50);
      expect(validateDamageScore(NaN, 'electrical', testRequestId)).toBe(50);
    });
  });

  describe('validateSeverity', () => {
    test('should accept valid severity values', () => {
      expect(validateSeverity('minor', testRequestId)).toBe('minor');
      expect(validateSeverity('moderate', testRequestId)).toBe('moderate');
      expect(validateSeverity('severe', testRequestId)).toBe('severe');
    });

    test('should default to "moderate" for invalid values', () => {
      expect(validateSeverity('catastrophic', testRequestId)).toBe('moderate');
      expect(validateSeverity('low', testRequestId)).toBe('moderate');
      expect(validateSeverity(123, testRequestId)).toBe('moderate');
      expect(validateSeverity(null, testRequestId)).toBe('moderate');
      expect(validateSeverity(undefined, testRequestId)).toBe('moderate');
    });
  });

  describe('validateSummary', () => {
    test('should accept valid summaries', () => {
      const validSummary = 'This is a valid summary.';
      expect(validateSummary(validSummary, testRequestId)).toBe(validSummary);
    });

    test('should truncate summaries over 500 characters', () => {
      const longSummary = 'A'.repeat(600);
      const result = validateSummary(longSummary, testRequestId);
      expect(result.length).toBe(500);
      expect(result).toMatch(/\.\.\.$/);
    });

    test('should not truncate summaries at exactly 500 characters', () => {
      const exactSummary = 'A'.repeat(500);
      const result = validateSummary(exactSummary, testRequestId);
      expect(result.length).toBe(500);
      expect(result).toBe(exactSummary);
    });

    test('should use default for empty summaries', () => {
      expect(validateSummary('', testRequestId)).toBe('Damage assessment completed. Please review detailed scores.');
      expect(validateSummary('   ', testRequestId)).toBe('Damage assessment completed. Please review detailed scores.');
      expect(validateSummary('\n\t', testRequestId)).toBe('Damage assessment completed. Please review detailed scores.');
    });

    test('should use default for non-string summaries', () => {
      expect(validateSummary(123, testRequestId)).toBe('Damage assessment completed. Please review detailed scores.');
      expect(validateSummary(null, testRequestId)).toBe('Damage assessment completed. Please review detailed scores.');
      expect(validateSummary(undefined, testRequestId)).toBe('Damage assessment completed. Please review detailed scores.');
      expect(validateSummary({}, testRequestId)).toBe('Damage assessment completed. Please review detailed scores.');
    });
  });

  describe('validateBoolean', () => {
    test('should accept valid boolean values', () => {
      expect(validateBoolean(true, 'airbagDeployed', testRequestId)).toBe(true);
      expect(validateBoolean(false, 'totalLoss', testRequestId)).toBe(false);
    });

    test('should default to false for non-boolean values', () => {
      expect(validateBoolean('yes', 'airbagDeployed', testRequestId)).toBe(false);
      expect(validateBoolean('true', 'airbagDeployed', testRequestId)).toBe(false);
      expect(validateBoolean(1, 'totalLoss', testRequestId)).toBe(false);
      expect(validateBoolean(0, 'totalLoss', testRequestId)).toBe(false);
      expect(validateBoolean(null, 'airbagDeployed', testRequestId)).toBe(false);
      expect(validateBoolean(undefined, 'totalLoss', testRequestId)).toBe(false);
    });
  });
});
