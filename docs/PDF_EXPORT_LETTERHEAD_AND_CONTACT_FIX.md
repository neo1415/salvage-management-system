# PDF Export - Letterhead and Contact Details Fix

**Date**: May 4, 2026  
**Status**: ✅ COMPLETE  
**File Modified**: `src/components/reports/common/export-button.tsx`

## Problem

The PDF export was missing:
1. ❌ NEM logo (not implemented yet - requires image file)
2. ❌ Centered letterhead layout
3. ❌ Correct NEM contact details
4. ❌ Proper spacing for taller letterhead

## Solution

### 1. Updated Letterhead (Centered Layout)

**Before**:
```typescript
// Left-aligned letterhead
pdf.text('NEM Insurance', marginLeft, 12);
pdf.text('Plot 1234, Adeola Odeku Street, Victoria Island, Lagos', marginLeft, 20);
pdf.text('Tel: +234 1 234 5678 | Email: info@neminsurance.com', marginLeft, 25);
```

**After**:
```typescript
// Centered letterhead with correct details
pdf.text('NEM Insurance Plc', pdfWidth / 2, 12, { align: 'center' });
pdf.text('199, Ikorodu Road, Obanikoro Lagos', pdfWidth / 2, 20, { align: 'center' });
pdf.text('Call Us: 234-02-014489560 | E-mail: nemsupport@nem-insurance.com', pdfWidth / 2, 27, { align: 'center' });
```

### 2. Correct NEM Contact Details

| Field | Old (Wrong) | New (Correct) |
|-------|-------------|---------------|
| **Company Name** | NEM Insurance | **NEM Insurance Plc** |
| **Address** | Plot 1234, Adeola Odeku Street, Victoria Island, Lagos | **199, Ikorodu Road, Obanikoro Lagos** |
| **Phone** | Tel: +234 1 234 5678 | **Call Us: 234-02-014489560** |
| **Email** | Email: info@neminsurance.com | **E-mail: nemsupport@nem-insurance.com** |

### 3. Updated Letterhead Height

- **Old**: 30mm burgundy bar
- **New**: 35mm burgundy bar (to accommodate 3 lines of centered text)

### 4. Updated Content Positioning

**First Page** (with title):
- Letterhead: 0-35mm
- Report Title: 42mm (centered)
- Generated Date: 48mm (centered)
- Content starts: 54mm

**Subsequent Pages**:
- Letterhead: 0-35mm
- Content starts: 40mm (marginTop)

## What's Still Missing

### NEM Logo
The letterhead does NOT include the NEM logo yet because:
1. Need the actual logo image file (PNG/JPG)
2. Need to embed it in the PDF using `pdf.addImage()`

**To add logo later**:
```typescript
// After getting logo file at /public/icons/nem-logo.png
const logoImg = await fetch('/icons/nem-logo.png');
const logoBlob = await logoImg.blob();
const logoData = await new Promise((resolve) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(reader.result);
  reader.readAsDataURL(logoBlob);
});

// Add logo to PDF (centered, above company name)
pdf.addImage(logoData, 'PNG', (pdfWidth - 30) / 2, 5, 30, 15);
```

## Testing

1. **Start dev server**: `npm run dev`
2. **Navigate to**: `/reports/financial/revenue-analysis`
3. **Click**: Export → Export as PDF
4. **Verify**:
   - ✅ Burgundy header bar (35mm tall)
   - ✅ "NEM Insurance Plc" centered
   - ✅ "199, Ikorodu Road, Obanikoro Lagos" centered
   - ✅ "Call Us: 234-02-014489560 | E-mail: nemsupport@nem-insurance.com" centered
   - ✅ Report title centered below letterhead
   - ✅ Generated date centered
   - ✅ Footer with page numbers
   - ✅ All content visible (no cutoff)

## Files Changed

```
src/components/reports/common/export-button.tsx
```

## Build Status

✅ Build successful: `npm run build` completed without errors

## Next Steps (Optional)

1. **Add NEM Logo**: Get logo file and embed in letterhead
2. **Test with all reports**: Verify letterhead appears correctly on all report types
3. **Print testing**: Test with browser print dialog
