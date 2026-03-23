import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VehicleAutocomplete } from '@/components/ui/vehicle-autocomplete'

// Mock fetch
global.fetch = vi.fn()

describe('VehicleAutocomplete', () => {
  const mockOnChange = vi.fn()
  const defaultProps = {
    name: 'test-field',
    label: 'Test Field',
    placeholder: 'Enter value',
    value: '',
    onChange: mockOnChange,
    endpoint: '/api/test',
    debounceMs: 10, // Use short debounce for tests
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render with label and input', () => {
      render(<VehicleAutocomplete {...defaultProps} />)
      
      expect(screen.getByLabelText('Test Field')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument()
    })

    it('should show required indicator when required', () => {
      render(<VehicleAutocomplete {...defaultProps} required />)
      
      expect(screen.getByText('*')).toBeInTheDocument()
    })

    it('should display error message when provided', () => {
      render(<VehicleAutocomplete {...defaultProps} error="This field is required" />)
      
      expect(screen.getByText('This field is required')).toBeInTheDocument()
    })

    it('should be disabled when disabled prop is true', () => {
      render(<VehicleAutocomplete {...defaultProps} disabled />)
      
      const input = screen.getByRole('combobox')
      expect(input).toBeDisabled()
    })
  })

  describe('Suggestion Display', () => {
    it('should fetch and display suggestions', async () => {
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
        const options = screen.getAllByRole('option')
        expect(options.length).toBeGreaterThan(0)
        // Check that options contain the expected text (even if split by highlighting)
        expect(options[0].textContent).toContain('Toyota')
      }, { timeout: 1000 })
    })

    it('should filter suggestions based on input', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: ['Toyota', 'Honda', 'Hyundai'] }),
      } as Response)

      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: 'Toy' } })
      fireEvent.focus(input)

      await waitFor(() => {
        const options = screen.getAllByRole('option')
        expect(options).toHaveLength(1)
        expect(options[0]).toHaveTextContent('Toyota')
      }, { timeout: 1000 })
    })

    it('should show "No results found" when no matches', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response)

      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: 'XYZ' } })
      fireEvent.focus(input)

      await waitFor(() => {
        // Query for the visible "No results found" message (not the screen reader one)
        const noResults = screen.getAllByText(/No results found/i)
        expect(noResults.length).toBeGreaterThan(0)
        // Verify at least one is visible (not sr-only)
        const visibleNoResults = noResults.find(el => !el.classList.contains('sr-only'))
        expect(visibleNoResults).toBeInTheDocument()
      }, { timeout: 1000 })
    })

    it('should limit suggestions to maxSuggestions', async () => {
      const mockFetch = vi.mocked(fetch)
      const manySuggestions = Array.from({ length: 20 }, (_, i) => `Item ${i + 1}`)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: manySuggestions }),
      } as Response)

      render(<VehicleAutocomplete {...defaultProps} maxSuggestions={5} />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: 'Item' } })
      fireEvent.focus(input)

      await waitFor(() => {
        const options = screen.getAllByRole('option')
        expect(options).toHaveLength(5)
      }, { timeout: 1000 })
    })

    it('should show fewer suggestions in mobile mode', async () => {
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
        expect(options).toHaveLength(5) // Mobile shows max 5
      }, { timeout: 1000 })
    })
  })

  describe('Keyboard Navigation', () => {
    beforeEach(() => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: ['Toyota', 'Honda', 'Nissan'] }),
      } as Response)
    })

    it('should navigate suggestions with ArrowDown', async () => {
      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: 'T' } })
      fireEvent.focus(input)

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument()
      }, { timeout: 1000 })

      fireEvent.keyDown(input, { key: 'ArrowDown' })

      const firstOption = screen.getAllByRole('option')[0]
      expect(firstOption).toHaveAttribute('aria-selected', 'true')
    })

    it('should select suggestion with Enter key', async () => {
      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: 'T' } })
      fireEvent.focus(input)

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument()
      }, { timeout: 1000 })

      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(mockOnChange).toHaveBeenCalledWith('Toyota')
    })

    it('should close dropdown with Escape key', async () => {
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

  describe('Loading and Error States', () => {
    it('should show external loading state', () => {
      render(<VehicleAutocomplete {...defaultProps} isLoading />)
      
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('should handle API errors gracefully', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockRejectedValue(new Error('Network error'))

      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: 'T' } })
      fireEvent.focus(input)

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert')
        expect(errorMessage).toHaveTextContent('⚠️ Autocomplete unavailable - Using text input mode')
      }, { timeout: 1000 })
    })

    it('should handle non-200 API responses', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      } as Response)

      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: 'T' } })
      fireEvent.focus(input)

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert')
        expect(errorMessage).toHaveTextContent('⚠️ Autocomplete unavailable - Using text input mode')
      }, { timeout: 1000 })
    })
  })

  describe('Clear Button Functionality', () => {
    it('should show clear button when value exists', () => {
      render(<VehicleAutocomplete {...defaultProps} value="Toyota" />)
      
      const clearButton = screen.getByLabelText('Clear selection')
      expect(clearButton).toBeInTheDocument()
    })

    it('should not show clear button when value is empty', () => {
      render(<VehicleAutocomplete {...defaultProps} value="" />)
      
      const clearButton = screen.queryByLabelText('Clear selection')
      expect(clearButton).not.toBeInTheDocument()
    })

    it('should clear value when clear button clicked', async () => {
      render(<VehicleAutocomplete {...defaultProps} value="Toyota" />)
      
      const clearButton = screen.getByLabelText('Clear selection')
      await userEvent.click(clearButton)

      expect(mockOnChange).toHaveBeenCalledWith('')
    })

    it('should not show clear button when disabled', () => {
      render(<VehicleAutocomplete {...defaultProps} value="Toyota" disabled />)
      
      const clearButton = screen.queryByLabelText('Clear selection')
      expect(clearButton).not.toBeInTheDocument()
    })
  })

  describe('ARIA Attributes', () => {
    it('should have correct combobox role', () => {
      render(<VehicleAutocomplete {...defaultProps} />)
      
      const input = screen.getByRole('combobox')
      expect(input).toBeInTheDocument()
    })

    it('should have aria-expanded attribute', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: ['Toyota'] }),
      } as Response)

      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      expect(input).toHaveAttribute('aria-expanded', 'false')

      fireEvent.change(input, { target: { value: 'T' } })
      fireEvent.focus(input)

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-expanded', 'true')
      }, { timeout: 1000 })
    })

    it('should have aria-controls when dropdown is open', async () => {
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
        expect(input).toHaveAttribute('aria-controls', 'test-field-listbox')
      }, { timeout: 1000 })
    })

    it('should announce suggestion count to screen readers', async () => {
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
        // Component filters client-side, so "T" matches both "Toyota" and "Honda"
        expect(status.textContent).toMatch(/\d+ suggestions? available/)
      }, { timeout: 1000 })
    })
  })

  describe('Response Format Handling', () => {
    it('should handle makes response format', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ makes: ['Toyota', 'Honda'] }),
      } as Response)

      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: 'T' } })
      fireEvent.focus(input)

      await waitFor(() => {
        const options = screen.getAllByRole('option')
        expect(options.length).toBeGreaterThan(0)
        expect(options[0].textContent).toContain('Toyota')
      }, { timeout: 1000 })
    })

    it('should handle models response format', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ models: ['Camry', 'Corolla'] }),
      } as Response)

      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: 'C' } })
      fireEvent.focus(input)

      await waitFor(() => {
        const options = screen.getAllByRole('option')
        expect(options.length).toBeGreaterThan(0)
        expect(options[0].textContent).toContain('Camry')
      }, { timeout: 1000 })
    })

    it('should handle years response format', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ years: [2020, 2021, 2022] }),
      } as Response)

      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: '202' } })
      fireEvent.focus(input)

      await waitFor(() => {
        const options = screen.getAllByRole('option')
        expect(options.length).toBeGreaterThan(0)
        expect(options[0].textContent).toContain('2020')
      }, { timeout: 1000 })
    })

    it('should handle array response format', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ['Toyota', 'Honda'],
      } as Response)

      render(<VehicleAutocomplete {...defaultProps} />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: 'T' } })
      fireEvent.focus(input)

      await waitFor(() => {
        const options = screen.getAllByRole('option')
        expect(options.length).toBeGreaterThan(0)
        expect(options[0].textContent).toContain('Toyota')
      }, { timeout: 1000 })
    })
  })

  describe('Offline and Degradation Support', () => {
    it('should show offline indicator when isOffline is true', () => {
      render(<VehicleAutocomplete {...defaultProps} isOffline />)
      
      const offlineMessage = screen.getByRole('alert')
      expect(offlineMessage).toHaveTextContent('📡 Offline - Using text input mode')
    })

    it('should not fetch suggestions when offline', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ makes: ['Toyota', 'Honda'] }),
      } as Response)

      render(<VehicleAutocomplete {...defaultProps} isOffline />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: 'T' } })
      fireEvent.focus(input)

      // Wait a bit to ensure no fetch is triggered
      await new Promise(resolve => setTimeout(resolve, 500))

      // Fetch should not have been called
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should allow text input when offline', () => {
      render(<VehicleAutocomplete {...defaultProps} isOffline />)
      const input = screen.getByRole('combobox') as HTMLInputElement

      fireEvent.change(input, { target: { value: 'Custom Make' } })

      expect(input.value).toBe('Custom Make')
    })

    it('should not show dropdown when offline', async () => {
      render(<VehicleAutocomplete {...defaultProps} isOffline />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: 'T' } })
      fireEvent.focus(input)

      await new Promise(resolve => setTimeout(resolve, 500))

      const dropdown = screen.queryByRole('listbox')
      expect(dropdown).not.toBeInTheDocument()
    })

    it('should hide degradation warning when showDegradationWarning is false', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockRejectedValue(new Error('Network error'))

      render(<VehicleAutocomplete {...defaultProps} showDegradationWarning={false} />)
      const input = screen.getByRole('combobox')

      fireEvent.change(input, { target: { value: 'T' } })
      fireEvent.focus(input)

      await waitFor(() => {
        const alerts = screen.queryAllByRole('alert')
        const hasWarning = alerts.some(alert => 
          alert.textContent?.includes('Autocomplete unavailable')
        )
        expect(hasWarning).toBe(false)
      }, { timeout: 1000 })
    })

    it('should announce offline status to screen readers', () => {
      render(<VehicleAutocomplete {...defaultProps} isOffline />)
      
      const srAnnouncement = document.querySelector('[role="status"]')
      expect(srAnnouncement).toHaveTextContent('Offline - autocomplete unavailable')
    })
  })
})
