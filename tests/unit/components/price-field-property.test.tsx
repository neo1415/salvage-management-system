/**
 * Property-Based Tests for PriceField Component
 * 
 * Feature: case-creation-and-approval-enhancements
 * Property 16: Currency Formatting
 * 
 * Requirements: 9.3
 * 
 * Tests:
 * - Currency formatting with thousand separators
 * - Formatting works for all valid numeric inputs
 */

import { render, screen } from '@testing-library/react';
import { PriceField } from '@/components/manager/price-field';
import { test, fc } from '@fast-check/vitest';
import { describe } from 'vitest';

describe('Feature: case-creation-and-approval-enhancements', () => {
  describe('Property 16: Currency Formatting', () => {
    /**
     * Property 16: Currency Formatting
     * 
     * For any numeric price value, the system should format it with 
     * thousand separators (e.g., 1,234,567) for display.
     * 
     * Validates: Requirements 9.3
     */
    test.prop([
      fc.integer({ min: 0, max: 999999999 }) // Valid price range
    ])('should format any valid price with thousand separators', (price) => {
      // Render the component with the generated price
      const { container } = render(
        <PriceField
          label="Test Price"
          aiValue={price}
          isEditMode={false}
          onChange={() => {}}
        />
      );

      // Get the formatted display value
      const displayText = container.textContent || '';

      // Property 1: The display should contain the currency symbol
      expect(displayText).toContain('₦');

      // Property 2: For prices >= 1000, should contain comma separators
      if (price >= 1000) {
        // The formatted number should have commas
        const expectedFormat = price.toLocaleString('en-US');
        expect(displayText).toContain(expectedFormat);
      }

      // Property 3: The numeric value should be preserved
      // Extract just the number part (remove currency symbol and commas)
      const numericPart = displayText
        .replace(/₦/g, '')
        .replace(/,/g, '')
        .replace(/[^\d]/g, '');
      
      if (numericPart) {
        expect(parseInt(numericPart, 10)).toBe(price);
      }
    });

    test.prop([
      fc.integer({ min: 0, max: 999999999 }), // AI value
      fc.integer({ min: 0, max: 999999999 })  // Override value
    ])('should format both AI and override values with thousand separators', (aiValue, overrideValue) => {
      const { container } = render(
        <PriceField
          label="Test Price"
          aiValue={aiValue}
          overrideValue={overrideValue}
          isEditMode={false}
          onChange={() => {}}
        />
      );

      const displayText = container.textContent || '';

      // Both values should be formatted with thousand separators
      const expectedOverrideFormat = overrideValue.toLocaleString('en-US');
      const expectedAiFormat = aiValue.toLocaleString('en-US');

      // Override value should be displayed
      expect(displayText).toContain(expectedOverrideFormat);

      // AI value should be shown in parentheses
      expect(displayText).toContain(expectedAiFormat);
    });

    test.prop([
      fc.constantFrom('₦', '$', '€', '£', '¥') // Different currency symbols
    ])('should support different currency symbols', (currencySymbol) => {
      const price = 1234567;

      const { container } = render(
        <PriceField
          label="Test Price"
          aiValue={price}
          isEditMode={false}
          onChange={() => {}}
          currencySymbol={currencySymbol}
        />
      );

      const displayText = container.textContent || '';

      // Should contain the specified currency symbol
      expect(displayText).toContain(currencySymbol);

      // Should still format with thousand separators
      expect(displayText).toContain('1,234,567');
    });

    test.prop([
      fc.integer({ min: 0, max: 999 }) // Small numbers without thousands
    ])('should format small numbers correctly without commas', (price) => {
      const { container } = render(
        <PriceField
          label="Test Price"
          aiValue={price}
          isEditMode={false}
          onChange={() => {}}
        />
      );

      const displayText = container.textContent || '';

      // Should contain the currency symbol
      expect(displayText).toContain('₦');

      // Should contain the price (no commas needed for < 1000)
      expect(displayText).toContain(price.toString());

      // Should not have commas for numbers < 1000
      const priceText = displayText.match(/₦\d+/)?.[0];
      if (priceText && price < 1000) {
        expect(priceText).not.toContain(',');
      }
    });

    test.prop([
      fc.constantFrom(0, 1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000)
    ])('should format boundary values correctly', (price) => {
      const { container } = render(
        <PriceField
          label="Test Price"
          aiValue={price}
          isEditMode={false}
          onChange={() => {}}
        />
      );

      const displayText = container.textContent || '';

      // Should contain the currency symbol
      expect(displayText).toContain('₦');

      // Should contain the correctly formatted price
      const expectedFormat = price.toLocaleString('en-US');
      expect(displayText).toContain(expectedFormat);
    });
  });

  describe('Currency Formatting Invariants', () => {
    /**
     * Invariant: Formatting should be consistent regardless of how the value is provided
     */
    test.prop([
      fc.integer({ min: 1000, max: 999999999 })
    ])('should format consistently whether value is AI or override', (price) => {
      // Render with AI value only
      const { container: container1 } = render(
        <PriceField
          label="Test Price"
          aiValue={price}
          isEditMode={false}
          onChange={() => {}}
        />
      );

      // Render with override value (same as AI)
      const { container: container2 } = render(
        <PriceField
          label="Test Price"
          aiValue={price}
          overrideValue={price}
          isEditMode={false}
          onChange={() => {}}
        />
      );

      const expectedFormat = price.toLocaleString('en-US');

      // Both should contain the formatted value
      expect(container1.textContent).toContain(expectedFormat);
      expect(container2.textContent).toContain(expectedFormat);
    });

    /**
     * Invariant: Formatting should preserve the numeric value
     */
    test.prop([
      fc.integer({ min: 0, max: 999999999 })
    ])('should preserve numeric value after formatting', (price) => {
      const { container } = render(
        <PriceField
          label="Test Price"
          aiValue={price}
          isEditMode={false}
          onChange={() => {}}
        />
      );

      const displayText = container.textContent || '';

      // Extract numeric value from formatted display
      const numericPart = displayText
        .replace(/₦/g, '')
        .replace(/,/g, '')
        .replace(/[^\d]/g, '');

      if (numericPart) {
        const extractedValue = parseInt(numericPart, 10);
        
        // The extracted value should match the original price
        expect(extractedValue).toBe(price);
      }
    });
  });
});
