# Tier 2 KYC: Name Handling and Field Immutability Fix

## Quick Reference

This document summarizes the critical fixes for name parsing and field immutability in the Tier 2 KYC Dojah Integration.

---

## Problem 1: Name Parsing

### Current Behavior (BROKEN)

```typescript
const nameParts = (user?.name ?? '').split(' ');
const options: DojahWidgetOptions = {
  user_data: {
    first_name: nameParts[0],
    last_name: nameParts.slice(1).join(' ') || undefined,
  },
};
```

**Why it fails:**
- "Chukwuemeka Okonkwo" → ✓ Works (first: "Chukwuemeka", last: "Okonkwo")
- "Okonkwo Chukwuemeka" → ✗ Reversed! (first: "Okonkwo", last: "Chukwuemeka")
- "Okonkwo Chukwuemeka Nnamdi" → ✗ Middle name lost (first: "Okonkwo", last: "Chukwuemeka Nnamdi")

### Root Cause

Nigerian names don't follow a single pattern:
- Some people put last name first: "Okonkwo Chukwuemeka"
- Some put first name first: "Chukwuemeka Okonkwo"
- Many have multiple middle names: "Okonkwo Chukwuemeka Nnamdi Chibueze"

The current code assumes first name always comes first, which is incorrect.

### Solution

**Create intelligent name parser:**

```typescript
// src/features/kyc/services/name-parsing.service.ts

interface ParsedName {
  firstName: string;
  middleName?: string;
  lastName: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

class NameParsingService {
  parseFullName(fullName: string): ParsedName {
    const words = fullName.trim().split(/\s+/);
    
    if (words.length === 1) {
      return {
        firstName: words[0],
        lastName: '',
        confidence: 'low',
        reasoning: 'Single word: cannot determine last name'
      };
    }
    
    if (words.length === 2) {
      return {
        firstName: words[0],
        lastName: words[1],
        confidence: 'high',
        reasoning: 'Two-word name: first word is first name, second is last name'
      };
    }
    
    // 3+ words: assume Nigerian pattern (last name first)
    return {
      firstName: words[1],
      middleName: words.slice(2).join(' '),
      lastName: words[0],
      confidence: 'medium',
      reasoning: 'Three+ word name: assuming last name first (Nigerian pattern)'
    };
  }
}
```

**Updated widget initialization:**

```typescript
import { NameParsingService } from '@/features/kyc/services/name-parsing.service';

const nameParser = new NameParsingService();
const parsedName = nameParser.parseFullName(user?.name ?? '');

const options: DojahWidgetOptions = {
  user_data: {
    first_name: parsedName.firstName,      // Editable
    middle_name: parsedName.middleName,    // Editable
    last_name: parsedName.lastName,        // Editable
    // ... other fields
  },
};
```

**Key Points:**
- All name fields are **editable** in the Dojah widget
- This is just a best-guess pre-population
- Vendor can correct any parsing errors
- System stores corrected names if vendor edits them

---

## Problem 2: Phone Number and BVN Immutability

### Current Behavior (BROKEN)

Phone and BVN are not passed to the Dojah widget, or if they are, they're editable. This is a security issue because:
- Phone is already verified in Tier 1 (via BVN verification)
- BVN is already verified in Tier 1
- Allowing changes could enable fraud

### Solution

**Fetch from Tier 1 data:**

```typescript
// Phone is in users table
const phone = user?.phone; // From users.phone (Tier 1 verified)

// BVN is in vendors table (encrypted)
const bvnEncrypted = vendor?.bvnEncrypted;
const bvn = decrypt(bvnEncrypted); // Decrypt for widget if needed
```

**Configure as immutable in widget:**

```typescript
const options: DojahWidgetOptions = {
  user_data: {
    first_name: parsedName.firstName,
    middle_name: parsedName.middleName,
    last_name: parsedName.lastName,
    phone: phone,                          // IMMUTABLE
    bvn: bvn,                              // IMMUTABLE (if Dojah supports)
    email: user?.email,
  },
  config: {
    otp: {
      phone_number: phone,
      phone_number_editable: false,        // Make read-only
    },
    // Check Dojah docs for BVN immutability config
  },
};
```

**Server-side validation:**

```typescript
// In POST /api/kyc/complete handler

// Fetch Tier 1 values
const tier1Phone = await getUserPhone(vendorId);
const tier1BVN = await getVendorBVN(vendorId);

// Get submitted values from Dojah response
const submittedPhone = dojahResponse.data.phone;
const submittedBVN = dojahResponse.data.bvn;

// Validate immutability
if (submittedPhone !== tier1Phone) {
  return res.status(400).json({
    error: 'Phone number must match your Tier 1 verified number. Contact support if you need to update it.'
  });
}

if (submittedBVN !== tier1BVN) {
  return res.status(400).json({
    error: 'BVN must match your Tier 1 verified BVN. Contact support if you need to update it.'
  });
}
```

---

## Database Schema Changes

Add to `vendors` table:

```sql
ALTER TABLE vendors
ADD COLUMN tier2_corrected_first_name VARCHAR(100),
ADD COLUMN tier2_corrected_middle_name VARCHAR(100),
ADD COLUMN tier2_corrected_last_name VARCHAR(100);
```

**Purpose:** Store vendor-corrected names if they edit the parsed values in the Dojah widget.

---

## Verification Flow Updates

### Before (Current)

1. Vendor opens Tier 2 page
2. Widget initialized with naive name split
3. Vendor completes verification
4. Server processes result

### After (Fixed)

1. Vendor opens Tier 2 page
2. **NEW:** Fetch phone from `users.phone`, BVN from `vendors.bvnEncrypted`
3. **NEW:** Parse full name using `NameParsingService`
4. Widget initialized with:
   - Parsed first/middle/last names (editable)
   - Phone (immutable)
   - BVN (immutable)
5. Vendor completes verification (can edit names if parsing was wrong)
6. Server processes result:
   - **NEW:** Validate phone matches Tier 1
   - **NEW:** Validate BVN matches Tier 1
   - **NEW:** Compare submitted names vs. parsed names
   - **NEW:** Store corrected names if different
   - **NEW:** Log name changes in audit trail

---

## Testing Requirements

### Property-Based Tests

1. **Property 17:** Name parsing round-trip
   ```typescript
   // For any full name, reconstructing from parsed components preserves essential info
   similarity(fullName, reconstructFullName(parseFullName(fullName))) >= 0.9
   ```

2. **Property 18:** Phone immutability
   ```typescript
   // For any submission where phone differs from Tier 1, reject
   submittedPhone !== tier1Phone → verificationStatus === "rejected"
   ```

3. **Property 19:** BVN immutability
   ```typescript
   // For any submission where BVN differs from Tier 1, reject
   submittedBVN !== tier1BVN → verificationStatus === "rejected"
   ```

4. **Property 20:** Name correction audit trail
   ```typescript
   // For any name edit, log both original and corrected
   correctedName !== parsedName → auditLog.contains(originalName AND correctedName)
   ```

### Unit Tests

```typescript
describe('NameParsingService', () => {
  it('should parse two-word names correctly', () => {
    const result = parser.parseFullName('Chukwuemeka Okonkwo');
    expect(result.firstName).toBe('Chukwuemeka');
    expect(result.lastName).toBe('Okonkwo');
  });

  it('should parse three-word names with last name first', () => {
    const result = parser.parseFullName('Okonkwo Chukwuemeka Nnamdi');
    expect(result.firstName).toBe('Chukwuemeka');
    expect(result.middleName).toBe('Nnamdi');
    expect(result.lastName).toBe('Okonkwo');
  });

  it('should handle single-word names', () => {
    const result = parser.parseFullName('John');
    expect(result.firstName).toBe('John');
    expect(result.lastName).toBe('');
    expect(result.confidence).toBe('low');
  });
});
```

---

## Implementation Checklist

### Phase 1: Name Parsing Service
- [ ] Create `src/features/kyc/services/name-parsing.service.ts`
- [ ] Implement `parseFullName()` method
- [ ] Implement `reconstructFullName()` method
- [ ] Write unit tests for edge cases
- [ ] Write property-based test for round-trip

### Phase 2: Database Schema
- [ ] Create migration for corrected name columns
- [ ] Update `vendors` schema in Drizzle
- [ ] Run migration in dev/test environments

### Phase 3: Widget Configuration
- [ ] Research Dojah docs for field immutability options
- [ ] Update `tier2/page.tsx` to fetch phone and BVN
- [ ] Update widget initialization with parsed names
- [ ] Configure phone/BVN as immutable
- [ ] Add client-side warnings if immutability not supported

### Phase 4: Server-Side Validation
- [ ] Update `POST /api/kyc/complete` handler
- [ ] Add phone/BVN validation against Tier 1 values
- [ ] Add name comparison and storage logic
- [ ] Add audit trail logging for name changes
- [ ] Add clear error messages for validation failures

### Phase 5: Testing
- [ ] Write property-based tests (Properties 17-20)
- [ ] Write unit tests for name parsing
- [ ] Write integration tests for complete flow
- [ ] Write E2E tests for name correction and immutability

### Phase 6: Documentation
- [ ] Document name parsing algorithm
- [ ] Document Dojah widget configuration
- [ ] Update API documentation
- [ ] Create troubleshooting guide

---

## Dojah Documentation Research Required

Before implementation, consult Dojah's official documentation to determine:

1. **Field immutability:** How to make phone/BVN read-only in the widget
2. **BVN support:** Whether BVN can be pre-filled in the widget
3. **Configuration structure:** Exact parameter names for field-level controls
4. **Version requirements:** Any widget version requirements for these features

**If Dojah doesn't support field-level immutability:**
- Implement client-side warnings when user tries to edit phone/BVN
- Implement server-side validation to reject mismatched values
- Provide clear error messages directing users to contact support

---

## Error Messages

### Name Parsing
- Low confidence: "We've pre-filled your name fields. Please verify and correct if needed."
- Name edited: (No error - this is expected and allowed)

### Phone Immutability
- Mismatch detected: "Phone number must match your Tier 1 verified number (ending in XXXX). Contact support if you need to update it."

### BVN Immutability
- Mismatch detected: "BVN must match your Tier 1 verified BVN. Contact support if you need to update it."

---

## Priority

**High Priority (Blocking):**
1. Name parsing service - Without this, Tier 2 verification fails for many Nigerian names
2. Phone/BVN immutability - Security requirement to prevent fraud

**Medium Priority:**
3. Database schema updates - Can be done in parallel
4. Audit trail enhancements - Compliance requirement

**Low Priority:**
5. Additional E2E tests - Quality assurance

---

## Related Files

- Design: `.kiro/specs/tier-2-kyc-dojah-integration/design.md`
- Requirements: `.kiro/specs/tier-2-kyc-dojah-integration/requirements.md`
- Current Implementation: `src/app/(dashboard)/vendor/kyc/tier2/page.tsx`
- Vendors Schema: `src/lib/db/schema/vendors.ts`
- Users Schema: `src/lib/db/schema/users.ts`

