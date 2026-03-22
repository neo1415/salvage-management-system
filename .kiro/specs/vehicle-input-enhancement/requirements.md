# Requirements Document: Vehicle Input Enhancement

## Introduction

The vehicle input enhancement feature addresses a critical database query matching issue in the case creation form. Currently, user input for vehicle make and model uses exact string matching, causing unnecessary fallback to web scraping even when data exists in the database. This results in slower performance, unnecessary API calls, and poor user experience.

The feature implements a two-phase solution: Phase 1 adds backend fuzzy matching for immediate improvement, and Phase 2 introduces modern autocomplete UI components for long-term usability and accuracy.

## Glossary

- **Case_Creation_Form**: The mobile-first form used by adjusters to create new salvage vehicle cases
- **Valuation_Query_Service**: Backend service that queries the vehicleValuations database table
- **Fuzzy_Matching**: String matching algorithm that finds approximate matches (e.g., "GLE-Class GLE 350" matches "GLE 350")
- **Autocomplete_Component**: UI component that provides real-time filtered suggestions as user types
- **Database_First_Query**: Query strategy that attempts database lookup before falling back to web scraping
- **String_Normalization**: Process of standardizing strings (lowercase, trim whitespace, remove special characters)
- **Combobox_Pattern**: Accessible UI pattern combining text input with dropdown selection (ARIA compliant)
- **Debouncing**: Technique to delay function execution until user stops typing (typically 300ms)
- **Market_Data_Service**: Service that scrapes vehicle pricing data from external sources when database lookup fails

## Requirements

### Requirement 1: Backend Fuzzy String Matching

**User Story:** As an adjuster, I want the system to find database matches even when I include extra words in the vehicle model, so that I get faster results without unnecessary web scraping.

#### Acceptance Criteria

1. WHEN a user enters a make that approximately matches a database entry, THE Valuation_Query_Service SHALL return the closest matching make using fuzzy matching
2. WHEN a user enters a model that approximately matches a database entry, THE Valuation_Query_Service SHALL return the closest matching model using fuzzy matching
3. THE Valuation_Query_Service SHALL normalize all input strings by converting to lowercase, trimming whitespace, and removing hyphens before comparison
4. WHEN fuzzy matching is performed, THE Valuation_Query_Service SHALL use SQL ILIKE or full-text search for case-insensitive partial matching
5. THE Valuation_Query_Service SHALL implement a fallback chain: exact match → fuzzy make/model match → fuzzy year match (±2 years) → web scraping
6. WHEN multiple fuzzy matches are found, THE Valuation_Query_Service SHALL return the match with the highest similarity score
7. THE Valuation_Query_Service SHALL log all fuzzy match attempts with input string, matched string, and similarity score for debugging

### Requirement 2: Autocomplete API Endpoints

**User Story:** As a developer, I want RESTful API endpoints that provide vehicle data for autocomplete components, so that the UI can display real-time suggestions.

#### Acceptance Criteria

1. THE System SHALL provide a GET /api/valuations/makes endpoint that returns all available vehicle makes from the database
2. THE System SHALL provide a GET /api/valuations/models?make={make} endpoint that returns all models for a specified make
3. THE System SHALL provide a GET /api/valuations/years?make={make}&model={model} endpoint that returns all years for a specified make and model
4. WHEN the makes endpoint is called, THE System SHALL return results in alphabetical order
5. WHEN the models endpoint is called without a make parameter, THE System SHALL return a 400 Bad Request error
6. WHEN the years endpoint is called without required parameters, THE System SHALL return a 400 Bad Request error
7. THE System SHALL respond to all autocomplete endpoints within 200ms under normal load
8. THE System SHALL cache autocomplete endpoint responses for 1 hour to improve performance
9. WHEN an autocomplete endpoint encounters a database error, THE System SHALL return a 500 error with a descriptive message

### Requirement 3: Reusable Autocomplete Component

**User Story:** As a developer, I want a reusable autocomplete component that follows modern UX patterns, so that I can provide consistent vehicle input across the application.

#### Acceptance Criteria

1. THE Autocomplete_Component SHALL implement the ARIA combobox pattern with proper roles and attributes
2. THE Autocomplete_Component SHALL support keyboard navigation using arrow keys, Enter, Escape, and Tab
3. THE Autocomplete_Component SHALL debounce user input by 300ms before triggering search
4. WHEN a user types in the Autocomplete_Component, THE Component SHALL display filtered suggestions in a dropdown
5. THE Autocomplete_Component SHALL limit displayed suggestions to 10 items maximum
6. WHEN no suggestions match the input, THE Autocomplete_Component SHALL display a "No results found" message
7. THE Autocomplete_Component SHALL show a loading indicator while fetching suggestions
8. WHEN the API request fails, THE Autocomplete_Component SHALL gracefully degrade to a standard text input
9. THE Autocomplete_Component SHALL support touch targets of at least 44x44 pixels for mobile devices
10. THE Autocomplete_Component SHALL match the application theme using Tailwind CSS with #800020 brand color
11. THE Autocomplete_Component SHALL allow users to clear their selection with a clear button
12. THE Autocomplete_Component SHALL highlight the matching portion of suggestions

### Requirement 4: Case Creation Form Integration

**User Story:** As an adjuster, I want the case creation form to use autocomplete for vehicle inputs, so that I can quickly and accurately select vehicles from the database.

#### Acceptance Criteria

1. THE Case_Creation_Form SHALL replace the vehicle make text input with an Autocomplete_Component
2. THE Case_Creation_Form SHALL replace the vehicle model text input with an Autocomplete_Component
3. THE Case_Creation_Form SHALL replace the vehicle year text input with an Autocomplete_Component
4. WHEN a user selects a make, THE Case_Creation_Form SHALL automatically fetch and enable the model autocomplete
5. WHEN a user selects a model, THE Case_Creation_Form SHALL automatically fetch and enable the year autocomplete
6. THE Case_Creation_Form SHALL disable model selection until a make is selected
7. THE Case_Creation_Form SHALL disable year selection until both make and model are selected
8. WHEN a user changes the make selection, THE Case_Creation_Form SHALL clear the model and year selections
9. WHEN a user changes the model selection, THE Case_Creation_Form SHALL clear the year selection
10. THE Case_Creation_Form SHALL maintain existing form validation rules for vehicle inputs
11. THE Case_Creation_Form SHALL preserve form state in sessionStorage including autocomplete selections

### Requirement 5: Mobile-First Responsive Design

**User Story:** As an adjuster using a mobile device, I want the autocomplete components to work smoothly on my phone, so that I can create cases efficiently in the field.

#### Acceptance Criteria

1. THE Autocomplete_Component SHALL render properly on screen sizes from 320px to 1920px width
2. THE Autocomplete_Component SHALL use touch-friendly tap targets (minimum 44x44 pixels)
3. WHEN displayed on mobile devices, THE Autocomplete_Component SHALL show a maximum of 5 suggestions to avoid excessive scrolling
4. THE Autocomplete_Component SHALL prevent zoom on input focus on iOS devices
5. THE Autocomplete_Component SHALL support swipe gestures to dismiss the dropdown on mobile
6. WHEN the keyboard is visible on mobile, THE Autocomplete_Component SHALL ensure the dropdown remains visible above the keyboard
7. THE Autocomplete_Component SHALL use native mobile scrolling for the suggestions list

### Requirement 6: Performance and Caching

**User Story:** As a system administrator, I want the autocomplete feature to perform efficiently under load, so that it doesn't impact application performance.

#### Acceptance Criteria

1. THE System SHALL cache the list of all makes in memory for 1 hour
2. THE System SHALL cache model lists per make in memory for 1 hour
3. THE System SHALL cache year lists per make/model combination in memory for 1 hour
4. WHEN cache expires, THE System SHALL refresh data from the database asynchronously
5. THE Autocomplete_Component SHALL debounce API requests to prevent excessive calls
6. THE System SHALL handle concurrent requests to autocomplete endpoints without performance degradation
7. WHEN database query takes longer than 200ms, THE System SHALL log a performance warning

### Requirement 7: Backward Compatibility and Graceful Degradation

**User Story:** As a user with a slow internet connection, I want the form to still work if autocomplete fails, so that I can complete my task regardless of network conditions.

#### Acceptance Criteria

1. WHEN autocomplete API requests fail, THE Case_Creation_Form SHALL fall back to standard text input fields
2. THE Case_Creation_Form SHALL display a warning message when autocomplete is unavailable
3. THE Valuation_Query_Service SHALL continue to support exact string matching for backward compatibility
4. WHEN a user enters text that doesn't match any suggestions, THE System SHALL allow form submission with the custom text
5. THE System SHALL process custom text entries using the fuzzy matching backend logic
6. WHEN offline, THE Case_Creation_Form SHALL disable autocomplete and show text inputs with offline indicator

### Requirement 8: Accessibility Compliance

**User Story:** As a user with disabilities, I want the autocomplete components to work with assistive technologies, so that I can use the application independently.

#### Acceptance Criteria

1. THE Autocomplete_Component SHALL implement ARIA combobox role with aria-expanded, aria-controls, and aria-activedescendant attributes
2. THE Autocomplete_Component SHALL announce suggestion count to screen readers when results update
3. THE Autocomplete_Component SHALL provide clear focus indicators that meet WCAG 2.1 AA contrast requirements
4. THE Autocomplete_Component SHALL support keyboard-only navigation without requiring a mouse
5. WHEN a suggestion is selected, THE Autocomplete_Component SHALL announce the selection to screen readers
6. THE Autocomplete_Component SHALL have visible labels that are properly associated with inputs
7. THE Autocomplete_Component SHALL provide error messages that are announced to screen readers

### Requirement 9: Analytics and Monitoring

**User Story:** As a product manager, I want to track autocomplete usage and performance, so that I can measure the feature's impact and identify issues.

#### Acceptance Criteria

1. THE System SHALL log when fuzzy matching is used instead of exact matching
2. THE System SHALL log the similarity score for all fuzzy matches
3. THE System SHALL track the percentage of cases created using autocomplete vs manual text entry
4. THE System SHALL track average response time for autocomplete API endpoints
5. THE System SHALL log when autocomplete falls back to text input due to errors
6. THE System SHALL track which vehicle makes and models are most frequently searched
7. THE System SHALL alert administrators when autocomplete API response time exceeds 500ms

### Requirement 10: Testing and Quality Assurance

**User Story:** As a QA engineer, I want comprehensive tests for the autocomplete feature, so that I can verify it works correctly across all scenarios.

#### Acceptance Criteria

1. THE System SHALL include unit tests for fuzzy string matching algorithm with edge cases
2. THE System SHALL include integration tests for all autocomplete API endpoints
3. THE System SHALL include component tests for the Autocomplete_Component with keyboard navigation
4. THE System SHALL include end-to-end tests for the complete case creation flow with autocomplete
5. THE System SHALL include property-based tests for string normalization (round-trip property)
6. THE System SHALL include performance tests verifying API response times under load
7. THE System SHALL include accessibility tests using automated tools (axe-core)
8. THE System SHALL include mobile responsiveness tests on iOS and Android devices
