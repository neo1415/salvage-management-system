# Implementation Plan: Vehicle Input Enhancement

## Overview

This implementation plan converts the vehicle input enhancement design into actionable coding tasks. The feature implements a two-phase approach to solve database query matching issues:

**Phase 1 (Backend):** Add fuzzy string matching to ValuationQueryService for immediate improvement in database query success rates.

**Phase 2 (Frontend):** Replace text inputs with modern autocomplete components for better UX and accuracy.

The implementation follows a test-driven approach with property-based testing for universal correctness properties and unit tests for specific edge cases.

## Tasks

- [x] 1. Phase 1: Backend Fuzzy Matching Implementation
  - [x] 1.1 Add string normalization to ValuationQueryService
    - Implement `normalizeString()` method that converts to lowercase, trims whitespace, removes hyphens and special characters
    - Add unit tests for normalization edge cases (empty strings, special characters, multiple spaces)
    - _Requirements: 1.3_

  - [x] 1.2 Write property test for string normalization
    - **Property 1: Normalization idempotence**
    - **Validates: Requirements 1.3**
    - Test that normalizing a string twice produces the same result as normalizing once
    - Test with random strings containing various special characters

  - [x] 1.3 Implement fuzzy make/model matching
    - Add `fuzzyMakeModelMatch()` method using PostgreSQL ILIKE and trigram similarity
    - Implement similarity score calculation using Levenshtein distance
    - Add threshold filtering (≥ 0.6 similarity score)
    - Return best match with similarity score
    - _Requirements: 1.1, 1.2, 1.6_

  - [x] 1.4 Write property test for fuzzy matching
    - **Property 2: Fuzzy match reflexivity**
    - **Validates: Requirements 1.1, 1.6**
    - Test that exact matches always return similarity score of 1.0
    - Test that similar strings return scores between 0.6 and 1.0

  - [x] 1.5 Update queryValuation() with fallback chain
    - Modify existing method to implement: exact match → fuzzy make/model → fuzzy year → not found
    - Add matchType and similarityScore to ValuationResult interface
    - Add logging for fuzzy match attempts with input/matched values
    - _Requirements: 1.5, 1.7_

  - [x] 1.6 Write unit tests for fallback chain
    - Test exact match takes precedence over fuzzy match
    - Test fuzzy make/model match when exact fails
    - Test fuzzy year match when make/model fuzzy fails
    - Test not found when all strategies fail
    - _Requirements: 1.5_

  - [x] 1.7 Write integration tests for enhanced valuation query
    - Test real database queries with fuzzy matching
    - Test with actual vehicle data (e.g., "GLE-Class GLE 350" → "GLE 350")
    - Test performance (queries complete within 200ms)
    - _Requirements: 1.1, 1.2, 1.5_

- [x] 2. Checkpoint - Verify Phase 1 backend fuzzy matching
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Phase 2: Autocomplete API Endpoints
  - [x] 3.1 Create cache service for autocomplete data
    - Implement `AutocompleteCache` class in `src/lib/cache/autocomplete-cache.ts`
    - Add methods: getMakes(), setMakes(), getModels(), setModels(), getYears(), setYears()
    - Use Redis with 1-hour TTL
    - Add cache key constants for makes, models, years
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 3.2 Write unit tests for cache service
    - Test cache hit/miss scenarios
    - Test TTL expiration
    - Test cache key generation
    - Test error handling when Redis unavailable
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 3.3 Implement GET /api/valuations/makes endpoint
    - Create `src/app/api/valuations/makes/route.ts`
    - Check cache first, query database on miss
    - Return alphabetically sorted makes
    - Add error handling with descriptive messages
    - _Requirements: 2.1, 2.4, 2.9_

  - [x] 3.4 Implement GET /api/valuations/models endpoint
    - Create `src/app/api/valuations/models/route.ts`
    - Require make query parameter, return 400 if missing
    - Check cache first, query database on miss
    - Return alphabetically sorted models for specified make
    - _Requirements: 2.2, 2.5, 2.9_

  - [x] 3.5 Implement GET /api/valuations/years endpoint
    - Create `src/app/api/valuations/years/route.ts`
    - Require make and model query parameters, return 400 if missing
    - Check cache first, query database on miss
    - Return numerically sorted years for specified make/model
    - _Requirements: 2.3, 2.6, 2.9_

  - [x] 3.6 Write integration tests for autocomplete endpoints
    - Test all three endpoints with valid parameters
    - Test error responses for missing parameters
    - Test cache behavior (first call misses, second hits)
    - Test response time (< 200ms under normal load)
    - _Requirements: 2.1, 2.2, 2.3, 2.7, 2.8_

  - [x] 3.7 Write property test for API response consistency
    - **Property 3: API response stability**
    - **Validates: Requirements 2.1, 2.2, 2.3**
    - Test that repeated calls to same endpoint return identical data
    - Test that cached and non-cached responses have same structure

- [x] 4. Checkpoint - Verify autocomplete API endpoints
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Phase 2: Reusable Autocomplete Component
  - [x] 5.1 Create VehicleAutocomplete component
    - Create `src/components/ui/vehicle-autocomplete.tsx`
    - Implement ARIA combobox pattern with proper roles and attributes
    - Add keyboard navigation (Arrow Up/Down, Enter, Escape, Tab)
    - Add debounced input handling (300ms default)
    - Add loading state with spinner indicator
    - Add error state with graceful degradation to text input
    - _Requirements: 3.1, 3.2, 3.3, 3.7, 3.8_

  - [x] 5.2 Add mobile-optimized features to component
    - Implement touch-friendly tap targets (44x44px minimum)
    - Add mobile mode that shows max 5 suggestions
    - Prevent iOS zoom on input focus
    - Support swipe to dismiss dropdown
    - Ensure dropdown visible above keyboard
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 5.3 Add accessibility features to component
    - Implement aria-expanded, aria-controls, aria-activedescendant
    - Announce suggestion count to screen readers
    - Add visible focus indicators (WCAG 2.1 AA contrast)
    - Announce selections to screen readers
    - Add proper label associations
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 5.4 Add visual features to component
    - Implement clear button to reset selection
    - Highlight matching text in suggestions
    - Add "No results found" message
    - Style with Tailwind CSS using #800020 brand color
    - Limit displayed suggestions to 10 items (5 on mobile)
    - _Requirements: 3.4, 3.5, 3.6, 3.9, 3.10, 3.11, 3.12_

  - [x] 5.5 Write unit tests for VehicleAutocomplete component
    - Test keyboard navigation (arrow keys, enter, escape, tab)
    - Test debouncing behavior (300ms delay)
    - Test loading and error states
    - Test suggestion filtering and display
    - Test clear button functionality
    - _Requirements: 3.2, 3.3, 3.4, 3.7, 3.11_

  - [x] 5.6 Write accessibility tests for component
    - Test ARIA attributes are correctly set
    - Test keyboard-only navigation works
    - Test screen reader announcements
    - Test focus indicators meet WCAG 2.1 AA
    - Use axe-core for automated accessibility testing
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 10.7_

  - [ ]* 5.7 Write property test for component state management
    - **Property 4: Component state consistency**
    - **Validates: Requirements 3.2, 3.3**
    - Test that component state transitions are valid (closed → loading → open)
    - Test that selection always updates value correctly

- [x] 6. Checkpoint - Verify autocomplete component
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Phase 2: Case Creation Form Integration
  - [x] 7.1 Replace vehicle make input with VehicleAutocomplete
    - Update `src/app/(dashboard)/adjuster/cases/new/page.tsx`
    - Replace text input with VehicleAutocomplete component
    - Connect to /api/valuations/makes endpoint
    - Add onChange handler that clears model and year when make changes
    - Preserve existing validation rules
    - _Requirements: 4.1, 4.8, 4.10_

  - [x] 7.2 Replace vehicle model input with VehicleAutocomplete
    - Replace text input with VehicleAutocomplete component
    - Connect to /api/valuations/models endpoint with make query parameter
    - Disable until make is selected
    - Add onChange handler that clears year when model changes
    - Preserve existing validation rules
    - _Requirements: 4.2, 4.4, 4.6, 4.9, 4.10_

  - [x] 7.3 Replace vehicle year input with VehicleAutocomplete
    - Replace text input with VehicleAutocomplete component
    - Connect to /api/valuations/years endpoint with make and model query parameters
    - Disable until both make and model are selected
    - Preserve existing validation rules
    - _Requirements: 4.3, 4.5, 4.7, 4.10_

  - [x] 7.4 Add cascade and clear logic to form
    - Implement automatic model fetch when make is selected
    - Implement automatic year fetch when model is selected
    - Ensure model and year clear when make changes
    - Ensure year clears when model changes
    - _Requirements: 4.4, 4.5, 4.8, 4.9_

  - [x] 7.5 Add graceful degradation and offline support
    - Implement fallback to text inputs when API fails
    - Display warning message when autocomplete unavailable
    - Preserve sessionStorage integration for offline support
    - Show offline indicator when network unavailable
    - _Requirements: 7.1, 7.2, 7.6, 4.11_

  - [x] 7.6 Write integration tests for form integration
    - Test complete flow: select make → select model → select year
    - Test cascade clearing (changing make clears model/year)
    - Test disabled states (model disabled until make selected)
    - Test form submission with autocomplete selections
    - Test graceful degradation when API fails
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 7.1_

  - [x] 7.7 Write end-to-end tests for case creation with autocomplete
    - Test complete case creation flow using Playwright
    - Test on mobile viewport (375px width)
    - Test keyboard-only navigation
    - Test with real API calls
    - _Requirements: 10.4, 5.1_

- [x] 8. Checkpoint - Verify form integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Analytics and Monitoring Implementation
  - [x] 9.1 Add fuzzy match logging to ValuationQueryService
    - Log all fuzzy match attempts with input/matched values
    - Log similarity scores for debugging
    - Add performance warnings when queries exceed 200ms
    - _Requirements: 9.1, 9.2, 6.7_

  - [x] 9.2 Add autocomplete usage tracking
    - Track percentage of cases using autocomplete vs manual entry
    - Track average response time for autocomplete endpoints
    - Track fallback to text input due to errors
    - Track most frequently searched makes and models
    - Add alerts when response time exceeds 500ms
    - _Requirements: 9.3, 9.4, 9.5, 9.6, 9.7_

  - [x] 9.3 Write unit tests for analytics logging
    - Test that fuzzy matches are logged correctly
    - Test that performance warnings trigger at correct threshold
    - Test that usage metrics are tracked
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 10. Final Testing and Quality Assurance
  - [x] 10.1 Write property test for backward compatibility
    - **Property 5: Backward compatibility preservation**
    - **Validates: Requirements 7.3, 7.4**
    - Test that exact string matching still works
    - Test that custom text entries are processed correctly

  - [x] 10.2 Write performance tests for autocomplete system
    - Test API response times under load (concurrent requests)
    - Test cache performance (hit rate, response time improvement)
    - Test debouncing reduces API calls
    - _Requirements: 6.5, 6.6, 10.6_

  - [x] 10.3 Write mobile responsiveness tests
    - Test component rendering on screen sizes 320px to 1920px
    - Test touch targets meet 44x44px minimum
    - Test mobile shows max 5 suggestions
    - Test on iOS and Android devices
    - _Requirements: 5.1, 5.2, 5.3, 10.8_

  - [x] 10.4 Run comprehensive test suite
    - Execute all unit tests
    - Execute all integration tests
    - Execute all property-based tests
    - Execute all end-to-end tests
    - Execute accessibility tests with axe-core
    - Verify test coverage meets project standards
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation follows a test-driven approach with tests written alongside implementation
- Phase 1 (backend fuzzy matching) can be deployed independently before Phase 2 (autocomplete UI)
- All autocomplete components use Radix UI for accessibility compliance
- Redis caching is critical for performance - ensure Redis is available before deploying Phase 2
