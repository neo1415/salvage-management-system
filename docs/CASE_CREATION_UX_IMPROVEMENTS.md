# Case Creation UX Improvements

## Issues Identified

### 1. Voice Notes - Unclear Purpose ❌
**Problem**: Voice notes don't have a clear purpose. Should they:
- Fill form fields automatically (AI transcription)?
- Just be audio notes attached to the case?

**Current Implementation**: Text transcription stored as strings

**Recommendation**: Voice notes should be **optional audio memos** for additional context, NOT for filling form fields. Adjusters should manually fill the form.

### 2. Speech Recognition Permission Error ❌
**Error**: `Speech recognition error: not-allowed`
**Cause**: Browser needs explicit microphone permission before starting recording

### 3. Camera Capture Not Obvious ❌
**Problem**: Users don't realize they can use camera
**Current**: `capture="environment"` attribute exists but UI says "Add Photos" (sounds like upload only)

### 4. Market Value Should Be AI-Estimated ❌
**Problem**: User manually enters market value
**Should Be**: AI estimates it from photos, user can override if needed

### 5. Voice Notes Button Not User-Friendly ❌
**Problem**: Generic button, no visual feedback, unclear what it does

## Proposed Solutions

### Solution 1: Simplify Voice Notes
- Make it clearly "optional audio notes"
- Add better permission handling
- Show recording duration
- Add visual waveform or pulsing indicator
- Store as audio files, not transcribed text

### Solution 2: Improve Camera UX
- Change button text to "📷 Take Photos or Upload"
- Add separate "Take Photo" and "Upload" buttons on mobile
- Show camera icon prominently

### Solution 3: AI-Powered Market Value
- Remove manual market value input
- AI estimates from photos
- Show as "AI Estimated: ₦X" with edit button
- User can override if needed

### Solution 4: Better Permission Handling
- Request microphone permission before starting
- Show clear error messages
- Provide instructions if denied

## Implementation Priority

1. **HIGH**: Fix camera button text (quick win)
2. **HIGH**: Remove/hide market value manual input (AI should handle)
3. **MEDIUM**: Improve voice notes UI and permissions
4. **LOW**: Add audio file storage (can keep text transcription for MVP)
