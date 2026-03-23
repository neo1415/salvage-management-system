/**
 * Unit Tests for PriceField Component
 * 
 * Requirements: 4.1, 4.2, 9.3
 * 
 * Tests:
 * - View mode display
 * - Edit mode input
 * - Confidence score display
 * - Currency formatting
 * - Low confidence warning
 * - Override value display
 * - Mobile touch targets
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PriceField, PriceFieldGroup } from '@/components/manager/price-field';
import { vi } from 'vitest';

describe('PriceField Component', () => {
  describe('View Mode Display', () => {
    it('should display AI value in view mode', () => {
      render(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          isEditMode={false}
          onChange={() => {}}
        />
      );

      expect(screen.getByText('Market Value')).toBeInTheDocument();
      expect(screen.getByText('₦5,000,000')).toBeInTheDocument();
    });

    it('should display override value when provided', () => {
      render(
        <PriceField
          label="Salvage Value"
          aiValue={3000000}
          overrideValue={3500000}
          isEditMode={false}
          onChange={() => {}}
        />
      );

      // Should show override value
      expect(screen.getByText('₦3,500,000')).toBeInTheDocument();
      
      // Should show AI value in parentheses
      expect(screen.getByText(/AI: ₦3,000,000/)).toBeInTheDocument();
    });

    it('should not show AI value in parentheses when no override', () => {
      render(
        <PriceField
          label="Reserve Price"
          aiValue={2000000}
          isEditMode={false}
          onChange={() => {}}
        />
      );

      expect(screen.getByText('₦2,000,000')).toBeInTheDocument();
      expect(screen.queryByText(/AI:/)).not.toBeInTheDocument();
    });
  });

  describe('Edit Mode Input', () => {
    it('should render input field in edit mode', () => {
      render(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          isEditMode={true}
          onChange={() => {}}
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue(5000000);
    });

    it('should call onChange when value is edited', () => {
      const handleChange = vi.fn();
      
      render(
        <PriceField
          label="Salvage Value"
          aiValue={3000000}
          isEditMode={true}
          onChange={handleChange}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '3500000' } });

      expect(handleChange).toHaveBeenCalledWith(3500000);
    });

    it('should not call onChange for invalid input', () => {
      const handleChange = vi.fn();
      
      render(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          isEditMode={true}
          onChange={handleChange}
        />
      );

      const input = screen.getByRole('spinbutton');
      
      // Clear previous calls
      handleChange.mockClear();
      
      // Try invalid input
      fireEvent.change(input, { target: { value: 'invalid' } });

      expect(handleChange).not.toHaveBeenCalled();
    });

    it('should not call onChange for negative values', () => {
      const handleChange = vi.fn();
      
      render(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          isEditMode={true}
          onChange={handleChange}
        />
      );

      const input = screen.getByRole('spinbutton');
      
      // Clear previous calls
      handleChange.mockClear();
      
      // Try negative value
      fireEvent.change(input, { target: { value: '-1000' } });

      expect(handleChange).not.toHaveBeenCalled();
    });

    it('should reset to display value on blur if invalid', async () => {
      render(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          isEditMode={true}
          onChange={() => {}}
        />
      );

      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      
      // Enter empty value (which is invalid)
      fireEvent.change(input, { target: { value: '' } });
      
      // Blur should reset to original value
      fireEvent.blur(input);
      
      await waitFor(() => {
        expect(input.value).toBe('5000000');
      });
    });

    it('should show AI estimate below input when override exists', () => {
      render(
        <PriceField
          label="Salvage Value"
          aiValue={3000000}
          overrideValue={3500000}
          isEditMode={true}
          onChange={() => {}}
        />
      );

      expect(screen.getByText(/AI estimate: ₦3,000,000/)).toBeInTheDocument();
    });
  });

  describe('Confidence Score Display', () => {
    it('should display confidence score when provided', () => {
      render(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          isEditMode={false}
          onChange={() => {}}
          confidence={85}
        />
      );

      expect(screen.getByText('85% confidence')).toBeInTheDocument();
    });

    it('should not display confidence score when not provided', () => {
      render(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          isEditMode={false}
          onChange={() => {}}
        />
      );

      expect(screen.queryByText(/confidence/)).not.toBeInTheDocument();
    });

    it('should color high confidence (>=80) as green', () => {
      render(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          isEditMode={false}
          onChange={() => {}}
          confidence={85}
        />
      );

      const confidenceText = screen.getByText('85% confidence');
      expect(confidenceText).toHaveClass('text-green-600');
    });

    it('should color medium confidence (60-79) as yellow', () => {
      render(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          isEditMode={false}
          onChange={() => {}}
          confidence={70}
        />
      );

      const confidenceText = screen.getByText('70% confidence');
      expect(confidenceText).toHaveClass('text-yellow-600');
    });

    it('should color low confidence (<60) as red', () => {
      render(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          isEditMode={false}
          onChange={() => {}}
          confidence={50}
        />
      );

      const confidenceText = screen.getByText('50% confidence');
      expect(confidenceText).toHaveClass('text-red-600');
    });
  });

  describe('Currency Formatting', () => {
    it('should format numbers with thousand separators', () => {
      render(
        <PriceField
          label="Market Value"
          aiValue={1234567}
          isEditMode={false}
          onChange={() => {}}
        />
      );

      expect(screen.getByText('₦1,234,567')).toBeInTheDocument();
    });

    it('should use default Naira symbol', () => {
      render(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          isEditMode={false}
          onChange={() => {}}
        />
      );

      expect(screen.getByText(/₦/)).toBeInTheDocument();
    });

    it('should support custom currency symbol', () => {
      render(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          isEditMode={false}
          onChange={() => {}}
          currencySymbol="$"
        />
      );

      expect(screen.getByText('$5,000,000')).toBeInTheDocument();
    });

    it('should format zero correctly', () => {
      render(
        <PriceField
          label="Market Value"
          aiValue={0}
          isEditMode={false}
          onChange={() => {}}
        />
      );

      expect(screen.getByText('₦0')).toBeInTheDocument();
    });

    it('should format large numbers correctly', () => {
      render(
        <PriceField
          label="Market Value"
          aiValue={999999999}
          isEditMode={false}
          onChange={() => {}}
        />
      );

      expect(screen.getByText('₦999,999,999')).toBeInTheDocument();
    });
  });

  describe('Low Confidence Warning', () => {
    it('should show warning for confidence below 70%', () => {
      render(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          isEditMode={false}
          onChange={() => {}}
          confidence={65}
        />
      );

      expect(screen.getByText(/Low confidence - manual review recommended/)).toBeInTheDocument();
    });

    it('should not show warning for confidence 70% or above', () => {
      render(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          isEditMode={false}
          onChange={() => {}}
          confidence={70}
        />
      );

      expect(screen.queryByText(/Low confidence/)).not.toBeInTheDocument();
    });

    it('should not show warning in edit mode', () => {
      render(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          isEditMode={true}
          onChange={() => {}}
          confidence={65}
        />
      );

      expect(screen.queryByText(/Low confidence/)).not.toBeInTheDocument();
    });

    it('should highlight low confidence field with yellow background', () => {
      const { container } = render(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          isEditMode={false}
          onChange={() => {}}
          confidence={65}
        />
      );

      const fieldContainer = container.firstChild as HTMLElement;
      expect(fieldContainer).toHaveClass('bg-yellow-50');
      expect(fieldContainer).toHaveClass('border-yellow-200');
    });

    it('should use gray background for normal confidence', () => {
      const { container } = render(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          isEditMode={false}
          onChange={() => {}}
          confidence={80}
        />
      );

      const fieldContainer = container.firstChild as HTMLElement;
      expect(fieldContainer).toHaveClass('bg-gray-50');
      expect(fieldContainer).not.toHaveClass('bg-yellow-50');
    });
  });

  describe('Mobile Touch Targets', () => {
    it('should have minimum 44px height for input in edit mode', () => {
      render(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          isEditMode={true}
          onChange={() => {}}
        />
      );

      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      const styles = window.getComputedStyle(input);
      
      // Check minHeight style is set
      expect(input.style.minHeight).toBe('44px');
    });

    it('should have proper input attributes for mobile', () => {
      render(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          isEditMode={true}
          onChange={() => {}}
        />
      );

      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      
      expect(input.type).toBe('number');
      expect(input.min).toBe('0');
      expect(input.step).toBe('1000');
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          isEditMode={false}
          onChange={() => {}}
          className="custom-class"
        />
      );

      const fieldContainer = container.firstChild as HTMLElement;
      expect(fieldContainer).toHaveClass('custom-class');
    });
  });

  describe('Value Updates', () => {
    it('should update input value when overrideValue prop changes', () => {
      const { rerender } = render(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          overrideValue={5500000}
          isEditMode={true}
          onChange={() => {}}
        />
      );

      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      expect(input.value).toBe('5500000');

      // Update override value
      rerender(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          overrideValue={6000000}
          isEditMode={true}
          onChange={() => {}}
        />
      );

      expect(input.value).toBe('6000000');
    });

    it('should update display when switching from edit to view mode', () => {
      const { rerender } = render(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          overrideValue={5500000}
          isEditMode={true}
          onChange={() => {}}
        />
      );

      expect(screen.getByRole('spinbutton')).toBeInTheDocument();

      // Switch to view mode
      rerender(
        <PriceField
          label="Market Value"
          aiValue={5000000}
          overrideValue={5500000}
          isEditMode={false}
          onChange={() => {}}
        />
      );

      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
      expect(screen.getByText('₦5,500,000')).toBeInTheDocument();
    });
  });
});

describe('PriceFieldGroup Component', () => {
  it('should render group title', () => {
    render(
      <PriceFieldGroup title="Valuation">
        <div>Child content</div>
      </PriceFieldGroup>
    );

    expect(screen.getByText('Valuation')).toBeInTheDocument();
  });

  it('should render children', () => {
    render(
      <PriceFieldGroup title="Valuation">
        <div>Test child</div>
      </PriceFieldGroup>
    );

    expect(screen.getByText('Test child')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <PriceFieldGroup title="Valuation" className="custom-group">
        <div>Child</div>
      </PriceFieldGroup>
    );

    const groupContainer = container.firstChild as HTMLElement;
    expect(groupContainer).toHaveClass('custom-group');
  });

  it('should have proper spacing for multiple children', () => {
    render(
      <PriceFieldGroup title="Valuation">
        <PriceField
          label="Market Value"
          aiValue={5000000}
          isEditMode={false}
          onChange={() => {}}
        />
        <PriceField
          label="Salvage Value"
          aiValue={3000000}
          isEditMode={false}
          onChange={() => {}}
        />
      </PriceFieldGroup>
    );

    expect(screen.getByText('Market Value')).toBeInTheDocument();
    expect(screen.getByText('Salvage Value')).toBeInTheDocument();
  });
});
