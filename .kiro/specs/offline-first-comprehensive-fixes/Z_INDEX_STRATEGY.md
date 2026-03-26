# Z-Index Strategy Documentation

## Overview
This document defines the z-index layering strategy for the Salvage Management System to ensure proper UI element stacking and prevent interaction conflicts.

## Visual Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                         Z-INDEX LAYERS                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  z-50  ┌──────────────────────────────────────────────┐    │
│        │           MODALS (Highest)                    │    │
│        │  - Payment modals                             │    │
│        │  - Confirmation dialogs                       │    │
│        │  - Error/Success modals                       │    │
│        │  - Any full-screen overlays                   │    │
│        └──────────────────────────────────────────────┘    │
│                                                               │
│  z-45  ┌──────────────────────────────────────────────┐    │
│        │      NAVIGATION (Mobile)                      │    │
│        │  - Hamburger menu button                      │    │
│        │  - Mobile sidebar                             │    │
│        │  - Mobile header                              │    │
│        └──────────────────────────────────────────────┘    │
│                                                               │
│  z-40  ┌──────────────────────────────────────────────┐    │
│        │      INFORMATIONAL OVERLAYS                   │    │
│        │  - Offline indicator banner                   │    │
│        │  - Offline indicator compact badge            │    │
│        │  - Mobile menu overlay backdrop               │    │
│        └──────────────────────────────────────────────┘    │
│                                                               │
│  z-30  ┌──────────────────────────────────────────────┐    │
│        │      DROPDOWNS & TOOLTIPS                     │    │
│        │  - Select dropdowns                           │    │
│        │  - Autocomplete suggestions                   │    │
│        │  - Tooltips                                   │    │
│        └──────────────────────────────────────────────┘    │
│                                                               │
│  z-0   ┌──────────────────────────────────────────────┐    │
│        │      REGULAR CONTENT (Base)                   │    │
│        │  - Page content                               │    │
│        │  - Cards                                      │    │
│        │  - Forms                                      │    │
│        │  - Tables                                     │    │
│        └──────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Z-Index Values

### Critical Layers

#### z-50: Modals (Highest Priority)
**Purpose**: Full-screen overlays that require immediate user attention

**Components**:
- Payment modals (`src/components/modals/`)
- Confirmation dialogs (`src/components/ui/confirmation-modal.tsx`)
- Error modals (`src/components/modals/error-modal.tsx`)
- Success modals (`src/components/modals/success-modal.tsx`)
- Result modals (`src/components/ui/result-modal.tsx`)
- Any component with `fixed inset-0` that needs to overlay everything

**Characteristics**:
- Blocks all interaction with underlying content
- Usually has a backdrop (semi-transparent overlay)
- Requires explicit user action to dismiss
- Should be used sparingly

**Example**:
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
  <div className="bg-white rounded-lg p-6">
    {/* Modal content */}
  </div>
</div>
```

---

#### z-45: Navigation (Mobile)
**Purpose**: Essential navigation elements that must always be accessible

**Components**:
- Mobile hamburger menu button (`src/components/layout/dashboard-sidebar.tsx`)
- Mobile sidebar (`src/components/layout/dashboard-sidebar.tsx`)
- Mobile header bar

**Characteristics**:
- Must be accessible at all times (except when modal is open)
- Should not block informational elements
- Should be below modals (modals take precedence)
- Only applies to mobile viewport (< 1024px)

**Example**:
```tsx
{/* Mobile Header */}
<div className="lg:hidden fixed top-0 left-0 right-0 z-45 bg-white">
  <button onClick={toggleMenu}>☰</button>
</div>

{/* Mobile Sidebar */}
<aside className="lg:hidden fixed top-0 left-0 bottom-0 w-64 bg-white z-45">
  {/* Navigation links */}
</aside>
```

**Note**: Custom utility class `.z-45` is defined in `src/app/globals.css`

---

#### z-40: Informational Overlays
**Purpose**: Non-blocking informational elements

**Components**:
- Offline indicator banner (`src/components/pwa/offline-indicator.tsx`)
- Offline indicator compact badge
- Mobile menu overlay backdrop
- Toast notifications (bottom-right)

**Characteristics**:
- Provides information without blocking critical functionality
- Can be dismissed by user
- Should not interfere with navigation
- Should be below navigation and modals

**Example**:
```tsx
{/* Offline Indicator Banner */}
<div className="fixed top-0 left-0 right-0 z-40 bg-yellow-500">
  <span>You're offline</span>
  <button onClick={dismiss}>×</button>
</div>

{/* Compact Badge */}
<button className="fixed top-4 right-4 z-40 bg-yellow-500 rounded-full">
  <WifiOff />
</button>
```

---

#### z-30: Dropdowns & Tooltips
**Purpose**: Contextual UI elements that appear on demand

**Components**:
- Select dropdowns
- Autocomplete suggestions (`src/components/ui/filters/location-autocomplete.tsx`)
- Tooltips
- Popovers
- Context menus

**Characteristics**:
- Appears on user interaction
- Should overlay regular content
- Should be below informational overlays
- Usually positioned relative to trigger element

**Example**:
```tsx
<div className="relative">
  <input type="text" />
  <div className="absolute z-30 w-full mt-1 bg-white border rounded-lg shadow-lg">
    {/* Dropdown options */}
  </div>
</div>
```

---

#### z-0 to z-10: Regular Content
**Purpose**: Base layer for all page content

**Components**:
- Page content
- Cards
- Forms
- Tables
- Images
- Text

**Characteristics**:
- Default stacking context
- No special z-index needed (use z-0 or omit)
- Should not use high z-index values

---

## Implementation Guidelines

### 1. When to Use Each Layer

| Use Case | Z-Index | Example |
|----------|---------|---------|
| Full-screen modal that blocks everything | `z-50` | Payment confirmation |
| Mobile navigation that must be accessible | `z-45` | Hamburger menu |
| Informational banner that can be dismissed | `z-40` | Offline indicator |
| Dropdown that appears on click | `z-30` | Select dropdown |
| Regular page content | `z-0` | Cards, forms, text |

### 2. Adding New Components

When adding a new component, ask:

1. **Does it need to block all interaction?**
   - Yes → Use `z-50` (modal)
   - No → Continue to next question

2. **Is it essential navigation?**
   - Yes → Use `z-45` (navigation)
   - No → Continue to next question

3. **Is it informational but non-blocking?**
   - Yes → Use `z-40` (informational)
   - No → Continue to next question

4. **Does it appear on user interaction?**
   - Yes → Use `z-30` (dropdown/tooltip)
   - No → Use `z-0` (regular content)

### 3. Common Pitfalls to Avoid

❌ **Don't use arbitrary high z-index values**
```tsx
// BAD
<div className="z-[9999]">...</div>
```

✅ **Use the defined strategy**
```tsx
// GOOD
<div className="z-50">...</div>
```

---

❌ **Don't use z-index for non-positioned elements**
```tsx
// BAD - z-index has no effect without position
<div className="z-50">...</div>
```

✅ **Always use with position**
```tsx
// GOOD
<div className="fixed z-50">...</div>
<div className="absolute z-30">...</div>
<div className="relative z-10">...</div>
```

---

❌ **Don't create z-index conflicts**
```tsx
// BAD - Modal and sidebar at same level
<div className="fixed z-50">Modal</div>
<aside className="fixed z-50">Sidebar</aside>
```

✅ **Follow the hierarchy**
```tsx
// GOOD
<div className="fixed z-50">Modal</div>
<aside className="fixed z-45">Sidebar</aside>
```

### 4. Testing Z-Index

When implementing or modifying z-index:

1. **Test on mobile devices** (iOS Safari, Android Chrome)
2. **Test with multiple layers open** (modal + sidebar + offline indicator)
3. **Test screen size transitions** (desktop → mobile)
4. **Test interaction** (can you click what you need to?)
5. **Test accessibility** (keyboard navigation, screen readers)

### 5. Custom Z-Index Values

If you need a custom z-index value (like `z-45`), add it to `src/app/globals.css`:

```css
@layer utilities {
  .z-45 {
    z-index: 45;
  }
}
```

**When to add custom values**:
- Only when the standard Tailwind values don't fit the strategy
- Document the reason in this file
- Use sparingly to maintain simplicity

## Troubleshooting

### Problem: Element is not appearing above another

**Check**:
1. Is the element positioned? (`fixed`, `absolute`, `relative`)
2. Is the z-index value correct according to the strategy?
3. Is there a parent with a lower z-index creating a stacking context?
4. Are both elements in the same stacking context?

**Solution**:
- Add position class: `fixed`, `absolute`, or `relative`
- Use the correct z-index from the strategy
- Check parent elements for z-index values
- Consider the stacking context hierarchy

### Problem: Modal is not blocking sidebar

**Check**:
1. Modal should be `z-50`
2. Sidebar should be `z-45`
3. Modal should have a backdrop

**Solution**:
```tsx
{/* Modal with backdrop */}
<div className="fixed inset-0 z-50 bg-black/50">
  <div className="bg-white rounded-lg p-6">
    {/* Modal content */}
  </div>
</div>
```

### Problem: Offline indicator blocking navigation

**Check**:
1. Offline indicator should be `z-40`
2. Navigation should be `z-45`
3. Both should be positioned (`fixed`)

**Solution**:
- Ensure offline indicator is `z-40`
- Ensure navigation is `z-45`
- Verify both have `fixed` positioning

## Browser Compatibility

This z-index strategy is compatible with:
- ✅ Chrome/Edge (all versions)
- ✅ Firefox (all versions)
- ✅ Safari (all versions)
- ✅ iOS Safari (all versions)
- ✅ Android Chrome (all versions)

Z-index is a well-supported CSS property with no compatibility issues.

## Maintenance

### When to Update This Document

Update this document when:
1. Adding a new z-index layer
2. Changing the z-index strategy
3. Adding new component types
4. Discovering edge cases or issues

### Review Schedule

Review this strategy:
- When adding major new features
- During UI/UX audits
- When z-index conflicts are reported
- Quarterly as part of code quality review

## References

- **Task**: 1.1 Update z-index strategy
- **Spec**: offline-first-comprehensive-fixes
- **Implementation**: 
  - `src/components/layout/dashboard-sidebar.tsx`
  - `src/components/pwa/offline-indicator.tsx`
  - `src/app/globals.css`
- **Tests**: `tests/manual/test-z-index-strategy.md`

---

**Last Updated**: 2024  
**Maintained By**: Development Team  
**Status**: ✅ ACTIVE
