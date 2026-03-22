# Design Document

## Overview

This design implements two critical enhancements to the salvage case workflow:

1. **Mileage and Condition Collection**: Extends the case creation form to collect vehicle mileage and condition, enabling the AI assessment service to provide more accurate valuations.

2. **Manager Price Editing**: Adds price override capability to the manager approval workflow, allowing managers to review and adjust AI estimates before creating auctions.

### Design Goals

- Minimal changes to existing code (leverage existing AI service capabilities)
- Mobile-first UI for both adjuster and manager workflows
- Comprehensive audit trail for all price changes
- Backward compatible with existing cases
- Clear validation and user feedback

### Key Design Decisions

**Decision 1: Optional Fields**
- Mileage and condition are optional but recommended
- System works without them (uses defaults) for backward compatibility
- Clear messaging about accuracy impact when fields are skipped

**Decision 2: Edit Mode Pattern**
- Manager must explicitly enter "Edit Mode" to change prices
- Prevents accidental edits on mobile devices
- Clear visual distinction between view and edit states

**Decision 3: Inline Validation**
- Real-time validation as manager edits prices
- Prevents submission of invalid data
- Shows warnings for unusual values without blocking submission

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Case Creation Flow                        │
├─────────────────────────────────────────────────────────────┤
│  Adjuster Form                                              │
│  ├─ Vehicle Details Section                                │
│  │  ├─ Make, Model, Year (existing)                        │
│  │  ├─ VIN (existing)                                      │
│  │  ├─ Mileage (NEW - optional)                           │
│  │  └─ Condition (NEW - optional)                         │
│  │                                                          │
│  ├─ Photo Upload (existing)                                │
│  │  └─ Triggers AI Assessment                             │
│  │                                                          │
│  └─ AI Results Display (enhanced)                          │
│     ├─ Shows mileage/condition used                        │
│     └─ Shows adjustment factors applied                    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Manager Approval Flow                       │
├─────────────────────────────────────────────────────────────┤
│  Approval Page                                              │
│  ├─ Case Details (existing)                                │
│  │                                                          │
│  ├─ AI Assessment Section (enhanced)                       │
│  │  ├─ Confidence Score                                    │
│  │  ├─ Warnings                                            │
│  │  └─ Mileage/Condition Info                             │
│  │                                                          │
│  ├─ Price Override Section (NEW)                           │
│  │  ├─ Market Value (editable)                            │
│  │  ├─ Repair Cost (editable)                             │
│  │  ├─ Salvage Value (editable)                           │
│  │  ├─ Reserve Price (editable)                           │
│  │  └─ Comment Field (required if edited)                 │
│  │                                                          │
│  └─ Actions                                                 │
│     ├─ Approve (uses AI estimates)                         │
│     ├─ Approve with Changes (uses overrides)               │
│     └─ Reject                                               │
└─────────────────────────────────────────────────────────────┘
```


### Data Flow

```
1. Case Creation:
   Adjuster → Form (with mileage/condition) → AI Service → Enhanced Assessment → Database

2. Manager Approval (No Edits):
   Manager → View Case → Approve → Auction (AI estimates) → Database

3. Manager Approval (With Edits):
   Manager → View Case → Edit Prices → Validate → Approve → Auction (overrides) → Audit Log → Database
```

## Components and Interfaces

### 1. Case Creation Form Enhancements

**File**: `src/app/(dashboard)/adjuster/cases/new/page.tsx`

**New Form Fields**:

```typescript
interface CaseFormData {
  // ... existing fields ...
  
  // NEW: Vehicle-specific optional fields
  vehicleMileage?: number;
  vehicleCondition?: 'excellent' | 'good' | 'fair' | 'poor';
}
```

**UI Changes**:

1. Add mileage input field in vehicle details section:
   - Type: number
   - Placeholder: "Enter odometer reading (km)"
   - Validation: Positive number, max 1,000,000
   - Position: After VIN field
   - Label: "Mileage (Optional - Recommended)"

2. Add condition dropdown in vehicle details section:
   - Options: Excellent, Good, Fair, Poor
   - Default: None selected
   - Position: After mileage field
   - Label: "Pre-Accident Condition (Optional - Recommended)"

3. Enhance AI results display:
   - Show mileage used (if provided)
   - Show condition used (if provided or defaulted)
   - Show adjustment factors applied

**Validation Logic**:

```typescript
// Mileage validation
if (vehicleMileage !== undefined) {
  if (vehicleMileage < 0) {
    errors.push('Mileage must be positive');
  }
  if (vehicleMileage > 1000000) {
    warnings.push('Unusually high mileage - please verify');
  }
}

// Info messages
if (!vehicleMileage && assetType === 'vehicle') {
  info.push('💡 Adding mileage improves AI accuracy by 10-15%');
}
if (!vehicleCondition && assetType === 'vehicle') {
  info.push('💡 Adding condition improves AI accuracy by 5-10%');
}
```

### 2. AI Assessment Service Integration

**File**: `src/features/cases/services/ai-assessment-enhanced.service.ts`

**No changes needed** - The service already supports mileage and condition parameters. We just need to pass them from the form.

**API Call Update**:

```typescript
// In case creation form
const response = await fetch('/api/cases/ai-assessment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    photos: photosToAssess,
    vehicleInfo: {
      make: data.vehicleMake,
      model: data.vehicleModel,
      year: data.vehicleYear,
      vin: data.vehicleVin,
      marketValue: data.marketValue,
      mileage: data.vehicleMileage,      // NEW
      condition: data.vehicleCondition,  // NEW
    },
  }),
});
```

### 3. Manager Approval Page Enhancements

**File**: `src/app/(dashboard)/manager/approvals/page.tsx`

**New State**:

```typescript
interface PriceOverrides {
  marketValue?: number;
  repairCost?: number;
  salvageValue?: number;
  reservePrice?: number;
}

const [isEditMode, setIsEditMode] = useState(false);
const [priceOverrides, setPriceOverrides] = useState<PriceOverrides>({});
const [overrideComment, setOverrideComment] = useState('');
const [validationErrors, setValidationErrors] = useState<string[]>([]);
```

**New UI Sections**:

1. **AI Confidence Section** (enhanced):
   ```tsx
   <div className="bg-white rounded-lg shadow-md p-4">
     <h3 className="font-bold mb-3">🤖 AI Assessment</h3>
     
     {/* Confidence Score */}
     <div className="flex justify-between items-center mb-3">
       <span>Overall Confidence</span>
       <span className={`font-bold ${
         confidence >= 80 ? 'text-green-600' :
         confidence >= 60 ? 'text-yellow-600' :
         'text-red-600'
       }`}>
         {confidence}%
       </span>
     </div>
     
     {/* Mileage/Condition Info */}
     {mileage && (
       <div className="text-sm text-gray-600">
         📊 Mileage: {mileage.toLocaleString()} km
       </div>
     )}
     {condition && (
       <div className="text-sm text-gray-600">
         ⭐ Condition: {condition}
       </div>
     )}
     
     {/* Warnings */}
     {warnings.map((warning, i) => (
       <div key={i} className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
         {warning}
       </div>
     ))}
   </div>
   ```

2. **Price Override Section** (new):
   ```tsx
   <div className="bg-white rounded-lg shadow-md p-4">
     <div className="flex justify-between items-center mb-3">
       <h3 className="font-bold">💰 Valuation</h3>
       {!isEditMode && (
         <button
           onClick={() => setIsEditMode(true)}
           className="text-sm text-[#800020] font-medium"
         >
           ✏️ Edit Prices
         </button>
       )}
     </div>
     
     {/* Price Fields */}
     <div className="space-y-3">
       <PriceField
         label="Market Value"
         aiValue={aiEstimates.marketValue}
         overrideValue={priceOverrides.marketValue}
         isEditMode={isEditMode}
         onChange={(value) => handlePriceChange('marketValue', value)}
         confidence={confidence.valuationAccuracy}
       />
       
       <PriceField
         label="Repair Cost"
         aiValue={aiEstimates.repairCost}
         overrideValue={priceOverrides.repairCost}
         isEditMode={isEditMode}
         onChange={(value) => handlePriceChange('repairCost', value)}
       />
       
       <PriceField
         label="Salvage Value"
         aiValue={aiEstimates.salvageValue}
         overrideValue={priceOverrides.salvageValue}
         isEditMode={isEditMode}
         onChange={(value) => handlePriceChange('salvageValue', value)}
       />
       
       <PriceField
         label="Reserve Price"
         aiValue={aiEstimates.reservePrice}
         overrideValue={priceOverrides.reservePrice}
         isEditMode={isEditMode}
         onChange={(value) => handlePriceChange('reservePrice', value)}
       />
     </div>
     
     {/* Comment Field (shown in edit mode) */}
     {isEditMode && hasOverrides && (
       <div className="mt-4">
         <label className="block text-sm font-medium mb-1">
           Reason for Changes <span className="text-red-500">*</span>
         </label>
         <textarea
           value={overrideComment}
           onChange={(e) => setOverrideComment(e.target.value)}
           placeholder="Explain why you're adjusting these prices..."
           rows={3}
           className="w-full px-3 py-2 border rounded-lg"
         />
       </div>
     )}
     
     {/* Validation Errors */}
     {validationErrors.map((error, i) => (
       <div key={i} className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
         {error}
       </div>
     ))}
   </div>
   ```

3. **PriceField Component** (new):
   ```tsx
   function PriceField({
     label,
     aiValue,
     overrideValue,
     isEditMode,
     onChange,
     confidence
   }: {
     label: string;
     aiValue: number;
     overrideValue?: number;
     isEditMode: boolean;
     onChange: (value: number) => void;
     confidence?: number;
   }) {
     const displayValue = overrideValue ?? aiValue;
     const hasOverride = overrideValue !== undefined;
     const isLowConfidence = confidence !== undefined && confidence < 70;
     
     return (
       <div className={`p-3 rounded-lg ${
         isLowConfidence ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
       }`}>
         <div className="flex justify-between items-center mb-1">
           <span className="text-sm font-medium text-gray-700">{label}</span>
           {confidence !== undefined && (
             <span className="text-xs text-gray-500">{confidence}% confidence</span>
           )}
         </div>
         
         {isEditMode ? (
           <input
             type="number"
             value={displayValue}
             onChange={(e) => onChange(parseFloat(e.target.value))}
             className="w-full px-3 py-2 border rounded-lg"
           />
         ) : (
           <div className="flex items-center justify-between">
             <span className="text-lg font-bold">
               ₦{displayValue.toLocaleString()}
             </span>
             {hasOverride && (
               <span className="text-xs text-blue-600">
                 (AI: ₦{aiValue.toLocaleString()})
               </span>
             )}
           </div>
         )}
       </div>
     );
   }
   ```

**Validation Logic**:

```typescript
function validatePriceOverrides(
  overrides: PriceOverrides,
  aiEstimates: AIEstimates
): string[] {
  const errors: string[] = [];
  
  const marketValue = overrides.marketValue ?? aiEstimates.marketValue;
  const salvageValue = overrides.salvageValue ?? aiEstimates.salvageValue;
  const reservePrice = overrides.reservePrice ?? aiEstimates.reservePrice;
  
  // Market value must be positive
  if (marketValue <= 0) {
    errors.push('Market value must be greater than zero');
  }
  
  // Salvage value cannot exceed market value
  if (salvageValue > marketValue) {
    errors.push('Salvage value cannot exceed market value');
  }
  
  // Reserve price cannot exceed salvage value
  if (reservePrice > salvageValue) {
    errors.push('Reserve price cannot exceed salvage value');
  }
  
  // Salvage value should be positive
  if (salvageValue < 0) {
    errors.push('Salvage value cannot be negative');
  }
  
  // Reserve price should be positive
  if (reservePrice < 0) {
    errors.push('Reserve price cannot be negative');
  }
  
  return errors;
}
```

**Action Buttons**:

```tsx
{/* Approval Actions */}
<div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
  {isEditMode ? (
    // Edit Mode Actions
    <div className="space-y-2">
      <button
        onClick={handleCancelEdit}
        className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg"
      >
        Cancel Edits
      </button>
      <button
        onClick={handleApproveWithChanges}
        disabled={!canApproveWithChanges}
        className="w-full px-4 py-3 bg-green-500 text-white rounded-lg disabled:bg-gray-400"
      >
        ✓ Approve with Changes
      </button>
    </div>
  ) : (
    // Normal Mode Actions
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={() => handleApprovalAction('reject')}
        className="px-4 py-3 bg-red-500 text-white rounded-lg"
      >
        ✕ Reject
      </button>
      <button
        onClick={() => handleApprovalAction('approve')}
        className="px-4 py-3 bg-green-500 text-white rounded-lg"
      >
        ✓ Approve
      </button>
    </div>
  )}
</div>
```

### 4. Approval API Enhancements

**File**: `src/app/api/cases/[id]/approve/route.ts`

**Updated Request Interface**:

```typescript
interface ApprovalRequest {
  action: 'approve' | 'reject';
  comment?: string;
  
  // NEW: Price overrides
  priceOverrides?: {
    marketValue?: number;
    repairCost?: number;
    salvageValue?: number;
    reservePrice?: number;
  };
}
```

**Validation Logic**:

```typescript
// Validate price overrides if provided
if (body.priceOverrides) {
  const overrides = body.priceOverrides;
  
  // Get current AI estimates
  const marketValue = overrides.marketValue ?? parseFloat(caseRecord.marketValue);
  const salvageValue = overrides.salvageValue ?? parseFloat(caseRecord.estimatedSalvageValue);
  const reservePrice = overrides.reservePrice ?? parseFloat(caseRecord.reservePrice);
  
  // Validate relationships
  if (salvageValue > marketValue) {
    return NextResponse.json(
      { error: 'Salvage value cannot exceed market value' },
      { status: 400 }
    );
  }
  
  if (reservePrice > salvageValue) {
    return NextResponse.json(
      { error: 'Reserve price cannot exceed salvage value' },
      { status: 400 }
    );
  }
  
  // Require comment if prices are overridden
  if (!body.comment || body.comment.trim().length < 10) {
    return NextResponse.json(
      { error: 'Comment is required when overriding prices (minimum 10 characters)' },
      { status: 400 }
    );
  }
}
```

**Auction Creation with Overrides**:

```typescript
// Determine which values to use
const finalMarketValue = body.priceOverrides?.marketValue ?? parseFloat(caseRecord.marketValue);
const finalSalvageValue = body.priceOverrides?.salvageValue ?? parseFloat(caseRecord.estimatedSalvageValue);
const finalReservePrice = body.priceOverrides?.reservePrice ?? parseFloat(caseRecord.reservePrice);

// Update case with final values
await db
  .update(salvageCases)
  .set({
    marketValue: finalMarketValue.toString(),
    estimatedSalvageValue: finalSalvageValue.toString(),
    reservePrice: finalReservePrice.toString(),
    // Store original AI estimates for comparison
    aiEstimates: {
      marketValue: parseFloat(caseRecord.marketValue),
      salvageValue: parseFloat(caseRecord.estimatedSalvageValue),
      reservePrice: parseFloat(caseRecord.reservePrice),
    },
    // Store manager overrides if any
    managerOverrides: body.priceOverrides ?? null,
    status: 'approved',
    approvedBy: session.user.id,
    approvedAt: new Date(),
  })
  .where(eq(salvageCases.id, caseId));

// Create audit log for price overrides
if (body.priceOverrides) {
  await logAction(
    createAuditLogData(
      request,
      session.user.id,
      AuditActionType.PRICE_OVERRIDE,
      AuditEntityType.CASE,
      caseId,
      {
        aiEstimates: {
          marketValue: parseFloat(caseRecord.marketValue),
          salvageValue: parseFloat(caseRecord.estimatedSalvageValue),
          reservePrice: parseFloat(caseRecord.reservePrice),
        }
      },
      {
        managerOverrides: body.priceOverrides,
        reason: body.comment,
      }
    )
  );
}
```


## Data Models

### Database Schema Changes

**salvageCases Table** (add new columns):

```sql
ALTER TABLE salvage_cases
ADD COLUMN vehicle_mileage INTEGER,
ADD COLUMN vehicle_condition VARCHAR(20) CHECK (vehicle_condition IN ('excellent', 'good', 'fair', 'poor')),
ADD COLUMN ai_estimates JSONB,
ADD COLUMN manager_overrides JSONB;
```

**Field Descriptions**:

- `vehicle_mileage`: Odometer reading in kilometers (nullable)
- `vehicle_condition`: Pre-accident condition (nullable)
- `ai_estimates`: Original AI estimates before manager overrides (JSONB)
  ```json
  {
    "marketValue": 8500000,
    "repairCost": 3200000,
    "salvageValue": 5300000,
    "reservePrice": 3710000,
    "confidence": 85
  }
  ```
- `manager_overrides`: Manager's price adjustments (JSONB, nullable)
  ```json
  {
    "marketValue": 9000000,
    "salvageValue": 5500000,
    "reservePrice": 3850000,
    "reason": "Market research shows higher value for this model in Lagos",
    "overriddenBy": "user-id",
    "overriddenAt": "2025-02-01T10:30:00Z"
  }
  ```

### TypeScript Interfaces

```typescript
// Enhanced case data
interface SalvageCase {
  // ... existing fields ...
  
  // NEW: Vehicle details
  vehicleMileage?: number;
  vehicleCondition?: 'excellent' | 'good' | 'fair' | 'poor';
  
  // NEW: Price tracking
  aiEstimates?: {
    marketValue: number;
    repairCost: number;
    salvageValue: number;
    reservePrice: number;
    confidence: number;
  };
  
  managerOverrides?: {
    marketValue?: number;
    repairCost?: number;
    salvageValue?: number;
    reservePrice?: number;
    reason: string;
    overriddenBy: string;
    overriddenAt: Date;
  };
}

// Price override request
interface PriceOverrideRequest {
  marketValue?: number;
  repairCost?: number;
  salvageValue?: number;
  reservePrice?: number;
}

// Validation result
interface PriceValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following redundancies:

- **Redundancy 1**: Properties 1.3 and 2.3 both test that form data is passed to the AI service. These can be combined into a single property that tests all vehicle info fields are passed correctly.

- **Redundancy 2**: Properties 6.1, 6.4, and 11.4 all test that override data is stored. These can be combined into a single comprehensive property about data persistence.

- **Redundancy 3**: Properties 5.1, 5.2, and 5.3 test individual validation rules, but property 11.2 tests all validation rules together. Property 11.2 subsumes the individual validation properties.

- **Redundancy 4**: Properties 6.2 and 11.3 both test that overrides are used in auction creation. These are the same property stated differently.

- **Redundancy 5**: Properties 3.1, 3.2, and 3.3 all test that assessment data is displayed in results. These can be combined into a single property about result display completeness.

After eliminating redundancies, we have the following unique, high-value properties:

### Core Properties

**Property 1: Vehicle Info Pass-Through**
*For any* case submission with vehicle details (make, model, year, mileage, condition), the AI assessment API call should include all provided vehicle information fields.
**Validates: Requirements 1.3, 2.3**

**Property 2: Mileage Validation**
*For any* mileage input value, the system should accept only positive numbers and reject zero, negative, or non-numeric values.
**Validates: Requirements 1.2**

**Property 3: Mileage Impact on Valuation**
*For any* vehicle with the same make/model/year, providing different mileage values should result in different market value estimates, with higher mileage generally reducing value.
**Validates: Requirements 1.5**

**Property 4: Condition Impact on Valuation**
*For any* vehicle with the same make/model/year, providing different condition values (excellent/good/fair/poor) should result in different market value estimates, with better condition increasing value.
**Validates: Requirements 2.5**

**Property 5: Assessment Result Display Completeness**
*For any* AI assessment that includes mileage and condition data, the results display should show both the mileage value used, the condition value used, and any adjustment factors applied.
**Validates: Requirements 3.1, 3.2, 3.3**

**Property 6: Warning Display for Accuracy Impact**
*For any* assessment where mileage or condition significantly affects confidence (>10% impact), the system should display a warning message explaining the accuracy impact.
**Validates: Requirements 3.4**

**Property 7: Price Edit Requires Comment**
*For any* price field that is edited by a manager, the system should require a comment with minimum 10 characters before allowing submission.
**Validates: Requirements 4.5**

**Property 8: Price Relationship Validation**
*For any* set of price overrides, the system should enforce: market value > 0, salvage value ≤ market value, and reserve price ≤ salvage value.
**Validates: Requirements 5.1, 5.2, 5.3, 11.2**

**Property 9: Validation Error Prevents Submission**
*For any* price override that fails validation, the system should display specific error messages and disable the approval button.
**Validates: Requirements 5.4**

**Property 10: Valid Overrides Enable Approval**
*For any* set of price overrides that pass all validation rules, the system should enable the "Approve with Changes" button.
**Validates: Requirements 5.5**

**Property 11: Override Data Persistence**
*For any* case approval with price overrides, the system should store both the original AI estimates and the manager's overrides in the database.
**Validates: Requirements 6.1, 6.4, 11.4**

**Property 12: Overrides Used in Auction Creation**
*For any* case approved with price overrides, the created auction should use the overridden reserve price as the minimum bid, not the AI estimate.
**Validates: Requirements 6.2, 6.3, 11.3**

**Property 13: Audit Log Creation**
*For any* price override action, the system should create an audit log entry containing the original value, new value, change reason, manager ID, and timestamp.
**Validates: Requirements 7.1, 7.2, 7.3**

**Property 14: Audit Log Filtering**
*For any* set of audit log entries, the system should support filtering by manager ID, case ID, and price field name, returning only matching entries.
**Validates: Requirements 7.5**

**Property 15: AI Warnings Pass-Through**
*For any* AI assessment that generates warnings, all warnings should be displayed on the approval page without modification.
**Validates: Requirements 8.3**

**Property 16: Currency Formatting**
*For any* numeric price value, the system should format it with thousand separators (e.g., 1,234,567) for display.
**Validates: Requirements 9.3**

**Property 17: Form State Persistence**
*For any* partially completed case form, if the user navigates away and returns, all entered values (including mileage and condition) should be preserved.
**Validates: Requirements 10.5**

**Property 18: API Invalid Override Error Response**
*For any* approval request with invalid price overrides, the API should return a 400 status code with detailed validation error messages.
**Validates: Requirements 11.5**

### Example-Based Tests

These test specific scenarios that don't generalize to properties:

**Example 1: Mileage Field Appears for Vehicles**
When the adjuster selects "vehicle" as asset type, the mileage input field should appear after the VIN field.
**Validates: Requirements 1.1**

**Example 2: Condition Dropdown Appears for Vehicles**
When the adjuster selects "vehicle" as asset type, the condition dropdown should appear after the mileage field with exactly four options: excellent, good, fair, poor.
**Validates: Requirements 2.1, 2.2**

**Example 3: Default Mileage Estimation**
When mileage is not provided for a 5-year-old vehicle, the AI service should estimate mileage as 75,000 km (15,000 km/year).
**Validates: Requirements 1.4**

**Example 4: Default Condition Assumption**
When condition is not provided, the AI service should assume "good" condition for valuation.
**Validates: Requirements 2.4**

**Example 5: Price Fields Are Editable**
When a manager views a pending case, all four price fields (market value, repair cost, salvage value, reserve price) should be editable in edit mode.
**Validates: Requirements 4.1, 4.2**

**Example 6: Numeric Keyboard on Mobile**
When a manager taps a price field on a mobile device, the system should show a numeric keyboard (input type="number").
**Validates: Requirements 9.2**

**Example 7: Edit Mode Activation**
Price fields should be read-only until the manager explicitly clicks "Edit Prices" to enter edit mode.
**Validates: Requirements 9.5**

**Example 8: Confidence Score Display**
When displaying AI estimates, the approval page should show the overall confidence score prominently at the top of the AI assessment section.
**Validates: Requirements 8.1**

**Example 9: Field Labels**
Mileage and condition fields should be labeled as "optional but recommended" to guide users.
**Validates: Requirements 10.3**

**Example 10: API Accepts Overrides**
The approval API should accept an optional `priceOverrides` object in the request body with fields for marketValue, repairCost, salvageValue, and reservePrice.
**Validates: Requirements 11.1**

**Example 11: Approval Without Edits**
When a manager approves a case without editing prices, the system should use AI estimates exactly as before this feature was added.
**Validates: Requirements 12.3**

**Example 12: Adjuster Notification**
When a case is approved with price adjustments, the adjuster should receive a notification stating "Your case was approved with price adjustments by the manager."
**Validates: Requirements 6.5**

### Edge Cases

These handle boundary conditions and error scenarios:

**Edge Case 1: Low Confidence Warning**
When AI confidence is below 70%, display a prominent warning: "⚠️ Low confidence score - manual review strongly recommended"
**Validates: Requirements 8.2**

**Edge Case 2: Missing Mileage Notice**
When mileage is not provided for a vehicle, show an info message: "💡 Adding mileage improves AI accuracy by 10-15%"
**Validates: Requirements 8.5**

**Edge Case 3: Missing Condition Notice**
When condition is not provided for a vehicle, show an info message: "💡 Adding condition improves AI accuracy by 5-10%"
**Validates: Requirements 8.5**

**Edge Case 4: Non-Numeric Mileage**
When the adjuster enters non-numeric characters in the mileage field, display error: "Mileage must be a number"
**Validates: Requirements 10.1**

**Edge Case 5: Unrealistic Mileage**
When the adjuster enters mileage > 500,000 km, display warning: "⚠️ Unusually high mileage - please verify"
**Validates: Requirements 10.2**

**Edge Case 6: Missing Mileage Info Message**
When the adjuster skips mileage, show: "ℹ️ Estimates may be less accurate without mileage data"
**Validates: Requirements 10.4**

**Edge Case 7: Backward Compatibility - Missing Mileage**
When processing a case without mileage data (created before this feature), the system should work normally using estimated mileage.
**Validates: Requirements 12.1**

**Edge Case 8: Backward Compatibility - Missing Condition**
When processing a case without condition data (created before this feature), the system should work normally using "good" as default.
**Validates: Requirements 12.2**

**Edge Case 9: Old Case Display**
When displaying a case created before this feature, show "N/A" for mileage and condition fields instead of empty values.
**Validates: Requirements 12.5**

**Edge Case 10: Backward Compatibility - Old Cases**
When loading cases created before this feature was deployed, the system should handle missing mileage/condition fields gracefully without errors.
**Validates: Requirements 12.4**

**Edge Case 11: Unreasonable Salvage Value Warning**
When a manager edits salvage value to be > 90% of market value, show warning: "⚠️ Salvage value seems high - please verify"
**Validates: Requirements 4.4**

**Edge Case 12: Unreasonable Reserve Price Warning**
When a manager edits reserve price to be < 50% of salvage value, show warning: "⚠️ Reserve price seems low - this may result in undervaluation"
**Validates: Requirements 4.4**


## Error Handling

### Form Validation Errors

**Mileage Field**:
- Non-numeric input: "Mileage must be a number"
- Negative value: "Mileage must be positive"
- Zero value: "Mileage must be greater than zero"
- Unrealistic value (>500,000): "⚠️ Unusually high mileage - please verify"

**Price Override Fields**:
- Non-numeric input: "Price must be a number"
- Negative value: "Price must be positive"
- Zero market value: "Market value must be greater than zero"
- Salvage > Market: "Salvage value cannot exceed market value"
- Reserve > Salvage: "Reserve price cannot exceed salvage value"
- Missing comment: "Please explain why you're adjusting these prices (minimum 10 characters)"

### API Error Responses

**400 Bad Request**:
```json
{
  "error": "Validation failed",
  "details": {
    "salvageValue": "Salvage value (₦6,000,000) cannot exceed market value (₦5,000,000)",
    "comment": "Comment is required when overriding prices"
  }
}
```

**404 Not Found**:
```json
{
  "error": "Case not found",
  "caseId": "case-123"
}
```

**403 Forbidden**:
```json
{
  "error": "Only Salvage Managers can approve cases",
  "userRole": "claims_adjuster"
}
```

**500 Internal Server Error**:
```json
{
  "error": "Failed to process approval",
  "details": "Database connection failed"
}
```

### User-Facing Error Messages

**Network Errors**:
- "Unable to connect to server. Please check your internet connection."
- "Request timed out. Please try again."

**AI Assessment Errors**:
- "AI assessment failed. You can still submit the form with manual estimates."
- "Unable to process photos. Please ensure images are valid and try again."

**Form Submission Errors**:
- "Failed to submit case. Please check all fields and try again."
- "Session expired. Please log in again."

### Error Recovery

**Offline Mode**:
- Save form data to IndexedDB
- Show offline indicator
- Auto-retry when connection restored

**Validation Failures**:
- Highlight invalid fields in red
- Show specific error message below field
- Scroll to first error
- Keep valid data intact

**API Failures**:
- Show user-friendly error message
- Provide retry button
- Log detailed error for debugging
- Don't lose user's entered data

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and integration points
- UI component rendering
- Form validation logic
- API endpoint behavior
- Database operations
- Notification sending

**Property-Based Tests**: Verify universal properties across all inputs
- Input validation rules
- Price relationship constraints
- Data persistence
- Audit logging
- Currency formatting

### Property-Based Testing Configuration

**Library**: Use `fast-check` for TypeScript/JavaScript property-based testing

**Configuration**:
- Minimum 100 iterations per property test
- Each test must reference its design document property
- Tag format: `Feature: case-creation-and-approval-enhancements, Property {number}: {property_text}`

**Example Property Test**:

```typescript
import fc from 'fast-check';

describe('Feature: case-creation-and-approval-enhancements', () => {
  it('Property 8: Price Relationship Validation', () => {
    // Feature: case-creation-and-approval-enhancements, Property 8: Price Relationship Validation
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000000 }), // market value
        fc.integer({ min: 1, max: 10000000 }), // salvage value
        fc.integer({ min: 1, max: 10000000 }), // reserve price
        (marketValue, salvageValue, reservePrice) => {
          const result = validatePriceOverrides({
            marketValue,
            salvageValue,
            reservePrice,
          });
          
          // Market value must be positive
          if (marketValue <= 0) {
            expect(result.errors).toContain('Market value must be greater than zero');
          }
          
          // Salvage cannot exceed market
          if (salvageValue > marketValue) {
            expect(result.errors).toContain('Salvage value cannot exceed market value');
          }
          
          // Reserve cannot exceed salvage
          if (reservePrice > salvageValue) {
            expect(result.errors).toContain('Reserve price cannot exceed salvage value');
          }
          
          // If all valid, no errors
          if (marketValue > 0 && salvageValue <= marketValue && reservePrice <= salvageValue) {
            expect(result.errors).toHaveLength(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Unit Test Coverage

**Form Components**:
- Mileage field appears for vehicles
- Condition dropdown appears for vehicles
- Fields are optional but recommended
- Validation messages display correctly
- Form state persists on navigation

**Price Override UI**:
- Edit mode activation/deactivation
- Price fields are editable in edit mode
- Comment field appears when prices edited
- Validation errors display inline
- Approve button state changes correctly

**API Endpoints**:
- Accept price overrides in request
- Validate override relationships
- Store AI estimates and overrides
- Create audit log entries
- Return appropriate error codes

**Database Operations**:
- Save mileage and condition
- Store AI estimates JSON
- Store manager overrides JSON
- Query audit logs with filters

### Integration Tests

**End-to-End Workflows**:

1. **Case Creation with Mileage/Condition**:
   - Adjuster creates case with mileage and condition
   - AI assessment uses provided values
   - Results display shows mileage/condition
   - Case is saved with all data

2. **Manager Approval with Overrides**:
   - Manager views pending case
   - Enters edit mode
   - Edits prices with comment
   - Approves with changes
   - Auction uses overridden prices
   - Audit log created

3. **Backward Compatibility**:
   - Load old case without mileage/condition
   - Display shows "N/A" for missing fields
   - AI assessment works with defaults
   - Approval works normally

### Manual Testing Checklist

**Mobile Testing**:
- [ ] Mileage field shows numeric keyboard
- [ ] Condition dropdown is touch-friendly
- [ ] Price edit fields have adequate touch targets
- [ ] Edit mode button is easily tappable
- [ ] Validation errors are readable on small screens
- [ ] Currency formatting displays correctly

**Cross-Browser Testing**:
- [ ] Chrome (desktop and mobile)
- [ ] Safari (desktop and mobile)
- [ ] Firefox
- [ ] Edge

**Accessibility Testing**:
- [ ] All form fields have labels
- [ ] Error messages are announced by screen readers
- [ ] Keyboard navigation works
- [ ] Color contrast meets WCAG AA standards
- [ ] Focus indicators are visible

### Performance Considerations

**Form Validation**:
- Debounce validation on input (300ms)
- Don't block UI during validation
- Cache validation results

**AI Assessment**:
- Show loading indicator during processing
- Don't block form submission if AI fails
- Timeout after 30 seconds

**Database Queries**:
- Index mileage and condition columns
- Use prepared statements
- Batch audit log inserts

## Security Considerations

### Input Validation

**Server-Side Validation**:
- All price overrides must be validated on the server
- Never trust client-side validation alone
- Sanitize all user inputs
- Validate data types and ranges

**SQL Injection Prevention**:
- Use parameterized queries (Drizzle ORM handles this)
- Never concatenate user input into SQL
- Validate all IDs before database queries

### Authorization

**Role-Based Access Control**:
- Only Salvage Managers can approve cases
- Only Claims Adjusters can create cases
- Verify user role on every API request
- Check case ownership before allowing edits

**Audit Trail Security**:
- Audit logs are immutable (no updates/deletes)
- Include user ID in all audit entries
- Log all price override attempts (success and failure)
- Protect audit log API with admin-only access

### Data Privacy

**Sensitive Data**:
- Don't log sensitive vehicle information
- Redact VIN in audit logs
- Encrypt database backups
- Follow GDPR/data protection regulations

## Deployment Plan

### Database Migration

**Migration File**: `0005_add_mileage_condition_overrides.sql`

```sql
-- Add new columns to salvage_cases table
ALTER TABLE salvage_cases
ADD COLUMN vehicle_mileage INTEGER,
ADD COLUMN vehicle_condition VARCHAR(20) CHECK (vehicle_condition IN ('excellent', 'good', 'fair', 'poor')),
ADD COLUMN ai_estimates JSONB,
ADD COLUMN manager_overrides JSONB;

-- Create indexes for performance
CREATE INDEX idx_salvage_cases_mileage ON salvage_cases(vehicle_mileage);
CREATE INDEX idx_salvage_cases_condition ON salvage_cases(vehicle_condition);

-- Add comment
COMMENT ON COLUMN salvage_cases.vehicle_mileage IS 'Odometer reading in kilometers';
COMMENT ON COLUMN salvage_cases.vehicle_condition IS 'Pre-accident condition: excellent, good, fair, poor';
COMMENT ON COLUMN salvage_cases.ai_estimates IS 'Original AI price estimates before manager overrides';
COMMENT ON COLUMN salvage_cases.manager_overrides IS 'Manager price adjustments with reason and metadata';
```

### Deployment Steps

1. **Pre-Deployment**:
   - Review and test all code changes
   - Run database migration in staging
   - Verify backward compatibility with existing cases
   - Test with real data in staging environment

2. **Deployment**:
   - Deploy database migration
   - Deploy backend API changes
   - Deploy frontend changes
   - Verify deployment health checks

3. **Post-Deployment**:
   - Monitor error logs for issues
   - Check that existing cases still load correctly
   - Verify new features work as expected
   - Monitor performance metrics

4. **Rollback Plan**:
   - Keep previous version ready
   - Database migration is backward compatible (new columns are nullable)
   - Can rollback frontend without database changes
   - Document rollback procedure

### Feature Flags

**Gradual Rollout**:
- Enable mileage/condition fields for 10% of users first
- Monitor for issues
- Gradually increase to 50%, then 100%
- Enable manager price editing separately

**Configuration**:
```typescript
const FEATURE_FLAGS = {
  enableMileageCondition: process.env.ENABLE_MILEAGE_CONDITION === 'true',
  enablePriceOverrides: process.env.ENABLE_PRICE_OVERRIDES === 'true',
};
```

### Monitoring

**Metrics to Track**:
- % of cases with mileage data
- % of cases with condition data
- % of approvals with price overrides
- Average override amount
- AI confidence scores before/after
- Validation error rates
- API response times

**Alerts**:
- High validation error rate (>10%)
- AI assessment failures (>5%)
- Database migration failures
- Audit log write failures

## Documentation

### User Documentation

**For Claims Adjusters**:
- How to enter mileage and condition
- Why these fields improve accuracy
- What happens if fields are skipped
- How to interpret AI results

**For Salvage Managers**:
- How to enter edit mode
- How to override prices
- When to override prices
- How to write good override comments
- How to interpret AI confidence scores

### Developer Documentation

**API Documentation**:
- Updated case creation endpoint
- Updated approval endpoint
- New audit log query endpoint
- Request/response examples

**Database Schema**:
- New columns documentation
- JSONB structure for ai_estimates
- JSONB structure for manager_overrides
- Index usage guidelines

**Code Comments**:
- Validation logic explanation
- Price calculation formulas
- Audit logging requirements
- Backward compatibility notes
