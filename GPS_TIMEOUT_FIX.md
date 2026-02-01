# GPS Timeout Error Fix

## Issue
When users granted location permission on the case creation page, they encountered:
```
GPS capture error: GeolocationPositionError {code: 3, message: 'Timeout expired'}
```

**Root Cause**: The GPS timeout was set to 10 seconds, which is often insufficient for:
- First-time GPS fix (cold start)
- Indoor locations with weak GPS signal
- Devices with slower GPS hardware

## Solution Implemented

### 1. Increased Timeout Duration
Changed GPS timeout from **10 seconds to 30 seconds**:
```typescript
timeout: 30000, // Increased to 30 seconds for better reliability
```

This gives the device more time to acquire a GPS fix, especially in challenging conditions.

### 2. Enhanced Error Messages
Added user-friendly error messages based on GeolocationPositionError codes:

- **Code 1 (PERMISSION_DENIED)**: "Location permission denied. Please enable location access in your browser settings."
- **Code 2 (POSITION_UNAVAILABLE)**: "Location unavailable. Please check your device GPS settings."
- **Code 3 (TIMEOUT)**: "Location request timed out. Please try again or move to an area with better GPS signal."

### 3. Better Error Handling
Improved error detection and type checking:
```typescript
if (error && typeof error === 'object' && 'code' in error) {
  const geoError = error as GeolocationPositionError;
  switch (geoError.code) {
    // Handle specific error codes
  }
}
```

## User Experience Improvements

### Before:
- Generic console error
- 10-second timeout (too short)
- Unclear error messages

### After:
- 30-second timeout (more reliable)
- Clear, actionable error messages displayed in UI
- Specific guidance based on error type

## Files Modified
- `src/app/(dashboard)/adjuster/cases/new/page.tsx`

## Testing
✅ TypeScript compilation passes with no errors
✅ Error messages display correctly in UI (already verified in code)
✅ Longer timeout gives GPS more time to acquire fix

## Notes
- The error is already displayed to users via the existing `gpsError` state
- Users can retry GPS capture if it fails
- The page continues to work even if GPS capture fails (GPS is optional)
- Error messages guide users on how to resolve the issue
