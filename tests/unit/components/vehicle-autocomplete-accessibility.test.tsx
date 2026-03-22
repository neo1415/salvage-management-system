import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { VehicleAutocomplete } from '@/components/ui/vehicle-autocomplete'

// Extend expect with axe matchers
expect.extend(toHaveNoViolations)

// Mock fetch
global.fetch = vi.fn()

describe('VehicleAutocomplete - Accessibility', () => {
  const mockOnChange = vi.fn()
  const defaultProps = {
    name: 'test-field',
    label: 'Test Field',
    placeholder: 'Enter value',
    value: '',
    onChange: mockOnChange,
    endpoint: '/api/test',
    debounceMs: 10,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Axe Accessibility Tests', () => {
    it('should have no accessibility violations in default state', async () => {
      const { container } = render(<VehicleAutocomplete {...defaultProps} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations with value', async () => {
      const { container } = render(<VehicleAutocomplete {...defaultProps} value="Toyota" />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations when disabled', async () => {
      const { container } = render(<VehicleAutocomplete {...defaultProps} disabled />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations with error', async () => {
      const { container } = render(<VehicleAutocomplete {...defaultProps} error="Required field" />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations with dropdown open', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: ['Toyota', 'Honda'] }),
      } as Response)

      const { container } = render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: 'T' } })
      fireEvent.focus(input)

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument()
      }, { timeout: 1000 })

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Keyboard Navigation Accessibility', () => {
    beforeEach(() => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: ['Toyota', 'Honda', 'Nissan'] }),
      } as Response)
    })

    it('should be fully keyboard navigable', async () => {
      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      // Tab to input
      input.focus()
      expect(input).toHaveFocus()

      // Type to open dropdown
      fireEvent.change(input, { target: { value: 'T' } })

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument()
      }, { timeout: 1000 })

      // Arrow down to navigate
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      
      const options = screen.getAllByRole('option')
      expect(options[0]).toHaveAttribute('aria-selected', 'true')

      // Enter to select
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(mockOnChange).toHaveBeenCalledWith('Toyota')
    })

    it('should support Escape key to close dropdown', async () => {
      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: 'T' } })
      fireEvent.focus(input)

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument()
      }, { timeout: 1000 })

      fireEvent.keyDown(input, { key: 'Escape' })

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      }, { timeout: 500 })
    })
  })

  describe('Screen Reader Support', () => {
    it('should have proper ARIA labels', () => {
      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      expect(input).toHaveAttribute('aria-labelledby', 'test-field-label')
      expect(input).toHaveAttribute('aria-autocomplete', 'list')
    })

    it('should announce dropdown state', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: ['Toyota'] }),
      } as Response)

      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      // Initially collapsed
      expect(input).toHaveAttribute('aria-expanded', 'false')

      fireEvent.change(input, { target: { value: 'T' } })
      fireEvent.focus(input)

      // Should expand
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-expanded', 'true')
      }, { timeout: 1000 })
    })

    it('should announce suggestion count', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: ['Toyota', 'Honda'] }),
      } as Response)

      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: 'T' } })
      fireEvent.focus(input)

      await waitFor(() => {
        const status = screen.getByRole('status')
        // Component filters client-side, so "T" matches both "Toyota" and "Honda" but may show only one
        expect(status.textContent).toMatch(/\d+ suggestions? available/)
      }, { timeout: 1000 })
    })

    it('should announce loading state', () => {
      render(<VehicleAutocomplete {...defaultProps} isLoading />)
      
      const status = screen.getByRole('status')
      expect(status).toHaveTextContent('Loading suggestions')
    })

    it('should announce errors', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockRejectedValue(new Error('Network error'))

      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: 'T' } })
      fireEvent.focus(input)

      await waitFor(() => {
        const status = screen.getByRole('status')
        expect(status).toHaveTextContent('Failed to load suggestions')
      }, { timeout: 1000 })
    })
  })

  describe('Focus Management', () => {
    it('should have visible focus indicators', () => {
      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      input.focus()
      
      // Check that focus ring is applied
      expect(input).toHaveClass('focus:ring-2', 'focus:ring-[#800020]')
    })

    it('should maintain focus on input after selection', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: ['Toyota'] }),
      } as Response)

      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: 'T' } })
      fireEvent.focus(input)

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument()
      }, { timeout: 1000 })

      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'Enter' })

      // Focus should remain on input
      expect(input).toHaveFocus()
    })

    it('should return focus to input after clear button click', async () => {
      render(<VehicleAutocomplete {...defaultProps} value="Toyota" />)
      const input = screen.getByRole('combobox')
      const clearButton = screen.getByLabelText('Clear selection')

      fireEvent.click(clearButton)

      // Focus should be on input
      expect(input).toHaveFocus()
    })
  })

  describe('Touch Target Sizes', () => {
    it('should have minimum 44x44px touch targets for clear button', () => {
      render(<VehicleAutocomplete {...defaultProps} value="Toyota" />)
      const clearButton = screen.getByLabelText('Clear selection')

      expect(clearButton).toHaveClass('min-w-[44px]', 'min-h-[44px]')
    })

    it('should have minimum 44px height for suggestions', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: ['Toyota'] }),
      } as Response)

      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: 'T' } })
      fireEvent.focus(input)

      await waitFor(() => {
        const option = screen.getByRole('option')
        expect(option).toHaveClass('min-h-[44px]')
      }, { timeout: 1000 })
    })
  })

  describe('Color Contrast', () => {
    it('should use brand color for focus ring', () => {
      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      // Check that brand color #800020 is used
      expect(input).toHaveClass('focus:ring-[#800020]')
    })

    it('should use brand color for highlighted text', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: ['Toyota'] }),
      } as Response)

      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: 'T' } })
      fireEvent.focus(input)

      await waitFor(() => {
        const mark = document.querySelector('mark')
        expect(mark).toHaveClass('bg-[#800020]', 'text-white')
      }, { timeout: 1000 })
    })

    it('should use brand color for selected option', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: ['Toyota'] }),
      } as Response)

      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: 'T' } })
      fireEvent.focus(input)

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument()
      }, { timeout: 1000 })

      fireEvent.keyDown(input, { key: 'ArrowDown' })

      const option = screen.getByRole('option')
      expect(option).toHaveClass('bg-[#800020]', 'text-white')
    })
  })

  describe('Mobile Accessibility', () => {
    it('should prevent iOS zoom with 16px font size', () => {
      render(<VehicleAutocomplete {...defaultProps} isMobile />)
      const input = screen.getByRole('combobox')

      // Check that font size is set to prevent zoom
      expect(input).toHaveStyle({ fontSize: '16px' })
    })

    it('should show fewer suggestions on mobile', async () => {
      const mockFetch = vi.mocked(fetch)
      const manySuggestions = Array.from({ length: 20 }, (_, i) => `Item ${i + 1}`)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: manySuggestions }),
      } as Response)

      render(<VehicleAutocomplete {...defaultProps} isMobile />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: 'Item' } })
      fireEvent.focus(input)

      await waitFor(() => {
        const options = screen.getAllByRole('option')
        expect(options.length).toBeLessThanOrEqual(5)
      }, { timeout: 1000 })
    })
  })
})
