# Mobile Auction/Marketplace Listing Page Design Best Practices 2026

**Research Date:** January 2026  
**Focus:** Modern mobile-first design for auction and marketplace listing pages

---

## Executive Summary

This document provides code-ready specifications and actionable recommendations for designing modern mobile auction/marketplace listing pages based on 2026 industry standards, including Material Design 3, iOS Human Interface Guidelines, WCAG 2.2 accessibility standards, and real-world implementations from leading marketplace apps.

**Key Findings:**
- **Touch targets:** Minimum 48×48dp (Android) / 44×44pt (iOS), recommended 48×48px for universal compliance
- **Layout:** Context-dependent - single column for <20 products, 2-column for larger catalogs
- **Card aspect ratios:** 1:1 (square) and 4:5 (portrait) dominate mobile-first design in 2026
- **Micro-interactions:** 100-300ms timing range for optimal perceived performance
- **Skeleton screens:** Reduce perceived load time by 10-40% vs spinners

---

## 1. Card Layout & Grid Systems

### 1.1 Single Column vs 2-Column Grid Decision Matrix

**Use Single Column When:**
- Product catalog has <10-20 items per page
- Sales concentrated in 1-2 hero products
- Premium/luxury positioning requiring focus
- Complex product information needs larger display area
- Minimalist brand aesthetic

**Use 2-Column Grid When:**
- Product catalog has >20 items
- Sales distributed across multiple products
- Users need quick comparison capabilities
- Faster browsing and reduced scrolling is priority
- Standard e-commerce positioning

**Research Evidence:**
- Single column test: Notable conversion improvement for focused, small catalogs
- 2-column test: 12% conversion increase for distributed product catalogs
- 2-column improves product findability and sales distribution

### 1.2 Grid Specifications (Material Design 3 Based)

**Mobile Grid System:**
```css
/* Breakpoints */
--mobile-small: 360px;    /* Minimum supported */
--mobile-medium: 375px;   /* iPhone standard */
--mobile-large: 414px;    /* Large phones */

/* Grid Configuration */
--grid-columns-mobile: 4;
--grid-gutter: 16px;      /* Space between cards */
--grid-margin: 16px;      /* Screen edge margins */

/* 2-Column Layout */
.grid-2col {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding: 16px;
}

/* Single Column Layout */
.grid-1col {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;              /* Slightly larger for breathing room */
  padding: 16px;
}
```

### 1.3 Card Dimensions & Aspect Ratios

**Recommended Aspect Ratios (2026 Mobile-First Standard):**

1. **1:1 (Square)** - Universal standard, maximum compatibility
   - Dimensions: 1080×1080px (design), scales to card width
   - Best for: Product photos, uniform catalogs
   - Used by: Instagram, most e-commerce

2. **4:5 (Portrait)** - Preferred for mobile feed visibility
   - Dimensions: 1080×1350px (design)
   - Best for: Maximum vertical screen space, fashion, real estate
   - Occupies 20% more screen real estate than square

3. **16:9 (Landscape)** - Secondary option
   - Dimensions: 1080×608px
   - Best for: Video thumbnails, wide products (cars, furniture)

**Implementation:**
```css
/* Responsive card image container */
.card-image {
  width: 100%;
  aspect-ratio: 1 / 1;        /* Default square */
  object-fit: cover;
  border-radius: 12px 12px 0 0;
}

.card-image--portrait {
  aspect-ratio: 4 / 5;
}

.card-image--landscape {
  aspect-ratio: 16 / 9;
}
```

### 1.4 Spacing Standards

**Vertical Rhythm:**
```css
--space-xs: 4px;    /* Icon-to-text */
--space-sm: 8px;    /* Related elements */
--space-md: 12px;   /* Section separation within card */
--space-lg: 16px;   /* Card padding */
--space-xl: 20px;   /* Card-to-card (single column) */
--space-2xl: 24px;  /* Major section breaks */
```

**Card Internal Padding:**
```css
.card {
  padding: 16px;              /* Standard */
  border-radius: 12px;        /* Modern rounded corners */
}

.card-compact {
  padding: 12px;              /* Dense layouts */
}
```

---

## 2. Card Content & Information Hierarchy

### 2.1 Optimal Data Points Per Card

**Essential Information (Always Visible):**
1. **Product Image** (hero element)
2. **Title/Name** (1-2 lines max, truncate with ellipsis)
3. **Current Price/Bid** (largest, most prominent)
4. **Time Remaining** (for auctions - creates urgency)
5. **Primary CTA** (one clear action)

**Optional/Secondary Information:**
- Starting price (crossed out if bid placed)
- Number of bids/watchers
- Seller rating/badge
- Location/shipping info
- Condition indicator
- Save/favorite icon (secondary action)

**Maximum Recommendation:** 5-7 data points total to avoid cognitive overload

### 2.2 Typography Hierarchy

**Type Scale (Mobile Optimized):**
```css
/* Card Typography System */
.card-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: -0.01em;
  color: #1a1a1a;
  /* Truncate to 2 lines */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-price {
  font-size: 20px;          /* Largest element */
  font-weight: 700;
  line-height: 1.2;
  color: #1a1a1a;
}

.card-price--auction {
  color: #d32f2f;           /* Red for urgency */
}

.card-metadata {
  font-size: 13px;
  font-weight: 400;
  line-height: 1.4;
  color: #666666;
}

.card-timer {
  font-size: 14px;
  font-weight: 500;
  color: #d32f2f;           /* Urgency color */
}

.card-description {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
  color: #4a4a4a;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

**Minimum Font Sizes (Accessibility):**
- Body text: 14px minimum
- Metadata: 13px minimum (never below 12px)
- Touch target labels: 16px recommended

### 2.3 Icon Usage & Placement

**Icon Specifications:**
```css
.icon-sm { width: 16px; height: 16px; }  /* Inline with text */
.icon-md { width: 20px; height: 20px; }  /* Standalone metadata */
.icon-lg { width: 24px; height: 24px; }  /* Action buttons */
```

**Common Icon Patterns:**
- **Top-right corner:** Favorite/save (heart icon)
- **Bottom-right corner:** Quick action (bid, buy now)
- **Inline with metadata:** Location pin, clock, user count
- **Badge overlay (top-left):** Status indicators (NEW, ENDING SOON)

**Icon + Text Spacing:**
```css
.icon-text-group {
  display: flex;
  align-items: center;
  gap: 4px;                 /* Tight coupling */
}
```

---

## 3. Visual Design Trends 2026

### 3.1 Modern Design Systems

**Material Design 3 (2026):**
- Dynamic color system with user personalization
- Emphasis on elevation through shadows (not flat)
- Rounded corners: 12-16px for cards
- Adaptive layouts with responsive breakpoints

**iOS Human Interface Guidelines (2026):**
- Minimum touch target: 44×44pt
- SF Pro font family for consistency
- Emphasis on clarity and depth
- Liquid Glass Design Language emerging

### 3.2 Glassmorphism vs Neumorphism

**Glassmorphism (Recommended for 2026):**
- **Status:** Mainstream adoption, performance-optimized
- **Use cases:** Overlays, modals, floating elements, premium features
- **Key characteristics:** Translucency, backdrop blur, subtle borders

```css
.glass-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

/* Dark mode variant */
.glass-card--dark {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

**Neumorphism (Use Sparingly):**
- **Status:** Niche use, accessibility concerns
- **Use cases:** Tactile controls, premium apps, specific brand aesthetics
- **Limitations:** Poor contrast, not WCAG compliant by default

```css
.neomorphic-card {
  background: #e0e5ec;
  box-shadow: 
    9px 9px 16px rgba(163, 177, 198, 0.6),
    -9px -9px 16px rgba(255, 255, 255, 0.5);
  border-radius: 16px;
}
```

**2026 Recommendation:** Use standard elevated cards with subtle shadows for main content. Reserve glassmorphism for overlays and special UI elements.

### 3.3 Color Psychology for Auctions/Urgency

**Urgency Colors (Research-Backed):**
```css
/* Primary urgency - Red spectrum */
--urgent-red: #d32f2f;        /* Ending soon, low stock */
--urgent-orange: #f57c00;     /* Moderate urgency */

/* Trust & stability - Blue spectrum */
--trust-blue: #1976d2;        /* Primary actions */
--trust-dark-blue: #0d47a1;   /* Premium/verified */

/* Success & growth - Green spectrum */
--success-green: #388e3c;     /* Winning bid, completed */
--growth-green: #43a047;      /* Price drops, deals */

/* Warning - Yellow/Amber */
--warning-amber: #f9a825;     /* Attention needed */

/* Neutral - Gray spectrum */
--neutral-dark: #1a1a1a;      /* Primary text */
--neutral-medium: #666666;    /* Secondary text */
--neutral-light: #e0e0e0;     /* Borders, dividers */
```

**Application Guidelines:**
- **Red:** Time-sensitive elements (countdown timers, "Ending in 2h")
- **Orange:** Call-to-action buttons for bidding
- **Blue:** Trust signals (verified sellers, secure payment)
- **Green:** Positive feedback (winning status, price drops)

### 3.4 Shadow & Elevation Patterns

**Elevation System (Material Design 3):**
```css
/* Level 1: Resting cards */
.elevation-1 {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12),
              0 1px 2px rgba(0, 0, 0, 0.24);
}

/* Level 2: Hover/focus state */
.elevation-2 {
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15),
              0 2px 4px rgba(0, 0, 0, 0.12);
  transition: box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Level 3: Active/pressed state */
.elevation-3 {
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15),
              0 3px 6px rgba(0, 0, 0, 0.10);
}

/* Level 4: Modals and overlays */
.elevation-4 {
  box-shadow: 0 15px 25px rgba(0, 0, 0, 0.15),
              0 5px 10px rgba(0, 0, 0, 0.05);
}
```

**Interaction Pattern:**
```css
.card {
  box-shadow: var(--elevation-1);
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.card:hover {
  box-shadow: var(--elevation-2);
  transform: translateY(-2px);
}

.card:active {
  box-shadow: var(--elevation-3);
  transform: translateY(0);
}
```

### 3.5 Border Radius Standards

**2026 Rounded Corner Guidelines:**
```css
--radius-sm: 8px;     /* Small elements, chips */
--radius-md: 12px;    /* Standard cards */
--radius-lg: 16px;    /* Large cards, modals */
--radius-xl: 20px;    /* Hero elements */
--radius-full: 9999px; /* Pills, avatars */
```

**Card Implementation:**
```css
.card {
  border-radius: 12px;
  overflow: hidden;     /* Ensures image respects radius */
}

.card-image {
  border-radius: 12px 12px 0 0;  /* Top corners only */
}

.card-button {
  border-radius: 8px;   /* Slightly less than card */
}
```

---

## 4. Navigation & Filters

### 4.1 Tab Navigation Patterns

**Three Main Styles (2026):**

**1. Pills (Recommended for Mobile):**
```css
.tab-pills {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  overflow-x: auto;
  scrollbar-width: none;
}

.tab-pill {
  padding: 8px 16px;
  border-radius: 20px;
  background: #f5f5f5;
  color: #666;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  transition: all 200ms ease;
}

.tab-pill--active {
  background: #1976d2;
  color: white;
}
```

**2. Underline (iOS Native Style):**
```css
.tab-underline {
  display: flex;
  border-bottom: 1px solid #e0e0e0;
}

.tab-item {
  padding: 12px 16px;
  color: #666;
  font-size: 15px;
  position: relative;
  transition: color 200ms ease;
}

.tab-item--active {
  color: #1976d2;
}

.tab-item--active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: #1976d2;
  animation: slideIn 200ms ease;
}
```

**3. Segmented Control (iOS Compact):**
```css
.segmented-control {
  display: flex;
  background: #f5f5f5;
  border-radius: 10px;
  padding: 2px;
  margin: 12px 16px;
}

.segment {
  flex: 1;
  padding: 8px 12px;
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  border-radius: 8px;
  transition: all 200ms ease;
}

.segment--active {
  background: white;
  color: #1a1a1a;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
```

### 4.2 Filter UI Patterns

**Bottom Sheet (Recommended for Mobile - Nielsen Norman Group):**

**Advantages:**
- Preserves context of main content
- Easy to dismiss (swipe down)
- Familiar mobile pattern
- Supports complex filter sets

**Implementation:**
```css
.filter-bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  border-radius: 20px 20px 0 0;
  max-height: 80vh;
  transform: translateY(100%);
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
}

.filter-bottom-sheet--open {
  transform: translateY(0);
}

.filter-handle {
  width: 40px;
  height: 4px;
  background: #d0d0d0;
  border-radius: 2px;
  margin: 12px auto 8px;
}

.filter-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0;
  transition: opacity 300ms ease;
  pointer-events: none;
}

.filter-backdrop--visible {
  opacity: 1;
  pointer-events: auto;
}
```

**Critical Guidelines (NN/g Research):**
- Always include visible Close/X button (don't rely only on swipe)
- Support Back button for dismissal
- Never stack multiple bottom sheets
- Use for short interactions only (<30 seconds)

**Alternative: Inline Filters (Simple Cases):**
```css
.filter-inline {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  overflow-x: auto;
  background: white;
  border-bottom: 1px solid #e0e0e0;
}

.filter-chip {
  padding: 6px 12px;
  border: 1px solid #d0d0d0;
  border-radius: 16px;
  font-size: 13px;
  white-space: nowrap;
}

.filter-chip--active {
  background: #1976d2;
  color: white;
  border-color: #1976d2;
}
```

### 4.3 Search Bar Placement & Behavior

**Sticky Header Pattern (Recommended):**
```css
.search-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: white;
  padding: 12px 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}

.search-input {
  width: 100%;
  padding: 10px 16px 10px 40px;
  border: 1px solid #e0e0e0;
  border-radius: 24px;
  font-size: 15px;
  background-image: url('search-icon.svg');
  background-position: 12px center;
  background-repeat: no-repeat;
  background-size: 20px;
}

.search-input:focus {
  outline: none;
  border-color: #1976d2;
  box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
}
```

**Expandable Search (Space-Saving):**
```css
.search-compact {
  width: 44px;
  height: 44px;
  border-radius: 22px;
  transition: width 300ms ease;
}

.search-compact--expanded {
  width: 100%;
  border-radius: 24px;
}
```

### 4.4 Sticky Headers & Scroll Behavior

**Performance-Optimized Sticky:**
```css
.sticky-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: white;
  will-change: transform;  /* GPU acceleration */
}

/* Hide on scroll down, show on scroll up */
.sticky-header--hidden {
  transform: translateY(-100%);
  transition: transform 300ms ease;
}
```

**JavaScript Pattern:**
```javascript
let lastScroll = 0;
const header = document.querySelector('.sticky-header');

window.addEventListener('scroll', () => {
  const currentScroll = window.pageYOffset;
  
  if (currentScroll > lastScroll && currentScroll > 100) {
    header.classList.add('sticky-header--hidden');
  } else {
    header.classList.remove('sticky-header--hidden');
  }
  
  lastScroll = currentScroll;
}, { passive: true });
```

---

## 5. Interaction Patterns

### 5.1 Touch Target Sizes (2026 Accessibility Standards)

**WCAG 2.2 Requirements:**
- **Minimum:** 24×24px (Level AA)
- **Recommended:** 44×44px (iOS) / 48×48px (Android)
- **Best practice:** 48×48px for universal compliance

**Implementation:**
```css
/* Minimum touch target */
.touch-target {
  min-width: 48px;
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Visual element can be smaller, but hit area must be 48px */
.icon-button {
  width: 48px;
  height: 48px;
  padding: 12px;  /* Creates 48px hit area for 24px icon */
}

/* Spacing between touch targets */
.touch-target + .touch-target {
  margin-left: 8px;  /* Minimum 8px spacing */
}
```

**Common Violations to Avoid:**
- Close buttons <44px
- Favorite/heart icons <44px
- Filter chips with insufficient padding
- Densely packed action buttons

### 5.2 Swipe Gestures

**Standard Swipe Actions:**
```javascript
// Swipe to reveal actions (e.g., delete, archive)
const SWIPE_THRESHOLD = 80;  // pixels
const SWIPE_VELOCITY = 0.3;  // px/ms

let startX, startTime;

card.addEventListener('touchstart', (e) => {
  startX = e.touches[0].clientX;
  startTime = Date.now();
});

card.addEventListener('touchmove', (e) => {
  const currentX = e.touches[0].clientX;
  const diff = currentX - startX;
  
  if (Math.abs(diff) > 10) {
    card.style.transform = `translateX(${diff}px)`;
  }
});

card.addEventListener('touchend', (e) => {
  const endX = e.changedTouches[0].clientX;
  const diff = endX - startX;
  const duration = Date.now() - startTime;
  const velocity = Math.abs(diff) / duration;
  
  if (Math.abs(diff) > SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY) {
    // Trigger action
    card.classList.add('swiped');
  } else {
    // Reset
    card.style.transform = '';
  }
});
```

**Swipe Guidelines:**
- Provide visual feedback during swipe
- Use haptic feedback on action trigger (if available)
- Allow swipe-to-dismiss for modals/sheets
- Never use swipe as the only way to access critical functions

### 5.3 Pull-to-Refresh Pattern

**Standard Implementation:**
```css
.pull-refresh-indicator {
  position: absolute;
  top: -60px;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 40px;
  opacity: 0;
  transition: opacity 200ms ease;
}

.pull-refresh-indicator--visible {
  opacity: 1;
}

.pull-refresh-indicator--loading {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: translateX(-50%) rotate(360deg); }
}
```

**Thresholds:**
- **Activation threshold:** 80-100px pull distance
- **Visual feedback starts:** 20px
- **Haptic feedback:** At activation point

### 5.4 Loading States & Skeletons

**Skeleton Screen (Reduces Perceived Load Time by 10-40%):**
```css
.skeleton {
  background: linear-gradient(
    90deg,
    #f0f0f0 0%,
    #f8f8f8 50%,
    #f0f0f0 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-card {
  padding: 16px;
  border-radius: 12px;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.skeleton-image {
  width: 100%;
  aspect-ratio: 1 / 1;
  margin-bottom: 12px;
}

.skeleton-text {
  height: 16px;
  margin-bottom: 8px;
}

.skeleton-text--short {
  width: 60%;
}
```

**When to Use:**
- Initial page load
- Infinite scroll loading
- Filter/sort operations
- Any operation >200ms

**When to Use Spinner Instead:**
- Button loading states
- Very quick operations (<200ms)
- Background updates

---

## 6. Performance & UX Optimization

### 6.1 Lazy Loading Strategies

**Intersection Observer (Modern Standard):**
```javascript
const imageObserver = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.classList.add('loaded');
        observer.unobserve(img);
      }
    });
  },
  {
    rootMargin: '50px'  // Start loading 50px before visible
  }
);

document.querySelectorAll('img[data-src]').forEach(img => {
  imageObserver.observe(img);
});
```

**HTML Implementation:**
```html
<img 
  data-src="product-image.jpg"
  src="placeholder.jpg"
  alt="Product name"
  loading="lazy"
  class="card-image"
/>
```

**Native Lazy Loading:**
```html
<!-- Modern browsers support this natively -->
<img 
  src="product-image.jpg"
  loading="lazy"
  alt="Product name"
/>
```

**Best Practices:**
- Never lazy-load above-the-fold images
- Use `loading="eager"` or `fetchpriority="high"` for LCP images
- Provide placeholder with correct aspect ratio to prevent layout shift
- Lazy load images 50-200px before they enter viewport

### 6.2 Image Optimization

**Responsive Images:**
```html
<img
  srcset="
    product-400w.jpg 400w,
    product-800w.jpg 800w,
    product-1200w.jpg 1200w
  "
  sizes="
    (max-width: 640px) 100vw,
    (max-width: 1024px) 50vw,
    33vw
  "
  src="product-800w.jpg"
  alt="Product name"
  loading="lazy"
/>
```

**Modern Formats:**
```html
<picture>
  <source type="image/avif" srcset="product.avif" />
  <source type="image/webp" srcset="product.webp" />
  <img src="product.jpg" alt="Product name" />
</picture>
```

**Optimization Targets:**
- **File size:** <100KB per image (mobile)
- **Format:** WebP or AVIF (50-80% smaller than JPEG)
- **Dimensions:** Serve appropriate size for viewport
- **Compression:** 80-85% quality for photos

### 6.3 Perceived Performance Tricks

**1. Optimistic UI Updates:**
```javascript
// Update UI immediately, sync with server in background
function placeBid(amount) {
  // Immediate UI update
  updateBidDisplay(amount);
  showSuccessMessage();
  
  // Background sync
  fetch('/api/bid', {
    method: 'POST',
    body: JSON.stringify({ amount })
  }).catch(error => {
    // Rollback on error
    revertBidDisplay();
    showErrorMessage();
  });
}
```

**2. Progressive Enhancement:**
- Load critical content first
- Defer non-essential features
- Show skeleton for below-fold content
- Prioritize above-the-fold rendering

**3. Instant Feedback:**
```css
/* Button press feedback */
.button:active {
  transform: scale(0.96);
  transition: transform 100ms ease;
}

/* Immediate visual response */
.card:active {
  opacity: 0.7;
  transition: opacity 50ms ease;
}
```

### 6.4 Micro-Interactions & Animations

**Timing Standards (Research-Backed):**
```css
/* Optimal timing ranges */
--timing-instant: 50ms;      /* Immediate feedback */
--timing-fast: 100ms;        /* Button press */
--timing-normal: 200ms;      /* Standard transitions */
--timing-slow: 300ms;        /* Complex animations */
--timing-very-slow: 500ms;   /* Page transitions */
```

**Easing Functions:**
```css
/* Material Design easing */
--ease-standard: cubic-bezier(0.4, 0.0, 0.2, 1);
--ease-decelerate: cubic-bezier(0.0, 0.0, 0.2, 1);
--ease-accelerate: cubic-bezier(0.4, 0.0, 1, 1);

/* iOS easing */
--ease-ios: cubic-bezier(0.25, 0.1, 0.25, 1);
```

**Common Micro-Interactions:**

**1. Button Press:**
```css
.button {
  transition: all 100ms var(--ease-standard);
}

.button:active {
  transform: scale(0.96);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
```

**2. Card Hover/Tap:**
```css
.card {
  transition: all 200ms var(--ease-standard);
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
}
```

**3. Favorite/Like Animation:**
```css
@keyframes heartBeat {
  0%, 100% { transform: scale(1); }
  25% { transform: scale(1.3); }
  50% { transform: scale(1.1); }
}

.favorite-button--active {
  animation: heartBeat 300ms ease;
}
```

**4. Success Feedback:**
```css
@keyframes checkmark {
  0% {
    stroke-dashoffset: 100;
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    stroke-dashoffset: 0;
  }
}

.success-icon {
  animation: checkmark 400ms ease forwards;
}
```

**Performance Guidelines:**
- Use `transform` and `opacity` for animations (GPU-accelerated)
- Avoid animating `width`, `height`, `top`, `left` (causes reflow)
- Keep animations under 300ms for responsiveness
- Respect `prefers-reduced-motion` media query

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 7. Real-World Implementation Examples

### 7.1 Complete Auction Card Component

```html
<article class="auction-card" role="article">
  <!-- Image Container -->
  <div class="auction-card__image-wrapper">
    <img 
      src="placeholder.jpg"
      data-src="product-image.jpg"
      alt="2020 Toyota Camry"
      class="auction-card__image"
      loading="lazy"
    />
    <button 
      class="auction-card__favorite"
      aria-label="Add to favorites"
    >
      <svg width="24" height="24"><!-- Heart icon --></svg>
    </button>
    <span class="auction-card__badge auction-card__badge--urgent">
      Ending Soon
    </span>
  </div>

  <!-- Content -->
  <div class="auction-card__content">
    <h3 class="auction-card__title">
      2020 Toyota Camry SE - Low Mileage
    </h3>
    
    <div class="auction-card__metadata">
      <span class="auction-card__location">
        <svg width="16" height="16"><!-- Pin icon --></svg>
        Lagos, Nigeria
      </span>
      <span class="auction-card__bids">
        <svg width="16" height="16"><!-- Gavel icon --></svg>
        12 bids
      </span>
    </div>

    <div class="auction-card__pricing">
      <div class="auction-card__current-bid">
        <span class="auction-card__label">Current Bid</span>
        <span class="auction-card__price">₦8,500,000</span>
      </div>
      <div class="auction-card__timer">
        <svg width="16" height="16"><!-- Clock icon --></svg>
        2h 34m left
      </div>
    </div>

    <button class="auction-card__cta">
      Place Bid
    </button>
  </div>
</article>
```

```css
.auction-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.auction-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.auction-card__image-wrapper {
  position: relative;
  aspect-ratio: 1 / 1;
  overflow: hidden;
}

.auction-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.auction-card__favorite {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border: none;
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 200ms ease;
}

.auction-card__favorite:active {
  transform: scale(0.9);
}

.auction-card__badge {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.auction-card__badge--urgent {
  background: #d32f2f;
  color: white;
}

.auction-card__content {
  padding: 16px;
}

.auction-card__title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
  color: #1a1a1a;
  margin: 0 0 8px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.auction-card__metadata {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #666;
}

.auction-card__metadata span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.auction-card__pricing {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 16px;
}

.auction-card__current-bid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.auction-card__label {
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.auction-card__price {
  font-size: 20px;
  font-weight: 700;
  color: #d32f2f;
}

.auction-card__timer {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 500;
  color: #d32f2f;
}

.auction-card__cta {
  width: 100%;
  padding: 12px;
  background: #1976d2;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms ease;
}

.auction-card__cta:hover {
  background: #1565c0;
}

.auction-card__cta:active {
  transform: scale(0.98);
}
```

### 7.2 Responsive Grid Layout

```css
.auction-grid {
  display: grid;
  gap: 16px;
  padding: 16px;
}

/* Mobile: Single column for <20 products, 2-column for larger */
@media (max-width: 640px) {
  .auction-grid--single {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  
  .auction-grid--double {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Tablet: 2-3 columns */
@media (min-width: 641px) and (max-width: 1024px) {
  .auction-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    padding: 20px;
  }
}

/* Desktop: 3-4 columns */
@media (min-width: 1025px) {
  .auction-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
    padding: 24px;
    max-width: 1440px;
    margin: 0 auto;
  }
}
```

---

## 8. Accessibility Checklist

### Essential Requirements (WCAG 2.2 Level AA)

- [ ] **Touch targets:** Minimum 48×48px for all interactive elements
- [ ] **Color contrast:** 4.5:1 for normal text, 3:1 for large text
- [ ] **Focus indicators:** Visible outline on all focusable elements
- [ ] **Alt text:** Descriptive alternative text for all images
- [ ] **Semantic HTML:** Proper heading hierarchy, landmarks
- [ ] **Keyboard navigation:** All functions accessible via keyboard
- [ ] **Screen reader support:** ARIA labels where needed
- [ ] **Reduced motion:** Respect `prefers-reduced-motion`
- [ ] **Form labels:** All inputs have associated labels
- [ ] **Error messages:** Clear, descriptive error feedback

### Testing Tools

- **Contrast:** [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- **Screen readers:** VoiceOver (iOS), TalkBack (Android)
- **Automated testing:** axe DevTools, Lighthouse
- **Manual testing:** Keyboard-only navigation

---

## 9. Key Takeaways & Quick Reference

### Layout Decision Tree

```
Product Catalog Size?
├─ <20 products → Single Column
│  └─ Benefits: Focus, larger images, premium feel
└─ >20 products → 2-Column Grid
   └─ Benefits: Faster browsing, comparison, efficiency
```

### Critical Specifications

| Element | Specification | Standard |
|---------|--------------|----------|
| Touch Target | 48×48px | WCAG 2.2 AA |
| Card Border Radius | 12px | Material Design 3 |
| Grid Gutter | 16px | Material Design 3 |
| Screen Margins | 16px | Material Design 3 |
| Image Aspect Ratio | 1:1 or 4:5 | Mobile-first 2026 |
| Animation Duration | 100-300ms | UX Research |
| Font Size (Min) | 14px body, 13px metadata | Accessibility |
| Color Contrast | 4.5:1 minimum | WCAG 2.2 AA |

### Performance Targets

- **First Contentful Paint:** <1.8s
- **Largest Contentful Paint:** <2.5s
- **Time to Interactive:** <3.8s
- **Cumulative Layout Shift:** <0.1
- **Image Size:** <100KB per image (mobile)

### Color Palette (Auction/Urgency)

```css
/* Copy-paste ready */
:root {
  --urgent-red: #d32f2f;
  --urgent-orange: #f57c00;
  --trust-blue: #1976d2;
  --success-green: #388e3c;
  --warning-amber: #f9a825;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --border-color: #e0e0e0;
  --background: #ffffff;
}
```

---

## 10. Sources & Further Reading

### Design Systems
- [Material Design 3](https://m3.material.io/) - Google's latest design system
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/) - iOS design standards
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/) - Accessibility standards

### Research & Articles
- Nielsen Norman Group - Bottom Sheets UX Guidelines
- Baymard Institute - E-commerce UX Research
- Web.dev - Performance Best Practices
- Mobile Commerce Trends 2025-2026

### Real-World Examples
- **Airbnb:** Visual-first listing cards with clear hierarchy
- **eBay:** Auction-specific UI patterns and urgency indicators
- **StockX:** Marketplace bidding interfaces
- **Zillow:** Real estate listing cards
- **Vinted:** Second-hand marketplace patterns

---

**Document Version:** 1.0  
**Last Updated:** January 2026  
**Maintained by:** Research Team

*Content rephrased for compliance with licensing restrictions. All specifications derived from publicly available design guidelines and UX research.*
