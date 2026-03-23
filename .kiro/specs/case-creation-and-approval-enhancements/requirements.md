# Requirements Document

## Introduction

This specification addresses critical gaps in the salvage case creation and manager approval workflow identified in the NEM Project Delivery Audit. The current implementation lacks two key features required for contract compliance:

1. **Mileage and Condition Fields**: The AI assessment service already supports mileage and condition adjustments for more accurate valuations, but the case creation form doesn't collect this data from adjusters.

2. **Manager Price Editing**: The Product Requirements Document explicitly requires managers to review and edit AI estimates before approval, but the current approval workflow only allows approve/reject actions without price modification capability.

These enhancements will improve AI assessment accuracy and give managers the control they need to ensure fair valuations before cases go to auction.

## Glossary

- **System**: The Salvage Management System web application
- **Adjuster**: Claims Adjuster who creates salvage cases from accident sites
- **Manager**: Salvage Manager who reviews and approves cases
- **AI_Service**: The enhanced AI assessment service that analyzes damage photos
- **Case_Form**: The mobile-optimized case creation form used by adjusters
- **Approval_Page**: The manager's case approval interface
- **Mileage**: The vehicle's odometer reading in kilometers
- **Condition**: The pre-accident condition of the vehicle (excellent/good/fair/poor)
- **Market_Value**: The estimated pre-accident value of the vehicle
- **Salvage_Value**: The estimated post-accident value (market value minus repair cost)
- **Reserve_Price**: The minimum acceptable bid (70% of salvage value)
- **Audit_Trail**: System log of all price changes and approvals

## Requirements

### Requirement 1: Collect Mileage in Case Creation Form

**User Story:** As a Claims Adjuster, I want to enter the vehicle's mileage when creating a case, so that the AI can provide more accurate valuations based on actual vehicle usage.

#### Acceptance Criteria

1. WHEN the adjuster selects "vehicle" as the asset type, THE Case_Form SHALL display a mileage input field after the VIN field
2. WHEN the adjuster enters mileage, THE System SHALL validate it is a positive number
3. WHEN the adjuster submits the form with mileage, THE System SHALL pass the mileage value to the AI_Service
4. WHERE mileage is not provided, THE AI_Service SHALL use estimated mileage based on vehicle age
5. WHEN mileage is provided, THE AI_Service SHALL apply mileage-based adjustments to market value estimation

### Requirement 2: Collect Condition in Case Creation Form

**User Story:** As a Claims Adjuster, I want to specify the pre-accident condition of the vehicle, so that the AI can adjust valuations based on the vehicle's maintenance state.

#### Acceptance Criteria

1. WHEN the adjuster selects "vehicle" as the asset type, THE Case_Form SHALL display a condition dropdown after the mileage field
2. THE System SHALL provide four condition options: excellent, good, fair, poor
3. WHEN the adjuster selects a condition, THE System SHALL pass the condition value to the AI_Service
4. WHERE condition is not provided, THE AI_Service SHALL assume "good" condition as default
5. WHEN condition is provided, THE AI_Service SHALL apply condition-based adjustments to market value estimation

### Requirement 3: Display Mileage and Condition in AI Assessment Results

**User Story:** As a Claims Adjuster, I want to see how mileage and condition affected the AI's valuation, so that I can verify the assessment makes sense.

#### Acceptance Criteria

1. WHEN the AI_Service completes assessment with mileage data, THE Case_Form SHALL display the mileage value in the AI results section
2. WHEN the AI_Service completes assessment with condition data, THE Case_Form SHALL display the condition value in the AI results section
3. WHEN mileage or condition adjustments are applied, THE Case_Form SHALL show the adjustment percentage in the confidence section
4. THE System SHALL display warnings when mileage or condition significantly affect valuation accuracy

### Requirement 4: Manager Price Editing Interface

**User Story:** As a Salvage Manager, I want to edit AI-estimated prices before approving a case, so that I can correct valuations based on my expertise and market knowledge.

#### Acceptance Criteria

1. WHEN a manager views a pending case, THE Approval_Page SHALL display all AI estimates as editable fields
2. THE System SHALL allow editing of market value, repair cost estimate, salvage value, and reserve price
3. WHEN a manager edits a price field, THE System SHALL validate it is a positive number
4. WHEN a manager edits salvage value or reserve price, THE System SHALL show a warning if the value seems unreasonable
5. WHEN a manager edits any price, THE System SHALL require a comment explaining the change

### Requirement 5: Price Override Validation

**User Story:** As a Salvage Manager, I want the system to validate my price edits, so that I don't accidentally create invalid auction parameters.

#### Acceptance Criteria

1. WHEN a manager edits market value, THE System SHALL ensure it is greater than zero
2. WHEN a manager edits salvage value, THE System SHALL ensure it does not exceed market value
3. WHEN a manager edits reserve price, THE System SHALL ensure it does not exceed salvage value
4. IF validation fails, THEN THE System SHALL display a clear error message and prevent submission
5. WHEN all validations pass, THE System SHALL enable the "Approve with Changes" button

### Requirement 6: Approve with Price Overrides

**User Story:** As a Salvage Manager, I want to approve cases with my price adjustments, so that auctions use my corrected values instead of AI estimates.

#### Acceptance Criteria

1. WHEN a manager has edited prices and clicks "Approve with Changes", THE System SHALL save the overridden prices
2. WHEN creating the auction, THE System SHALL use the manager's overridden prices instead of AI estimates
3. WHEN the auction is created, THE System SHALL use the overridden reserve price as the minimum bid
4. THE System SHALL store both original AI estimates and manager overrides for comparison
5. WHEN the approval is complete, THE System SHALL notify the adjuster that the case was approved with price adjustments

### Requirement 7: Audit Trail for Price Changes

**User Story:** As a System Administrator, I want to track all price changes made by managers, so that we can audit pricing decisions and identify patterns.

#### Acceptance Criteria

1. WHEN a manager overrides any price, THE System SHALL log the change in the Audit_Trail
2. THE Audit_Trail SHALL record the original AI value, new manager value, and change reason
3. THE Audit_Trail SHALL record the manager's user ID and timestamp
4. WHEN viewing audit logs, THE System SHALL display price changes with clear before/after comparisons
5. THE System SHALL allow filtering audit logs by manager, case, and price field

### Requirement 8: Display AI Confidence and Warnings

**User Story:** As a Salvage Manager, I want to see AI confidence scores and warnings alongside editable fields, so that I know when manual review is most critical.

#### Acceptance Criteria

1. WHEN displaying AI estimates, THE Approval_Page SHALL show the overall confidence score prominently
2. WHEN confidence is below 70%, THE System SHALL display a warning recommending manual review
3. WHEN the AI detected validation issues, THE System SHALL display all warnings from the AI_Service
4. THE System SHALL highlight fields with low confidence in yellow
5. WHEN mileage or condition data is missing, THE System SHALL show a notice that estimates may be less accurate

### Requirement 9: Mobile-Friendly Price Editing

**User Story:** As a Salvage Manager, I want to edit prices on my mobile device, so that I can approve cases from anywhere.

#### Acceptance Criteria

1. THE Approval_Page SHALL display price editing fields optimized for mobile touch input
2. WHEN a manager taps a price field, THE System SHALL show a numeric keyboard
3. THE System SHALL format currency values with thousand separators for readability
4. WHEN editing on mobile, THE System SHALL provide adequate touch targets (minimum 44x44 pixels)
5. THE System SHALL prevent accidental edits by requiring explicit "Edit Mode" activation

### Requirement 10: Form Field Validation and UX

**User Story:** As a Claims Adjuster, I want clear validation feedback on mileage and condition fields, so that I know if I've entered valid data.

#### Acceptance Criteria

1. WHEN the adjuster enters non-numeric mileage, THE System SHALL display an error message immediately
2. WHEN the adjuster enters unrealistic mileage (e.g., > 500,000 km), THE System SHALL show a warning
3. THE System SHALL mark mileage and condition fields as "optional but recommended"
4. WHEN the adjuster skips mileage or condition, THE System SHALL show an info message about reduced accuracy
5. THE System SHALL preserve mileage and condition values if the adjuster navigates away and returns

### Requirement 11: API Support for Price Overrides

**User Story:** As a Backend Developer, I want the approval API to accept price overrides, so that the frontend can submit manager-edited prices.

#### Acceptance Criteria

1. THE Approval API SHALL accept optional price override fields in the request body
2. WHEN price overrides are provided, THE System SHALL validate all override values
3. WHEN creating an auction with overrides, THE System SHALL use overridden values instead of AI estimates
4. THE System SHALL store both AI estimates and overrides in the database
5. WHEN price overrides are invalid, THE System SHALL return a 400 error with detailed validation messages

### Requirement 12: Backward Compatibility

**User Story:** As a System Administrator, I want the new features to work with existing cases, so that we don't break the current workflow.

#### Acceptance Criteria

1. WHEN processing cases without mileage data, THE System SHALL continue to work normally
2. WHEN processing cases without condition data, THE System SHALL continue to work normally
3. WHEN a manager approves without editing prices, THE System SHALL use AI estimates as before
4. THE System SHALL handle cases created before this feature was deployed
5. WHEN displaying old cases, THE System SHALL show "N/A" for missing mileage and condition fields
