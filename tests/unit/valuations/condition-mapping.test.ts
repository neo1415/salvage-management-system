/**
 * Unit Tests: Condition Mapping Service
 * 
 * Tests the 4-tier quality-based condition categorization system.
 * 
 * Test Coverage:
 * - Type definitions and validation
 * - Legacy condition mapping
 * - Display formatting
 * - Utility functions
 * - Error handling and fallbacks
 * - Backward compatibility
 */

import { vi } from "vitest";
import {
  type QualityTier,
  type LegacyCondition,
  type ConditionDisplay,
  mapLegacyToQuality,
  formatConditionForDisplay,
  getQualityTiers,
  isValidQualityTier,
  validateQualityTier,
  mapAnyConditionToQuality,
} from "@/features/valuations/services/condition-mapping.service";

describe("Condition Mapping Service", () => {
  // ==========================================================================
  // Legacy Condition Mapping Tests
  // ==========================================================================

  describe("mapLegacyToQuality", () => {
    it("should map brand_new to excellent", () => {
      expect(mapLegacyToQuality("brand_new")).toBe("excellent");
    });

    it("should map foreign_used to good", () => {
      expect(mapLegacyToQuality("foreign_used")).toBe("good");
    });

    it("should map tokunbo_low to good", () => {
      expect(mapLegacyToQuality("tokunbo_low")).toBe("good");
    });

    it("should map tokunbo_high to good", () => {
      expect(mapLegacyToQuality("tokunbo_high")).toBe("good");
    });

    it("should map nigerian_used to fair", () => {
      expect(mapLegacyToQuality("nigerian_used")).toBe("fair");
    });

    it("should map nig_used_low to fair", () => {
      expect(mapLegacyToQuality("nig_used_low")).toBe("fair");
    });

    it("should map nig_used_high to fair", () => {
      expect(mapLegacyToQuality("nig_used_high")).toBe("fair");
    });
  });

  // ==========================================================================
  // Display Formatting Tests
  // ==========================================================================

  describe("formatConditionForDisplay", () => {
    it("should format excellent with Brand New in brackets", () => {
      const result = formatConditionForDisplay("excellent");
      
      expect(result.value).toBe("excellent");
      expect(result.label).toBe("Excellent (Brand New)");
      expect(result.marketTerm).toBe("Brand New");
    });

    it("should format good with Foreign Used in brackets", () => {
      const result = formatConditionForDisplay("good");
      
      expect(result.value).toBe("good");
      expect(result.label).toBe("Good (Foreign Used)");
      expect(result.marketTerm).toBe("Foreign Used");
    });

    it("should format fair with Nigerian Used in brackets", () => {
      const result = formatConditionForDisplay("fair");
      
      expect(result.value).toBe("fair");
      expect(result.label).toBe("Fair (Nigerian Used)");
      expect(result.marketTerm).toBe("Nigerian Used");
    });

    it("should format poor without brackets", () => {
      const result = formatConditionForDisplay("poor");
      
      expect(result.value).toBe("poor");
      expect(result.label).toBe("Poor");
      expect(result.marketTerm).toBeUndefined();
    });
  });

  // ==========================================================================
  // Quality Tiers List Tests
  // ==========================================================================

  describe("getQualityTiers", () => {
    it("should return all four quality tiers", () => {
      const tiers = getQualityTiers();
      
      expect(tiers).toHaveLength(4);
      expect(tiers[0].value).toBe("excellent");
      expect(tiers[1].value).toBe("good");
      expect(tiers[2].value).toBe("fair");
      expect(tiers[3].value).toBe("poor");
    });

    it("should return tiers with correct labels", () => {
      const tiers = getQualityTiers();
      
      expect(tiers[0].label).toBe("Excellent (Brand New)");
      expect(tiers[1].label).toBe("Good (Foreign Used)");
      expect(tiers[2].label).toBe("Fair (Nigerian Used)");
      expect(tiers[3].label).toBe("Poor");
    });

    it("should return tiers with correct market terms", () => {
      const tiers = getQualityTiers();
      
      expect(tiers[0].marketTerm).toBe("Brand New");
      expect(tiers[1].marketTerm).toBe("Foreign Used");
      expect(tiers[2].marketTerm).toBe("Nigerian Used");
      expect(tiers[3].marketTerm).toBeUndefined();
    });
  });

  // ==========================================================================
  // Validation Tests
  // ==========================================================================

  describe("isValidQualityTier", () => {
    it("should return true for excellent", () => {
      expect(isValidQualityTier("excellent")).toBe(true);
    });

    it("should return true for good", () => {
      expect(isValidQualityTier("good")).toBe(true);
    });

    it("should return true for fair", () => {
      expect(isValidQualityTier("fair")).toBe(true);
    });

    it("should return true for poor", () => {
      expect(isValidQualityTier("poor")).toBe(true);
    });

    it("should return false for legacy condition values", () => {
      expect(isValidQualityTier("brand_new")).toBe(false);
      expect(isValidQualityTier("foreign_used")).toBe(false);
      expect(isValidQualityTier("nigerian_used")).toBe(false);
    });

    it("should return false for invalid values", () => {
      expect(isValidQualityTier("invalid")).toBe(false);
      expect(isValidQualityTier("")).toBe(false);
      expect(isValidQualityTier("EXCELLENT")).toBe(false);
    });
  });

  // ==========================================================================
  // Validation with Fallback Tests
  // ==========================================================================

  describe("validateQualityTier", () => {
    it("should return the value if it is a valid quality tier", () => {
      expect(validateQualityTier("excellent")).toBe("excellent");
      expect(validateQualityTier("good")).toBe("good");
      expect(validateQualityTier("fair")).toBe("fair");
      expect(validateQualityTier("poor")).toBe("poor");
    });

    it("should return fair as fallback for invalid values", () => {
      expect(validateQualityTier("invalid")).toBe("fair");
      expect(validateQualityTier("")).toBe("fair");
      expect(validateQualityTier("brand_new")).toBe("fair");
    });

    it("should log a warning for invalid values", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      
      validateQualityTier("invalid");
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid quality tier: \"invalid\"")
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Using fallback: \"fair\"")
      );
      
      consoleWarnSpy.mockRestore();
    });

    it("should include context in warning message if provided", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      
      validateQualityTier("invalid", "case creation");
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Context: case creation")
      );
      
      consoleWarnSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Any Condition Mapping Tests
  // ==========================================================================

  describe("mapAnyConditionToQuality", () => {
    it("should return quality tier if value is already valid", () => {
      expect(mapAnyConditionToQuality("excellent")).toBe("excellent");
      expect(mapAnyConditionToQuality("good")).toBe("good");
      expect(mapAnyConditionToQuality("fair")).toBe("fair");
      expect(mapAnyConditionToQuality("poor")).toBe("poor");
    });

    it("should map legacy conditions to quality tiers", () => {
      expect(mapAnyConditionToQuality("brand_new")).toBe("excellent");
      expect(mapAnyConditionToQuality("foreign_used")).toBe("good");
      expect(mapAnyConditionToQuality("tokunbo_low")).toBe("good");
      expect(mapAnyConditionToQuality("tokunbo_high")).toBe("good");
      expect(mapAnyConditionToQuality("nigerian_used")).toBe("fair");
      expect(mapAnyConditionToQuality("nig_used_low")).toBe("fair");
      expect(mapAnyConditionToQuality("nig_used_high")).toBe("fair");
    });

    it("should log info message when mapping legacy conditions", () => {
      const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      
      mapAnyConditionToQuality("brand_new");
      
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining("Mapped legacy condition \"brand_new\" → \"excellent\"")
      );
      
      consoleInfoSpy.mockRestore();
    });

    it("should use fallback for invalid values", () => {
      expect(mapAnyConditionToQuality("invalid")).toBe("fair");
    });

    it("should include context in log messages if provided", () => {
      const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      
      mapAnyConditionToQuality("brand_new", "AI assessment");
      
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining("Context: AI assessment")
      );
      
      consoleInfoSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Semantic Meaning Preservation Tests
  // ==========================================================================

  describe("Semantic Meaning Preservation", () => {
    it("should preserve 'best condition' meaning when mapping brand_new", () => {
      const result = mapLegacyToQuality("brand_new");
      expect(result).toBe("excellent");
      
      const display = formatConditionForDisplay(result);
      expect(display.label).toContain("Brand New");
    });

    it("should preserve 'imported vehicle' meaning when mapping foreign_used", () => {
      const result = mapLegacyToQuality("foreign_used");
      expect(result).toBe("good");
      
      const display = formatConditionForDisplay(result);
      expect(display.label).toContain("Foreign Used");
    });

    it("should preserve 'locally used' meaning when mapping nigerian_used", () => {
      const result = mapLegacyToQuality("nigerian_used");
      expect(result).toBe("fair");
      
      const display = formatConditionForDisplay(result);
      expect(display.label).toContain("Nigerian Used");
    });

    it("should map high-quality tokunbo to good (imported quality)", () => {
      expect(mapLegacyToQuality("tokunbo_low")).toBe("good");
      expect(mapLegacyToQuality("tokunbo_high")).toBe("good");
    });

    it("should map all nigerian used variants to fair (moderate wear)", () => {
      expect(mapLegacyToQuality("nig_used_low")).toBe("fair");
      expect(mapLegacyToQuality("nig_used_high")).toBe("fair");
    });
  });

  // ==========================================================================
  // Round-Trip Tests
  // ==========================================================================

  describe("Round-Trip Consistency", () => {
    it("should maintain value through format and extract cycle", () => {
      const qualityTiers: QualityTier[] = ["excellent", "good", "fair", "poor"];
      
      qualityTiers.forEach((tier) => {
        const display = formatConditionForDisplay(tier);
        expect(display.value).toBe(tier);
      });
    });

    it("should maintain value through legacy mapping and format cycle", () => {
      const legacyConditions: LegacyCondition[] = [
        "brand_new",
        "foreign_used",
        "nigerian_used",
        "tokunbo_low",
        "tokunbo_high",
        "nig_used_low",
        "nig_used_high",
      ];
      
      legacyConditions.forEach((legacy) => {
        const quality = mapLegacyToQuality(legacy);
        const display = formatConditionForDisplay(quality);
        expect(display.value).toBe(quality);
      });
    });
  });

  // ==========================================================================
  // Edge Cases and Error Handling
  // ==========================================================================

  describe("Edge Cases", () => {
    it("should handle empty string gracefully", () => {
      expect(validateQualityTier("")).toBe("fair");
      expect(mapAnyConditionToQuality("")).toBe("fair");
    });

    it("should handle case sensitivity", () => {
      expect(isValidQualityTier("EXCELLENT")).toBe(false);
      expect(isValidQualityTier("Excellent")).toBe(false);
      expect(validateQualityTier("EXCELLENT")).toBe("fair");
    });

    it("should handle whitespace", () => {
      expect(isValidQualityTier(" excellent ")).toBe(false);
      expect(validateQualityTier(" excellent ")).toBe("fair");
    });

    it("should handle null-like values", () => {
      expect(validateQualityTier("null")).toBe("fair");
      expect(validateQualityTier("undefined")).toBe("fair");
    });
  });

  // ==========================================================================
  // Backward Compatibility Tests (Deprecated Functions)
  // ==========================================================================

  describe("Backward Compatibility (Deprecated)", () => {
    it("should log deprecation warning for getUniversalConditionCategories", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      
      const module = await import("@/features/valuations/services/condition-mapping.service");
      
      module.getUniversalConditionCategories();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("getUniversalConditionCategories() is deprecated")
      );
      
      consoleWarnSpy.mockRestore();
    });

    it("should log deprecation warning for mapUserConditionToDbConditions", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      
      const module = await import("@/features/valuations/services/condition-mapping.service");
      
      module.mapUserConditionToDbConditions("Brand New", 50000);
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("mapUserConditionToDbConditions() is deprecated")
      );
      
      consoleWarnSpy.mockRestore();
    });

    it("should log deprecation warning for getMileageThreshold", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      
      const module = await import("@/features/valuations/services/condition-mapping.service");
      
      module.getMileageThreshold();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("getMileageThreshold() is deprecated")
      );
      
      consoleWarnSpy.mockRestore();
    });
  });
});
