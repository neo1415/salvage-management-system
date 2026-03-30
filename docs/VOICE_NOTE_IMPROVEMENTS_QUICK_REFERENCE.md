# Voice Note Improvements - Quick Reference

## For Developers

### Hook Usage

```typescript
import { useUnifiedVoiceContent } from '@/components/ui/unified-voice-field';

const {
  content,              // Current voice note content
  appendVoiceNote,      // Add new transcription
  updateContent,        // Update content directly
  clearContent,         // Clear all content
  showTimestamps,       // Current timestamp preference
  toggleTimestamps,     // Toggle timestamp on/off
  wordCount,           // Word count
  characterCount,      // Character count
} = useUnifiedVoiceContent(initialValue);

// Add voice note (timestamps applied automatically based on user preference)
const newContent = appendVoiceNote("Vehicle has damage");

// Update content manually
updateContent("New content");

// Toggle timestamps
toggleTimestamps(); // Saves to localStorage automatically
```

---

### Component Usage

```typescript
import { VoiceNoteControls } from '@/components/ui/voice-note-controls';

<VoiceNoteControls
  content={voiceContent}
  onContentUpdate={(newContent) => {
    updateVoiceContent(newContent);
    setValue('unifiedVoiceContent', newContent);
  }}
  showTimestamps={showTimestamps}
  onToggleTimestamps={toggleTimestamps}
  disabled={isRecording}
/>
```

---

### API Usage

```typescript
// POST /api/voice-notes/cleanup
const response = await fetch('/api/voice-notes/cleanup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: "your text here" }),
});

const data = await response.json();
// { cleanedText: string, originalLength: number, cleanedLength: number }
```

---

### Filler Words List

```typescript
const FILLER_WORDS = [
  'um', 'uh', 'uhm', 'umm', 'er', 'ah', 
  'like', 'you know', 'i mean', 
  'sort of', 'kind of', 
  'basically', 'actually', 'literally', 
  'right', 'okay', 'so', 'well', 'yeah', 'yep'
];
```

---

### localStorage Key

```typescript
// Timestamp preference
const key = 'voiceNoteTimestamps';
const value = 'true' | 'false'; // String, not boolean
```

---

## For Users

### Keyboard Shortcuts
- **Ctrl+Enter**: Start recording (when in text field)
- **Escape**: Stop recording
- **Tab**: Navigate between controls

### Button States
- **Timestamp Toggle**:
  - ON: Burgundy (#800020)
  - OFF: White/Gray
  
- **AI Cleanup**:
  - Ready: Purple gradient
  - Processing: Spinner + "Processing..."
  - Disabled: Grayed out

---

## For Managers

### Costs
- **Filler Word Removal**: Free
- **Timestamp Toggle**: Free
- **AI Cleanup**: ~$0.0004 per request
- **Monthly Estimate**: ~$0.40 (1000 requests)

### Metrics to Track
- Voice notes per case
- AI cleanup usage rate
- Timestamp toggle adoption
- User satisfaction scores

---

## File Locations

### Components
- `src/components/ui/unified-voice-field.tsx` - Main hook and field
- `src/components/ui/voice-note-controls.tsx` - Controls component

### API
- `src/app/api/voice-notes/cleanup/route.ts` - AI cleanup endpoint

### Pages
- `src/app/(dashboard)/adjuster/cases/new/page.tsx` - Case creation
- `src/app/(dashboard)/adjuster/cases/[id]/page.tsx` - Case details

### Documentation
- `docs/VOICE_NOTE_IMPROVEMENTS.md` - Technical docs
- `docs/VOICE_NOTE_IMPROVEMENTS_USAGE_GUIDE.md` - User guide
- `docs/VOICE_NOTE_IMPROVEMENTS_SUMMARY.md` - Summary
- `docs/VOICE_NOTE_IMPROVEMENTS_CHECKLIST.md` - Testing checklist

---

## Common Issues

### Voice Recording Not Working
```
Check: Browser support (Chrome/Edge/Safari)
Check: Microphone permissions
Check: Internet connection
```

### Timestamp Not Persisting
```
Check: localStorage enabled
Check: Browser not in private mode
Clear: Browser cache
```

### AI Cleanup Failing
```
Check: GEMINI_API_KEY environment variable
Check: Internet connection
Check: API quota not exceeded
```

---

## Quick Commands

### Run Tests
```bash
npx tsx scripts/test-voice-note-improvements.ts
```

### Check TypeScript
```bash
npm run type-check
# or
npx tsc --noEmit
```

### Build
```bash
npm run build
```

---

## Environment Variables

```bash
# Required for AI cleanup
GEMINI_API_KEY=your_api_key_here
```

---

## Browser Support

| Browser | Voice Recording | Filler Removal | Timestamp | AI Cleanup |
|---------|----------------|----------------|-----------|------------|
| Chrome  | ✅ Full        | ✅ Full        | ✅ Full   | ✅ Full    |
| Edge    | ✅ Full        | ✅ Full        | ✅ Full   | ✅ Full    |
| Safari  | ✅ Full        | ✅ Full        | ✅ Full   | ✅ Full    |
| Firefox | ❌ No API      | ✅ Manual      | ✅ Full   | ✅ Full    |

---

## API Response Examples

### Success
```json
{
  "cleanedText": "Vehicle has damage. Needs repair.",
  "originalLength": 45,
  "cleanedLength": 38
}
```

### Error
```json
{
  "error": "Failed to clean up text",
  "details": "Network error"
}
```

---

## State Management

### Hook State
```typescript
content: string              // Current text
showTimestamps: boolean      // Timestamp preference
wordCount: number           // Calculated word count
characterCount: number      // Calculated character count
```

### Component State
```typescript
isProcessing: boolean       // AI cleanup in progress
error: string | null        // Error message
```

---

## Best Practices

### For Developers
1. Always use the hook for voice content management
2. Don't bypass filler word removal
3. Handle API errors gracefully
4. Test on multiple browsers

### For Users
1. Speak clearly and naturally
2. Review before submitting
3. Use AI cleanup for professional docs
4. Toggle timestamps based on use case

---

## Support Contacts

- **Technical Issues**: [Your IT Support]
- **Feature Requests**: [Product Team]
- **Bug Reports**: [Development Team]

---

**Version**: 1.0
**Last Updated**: 2024
**Status**: Production Ready ✅
