# Modern Theme System

A comprehensive theme system for the Voice Note UI Modernization project, implementing 2026 design standards while preserving the brand color (#800020).

## Features

- **Modern Color Palette**: Semantic color system with voice-specific colors
- **Typography Scale**: Contemporary typography with variable fonts (Inter, JetBrains Mono)
- **Responsive Spacing**: 4px-based grid system for consistent spacing
- **Border Radius & Shadows**: Modern design elements with smooth transitions
- **Animation System**: Smooth, performant animations with reduced motion support
- **Accessibility**: WCAG 2.1 AA compliance with high contrast theme support
- **Theme Modes**: Light, dark, high-contrast, and auto-detection

## Usage

### Basic Theme Usage

```typescript
import { getTheme, applyTheme, useTheme } from '@/lib/theme/modern-theme';

// Get a specific theme
const lightTheme = getTheme('light');
const darkTheme = getTheme('dark');
const highContrastTheme = getTheme('high-contrast');

// Auto-detect based on system preferences
const autoTheme = getTheme('auto');

// Apply theme to document
applyTheme(lightTheme);

// Use in React components
function MyComponent() {
  const theme = useTheme('auto'); // Automatically applies theme
  
  return (
    <div style={{ 
      backgroundColor: theme.colors.surface,
      color: theme.colors.text.primary 
    }}>
      Content
    </div>
  );
}
```

### Voice Component Integration

```typescript
import { useVoiceTheme, voiceThemeClasses } from '@/lib/theme/voice-theme-integration';

function VoiceRecordingButton({ isRecording }: { isRecording: boolean }) {
  const voiceTheme = useVoiceTheme();
  const colors = voiceTheme.getVoiceColors();
  
  return (
    <button
      className={cn(
        voiceThemeClasses.container,
        isRecording ? voiceThemeClasses.recordingButton : voiceThemeClasses.idleButton
      )}
      style={{
        backgroundColor: isRecording ? colors.recording : colors.idle
      }}
    >
      {isRecording ? 'Recording...' : 'Start Recording'}
    </button>
  );
}
```

### CSS Custom Properties

The theme system generates CSS custom properties that can be used in stylesheets:

```css
.voice-button {
  background-color: var(--color-voice-recording);
  border-radius: var(--border-radius-full);
  padding: var(--spacing-3) var(--spacing-6);
  font-family: var(--font-family-sans);
  font-size: var(--font-size-base);
  box-shadow: var(--shadow-md);
  transition: all var(--animation-duration-normal) var(--animation-easing-ease);
}

.voice-button:hover {
  background-color: var(--color-primary-hover);
  box-shadow: var(--shadow-lg);
}
```

### Tailwind CSS Integration

Use theme variables with Tailwind CSS:

```jsx
<div className="bg-[var(--color-surface)] text-[var(--color-text-primary)] p-[var(--spacing-4)] rounded-[var(--border-radius-lg)]">
  <button className="bg-[var(--color-voice-recording)] hover:bg-[var(--color-primary-hover)] px-[var(--spacing-6)] py-[var(--spacing-3)] rounded-[var(--border-radius-full)] font-[var(--font-weight-medium)] transition-all duration-[var(--animation-duration-normal)]">
    Record Voice Note
  </button>
</div>
```

## Theme Structure

### Colors

- **Brand Colors**: Primary (#800020), hover, and active states
- **Voice Colors**: Recording, processing, success, error, idle states
- **Semantic Colors**: Success, warning, error, info
- **Surface Colors**: Background, surface, elevated surface
- **Text Colors**: Primary, secondary, tertiary, disabled, inverse
- **Border Colors**: Default, subtle, strong

### Typography

- **Font Families**: Sans-serif (Inter), Monospace (JetBrains Mono)
- **Font Sizes**: xs (12px) to 3xl (30px)
- **Font Weights**: Normal (400) to Bold (700)
- **Line Heights**: Tight (1.25) to Relaxed (1.75)

### Spacing

4px-based scale from 0px to 128px:
- `0`: 0px
- `1`: 4px
- `2`: 8px
- `3`: 12px
- `4`: 16px
- `5`: 20px
- `6`: 24px
- `8`: 32px
- `10`: 40px
- `12`: 48px
- `16`: 64px
- `20`: 80px
- `24`: 96px
- `32`: 128px

### Border Radius

- `none`: 0px
- `sm`: 4px
- `md`: 8px
- `lg`: 12px
- `xl`: 16px
- `2xl`: 24px
- `full`: 9999px

### Shadows

Modern shadow system with appropriate opacity for each theme:
- `sm`: Subtle shadow for small elements
- `md`: Standard shadow for cards and buttons
- `lg`: Prominent shadow for modals and dropdowns
- `xl`: Large shadow for floating elements
- `2xl`: Extra large shadow for major UI elements
- `inner`: Inset shadow for pressed states

### Animations

- **Durations**: Fast (150ms), Normal (300ms), Slow (500ms)
- **Easing**: Cubic-bezier functions for smooth transitions

## Theme Modes

### Light Theme
Clean, modern design with high contrast for accessibility.

### Dark Theme
Modern dark theme with proper contrast ratios and adjusted brand colors.

### High Contrast Theme
Enhanced contrast for accessibility compliance (WCAG 2.1 AAA).

### Auto Theme
Automatically detects system preferences:
1. Checks for high contrast preference
2. Checks for dark mode preference
3. Falls back to light theme

## Accessibility

- WCAG 2.1 AA compliance across all themes
- High contrast theme for AAA compliance
- Reduced motion support in animations
- Semantic color naming for screen readers
- Proper contrast ratios for all text combinations

## Integration with Existing Components

The theme system is designed to work with existing voice note components:

- `ModernVoiceControls`
- `UnifiedVoiceField`
- `VoiceErrorRecovery`
- `TranscriptionOverlay`

Use the `voice-theme-integration.ts` utilities for seamless integration.

## CSS Variables Reference

All theme values are available as CSS custom properties with the `--` prefix:

- Colors: `--color-primary`, `--color-voice-recording`, etc.
- Typography: `--font-family-sans`, `--font-size-base`, etc.
- Spacing: `--spacing-4`, `--spacing-8`, etc.
- Border Radius: `--border-radius-md`, `--border-radius-full`, etc.
- Shadows: `--shadow-md`, `--shadow-lg`, etc.
- Animations: `--animation-duration-normal`, `--animation-easing-ease`, etc.

## Brand Color Preservation

The original brand color (#800020) is preserved in the light theme and adapted appropriately for dark and high contrast themes while maintaining brand recognition.