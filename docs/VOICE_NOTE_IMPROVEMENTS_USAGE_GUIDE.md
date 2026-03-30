# Voice Note Improvements - User Guide

## Quick Start

### For Adjusters Creating Cases

When creating a new insurance claim case, you now have enhanced voice note capabilities:

---

## 1. Recording Voice Notes

### How to Record
1. Navigate to **Create New Case** page
2. Scroll to the **Voice Notes** section
3. Tap the **microphone button** to start recording
4. Speak clearly into your device's microphone
5. Tap the **red stop button** when finished

### What Happens Automatically
- **Filler words are removed** (um, uh, like, you know, etc.)
- Text is **automatically capitalized**
- **Timestamps are added** (if enabled)
- Text appears in the unified voice field

### Example
**You say**: "Um, the vehicle has, like, significant damage to the, uh, front bumper, you know?"

**What appears**: "The vehicle has significant damage to the front bumper."

---

## 2. Timestamp Toggle

### What Are Timestamps?
Timestamps show when each voice note was recorded:
```
[14:30] Vehicle has front bumper damage.
[14:32] Rear door is also dented.
```

### When to Use Timestamps

**Turn ON for**:
- Legal documentation
- Compliance requirements
- Long recording sessions
- When timing matters

**Turn OFF for**:
- Clean, professional reports
- Sharing with clients
- Formal documentation
- Better readability

### How to Toggle
1. Look for the **clock icon button** above the voice field
2. Click to toggle ON (burgundy) or OFF (white)
3. Your preference is saved automatically

---

## 3. AI Cleanup Button

### What It Does
The AI cleanup feature uses Google Gemini to:
- Add proper punctuation (periods, commas, etc.)
- Fix capitalization
- Remove any remaining filler words
- Improve overall readability

### When to Use It
- After recording multiple voice notes
- Before submitting the case
- When text needs professional polish
- For client-facing documentation

### How to Use
1. Record your voice notes (or type text)
2. Click the **"Clean up with AI"** button (purple gradient)
3. Wait a few seconds for processing
4. Review the cleaned text

### Example

**Before AI Cleanup**:
```
vehicle has front damage needs repair estimate around 5000
rear door dented windshield cracked
customer wants quick turnaround
```

**After AI Cleanup**:
```
Vehicle has front damage. Needs repair estimate around $5,000.
Rear door dented, windshield cracked.
Customer wants quick turnaround.
```

### Important Notes
- AI cleanup costs a small API fee (less than a cent per use)
- Use it when you need professional formatting
- You can manually edit the text before or after cleanup
- The original text is replaced (no undo currently)

---

## 4. Manual Editing

### You Can Always Edit
The voice field is fully editable:
- Click inside to type or edit
- Use keyboard shortcuts (Ctrl+A, Ctrl+C, etc.)
- Delete unwanted text
- Add additional notes manually

### Character Limit
- Maximum: **5,000 characters**
- Counter shows: Current / Maximum
- Color changes when approaching limit:
  - Green: Plenty of space
  - Yellow: Approaching limit (80%)
  - Red: At limit (100%)

---

## 5. Viewing Voice Notes

### In Case Details
After creating a case, voice notes are displayed:
1. Navigate to the case details page
2. Scroll to the **Voice Notes** section
3. All voice notes are shown with formatting preserved

### What You'll See
- All recorded voice notes
- Timestamps (if they were enabled)
- Clean, formatted text
- Easy-to-read layout

---

## Best Practices

### For Professional Documentation
1. ✅ Turn timestamps **OFF**
2. ✅ Record clear, concise notes
3. ✅ Use AI cleanup before submission
4. ✅ Review and edit as needed

### For Legal/Compliance
1. ✅ Turn timestamps **ON**
2. ✅ Record detailed observations
3. ✅ Keep original wording (skip AI cleanup)
4. ✅ Include all relevant details

### For Quick Notes
1. ✅ Timestamps don't matter (your choice)
2. ✅ Speak naturally (filler words removed automatically)
3. ✅ Edit manually if needed
4. ✅ Use AI cleanup for final polish

---

## Troubleshooting

### Voice Recording Not Working
- **Check microphone permissions** in browser settings
- **Use Chrome, Edge, or Safari** (Firefox not supported)
- **Check internet connection** (Web Speech API requires online)
- **Speak clearly** and close to microphone

### Filler Words Not Removed
- Filler word removal is automatic
- Some words may not be in the list
- You can manually edit to remove them
- Use AI cleanup for additional cleaning

### AI Cleanup Not Working
- **Check internet connection**
- **Verify Gemini API key** is configured
- **Try again** if it times out
- **Check error message** for details

### Timestamp Toggle Not Saving
- **Check browser localStorage** is enabled
- **Clear browser cache** if needed
- **Try different browser** if issue persists

---

## Keyboard Shortcuts

### Voice Recording
- **Ctrl+Enter**: Start new recording (when in text field)
- **Escape**: Stop recording (when recording)

### Text Editing
- **Ctrl+A**: Select all text
- **Ctrl+C**: Copy text
- **Ctrl+V**: Paste text
- **Ctrl+Z**: Undo (browser default)

---

## Tips and Tricks

### 1. Speak in Sentences
Instead of: "um damage front bumper uh needs repair"
Try: "The front bumper has damage and needs repair."

### 2. Use Pauses
Pause briefly between thoughts for better transcription accuracy.

### 3. Review Before Submitting
Always review voice notes before submitting the case.

### 4. Combine Recording and Typing
You can record some notes and type others - they all go in the same field.

### 5. Use AI Cleanup Sparingly
AI cleanup costs money (though minimal). Use it when you need professional formatting, not for every note.

---

## Privacy and Security

### Voice Data
- Voice is processed by browser's Web Speech API
- No audio is stored on servers
- Only text transcription is saved

### AI Cleanup
- Text is sent to Google Gemini for processing
- No personal data is stored by Gemini
- Text is only used for cleanup, not training

### Storage
- Voice notes are stored in the database
- Only accessible to authorized users
- Encrypted in transit and at rest

---

## Support

### Need Help?
- Contact your system administrator
- Check browser console for errors
- Review this guide for common issues

### Feature Requests
- Suggest improvements to your team lead
- Report bugs through proper channels

---

## Summary

Voice note improvements make your job easier:
- ✅ **Automatic filler word removal** - cleaner transcripts
- ✅ **Optional timestamps** - your choice
- ✅ **AI cleanup** - professional formatting
- ✅ **Easy editing** - full control

Start using these features today to create better, more professional case documentation!
