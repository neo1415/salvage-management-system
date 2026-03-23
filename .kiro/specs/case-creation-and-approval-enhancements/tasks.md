# Implementation Plan: Case Creation and Approval Enhancements

## Overview

This implementation adds mileage/condition fields to the case creation form and price editing capability to the manager approval workflow. The changes are minimal and leverage existing AI service capabilities.

**Key Principles**:
- Backward compatible with existing cases
- Mobile-first UI design
- Comprehensive audit trail
- Real-time validation feedback

## Tasks

- [x] 1. Database schema migration
  - Create migration file `0005_add_mileage_condition_overrides.sql`
  - Add `vehicle_mileage` column (INTEGER, nullable)
  - Add `vehicle_condition` column (VARCHAR(20), nullable, CHECK constraint)
  - Add `ai_estimates` column (JSONB, nullable)
  - Add `manager_overrides` column (JSONB, nullable)
  - Create indexes on mileage and condition columns
  - Test migration in development environment
  - _Requirements: 1.1, 2.1, 6.4, 7.1_

- [x] 2. Update TypeScript interfaces and schema
  - [x] 2.1 Update salvage case schema in `src/lib/db/schema/cases.ts`
    - Add vehicleMileage field
    - Add vehicleCondition field with enum type
    - Add aiEstimates JSONB field
    - Add managerOverrides JSONB field
    - _Requirements: 1.1, 2.1, 6.4_
  
  - [ ]* 2.2 Write property test for schema validation
    - **Property 1: Vehicle Info Pass-Through**
    - **Validates: Requirements 1.3, 2.3**
  
  - [x] 2.3 Update case form data interface
    - Add optional vehicleMileage field to CaseFormData
    - Add optional vehicleCondition field to CaseFormData
    - Update form validation schema
    - _Requirements: 1.1, 2.1_

- [x] 3. Enhance case creation form UI
  - [x] 3.1 Add mileage input field to vehicle details section
    - Position after VIN field
    - Type: number, placeholder text
    - Label: "Mileage (Optional - Recommended)"
    - Add info icon with tooltip
    - _Requirements: 1.1_
  
  - [x] 3.2 Add condition dropdown to vehicle details section
    - Position after mileage field
    - Options: excellent, good, fair, poor
    - Label: "Pre-Accident Condition (Optional - Recommended)"
    - Add info icon with tooltip
    - _Requirements: 2.1, 2.2_
  
  - [x] 3.3 Write unit tests for form field rendering
    - Test mileage field appears for vehicles
    - Test condition dropdown appears for vehicles
    - Test fields don't appear for non-vehicle assets
    - _Requirements: 1.1, 2.1_

- [x] 4. Implement form validation for new fields
  - [x] 4.1 Add mileage validation logic
    - Validate positive numbers only
    - Show warning for unrealistic values (>500,000 km)
    - Show error for non-numeric input
    - Debounce validation (300ms)
    - _Requirements: 1.2, 10.1, 10.2_
  
  - [ ]* 4.2 Write property test for mileage validation
    - **Property 2: Mileage Validation**
    - **Validates: Requirements 1.2**
  
  - [x] 4.3 Add info messages for skipped fields
    - Show accuracy impact message when mileage skipped
    - Show accuracy impact message when condition skipped
    - _Requirements: 10.4, 8.5_
  
  - [ ]* 4.4 Write edge case tests for validation
    - Test non-numeric mileage input
    - Test unrealistic mileage values
    - Test missing field info messages
    - _Requirements: 10.1, 10.2, 10.4_

- [x] 5. Update AI assessment API call
  - [x] 5.1 Pass mileage and condition to AI service
    - Update API call in case creation form
    - Include vehicleMileage in vehicleInfo object
    - Include vehicleCondition in vehicleInfo object
    - Handle undefined values gracefully
    - _Requirements: 1.3, 2.3_
  
  - [ ]* 5.2 Write property test for AI service integration
    - **Property 3: Mileage Impact on Valuation**
    - **Property 4: Condition Impact on Valuation**
    - **Validates: Requirements 1.5, 2.5**

- [x] 6. Enhance AI results display
  - [x] 6.1 Show mileage and condition in results section
    - Display mileage value used (if provided)
    - Display condition value used (if provided or defaulted)
    - Show adjustment factors applied
    - Add visual indicators for data source (provided vs estimated)
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ]* 6.2 Write property test for result display
    - **Property 5: Assessment Result Display Completeness**
    - **Property 6: Warning Display for Accuracy Impact**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [x] 7. Checkpoint - Test case creation enhancements
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Create price override UI components
  - [x] 8.1 Create PriceField component
    - Display AI estimate and override value
    - Show confidence score if available
    - Highlight low confidence fields in yellow
    - Support edit mode and view mode
    - Format currency with thousand separators
    - _Requirements: 4.1, 4.2, 8.4, 9.3_
  
  - [x] 8.2 Write unit tests for PriceField component
    - Test view mode display
    - Test edit mode input
    - Test confidence score display
    - Test currency formatting
    - _Requirements: 4.1, 4.2, 9.3_
  
  - [x] 8.3 Write property test for currency formatting
    - **Property 16: Currency Formatting**
    - **Validates: Requirements 9.3**

- [x] 9. Add price override section to manager approval page
  - [x] 9.1 Add edit mode state management
    - Add isEditMode state
    - Add priceOverrides state
    - Add overrideComment state
    - Add validationErrors state
    - Implement edit mode toggle
    - _Requirements: 4.1, 9.5_
  
  - [x] 9.2 Render price override UI
    - Add "Edit Prices" button
    - Render PriceField for each price (market, repair, salvage, reserve)
    - Add comment textarea (required when editing)
    - Show validation errors inline
    - _Requirements: 4.1, 4.2, 4.5_
  
  - [x] 9.3 Write unit tests for price override UI
    - Test edit mode activation
    - Test price field rendering
    - Test comment field requirement
    - Test validation error display
    - _Requirements: 4.1, 4.2, 4.5_

- [x] 10. Implement price validation logic
  - [x] 10.1 Create validatePriceOverrides function
    - Validate market value > 0
    - Validate salvage value ≤ market value
    - Validate reserve price ≤ salvage value
    - Return detailed error messages
    - Return warnings for unusual values
    - _Requirements: 5.1, 5.2, 5.3, 4.4_
  
  - [x] 10.2 Write property test for price validation
    - **Property 8: Price Relationship Validation**
    - **Validates: Requirements 5.1, 5.2, 5.3, 11.2**
  
  - [x] 10.3 Integrate validation with UI
    - Run validation on price change
    - Display errors below fields
    - Disable approve button when invalid
    - Enable approve button when valid
    - _Requirements: 5.4, 5.5_
  
  - [x] 10.4 Write property tests for validation UI behavior
    - **Property 9: Validation Error Prevents Submission**
    - **Property 10: Valid Overrides Enable Approval**
    - **Validates: Requirements 5.4, 5.5**

- [x] 11. Enhance AI confidence display
  - [x] 11.1 Add AI confidence section to approval page
    - Show overall confidence score prominently
    - Display mileage and condition info
    - Show all AI warnings
    - Highlight low confidence (<70%) in red
    - _Requirements: 8.1, 8.2, 8.3, 8.5_
  
  - [x] 11.2 Write property test for warning display
    - **Property 15: AI Warnings Pass-Through**
    - **Validates: Requirements 8.3**
  
  - [x] 11.3 Write edge case tests for confidence display
    - Test low confidence warning
    - Test missing mileage notice
    - Test missing condition notice
    - _Requirements: 8.2, 8.5_

- [x] 12. Update approval action buttons
  - [x] 12.1 Modify action button logic
    - Show "Approve with Changes" when in edit mode with overrides
    - Show normal "Approve" / "Reject" when not editing
    - Add "Cancel Edits" button in edit mode
    - Disable buttons during submission
    - _Requirements: 4.1, 6.1_
  
  - [x] 12.2 Write unit tests for button states
    - Test button visibility in different modes
    - Test button enabled/disabled states
    - Test button click handlers
    - _Requirements: 4.1, 5.5_

- [x] 13. Update approval API endpoint
  - [x] 13.1 Add priceOverrides to request interface
    - Update ApprovalRequest interface
    - Add optional priceOverrides field
    - Document new API contract
    - _Requirements: 11.1_
  
  - [x] 13.2 Implement server-side validation
    - Validate price override relationships
    - Require comment when overrides provided
    - Return 400 with detailed errors on validation failure
    - _Requirements: 11.2, 11.5_
  
  - [x] 13.3 Write property test for API validation
    - **Property 18: API Invalid Override Error Response**
    - **Validates: Requirements 11.5**
  
  - [x] 13.4 Update case and auction creation logic
    - Use overridden prices if provided, else AI estimates
    - Store both AI estimates and overrides in database
    - Use overridden reserve price for auction minimum bid
    - _Requirements: 6.1, 6.2, 6.3, 11.3, 11.4_
  
  - [x] 13.5 Write property tests for override usage
    - **Property 11: Override Data Persistence**
    - **Property 12: Overrides Used in Auction Creation**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 11.3, 11.4**
  
  - [x] 13.6 Write integration test for approval with overrides
    - Test end-to-end approval flow with price overrides
    - Verify auction uses overridden prices
    - Verify both AI and override values stored
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 14. Implement audit logging for price overrides
  - [x] 14.1 Create audit log entries for overrides
    - Log original AI value
    - Log new manager value
    - Log change reason (comment)
    - Log manager user ID
    - Log timestamp
    - Use AuditActionType.PRICE_OVERRIDE
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [x] 14.2 Write property test for audit logging
    - **Property 13: Audit Log Creation**
    - **Validates: Requirements 7.1, 7.2, 7.3**
  
  - [x] 14.3 Add audit log filtering capability
    - Support filter by manager ID
    - Support filter by case ID
    - Support filter by price field name
    - Return only matching entries
    - _Requirements: 7.5_
  
  - [x] 14.4 Write property test for audit log filtering
    - **Property 14: Audit Log Filtering**
    - **Validates: Requirements 7.5**

- [-] 15. Implement form state persistence
  - [x] 15.1 Add form state to localStorage/sessionStorage
    - Save mileage and condition on change
    - Restore values on page load
    - Clear on successful submission
    - Handle navigation away and back
    - _Requirements: 10.5_
  
  - [ ] 15.2 Write property test for state persistence
    - **Property 17: Form State Persistence**
    - **Validates: Requirements 10.5**

- [-] 16. Add backward compatibility handling
  - [x] 16.1 Handle cases without mileage/condition
    - Display "N/A" for missing fields
    - Use default values in AI service
    - Don't break existing workflows
    - _Requirements: 12.1, 12.2, 12.4, 12.5_
  
  - [ ] 16.2 Write edge case tests for backward compatibility
    - Test loading old cases without mileage
    - Test loading old cases without condition
    - Test approval without price edits
    - Test display of missing fields
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 17. Add notification for approval with adjustments
  - [x] 17.1 Send notification to adjuster
    - Detect when approval includes price overrides
    - Send SMS with adjustment notice
    - Send email with adjustment details
    - Include manager's comment in notification
    - _Requirements: 6.5_
  
  - [x] 17.2 Write example test for notification
    - Test notification sent when overrides present
    - Test notification includes correct message
    - Test notification not sent for normal approval
    - _Requirements: 6.5_

- [x] 18. Checkpoint - Test manager approval enhancements
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Write example-based tests
  - [x] 19.1 Write UI example tests
    - Example 1: Mileage field appears for vehicles
    - Example 2: Condition dropdown appears for vehicles
    - Example 5: Price fields are editable
    - Example 6: Numeric keyboard on mobile
    - Example 7: Edit mode activation
    - Example 8: Confidence score display
    - Example 9: Field labels
    - _Requirements: 1.1, 2.1, 2.2, 4.1, 4.2, 8.1, 9.2, 9.5, 10.3_
  
  - [x] 19.2 Write API example tests
    - Example 3: Default mileage estimation
    - Example 4: Default condition assumption
    - Example 10: API accepts overrides
    - Example 11: Approval without edits
    - Example 12: Adjuster notification
    - _Requirements: 1.4, 2.4, 11.1, 12.3, 6.5_

- [x] 20. Write edge case tests
  - [x] 20.1 Write validation edge case tests
    - Edge Case 4: Non-numeric mileage
    - Edge Case 5: Unrealistic mileage
    - Edge Case 11: Unreasonable salvage value warning
    - Edge Case 12: Unreasonable reserve price warning
    - _Requirements: 10.1, 10.2, 4.4_
  
  - [x] 20.2 Write UI edge case tests
    - Edge Case 1: Low confidence warning
    - Edge Case 2: Missing mileage notice
    - Edge Case 3: Missing condition notice
    - Edge Case 6: Missing mileage info message
    - _Requirements: 8.2, 8.5, 10.4_
  
  - [x] 20.3 Write backward compatibility edge case tests
    - Edge Case 7: Backward compatibility - missing mileage
    - Edge Case 8: Backward compatibility - missing condition
    - Edge Case 9: Old case display
    - Edge Case 10: Backward compatibility - old cases
    - _Requirements: 12.1, 12.2, 12.4, 12.5_

- [x] 21. Mobile responsiveness testing
  - [x] 21.1 Test on mobile devices
    - Test mileage numeric keyboard
    - Test condition dropdown touch-friendliness
    - Test price edit fields touch targets (44x44px minimum)
    - Test edit mode button accessibility
    - Test validation error readability
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  
  - [x] 21.2 Test responsive layouts
    - Test on iPhone (Safari)
    - Test on Android (Chrome)
    - Test on tablet sizes
    - Verify all touch targets meet minimum size
    - _Requirements: 9.1, 9.4_

- [x] 22. Integration testing
  - [x] 22.1 Write end-to-end test for case creation with mileage/condition
    - Create case with mileage and condition
    - Verify AI uses provided values
    - Verify results display correctly
    - Verify case saved with all data
    - _Requirements: 1.1, 1.3, 1.5, 2.1, 2.3, 2.5, 3.1, 3.2_
  
  - [x] 22.2 Write end-to-end test for manager approval with overrides
    - Manager views pending case
    - Enters edit mode
    - Edits prices with comment
    - Approves with changes
    - Verify auction uses overridden prices
    - Verify audit log created
    - Verify adjuster notified
    - _Requirements: 4.1, 4.5, 6.1, 6.2, 6.3, 7.1, 6.5_
  
  - [x] 22.3 Write end-to-end test for backward compatibility
    - Load old case without mileage/condition
    - Verify display shows "N/A"
    - Verify AI assessment works
    - Verify approval works normally
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 23. Documentation
  - [ ] 23.1 Update API documentation
    - Document new case creation fields
    - Document approval API priceOverrides parameter
    - Add request/response examples
    - Document validation rules
    - _Requirements: All_
  
  - [ ] 23.2 Write user documentation
    - Guide for adjusters on mileage/condition
    - Guide for managers on price overrides
    - Explain when to override prices
    - Explain how to write good comments
    - _Requirements: All_
  
  - [ ] 23.3 Add code comments
    - Document validation logic
    - Document price calculation formulas
    - Document audit logging requirements
    - Document backward compatibility handling
    - _Requirements: All_

- [ ] 24. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test-related sub-tasks that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows
- The implementation is backward compatible - existing cases continue to work
- Database migration adds nullable columns, so no data migration needed
- All price overrides require manager comments for audit trail
