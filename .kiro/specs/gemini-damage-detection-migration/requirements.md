# Requirements Document: Gemini 2.0 Flash Damage Detection Migration

## Introduction

This document specifies the requirements for migrating the salvage management system's AI damage detection from Google Cloud Vision API with keyword matching to Gemini 2.0 Flash multimodal AI. The migration aims to improve damage assessment accuracy by leveraging Gemini's advanced image understanding capabilities while maintaining backward compatibility with existing systems.

## Glossary

- **Gemini_Service**: The service that interfaces with Google's Gemini 2.0 Flash API for multimodal AI analysis
- **Vision_Service**: The existing Google Cloud Vision API service used for image label detection
- **Damage_Assessor**: The system component that evaluates vehicle damage from photos
- **Fallback_Chain**: The sequential attempt of multiple damage detection methods when primary methods fail
- **Damage_Score**: A numerical value (0-100) representing the severity of damage in a specific category
- **Severity_Level**: A categorical classification of overall damage (minor/moderate/severe)
- **Total_Loss**: A boolean flag indicating if the vehicle is beyond economical repair
- **Airbag_Deployment**: A boolean flag indicating if airbags were deployed in the incident
- **Structured_Response**: A JSON object containing damage scores, flags, and summary text
- **Rate_Limit**: The maximum number of API requests allowed within a time period
- **Neutral_Score**: A default damage score of 50 used when AI assessment is unavailable

## Requirements

### Requirement 1: Install Gemini SDK

**User Story:** As a developer, I want to install the official Gemini SDK, so that I can integrate Gemini 2.0 Flash into the application.

#### Acceptance Criteria

1. THE System SHALL include @google/generative-ai package in package.json dependencies
2. THE System SHALL use a version compatible with gemini-2.0-flash model
3. THE System SHALL document the SDK version in the integration README

### Requirement 2: Configure Gemini API Key

**User Story:** As a system administrator, I want to configure the Gemini API key securely, so that the application can authenticate with Google's Gemini service.

#### Acceptance Criteria

1. THE System SHALL define GEMINI_API_KEY as an environment variable
2. THE System SHALL include GEMINI_API_KEY in .env.example with placeholder text
3. THE System SHALL validate GEMINI_API_KEY presence at service initialization
4. WHEN GEMINI_API_KEY is missing, THE System SHALL log a warning and disable Gemini_Service
5. THE System SHALL NOT expose GEMINI_API_KEY in client-side code or logs

### Requirement 3: Implement Gemini Damage Assessment Service

**User Story:** As a damage assessor, I want to analyze vehicle photos using Gemini 2.0 Flash, so that I can obtain accurate damage scores without manual keyword matching.

#### Acceptance Criteria

1. THE Gemini_Service SHALL implement an assessDamageWithGemini() function
2. THE assessDamageWithGemini() function SHALL use the gemini-2.0-flash model
3. WHEN called with vehicle photos, THE Gemini_Service SHALL send up to 6 photos per request
4. THE Gemini_Service SHALL include vehicle context (make, model, year) in the prompt
5. THE Gemini_Service SHALL request structured JSON output from Gemini
6. THE Gemini_Service SHALL parse the JSON response into a Structured_Response object

### Requirement 4: Return Structured Damage Data

**User Story:** As a damage assessor, I want to receive comprehensive damage information in a structured format, so that I can make informed decisions about vehicle valuation.

#### Acceptance Criteria

1. THE Structured_Response SHALL include a structural Damage_Score (0-100)
2. THE Structured_Response SHALL include a mechanical Damage_Score (0-100)
3. THE Structured_Response SHALL include a cosmetic Damage_Score (0-100)
4. THE Structured_Response SHALL include an electrical Damage_Score (0-100)
5. THE Structured_Response SHALL include an interior Damage_Score (0-100)
6. THE Structured_Response SHALL include a Severity_Level (minor/moderate/severe)
7. THE Structured_Response SHALL include an Airbag_Deployment boolean flag
8. THE Structured_Response SHALL include a Total_Loss boolean flag
9. THE Structured_Response SHALL include a summary text field with damage description
10. FOR ALL Damage_Score values, THE System SHALL ensure they are between 0 and 100 inclusive

### Requirement 5: Implement Fallback Chain

**User Story:** As a system operator, I want the system to gracefully handle API failures, so that damage assessment continues even when Gemini is unavailable.

#### Acceptance Criteria

1. WHEN assessDamageWithGemini() fails, THE Damage_Assessor SHALL attempt Vision_Service assessment
2. WHEN Vision_Service fails, THE Damage_Assessor SHALL return Neutral_Score values for all categories
3. THE Damage_Assessor SHALL log each fallback attempt with the reason for failure
4. THE Damage_Assessor SHALL include a confidence field indicating which method was used
5. THE Fallback_Chain SHALL execute in order: Gemini → Vision → Neutral

### Requirement 6: Respect Rate Limits

**User Story:** As a system administrator, I want the system to respect Gemini's rate limits, so that we stay within the free tier and avoid service disruption.

#### Acceptance Criteria

1. THE Gemini_Service SHALL enforce a maximum of 10 requests per minute
2. THE Gemini_Service SHALL track daily request count
3. WHEN daily requests exceed 1,500, THE Gemini_Service SHALL automatically fall back to Vision_Service
4. THE Gemini_Service SHALL log rate limit warnings at 80% and 90% of daily quota
5. THE Gemini_Service SHALL reset daily counters at midnight UTC

### Requirement 7: Preserve Existing Functions

**User Story:** As a developer, I want existing damage calculation functions to remain unchanged, so that downstream systems continue to work without modification.

#### Acceptance Criteria

1. THE System SHALL NOT modify identifyDamagedComponents() function signature or behavior
2. THE System SHALL NOT modify calculateSalvageValue() function signature or behavior
3. THE System SHALL NOT modify the damage deduction database schema
4. THE System SHALL NOT modify reserve price calculation logic
5. THE System SHALL maintain the same output format for all existing API endpoints

### Requirement 8: Test with Real Vehicle Photos

**User Story:** As a quality assurance engineer, I want to test the system with real damaged vehicle photos, so that I can verify accuracy in production scenarios.

#### Acceptance Criteria

1. THE System SHALL be tested with at least 10 photos of damaged vehicles
2. FOR ALL damaged vehicle photos, THE Gemini_Service SHALL return Damage_Score values above 30
3. THE System SHALL be tested with at least 3 photos of undamaged vehicles
4. FOR ALL undamaged vehicle photos, THE Gemini_Service SHALL return Damage_Score values below 30
5. THE test suite SHALL include photos with varying damage severity levels
6. THE test suite SHALL include photos with deployed airbags
7. THE test suite SHALL include photos of total loss vehicles

### Requirement 9: Test Fallback Behavior

**User Story:** As a quality assurance engineer, I want to verify that the fallback chain works correctly, so that the system remains resilient to API failures.

#### Acceptance Criteria

1. WHEN GEMINI_API_KEY is removed, THE Damage_Assessor SHALL successfully fall back to Vision_Service
2. WHEN both Gemini and Vision fail, THE Damage_Assessor SHALL return Neutral_Score values
3. THE System SHALL complete damage assessment within 30 seconds regardless of fallback depth
4. THE System SHALL log the active assessment method for each request
5. THE test suite SHALL simulate API timeout scenarios
6. THE test suite SHALL simulate invalid API key scenarios
7. THE test suite SHALL simulate rate limit exceeded scenarios

### Requirement 10: Monitor API Usage

**User Story:** As a system administrator, I want to monitor Gemini API usage, so that I can track costs and optimize request patterns.

#### Acceptance Criteria

1. THE System SHALL provide a link to aistudio.google.com/usage in documentation
2. THE System SHALL log each Gemini API request with timestamp and photo count
3. THE System SHALL calculate and log estimated daily quota usage
4. THE System SHALL generate weekly usage reports showing request counts by day
5. WHEN daily quota exceeds 1,200 requests, THE System SHALL send an alert notification

### Requirement 11: Maintain Transparent Migration

**User Story:** As a downstream system consumer, I want the migration to be transparent, so that I don't need to modify my integration code.

#### Acceptance Criteria

1. THE System SHALL maintain the same API response schema for damage assessment endpoints
2. THE System SHALL NOT change the data types of existing response fields
3. THE System SHALL NOT remove any existing response fields
4. WHERE new fields are added, THE System SHALL mark them as optional
5. THE System SHALL maintain backward compatibility with existing client applications

### Requirement 12: Handle Multi-Photo Requests

**User Story:** As a damage assessor, I want to submit multiple photos in a single request, so that Gemini can analyze damage from different angles comprehensively.

#### Acceptance Criteria

1. WHEN 1 to 6 photos are provided, THE Gemini_Service SHALL include all photos in a single API request
2. WHEN more than 6 photos are provided, THE Gemini_Service SHALL process the first 6 photos
3. THE Gemini_Service SHALL log a warning when photo count exceeds 6
4. THE Gemini_Service SHALL optimize photo order by prioritizing exterior damage photos
5. FOR ALL photos, THE Gemini_Service SHALL validate image format before sending to API

### Requirement 13: Provide Detailed Error Messages

**User Story:** As a developer, I want detailed error messages when Gemini assessment fails, so that I can quickly diagnose and resolve issues.

#### Acceptance Criteria

1. WHEN Gemini API returns an error, THE Gemini_Service SHALL log the full error response
2. WHEN photo format is invalid, THE Gemini_Service SHALL return a descriptive error message
3. WHEN rate limit is exceeded, THE Gemini_Service SHALL return a message indicating retry time
4. WHEN API key is invalid, THE Gemini_Service SHALL return a message indicating authentication failure
5. THE Gemini_Service SHALL include request ID in all error logs for traceability

### Requirement 14: Optimize Prompt Engineering

**User Story:** As a damage assessor, I want Gemini to receive optimized prompts, so that damage assessment results are accurate and consistent.

#### Acceptance Criteria

1. THE Gemini_Service SHALL include vehicle make, model, and year in the prompt
2. THE Gemini_Service SHALL request specific damage categories in the prompt
3. THE Gemini_Service SHALL provide examples of damage severity levels in the prompt
4. THE Gemini_Service SHALL instruct Gemini to return JSON in a specific schema
5. THE Gemini_Service SHALL include guidance on identifying airbag deployment
6. THE Gemini_Service SHALL include criteria for determining total loss status

### Requirement 15: Implement Response Validation

**User Story:** As a system operator, I want Gemini responses to be validated, so that invalid data doesn't propagate to downstream systems.

#### Acceptance Criteria

1. WHEN Gemini returns non-JSON response, THE Gemini_Service SHALL log an error and trigger fallback
2. WHEN Gemini returns JSON missing required fields, THE Gemini_Service SHALL trigger fallback
3. WHEN Damage_Score values are outside 0-100 range, THE Gemini_Service SHALL clamp them to valid range
4. WHEN Severity_Level is not minor/moderate/severe, THE Gemini_Service SHALL default to "moderate"
5. THE Gemini_Service SHALL validate all boolean flags are true or false
6. THE Gemini_Service SHALL ensure summary text is non-empty and under 500 characters

## Testing Requirements

### Property-Based Testing

The following properties must hold for all valid inputs:

1. **Score Range Invariant**: FOR ALL damage assessments, ALL Damage_Score values SHALL be between 0 and 100 inclusive
2. **Fallback Monotonicity**: IF Gemini fails, THEN Vision_Service is attempted; IF Vision fails, THEN Neutral_Score is returned
3. **Rate Limit Enforcement**: FOR ALL time windows, request count SHALL NOT exceed 10 per minute or 1,500 per day
4. **Response Completeness**: FOR ALL successful assessments, Structured_Response SHALL contain all required fields
5. **Idempotence**: FOR ALL identical photo sets, assessDamageWithGemini() SHALL return equivalent results (within confidence bounds)

### Integration Testing

1. Test complete flow from photo upload through Gemini assessment to damage score storage
2. Test fallback chain with simulated API failures
3. Test rate limiting with burst request patterns
4. Test with real vehicle photos from production dataset

### Edge Case Testing

1. Test with 0 photos (should return error)
2. Test with 1 photo (minimum valid input)
3. Test with 6 photos (maximum per request)
4. Test with 10 photos (should process first 6)
5. Test with corrupted image files
6. Test with non-vehicle photos
7. Test with extremely high-resolution photos
8. Test with black and white photos
9. Test with photos taken at night

## Success Criteria

The migration is considered successful when:

1. All 15 requirements are implemented and tested
2. Gemini assessment accuracy exceeds 85% on test dataset
3. Fallback chain operates correctly in all failure scenarios
4. Rate limits are respected with zero quota violations
5. Existing downstream systems continue to function without modification
6. API response times remain under 10 seconds for 95th percentile
7. All property-based tests pass with 1000+ generated test cases
8. Integration tests achieve 100% pass rate
9. Production monitoring shows successful Gemini usage within free tier limits
10. Zero breaking changes to existing API contracts
