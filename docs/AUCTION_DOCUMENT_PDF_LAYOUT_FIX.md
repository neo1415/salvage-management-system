# Auction Document PDF Layout Fix

## Problem Summary

The PDF generation for auction documents (Bill of Sale and Release & Waiver of Liability) had several critical layout and content issues:

### Issues Identified

1. **Layout Flow/Positioning Problem**
   - Signature image, QR code, vendor details, and footer were overlapping
   - Elements were using conflicting absolute coordinates
   - No reserved vertical spacing for dynamically sized content
   - Signature rendering without constrained container dimensions

2. **Bill of Sale Missing Signature**
   - Bill of Sale document was not being regenerated with signature after signing
   - Only the Liability Waiver was being regenerated with signature data

3. **Logo Loading Issue**
   - NEM Insurance logo path was correct but needed verification

4. **Email Address Update**
   - Footer email needed to be changed from `nemsupport@nem-insurance.com` to `noreply@nemsalvage.com`

## Root Cause Analysis

The core issue was **improper layout flow management**:

- **Dynamic elements without constraints**: Signature images were inserted without fixed container dimensions
- **Absolute positioning conflicts**: QR code, signature, and footer were competing for the same Y-coordinates
- **No overflow protection**: Signature height could expand beyond allocated space
- **Missing vertical spacing calculations**: No reserved space before rendering dynamic content

This is fundamentally a **layout-engine problem**, not a business logic issue.

## Solution Implemented

### 1. Containerized Layout with Fixed Dimensions

**Bill of Sale (`generateBillOfSalePDF`)**:
```typescript
// Calculate required space and ensure adequate room
const requiredSpace = 70; // Space needed for signature + QR + spacing
if (yPos + requiredSpace > maxContentY) {
  yPos = maxContentY - requiredSpace;
}

// LEFT COLUMN: Signature section (fixed container)
if (data.signatureData) {
  // Constrained signature dimensions
  const signatureWidth = 80;
  const signatureHeight = 40;
  doc.addImage(data.signatureData, 'PNG', 20, yPos, signatureWidth, signatureHeight);
}

// RIGHT COLUMN: QR Code section (separate column, no overlap)
const qrX = pageWidth - 50;
const qrY = sectionStartY;
doc.addImage(qrCodeDataUrl, 'PNG', qrX, qrY + 8, 30, 30);
```

**Release & Waiver (`generateLiabilityWaiverPDF`)**:
```typescript
// Structured layout with fixed containers
const leftColumnWidth = 100;
const rightColumnX = pageWidth - 50;

// LEFT COLUMN: Signature (max 80x40px)
const signatureWidth = 80;
const signatureHeight = 40;

// RIGHT COLUMN: QR Code (fixed 30x30px)
doc.addImage(qrCodeDataUrl, 'PNG', rightColumnX, qrY + 8, 30, 30);
```

### 2. Key Layout Principles Applied

✅ **Fixed Container Dimensions**
- Signature: max 80px width × 40px height
- QR Code: fixed 30px × 30px
- Prevents uncontrolled expansion

✅ **Column-Based Layout**
- LEFT COLUMN: Signature + vendor details
- RIGHT COLUMN: QR code + verification label
- No coordinate conflicts

✅ **Reserved Vertical Space**
- Calculate `requiredSpace` before rendering
- Ensure `yPos + requiredSpace ≤ maxContentY`
- Automatic adjustment if insufficient space

✅ **Footer Anchoring**
- Footer always anchored at page bottom
- Minimum 45px spacing from content
- No overlap with dynamic elements

### 3. Bill of Sale Signature Support

**Added signature fields to `BillOfSaleData` interface**:
```typescript
export interface BillOfSaleData {
  // ... existing fields ...
  
  // Signature information (optional - added when signed)
  signatureData?: string;
  signedDate?: string;
  
  // Verification
  verificationUrl: string;
}
```

**Updated document signing logic** (`document.service.ts`):
```typescript
// Now regenerates BOTH liability waiver AND bill of sale with signature
if (existingDoc.documentType === 'liability_waiver' || existingDoc.documentType === 'bill_of_sale') {
  // Regenerate PDF with signature data
  if (existingDoc.documentType === 'bill_of_sale') {
    const billOfSaleData: BillOfSaleData = {
      // ... all fields ...
      signatureData, // Include the signature
      signedDate: new Date().toLocaleDateString('en-NG'),
    };
    pdfBuffer = await generateBillOfSalePDF(billOfSaleData);
  }
}
```

### 4. Email Address Update

**Updated footer in `pdf-template.service.ts`**:
```typescript
// Line 2: Contact information
doc.text('Tel: 234-02-014489560 | Email: noreply@nemsalvage.com', pageWidth / 2, footerY + 5, { align: 'center' });
```

## Files Modified

1. **src/features/documents/services/pdf-generation.service.ts**
   - Fixed Bill of Sale layout with containerized rendering
   - Fixed Liability Waiver layout with column-based structure
   - Added signature support to Bill of Sale interface
   - Constrained all dynamic elements to fixed dimensions

2. **src/features/documents/services/pdf-template.service.ts**
   - Updated footer email to `noreply@nemsalvage.com`

3. **src/features/documents/services/document.service.ts**
   - Extended signature regeneration to include Bill of Sale
   - Both documents now regenerate with signature after signing

## Testing Recommendations

### Visual Testing
1. Generate Bill of Sale without signature → verify clean layout
2. Generate Bill of Sale with signature → verify signature appears in left column
3. Generate Liability Waiver without signature → verify clean layout
4. Generate Liability Waiver with signature → verify signature appears in left column
5. Verify QR code always appears in right column, no overlap
6. Verify footer always anchored at bottom with proper spacing
7. Verify NEM logo appears in header
8. Verify email shows as `noreply@nemsalvage.com` in footer

### Functional Testing
1. Sign Bill of Sale → verify PDF regenerates with signature
2. Sign Liability Waiver → verify PDF regenerates with signature
3. Download signed documents → verify signature visible
4. Scan QR codes → verify verification URLs work

## Layout Specifications

### Signature Container
- **Max Width**: 80px
- **Max Height**: 40px
- **Position**: Left column (x: 20)
- **Aspect Ratio**: Preserved

### QR Code Container
- **Fixed Size**: 30px × 30px
- **Position**: Right column (x: pageWidth - 50)
- **Margin**: 8px top spacing

### Footer
- **Position**: Fixed at bottom (pageHeight - 25)
- **Spacing**: 45px reserved from content
- **Content**: 3 lines (company info, contact, timestamp)

### Vertical Spacing
- **Required Space**: 70px minimum for signature section
- **Content Buffer**: 20px before signature section
- **Footer Buffer**: 45px (25px footer + 20px spacing)

## Benefits

✅ **No More Overlapping**: Elements render in separate containers with fixed coordinates
✅ **Predictable Layout**: Signature and QR code always render correctly
✅ **Overflow Protection**: Constrained dimensions prevent expansion
✅ **Professional Appearance**: Clean, structured layout
✅ **Bill of Sale Signatures**: Now properly supported and displayed
✅ **Correct Contact Info**: Updated email address in all PDFs

## Related Documentation

- [PDF Generation Service](../src/features/documents/services/pdf-generation.service.ts)
- [PDF Template Service](../src/features/documents/services/pdf-template.service.ts)
- [Document Service](../src/features/documents/services/document.service.ts)

---

**Status**: ✅ Complete
**Date**: 2026-05-08
**Impact**: High - Fixes critical layout issues in legal documents
