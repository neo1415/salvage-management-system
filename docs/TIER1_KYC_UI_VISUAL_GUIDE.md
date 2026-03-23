# Tier 1 KYC UI - Visual Guide

## Page Layout Overview

```
┌─────────────────────────────────────────────────────────────┐
│  [← Back]                                                    │
│                                                              │
│                    [Shield Icon]                             │
│              Tier 1 Verification                             │
│        Verify your identity with BVN to start bidding       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                       │   │
│  │  ╔═══════════════════════════════════════════════╗  │   │
│  │  ║         Tier 1 Benefits (Burgundy BG)        ║  │   │
│  │  ╠═══════════════════════════════════════════════╣  │   │
│  │  ║  ✓ Instant Approval    ✓ Bid up to ₦500k   ║  │   │
│  │  ║  ✓ Secure & Private    ✓ Build Reputation   ║  │   │
│  │  ╚═══════════════════════════════════════════════╝  │   │
│  │                                                       │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │ ℹ️ Why do we need your BVN?                 │    │   │
│  │  │ Your BVN helps us verify your identity...   │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  │                                                       │   │
│  │  Bank Verification Number (BVN) *                    │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │ [___________] 0/11                      🔒   │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  │  Your BVN is encrypted and secure                    │   │
│  │                                                       │   │
│  │  Confirm Your Date of Birth *                        │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │ [YYYY-MM-DD]                                 │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  │  This must match your BVN registration DOB           │   │
│  │                                                       │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │  🛡️  Verify My Identity                     │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  │                                                       │   │
│  │  🔒 Your data is secure                              │   │
│  │  We use bank-grade encryption (AES-256)...          │   │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│         Need help? Contact Support                           │
└─────────────────────────────────────────────────────────────┘
```

## State Variations

### 1. Initial State (Empty Form)
- BVN input: Empty, showing placeholder
- DOB input: Empty
- Submit button: **Disabled** (gray)
- No error messages

### 2. Filling Form
```
BVN Input: [12345678901] ✓  11/11
DOB Input: [1990-01-01] ✓
Submit button: **Enabled** (Gold #FFD700)
```

### 3. Verifying State
```
┌─────────────────────────────────────────────────────┐
│ ⏳ Verifying your BVN...                            │
│                                                      │
│ • Connecting to Paystack Identity API               │
│ • Verifying BVN details                             │
│ • Matching with your registration information       │
└─────────────────────────────────────────────────────┘
```

### 4. Error State (Mismatch)
```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Verification Failed                              │
│                                                      │
│ The BVN details do not match your registration      │
│ information.                                         │
│                                                      │
│ ┌─────────────────────────────────────────────┐    │
│ │ Match Score: 65%                             │    │
│ │                                               │    │
│ │ Details that don't match:                    │    │
│ │ • First name mismatch: "John" vs "Jonathan"  │    │
│ │ • Date of birth mismatch: "1990-01-01" vs    │    │
│ │   "1990-01-15"                                │    │
│ │                                               │    │
│ │ Please ensure your name, date of birth, and  │    │
│ │ phone number match your BVN records exactly. │    │
│ └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### 5. Success State
```
┌─────────────────────────────────────────────────────┐
│                      ✅                              │
│                                                      │
│          🎉 Verification Complete!                   │
│                                                      │
│              🏆 Tier 1 Verified                      │
│                                                      │
│  Congratulations! Your BVN has been successfully    │
│  verified. You can now bid up to ₦500,000.          │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ What You Can Do Now:                         │   │
│  │ ✓ Browse all available salvage auctions     │   │
│  │ ✓ Place bids up to ₦500,000                 │   │
│  │ ✓ Win auctions and pay instantly            │   │
│  │ ✓ Build your vendor reputation              │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ 📈 Want to Bid Higher?                       │   │
│  │ Upgrade to Tier 2 to unlock unlimited       │   │
│  │ bidding on high-value items above ₦500,000. │   │
│  │ Learn about Tier 2 →                         │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  Redirecting you to dashboard in a moment...        │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │         Go to Dashboard                      │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Color Coding

### Background Colors
- **Page Background**: Gradient from Burgundy (#800020) to Dark Burgundy (#600018)
- **Card Background**: White (#FFFFFF)
- **Benefits Section**: Burgundy gradient
- **Info Box**: Blue-50 (#EFF6FF)
- **Error Box**: Red-50 (#FEF2F2)
- **Success Box**: Green-50 (#F0FDF4)
- **Warning Box**: Yellow-50 (#FEFCE8)

### Text Colors
- **Primary Text**: Gray-900 (#111827)
- **Secondary Text**: Gray-600 (#4B5563)
- **White Text**: White (#FFFFFF) - on burgundy background
- **Error Text**: Red-700 (#B91C1C)
- **Success Text**: Green-700 (#15803D)
- **Info Text**: Blue-700 (#1D4ED8)

### Button Colors
- **Primary Button**: Gold (#FFD700) with Burgundy text
- **Hover State**: Lighter Gold (#FFC700)
- **Disabled State**: 50% opacity

### Border Colors
- **Default**: Gray-300 (#D1D5DB)
- **Focus**: Burgundy (#800020)
- **Error**: Red-500 (#EF4444)
- **Success**: Green-500 (#22C55E)

## Responsive Breakpoints

### Mobile (< 640px)
- Single column layout
- Full-width inputs
- Stacked benefit cards
- Larger touch targets (44px minimum)

### Tablet (640px - 1024px)
- Two-column benefit grid
- Wider form inputs
- More padding

### Desktop (> 1024px)
- Centered card (max-width: 672px)
- Two-column benefit grid
- Optimal reading width

## Icons Used

- **Shield**: Main page icon (verification)
- **CheckCircle2**: Success indicators
- **AlertCircle**: Error indicators
- **Info**: Information messages
- **Lock**: Security indicators
- **Award**: Tier 1 badge
- **TrendingUp**: Upgrade prompt
- **ArrowLeft**: Back button
- **Loader2**: Loading spinner
- **Phone**: Contact support

## Typography

### Headings
- **H1**: 3xl (30px) on mobile, 3xl (30px) on desktop
- **H2**: 2xl (24px) on mobile, 2xl (24px) on desktop
- **H3**: xl (20px)

### Body Text
- **Regular**: base (16px)
- **Small**: sm (14px)
- **Extra Small**: xs (12px)

### Font Weights
- **Bold**: 700 (headings, buttons)
- **Semibold**: 600 (labels)
- **Medium**: 500 (secondary text)
- **Regular**: 400 (body text)

## Animations

### Loading Spinner
- Continuous rotation
- Blue color (#2563EB)
- 20px size

### Progress Dots
- Pulsing animation
- Staggered delays (0s, 0.2s, 0.4s)
- Blue color

### Success Celebration
- Fade in animation
- Scale up effect
- Green checkmark

### Form Validation
- Smooth color transitions
- Icon fade in/out
- Border color changes

## Accessibility Features

1. **Keyboard Navigation**
   - Tab through all interactive elements
   - Enter to submit form
   - Escape to close modals

2. **Screen Reader Support**
   - Proper ARIA labels
   - Form field descriptions
   - Error announcements

3. **Color Contrast**
   - All text meets WCAG 2.1 Level A
   - Minimum 4.5:1 ratio for body text
   - Minimum 3:1 ratio for large text

4. **Focus Indicators**
   - Visible focus rings
   - High contrast outlines
   - Consistent styling

## Mobile-Specific Features

1. **Touch Optimization**
   - Large tap targets (minimum 44x44px)
   - Adequate spacing between elements
   - No hover-dependent interactions

2. **Input Types**
   - `inputMode="numeric"` for BVN
   - `type="date"` for DOB
   - Native mobile keyboards

3. **Viewport Optimization**
   - Responsive font sizes
   - Flexible layouts
   - No horizontal scrolling

4. **Performance**
   - Minimal JavaScript
   - Optimized images
   - Fast load times

## Security Indicators

1. **BVN Encryption Notice**
   - 🔒 icon
   - "Your BVN is encrypted and secure"
   - Displayed below BVN input

2. **Data Security Section**
   - 🔒 icon
   - "Your data is secure"
   - Explains AES-256 encryption
   - NDPR compliance mention

3. **Privacy Information**
   - ℹ️ icon
   - "Why do we need your BVN?"
   - Explains verification process
   - Mentions Paystack secure API

## User Journey

```
Start → Authentication Check → Form Display → Fill BVN → Fill DOB
  ↓
Enable Submit Button → Click Submit → Show Progress → API Call
  ↓
Success? → Yes → Show Success → Auto Redirect (3s) → Dashboard
  ↓
  No → Show Error → Display Mismatches → Allow Retry
```

## Error Messages

### Validation Errors
- "Please enter a valid 11-digit BVN"
- "Please confirm your date of birth"

### API Errors
- "BVN verification failed"
- "The BVN details do not match your registration information"
- "Unable to verify BVN. Please try again."

### Network Errors
- "Network error. Please check your connection."
- "Request timeout. Please try again."

### Authentication Errors
- "Unauthorized. Please login to continue."
- "Session expired. Please login again."

---

This visual guide provides a comprehensive overview of the Tier 1 KYC UI design, layout, and user experience.
